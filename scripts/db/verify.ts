import postgres from "postgres";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TableDef {
  name: string;
  requiredColumns: string[];
}

interface TriggerDef {
  name: string;
  table: string;
}

interface RequiredRowDef {
  table: string;
  condition: string;
  description: string;
}

interface SchemaManifest {
  tables: TableDef[];
  triggers: TriggerDef[];
  functions: string[];
  requiredRows: RequiredRowDef[];
}

interface VerifyResult {
  ok: boolean;
  errors: string[];
}

// ---------------------------------------------------------------------------
// Schema Manifest — derived from canonical migrations 000000–000015
// ---------------------------------------------------------------------------

const SCHEMA_MANIFEST: SchemaManifest = {
  tables: [
    // 000000 — core schema
    { name: "runs", requiredColumns: ["id", "status", "config_json", "created_at"] },
    { name: "personas", requiredColumns: ["id", "run_id", "text"] },
    { name: "triggers", requiredColumns: ["id", "run_id", "stage", "label"] },
    { name: "queries", requiredColumns: ["id", "run_id", "persona_id", "query_text"] },
    { name: "responses", requiredColumns: ["id", "run_id", "query_id", "provider", "model"] },
    { name: "web_search_calls", requiredColumns: ["id", "response_id"] },
    { name: "citations", requiredColumns: ["id", "response_id", "provider"] },
    { name: "insights", requiredColumns: ["id", "run_id"] },
    { name: "analyses", requiredColumns: ["id", "run_id", "variant_key", "model", "analysis_kind", "analysis_json"] },

    // 000001 — intents schema
    { name: "intent_library_meta", requiredColumns: ["id", "version", "updated_at"] },
    { name: "intents", requiredColumns: ["id", "persona", "stage", "text", "tenant_id", "created_by", "updated_by"] },
    { name: "intent_history", requiredColumns: ["id", "version", "date", "changes", "actor_user_id"] },
    { name: "run_progress", requiredColumns: ["run_id", "status", "total_steps", "completed_steps"] },

    // 000003 — user activity
    { name: "app_users", requiredColumns: ["user_id", "last_active_at"] },

    // 000004 — matrix config
    { name: "matrix_personas", requiredColumns: ["id", "persona_id", "label", "order_index", "active"] },
    { name: "matrix_stages", requiredColumns: ["id", "stage_id", "label", "order_index", "active", "core_stage_mapping"] },
    { name: "matrix_config_versions", requiredColumns: ["id", "version", "status", "personas_json", "stages_json"] },

    // 000005 — optimization tables
    { name: "run_metrics", requiredColumns: ["id", "run_id", "persona"] },
    { name: "run_citations", requiredColumns: ["id", "run_id", "provider", "domain"] },
    { name: "run_summary", requiredColumns: ["run_id", "brand"] },

    // 000007 — entity tables
    { name: "matrix_entity_categories", requiredColumns: ["id", "label"] },
    { name: "matrix_entity_terms", requiredColumns: ["id", "category_id", "canonical_name"] },
    { name: "run_entity_mentions", requiredColumns: ["id", "run_id", "provider", "raw_mention"] },
    { name: "run_entity_summary", requiredColumns: ["run_id", "entity_term_id", "category_id"] },

    // 000008 — batch jobs
    { name: "batch_jobs", requiredColumns: ["id", "run_id", "provider", "batch_id", "status"] },

    // 000010 — app settings
    { name: "app_settings", requiredColumns: ["key", "value"] },

    // 000011 — tenant config
    { name: "tenant_config", requiredColumns: ["id", "brand_json", "competitors_json", "providers_json", "industry", "setup_complete"] },

    // 000012 — multi-tenant
    { name: "tenant_configs", requiredColumns: ["id", "tenant_slug", "tenant_name", "config_json"] },

    // 000013 — prompt versioning
    { name: "tenant_prompts", requiredColumns: ["id", "tenant_id", "prompt_type", "prompt_name", "prompt_content", "version"] },
  ],

  triggers: [
    { name: "update_tenant_config_updated_at", table: "tenant_config" },
    { name: "update_intents_updated_at", table: "intents" },
    { name: "update_matrix_personas_updated_at", table: "matrix_personas" },
    { name: "update_matrix_stages_updated_at", table: "matrix_stages" },
  ],

  functions: [
    "update_updated_at_column",
    "cleanup_old_progress",
    "get_active_matrix_config",
    "refresh_run_metadata_mv",
    "get_entity_status",
  ],

  requiredRows: [
    { table: "tenant_config", condition: "id = 'default'", description: "Default tenant config row" },
  ],
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getArg(name: string): string | undefined {
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === name) {
      return argv[i + 1];
    }
  }
  return undefined;
}

function needsSsl(connectionString: string): boolean {
  return !/localhost|127\.0\.0\.1/.test(connectionString);
}

// ---------------------------------------------------------------------------
// Verification
// ---------------------------------------------------------------------------

async function verify(databaseUrl: string): Promise<VerifyResult> {
  const errors: string[] = [];
  const sql = postgres(databaseUrl, {
    ssl: needsSsl(databaseUrl) ? "require" : undefined,
    max: 1,
  });

  try {
    // ---- 1. Check required tables ----
    const existingTables = await sql`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_type = 'BASE TABLE'
    `;
    const tableSet = new Set(existingTables.map((r) => r.table_name as string));

    for (const table of SCHEMA_MANIFEST.tables) {
      if (!tableSet.has(table.name)) {
        errors.push(`Missing required table: public.${table.name}`);
      }
    }

    // ---- 2. Check required columns on existing tables ----
    const existingColumns = await sql`
      SELECT table_name, column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
    `;
    const columnMap = new Map<string, Set<string>>();
    for (const row of existingColumns) {
      const tbl = row.table_name as string;
      if (!columnMap.has(tbl)) columnMap.set(tbl, new Set());
      columnMap.get(tbl)!.add(row.column_name as string);
    }

    for (const table of SCHEMA_MANIFEST.tables) {
      if (!tableSet.has(table.name)) continue; // already reported as missing
      const cols = columnMap.get(table.name) ?? new Set();
      for (const col of table.requiredColumns) {
        if (!cols.has(col)) {
          errors.push(`Missing required column: ${table.name}.${col}`);
        }
      }
    }

    // ---- 3. Check required triggers ----
    const existingTriggers = await sql`
      SELECT trigger_name, event_object_table
      FROM information_schema.triggers
      WHERE event_object_schema = 'public'
    `;
    const triggerSet = new Set(
      existingTriggers.map((r) => `${r.trigger_name}@${r.event_object_table}`)
    );

    for (const trigger of SCHEMA_MANIFEST.triggers) {
      if (!triggerSet.has(`${trigger.name}@${trigger.table}`)) {
        errors.push(`Missing required trigger: ${trigger.name} on ${trigger.table}`);
      }
    }

    // ---- 4. Check required functions ----
    const existingFunctions = await sql`
      SELECT routine_name
      FROM information_schema.routines
      WHERE specific_schema = 'public'
    `;
    const functionSet = new Set(existingFunctions.map((r) => r.routine_name as string));

    for (const fn of SCHEMA_MANIFEST.functions) {
      if (!functionSet.has(fn)) {
        errors.push(`Missing required function: ${fn}`);
      }
    }

    // ---- 5. Check required rows ----
    for (const req of SCHEMA_MANIFEST.requiredRows) {
      if (!tableSet.has(req.table)) continue; // table already reported missing
      const rows = await sql.unsafe(
        `SELECT 1 FROM ${req.table} WHERE ${req.condition} LIMIT 1`
      );
      if (rows.length === 0) {
        errors.push(`Missing required row: ${req.description} (${req.table} WHERE ${req.condition})`);
      }
    }
  } catch (err) {
    errors.push(`Database verification failed: ${(err as Error).message}`);
  } finally {
    await sql.end();
  }

  return { ok: errors.length === 0, errors };
}

// ---------------------------------------------------------------------------
// CLI entry point
// ---------------------------------------------------------------------------

async function run(): Promise<number> {
  const databaseUrl = getArg("--database-url") ?? process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("[db:verify] DATABASE_URL is not set. Pass --database-url or set env.");
    return 2;
  }

  const result = await verify(databaseUrl);
  if (!result.ok) {
    for (const error of result.errors) {
      console.error(`[db:verify] error: ${error}`);
    }
    return 1;
  }

  console.log("[db:verify] OK — all tables, columns, triggers, functions, and required rows verified.");
  return 0;
}

run()
  .then((code) => process.exit(code))
  .catch((err) => {
    console.error(`[db:verify] fatal: ${(err as Error).message}`);
    process.exit(1);
  });

// Export for testing
export { SCHEMA_MANIFEST, verify, type SchemaManifest, type VerifyResult };
