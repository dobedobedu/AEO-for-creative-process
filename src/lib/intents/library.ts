/**
 * Intent Library - Database-backed implementation
 *
 * Provides CRUD operations for the intent library stored in Postgres.
 * All changes are persisted immediately for multi-user sync.
 */

import {
  IntentLibrary,
  IntentLibrarySchema,
  Intent,
  IntentSchema,
  IntentChange,
  Persona,
  Stage,
  generateIntentId,
} from "./types";
import {
  fetchLibraryMeta,
  fetchAllIntents,
  fetchIntentsForCell,
  fetchIntentById,
  fetchHistory,
  atomicCreateIntent,
  atomicUpdateIntent,
} from "./db";

/** Shallow equality check for string arrays (order-sensitive). */
function arraysEqual(a: string[] | undefined, b: string[] | undefined): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

/**
 * Loads the entire intent library from the database.
 */
export async function loadIntentLibrary(): Promise<IntentLibrary> {
  const [meta, intents, history] = await Promise.all([
    fetchLibraryMeta(),
    fetchAllIntents(),
    fetchHistory(),
  ]);

  const library: IntentLibrary = {
    version: meta.version,
    updatedAt: meta.updatedAt,
    intents,
    history,
  };

  const result = IntentLibrarySchema.safeParse(library);
  if (!result.success) {
    console.error("[loadIntentLibrary] Zod validation failed:", JSON.stringify(result.error.issues, null, 2));
    throw result.error;
  }
  return result.data;
}

/**
 * Gets active intents for a specific persona/stage cell.
 */
export async function getIntentsForCell(
  persona: Persona,
  stage: Stage
): Promise<Intent[]> {
  return fetchIntentsForCell(persona, stage);
}

/**
 * Gets an intent by ID.
 */
export async function getIntentById(intentId: string): Promise<Intent | null> {
  return fetchIntentById(intentId);
}

/**
 * Creates a new intent and persists it to the database atomically.
 * Returns the updated library state.
 * @param input The intent data (without id, createdAt, active)
 * @param actorUserId Optional user ID who created the intent
 */
export async function createIntent(
  input: Omit<Intent, "id" | "createdAt" | "active">,
  actorUserId?: string
): Promise<IntentLibrary> {
  const validated = IntentSchema.omit({ id: true, createdAt: true, active: true }).parse(input);

  const newIntent: Intent = {
    ...validated,
    id: generateIntentId(validated.persona, validated.stage),
    createdAt: new Date().toISOString(),
    active: true,
  };

  const change: IntentChange = {
    action: "created",
    intentId: newIntent.id,
  };

  // Atomically insert intent, increment version, and record history
  await atomicCreateIntent(newIntent, change, actorUserId);

  // Return updated library
  return loadIntentLibrary();
}

/**
 * Updates an existing intent and persists changes to the database atomically.
 * Returns the updated library state.
 * @param intentId The ID of the intent to update
 * @param updates The fields to update
 * @param actorUserId Optional user ID who made the update
 */
export async function updateIntent(
  intentId: string,
  updates: Partial<Pick<Intent, "text" | "role" | "queryStyle" | "generatedQueries" | "generatedQueriesAt">>,
  actorUserId?: string
): Promise<IntentLibrary> {
  const existing = await fetchIntentById(intentId);
  if (!existing) {
    throw new Error(`Intent not found: ${intentId}`);
  }

  const changes: IntentChange[] = [];

  if (updates.text !== undefined && updates.text !== existing.text) {
    changes.push({
      action: "modified",
      intentId,
      field: "text",
      oldValue: existing.text,
      newValue: updates.text,
    });
  }

  if (updates.role !== undefined && updates.role !== existing.role) {
    changes.push({
      action: "modified",
      intentId,
      field: "role",
      oldValue: existing.role,
      newValue: updates.role,
    });
  }

  if (updates.queryStyle !== undefined && updates.queryStyle !== existing.queryStyle) {
    changes.push({
      action: "modified",
      intentId,
      field: "queryStyle",
      oldValue: existing.queryStyle,
      newValue: updates.queryStyle,
    });
  }

  if (updates.generatedQueries !== undefined && !arraysEqual(updates.generatedQueries, existing.generatedQueries)) {
    changes.push({
      action: "modified",
      intentId,
      field: "generatedQueries",
      oldValue: existing.generatedQueries,
      newValue: updates.generatedQueries,
    });
  }

  // generatedQueriesAt is meta; update without history entry

  // No changes to persist (but still might have generatedQueriesAt)
  if (changes.length === 0 && updates.generatedQueriesAt === undefined) {
    return loadIntentLibrary();
  }

  // Atomically update the intent, increment version, and record history
  await atomicUpdateIntent(intentId, updates, changes, actorUserId);

  return loadIntentLibrary();
}

/**
 * Deactivates an intent (soft delete) atomically.
 * Returns the updated library state.
 * @param intentId The ID of the intent to deactivate
 * @param actorUserId Optional user ID who made the change
 */
export async function deactivateIntent(intentId: string, actorUserId?: string): Promise<IntentLibrary> {
  const existing = await fetchIntentById(intentId);
  if (!existing) {
    throw new Error(`Intent not found: ${intentId}`);
  }

  if (!existing.active) {
    return loadIntentLibrary();
  }

  const change: IntentChange = {
    action: "deactivated",
    intentId,
  };

  // Atomically update intent, increment version, and record history
  await atomicUpdateIntent(intentId, { active: false }, [change], actorUserId);

  return loadIntentLibrary();
}

/**
 * Reactivates a previously deactivated intent atomically.
 * Returns the updated library state.
 * @param intentId The ID of the intent to reactivate
 * @param actorUserId Optional user ID who made the change
 */
export async function reactivateIntent(intentId: string, actorUserId?: string): Promise<IntentLibrary> {
  const existing = await fetchIntentById(intentId);
  if (!existing) {
    throw new Error(`Intent not found: ${intentId}`);
  }

  if (existing.active) {
    return loadIntentLibrary();
  }

  const change: IntentChange = {
    action: "reactivated",
    intentId,
  };

  // Atomically update intent, increment version, and record history
  await atomicUpdateIntent(intentId, { active: true }, [change], actorUserId);

  return loadIntentLibrary();
}

/**
 * Gets the changes for a specific library version.
 */
export async function getIntentChangesForVersion(version: number): Promise<IntentChange[]> {
  const history = await fetchHistory();
  const entry = history.find((h) => h.version === version);
  return entry?.changes ?? [];
}

/**
 * Gets all versions that have recorded changes.
 */
export async function getVersionsWithChanges(): Promise<number[]> {
  const history = await fetchHistory();
  return history.map((h) => h.version);
}

// Re-export for backwards compatibility with any code that might import from here
export { fetchIntentsForCell as getIntentsForCellSync } from "./db";
