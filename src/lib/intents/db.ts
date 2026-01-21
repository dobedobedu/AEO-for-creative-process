/**
 * Database helpers for intent library.
 * Handles schema initialization and provides type-safe query helpers.
 * Supports atomic transactions and user attribution.
 */

import { sql, getSql } from "@/lib/db";
import type { Intent, IntentChange, IntentHistoryEntry, Persona, Stage } from "./types";

// Database row types
interface IntentRow {
  id: string;
  persona: string;
  stage: string;
  text: string;
  default_queries: string[] | null;
  role: string;
  query_style: number;
  generated_queries: string[] | null;
  active: boolean;
  created_at: Date;
  created_by: string | null;
  updated_by: string | null;
  updated_at: Date | null;
}

interface MetaRow {
  version: number;
  updated_at: Date;
}

interface HistoryRow {
  id: number;
  version: number;
  date: Date;
  changes: IntentChange[];
  created_at: Date;
  actor_user_id: string | null;
}

// Schema initialization flag
let schemaInitialized = false;

/**
 * Ensures intent tables exist in the database.
 * Safe to call multiple times - only initializes once per process.
 */
export async function ensureIntentSchema(): Promise<void> {
  if (schemaInitialized) return;

  // Create tables if they don't exist
  await sql`
    CREATE TABLE IF NOT EXISTS intent_library_meta (
      id INT PRIMARY KEY DEFAULT 1,
      version INT NOT NULL DEFAULT 0,
      updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    );
  `;

  await sql`
    INSERT INTO intent_library_meta (id, version, updated_at)
    VALUES (1, 0, NOW())
    ON CONFLICT (id) DO NOTHING;
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS intents (
      id TEXT PRIMARY KEY,
      persona TEXT NOT NULL,
      stage TEXT NOT NULL,
      text TEXT NOT NULL,
      default_queries JSONB,
      role TEXT DEFAULT 'cpo',
      query_style FLOAT DEFAULT 0.75,
      generated_queries JSONB,
      active BOOLEAN DEFAULT true,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      created_by UUID NULL,
      updated_by UUID NULL,
      updated_at TIMESTAMP WITH TIME ZONE NULL
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS intent_history (
      id SERIAL PRIMARY KEY,
      version INT NOT NULL,
      date DATE NOT NULL,
      changes JSONB NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      actor_user_id UUID NULL
    );
  `;

  // Create indexes (IF NOT EXISTS is implicit for CREATE INDEX)
  try {
    await sql`CREATE INDEX IF NOT EXISTS idx_intents_persona_stage ON intents(persona, stage);`;
    await sql`CREATE INDEX IF NOT EXISTS idx_intents_active ON intents(active);`;
    await sql`CREATE INDEX IF NOT EXISTS idx_intent_history_version ON intent_history(version);`;
  } catch {
    // Indexes may already exist
  }

  schemaInitialized = true;
}

/**
 * Fetches the current library metadata (version and updatedAt).
 */
export async function fetchLibraryMeta(): Promise<{ version: number; updatedAt: string }> {
  await ensureIntentSchema();

  const rows = await sql`
    SELECT version, updated_at FROM intent_library_meta WHERE id = 1;
  ` as MetaRow[];

  if (rows.length === 0) {
    return { version: 1, updatedAt: new Date().toISOString() };
  }

  return {
    version: rows[0].version,
    updatedAt: rows[0].updated_at.toISOString(),
  };
}

/**
 * Increments the library version and updates timestamp.
 * Returns the new version number.
 */
export async function incrementVersion(): Promise<number> {
  await ensureIntentSchema();

  const rows = await sql`
    UPDATE intent_library_meta
    SET version = version + 1, updated_at = NOW()
    WHERE id = 1
    RETURNING version;
  ` as MetaRow[];

  return rows[0].version;
}

/**
 * Sets the library version to a specific value (used during migration).
 */
export async function setVersion(version: number): Promise<void> {
  await ensureIntentSchema();

  await sql`
    UPDATE intent_library_meta
    SET version = ${version}, updated_at = NOW()
    WHERE id = 1;
  `;
}

/**
 * Fetches all intents from the database.
 */
export async function fetchAllIntents(): Promise<Intent[]> {
  await ensureIntentSchema();

  const rows = await sql`
    SELECT * FROM intents ORDER BY created_at ASC;
  ` as IntentRow[];

  return rows.map(rowToIntent);
}

/**
 * Fetches active intents for a specific persona and stage.
 */
export async function fetchIntentsForCell(persona: Persona, stage: Stage): Promise<Intent[]> {
  await ensureIntentSchema();

  const rows = await sql`
    SELECT * FROM intents
    WHERE persona = ${persona} AND stage = ${stage} AND active = true
    ORDER BY created_at DESC;
  ` as IntentRow[];

  return rows.map(rowToIntent);
}

/**
 * Fetches a single intent by ID.
 */
export async function fetchIntentById(intentId: string): Promise<Intent | null> {
  await ensureIntentSchema();

  const rows = await sql`
    SELECT * FROM intents WHERE id = ${intentId} LIMIT 1;
  ` as IntentRow[];

  if (rows.length === 0) return null;
  return rowToIntent(rows[0]);
}

/**
 * Inserts a new intent into the database.
 * @param intent The intent to insert
 * @param createdBy Optional user ID who created the intent
 */
export async function insertIntent(intent: Intent, createdBy?: string): Promise<void> {
  await ensureIntentSchema();

  await sql`
    INSERT INTO intents (id, persona, stage, text, default_queries, role, query_style, generated_queries, active, created_at, created_by, updated_by)
    VALUES (
      ${intent.id},
      ${intent.persona},
      ${intent.stage},
      ${intent.text},
      ${intent.defaultQueries ? sql.json(intent.defaultQueries) : null},
      ${intent.role},
      ${intent.queryStyle},
      ${intent.generatedQueries ? sql.json(intent.generatedQueries) : null},
      ${intent.active},
      ${intent.createdAt}::timestamptz,
      ${createdBy ?? null},
      ${createdBy ?? null}
    );
  `;
}

/**
 * Updates an existing intent in the database.
 * @param intentId The ID of the intent to update
 * @param updates The fields to update
 * @param updatedBy Optional user ID who made the update
 */
export async function updateIntentInDb(
  intentId: string,
  updates: Partial<Pick<Intent, "text" | "role" | "queryStyle" | "generatedQueries" | "active">>,
  updatedBy?: string
): Promise<void> {
  await ensureIntentSchema();

  // Build dynamic update - only update provided fields
  // Also update updated_by if provided
  if (updates.text !== undefined) {
    await sql`UPDATE intents SET text = ${updates.text}, updated_by = ${updatedBy ?? null} WHERE id = ${intentId};`;
  }
  if (updates.role !== undefined) {
    await sql`UPDATE intents SET role = ${updates.role}, updated_by = ${updatedBy ?? null} WHERE id = ${intentId};`;
  }
  if (updates.queryStyle !== undefined) {
    await sql`UPDATE intents SET query_style = ${updates.queryStyle}, updated_by = ${updatedBy ?? null} WHERE id = ${intentId};`;
  }
  if (updates.generatedQueries !== undefined) {
    await sql`UPDATE intents SET generated_queries = ${sql.json(updates.generatedQueries)}, updated_by = ${updatedBy ?? null} WHERE id = ${intentId};`;
  }
  if (updates.active !== undefined) {
    await sql`UPDATE intents SET active = ${updates.active}, updated_by = ${updatedBy ?? null} WHERE id = ${intentId};`;
  }
}

/**
 * Fetches all history entries.
 */
export async function fetchHistory(): Promise<IntentHistoryEntry[]> {
  await ensureIntentSchema();

  const rows = await sql`
    SELECT * FROM intent_history ORDER BY version ASC;
  ` as HistoryRow[];

  return rows.map((row) => {
    // Handle double-encoded JSON for changes field
    let changes: IntentChange[] = [];
    if (row.changes) {
      if (Array.isArray(row.changes)) {
        changes = row.changes;
      } else if (typeof row.changes === "string") {
        try {
          const parsed = JSON.parse(row.changes);
          changes = Array.isArray(parsed) ? parsed : [];
        } catch {
          changes = [];
        }
      }
    }

    return {
      version: row.version,
      // postgres.js may return DATE as string (YYYY-MM-DD) or Date object
      date: typeof row.date === "string"
        ? row.date
        : row.date.toISOString().split("T")[0],
      changes,
    };
  });
}

/**
 * Inserts a history entry.
 * @param entry The history entry to insert
 * @param actorUserId Optional user ID who made the change
 */
export async function insertHistoryEntry(entry: IntentHistoryEntry, actorUserId?: string): Promise<void> {
  await ensureIntentSchema();

  await sql`
    INSERT INTO intent_history (version, date, changes, actor_user_id)
    VALUES (${entry.version}, ${entry.date}::date, ${sql.json(entry.changes)}, ${actorUserId ?? null});
  `;
}

/**
 * Bulk insert intents (used during migration).
 */
export async function bulkInsertIntents(intents: Intent[]): Promise<void> {
  await ensureIntentSchema();

  for (const intent of intents) {
    await insertIntent(intent);
  }
}

/**
 * Bulk insert history entries (used during migration).
 */
export async function bulkInsertHistory(entries: IntentHistoryEntry[]): Promise<void> {
  await ensureIntentSchema();

  for (const entry of entries) {
    await insertHistoryEntry(entry);
  }
}

/**
 * Converts a database row to an Intent object.
 */
function rowToIntent(row: IntentRow): Intent {
  // Helper to handle double-encoded JSON (string instead of array)
  const parseJsonArray = (val: string[] | string | null): string[] | undefined => {
    if (val === null || val === undefined) return undefined;
    if (Array.isArray(val)) return val;
    if (typeof val === "string") {
      try {
        const parsed = JSON.parse(val);
        return Array.isArray(parsed) ? parsed : undefined;
      } catch {
        return undefined;
      }
    }
    return undefined;
  };

  return {
    id: row.id,
    persona: row.persona as Persona,
    stage: row.stage as Stage,
    text: row.text,
    defaultQueries: parseJsonArray(row.default_queries as string[] | string | null),
    role: row.role as "cpo" | "family_unit",
    queryStyle: row.query_style,
    generatedQueries: parseJsonArray(row.generated_queries as string[] | string | null),
    createdAt: row.created_at.toISOString(),
    active: row.active,
  };
}

// ============================================
// Atomic Transaction Helpers
// ============================================

/**
 * Atomically creates an intent with version increment and history in a single transaction.
 * Prevents race conditions when multiple users create intents simultaneously.
 */
export async function atomicCreateIntent(
  intent: Intent,
  change: IntentChange,
  actorUserId?: string
): Promise<number> {
  await ensureIntentSchema();
  const client = getSql();

  let newVersion = 0;

  await client.begin(async (tx) => {
    // Insert the intent
    await tx`
      INSERT INTO intents (id, persona, stage, text, default_queries, role, query_style, generated_queries, active, created_at, created_by, updated_by)
      VALUES (
        ${intent.id},
        ${intent.persona},
        ${intent.stage},
        ${intent.text},
        ${intent.defaultQueries ? tx.json(intent.defaultQueries) : null},
        ${intent.role},
        ${intent.queryStyle},
        ${intent.generatedQueries ? tx.json(intent.generatedQueries) : null},
        ${intent.active},
        ${intent.createdAt}::timestamptz,
        ${actorUserId ?? null},
        ${actorUserId ?? null}
      );
    `;

    // Increment version atomically
    const versionRows = await tx`
      UPDATE intent_library_meta
      SET version = version + 1, updated_at = NOW()
      WHERE id = 1
      RETURNING version;
    `;
    newVersion = versionRows[0].version;

    // Insert history entry
    const now = new Date();
    const changesJson = JSON.stringify([change]);
    await tx`
      INSERT INTO intent_history (version, date, changes, actor_user_id)
      VALUES (${newVersion}, ${now.toISOString().split("T")[0]}::date, ${changesJson}::jsonb, ${actorUserId ?? null});
    `;
  });

  return newVersion;
}

/**
 * Atomically updates an intent with version increment and history in a single transaction.
 * Prevents race conditions when multiple users update intents simultaneously.
 */
export async function atomicUpdateIntent(
  intentId: string,
  updates: Partial<Pick<Intent, "text" | "role" | "queryStyle" | "generatedQueries" | "active">>,
  changes: IntentChange[],
  actorUserId?: string
): Promise<number> {
  await ensureIntentSchema();
  const client = getSql();

  let newVersion = 0;

  await client.begin(async (tx) => {
    // Update the intent fields
    if (updates.text !== undefined) {
      await tx`UPDATE intents SET text = ${updates.text}, updated_by = ${actorUserId ?? null} WHERE id = ${intentId};`;
    }
    if (updates.role !== undefined) {
      await tx`UPDATE intents SET role = ${updates.role}, updated_by = ${actorUserId ?? null} WHERE id = ${intentId};`;
    }
    if (updates.queryStyle !== undefined) {
      await tx`UPDATE intents SET query_style = ${updates.queryStyle}, updated_by = ${actorUserId ?? null} WHERE id = ${intentId};`;
    }
    if (updates.generatedQueries !== undefined) {
      await tx`UPDATE intents SET generated_queries = ${tx.json(updates.generatedQueries)}, updated_by = ${actorUserId ?? null} WHERE id = ${intentId};`;
    }
    if (updates.active !== undefined) {
      await tx`UPDATE intents SET active = ${updates.active}, updated_by = ${actorUserId ?? null} WHERE id = ${intentId};`;
    }

    // Increment version atomically
    const versionRows = await tx`
      UPDATE intent_library_meta
      SET version = version + 1, updated_at = NOW()
      WHERE id = 1
      RETURNING version;
    `;
    newVersion = versionRows[0].version;

    // Insert history entry
    const now = new Date();
    const changesJson = JSON.stringify(changes);
    await tx`
      INSERT INTO intent_history (version, date, changes, actor_user_id)
      VALUES (${newVersion}, ${now.toISOString().split("T")[0]}::date, ${changesJson}::jsonb, ${actorUserId ?? null});
    `;
  });

  return newVersion;
}
