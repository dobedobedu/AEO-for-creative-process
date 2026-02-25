import postgres from "postgres";

function getArg(name: string): string | undefined {
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === name) return argv[i + 1];
  }
  return undefined;
}

function hasFlag(flag: string): boolean {
  return process.argv.slice(2).includes(flag);
}

function needsSsl(connectionString: string): boolean {
  return !/localhost|127\.0\.0\.1/.test(connectionString);
}

async function reset(databaseUrl: string): Promise<void> {
  const sql = postgres(databaseUrl, {
    ssl: needsSsl(databaseUrl) ? "require" : undefined,
    max: 1,
  });

  try {
    await sql.begin(async (tx) => {
      // 1) Clear operational/benchmark data.
      await tx`DELETE FROM batch_jobs`;
      await tx`DELETE FROM run_progress`;
      await tx`DELETE FROM runs`;
      await tx`DELETE FROM intent_history`;
      await tx`DELETE FROM intents`;
      await tx`DELETE FROM app_users`;
      await tx`DELETE FROM tenant_prompts`;

      // 2) Reset intent library metadata.
      await tx`
        INSERT INTO intent_library_meta (id, version, updated_at)
        VALUES (1, 0, NOW())
        ON CONFLICT (id) DO UPDATE SET
          version = 0,
          updated_at = NOW()
      `;

      // 3) Reset matrix config to neutral defaults.
      await tx`DELETE FROM matrix_config_versions`;
      await tx`DELETE FROM matrix_personas`;
      await tx`DELETE FROM matrix_stages`;

      await tx`
        INSERT INTO matrix_personas (persona_id, label, description, full_text, order_index, active)
        VALUES
          ('persona_1', 'Persona 1', 'Primary persona', 'Primary persona', 0, true),
          ('persona_2', 'Persona 2', 'Secondary persona', 'Secondary persona', 1, true)
      `;

      await tx`
        INSERT INTO matrix_stages (stage_id, label, description, order_index, active, core_stage, core_stage_mapping, primary_metric)
        VALUES
          ('explore', 'Explore', 'Starting research', 0, true, true, 'explore', 'discovery_rate'),
          ('consider', 'Consider', 'Evaluating options', 1, true, true, 'consider', 'mention_rate'),
          ('compare', 'Compare', 'Narrowing choices', 2, true, true, 'compare', 'win_rate'),
          ('decide', 'Decide', 'Ready to decide', 3, true, true, 'decide', 'recommendation_rate')
      `;

      await tx`
        INSERT INTO matrix_config_versions (version, status, personas_json, stages_json, published_at)
        VALUES (
          1,
          'published',
          ${tx.json([
            { id: "persona_1", label: "Persona 1", description: "Primary persona", fullText: "Primary persona", orderIndex: 0, active: true },
            { id: "persona_2", label: "Persona 2", description: "Secondary persona", fullText: "Secondary persona", orderIndex: 1, active: true },
          ])},
          ${tx.json([
            { id: "explore", label: "Explore", description: "Starting research", orderIndex: 0, active: true, coreStage: true, coreStageMapping: "explore", primaryMetric: "discovery_rate" },
            { id: "consider", label: "Consider", description: "Evaluating options", orderIndex: 1, active: true, coreStage: true, coreStageMapping: "consider", primaryMetric: "mention_rate" },
            { id: "compare", label: "Compare", description: "Narrowing choices", orderIndex: 2, active: true, coreStage: true, coreStageMapping: "compare", primaryMetric: "win_rate" },
            { id: "decide", label: "Decide", description: "Ready to decide", orderIndex: 3, active: true, coreStage: true, coreStageMapping: "decide", primaryMetric: "recommendation_rate" },
          ])},
          NOW()
        )
      `;

      // 4) Clear custom entity dictionary.
      await tx`DELETE FROM matrix_entity_terms`;
      await tx`DELETE FROM matrix_entity_categories`;

      // 5) Reset tenant config and onboarding gate.
      await tx`
        INSERT INTO tenant_config (
          id,
          brand_json,
          competitors_json,
          geography_json,
          entity_categories_json,
          providers_json,
          industry,
          setup_complete,
          updated_by
        )
        VALUES (
          'default',
          ${tx.json({ name: "My Brand", aliases: [], highlightColor: "#dcf3dc" })},
          ${tx.json([])},
          null,
          ${tx.json([])},
          ${tx.json({})},
          'other',
          false,
          null
        )
        ON CONFLICT (id) DO UPDATE SET
          brand_json = EXCLUDED.brand_json,
          competitors_json = EXCLUDED.competitors_json,
          geography_json = EXCLUDED.geography_json,
          entity_categories_json = EXCLUDED.entity_categories_json,
          providers_json = EXCLUDED.providers_json,
          industry = EXCLUDED.industry,
          setup_complete = EXCLUDED.setup_complete,
          updated_by = EXCLUDED.updated_by
      `;

      await tx`
        UPDATE tenant_configs
        SET
          tenant_name = 'Default Tenant',
          industry = 'other',
          config_json = '{}'::jsonb,
          updated_at = NOW()
        WHERE tenant_slug = 'default'
      `;
    });
  } finally {
    await sql.end();
  }
}

async function run(): Promise<number> {
  const databaseUrl = getArg("--database-url") ?? process.env.DATABASE_URL;
  const confirmed = hasFlag("--yes");

  if (!databaseUrl) {
    console.error("[reset:blank-slate] DATABASE_URL is not set. Pass --database-url or set env.");
    return 2;
  }

  if (!confirmed) {
    console.error("[reset:blank-slate] Refusing to run without --yes.");
    console.error("[reset:blank-slate] This command deletes benchmark, intent, and onboarding data.");
    return 2;
  }

  await reset(databaseUrl);
  console.log("[reset:blank-slate] Done. App is reset and setup wizard is re-enabled.");
  return 0;
}

run()
  .then((code) => process.exit(code))
  .catch((err) => {
    console.error(`[reset:blank-slate] fatal: ${(err as Error).message}`);
    process.exit(1);
  });

