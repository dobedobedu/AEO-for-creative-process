import { sql, ensureSchema } from "@/lib/db";
import {
  BenchmarkRun,
  BenchmarkRunSchema,
  RunMetadata,
  CellResult,
  generateRunId,
  getRunFilename,
} from "./types";
import { calculateRunSummary } from "./utils";

// Ensure schema is up to date on first query
// Use Promise-based singleton to prevent race conditions in serverless
let schemaReadyPromise: Promise<void> | null = null;
async function ensureReady(): Promise<void> {
  if (!schemaReadyPromise) {
    schemaReadyPromise = ensureSchema().catch((err) => {
      schemaReadyPromise = null; // allow retry on next call
      throw err;
    });
  }
  await schemaReadyPromise;
}

export async function saveRun(run: BenchmarkRun): Promise<string> {
  await ensureReady();

  const validated = BenchmarkRunSchema.parse(run);

  // Check if run exists (update) or needs insert
  const existing = await sql`
    SELECT id FROM runs WHERE id = ${validated.id}::text::uuid
    LIMIT 1;
  `;

  if (existing.length > 0) {
    // Update existing run with result
    await sql`
      UPDATE runs
      SET result_json = ${sql.json(validated)},
          completed_at = NOW()
      WHERE id = ${validated.id}::text::uuid;
    `;
  } else {
    // Insert new run with result
    await sql`
      INSERT INTO runs (id, status, config_json, result_json, pending_count, completed_at)
      VALUES (
        ${validated.id}::text::uuid,
        'completed',
        ${sql.json({ brand: validated.brand })},
        ${sql.json(validated)},
        0,
        NOW()
      );
    `;
  }

  return validated.id;
}

export async function loadRun(runId: string): Promise<BenchmarkRun | null> {
  await ensureReady();

  const rows = await sql`
    SELECT result_json FROM runs
    WHERE id = ${runId}::text::uuid AND result_json IS NOT NULL
    LIMIT 1;
  `;

  if (rows.length === 0 || !rows[0].result_json) {
    return null;
  }

  return BenchmarkRunSchema.parse(rows[0].result_json);
}

export async function listRunMetadata(): Promise<RunMetadata[]> {
  await ensureReady();

  const rows = await sql`
    SELECT result_json FROM runs
    WHERE result_json IS NOT NULL
    ORDER BY completed_at DESC NULLS LAST, created_at DESC;
  `;

  const metadata: RunMetadata[] = [];

  for (const row of rows) {
    try {
      const run = BenchmarkRunSchema.parse(row.result_json);
      metadata.push({
        id: run.id,
        timestamp: run.timestamp,
        brand: run.brand,
        intentLibraryVersion: run.intentLibraryVersion,
        metricsConfigVersion: run.metricsConfigVersion,
        summary: run.summary,
      });
    } catch {
      // Skip invalid entries
    }
  }

  return metadata;
}

export async function loadAllRuns(): Promise<BenchmarkRun[]> {
  await ensureReady();

  const rows = await sql`
    SELECT result_json FROM runs
    WHERE result_json IS NOT NULL
    ORDER BY completed_at ASC NULLS LAST, created_at ASC;
  `;

  const runs: BenchmarkRun[] = [];

  for (const row of rows) {
    try {
      runs.push(BenchmarkRunSchema.parse(row.result_json));
    } catch (err) {
      console.error("[loadAllRuns] Schema validation failed for run:",
        row.result_json?.id,
        err instanceof Error ? err.message : err
      );
    }
  }

  return runs;
}

/**
 * Load recent runs with full data (for timeline UI)
 * More efficient than loadAllRuns for fetching limited results
 */
export async function loadRecentRuns(limit: number = 30): Promise<BenchmarkRun[]> {
  await ensureReady();

  const rows = await sql`
    SELECT result_json FROM runs
    WHERE result_json IS NOT NULL
    ORDER BY completed_at DESC NULLS LAST, created_at DESC
    LIMIT ${limit};
  `;

  const runs: BenchmarkRun[] = [];

  for (const row of rows) {
    const result = BenchmarkRunSchema.safeParse(row.result_json);
    if (result.success) {
      runs.push(result.data);
      continue;
    }

    const issueSummary = result.error.issues
      .map((issue) => {
        const path = issue.path.length > 0 ? issue.path.join(".") : "root";
        return `${path}: ${issue.message}`;
      })
      .join(", ");

    console.error(
      "[loadRecentRuns] Schema validation failed for run:",
      row.result_json?.id,
      issueSummary
    );
  }

  return runs;
}

export async function getRunsForDateRange(startDate: string, endDate: string): Promise<BenchmarkRun[]> {
  await ensureReady();

  // Use SQL filtering instead of loading all runs (performance optimization)
  const rows = await sql`
    SELECT result_json FROM runs
    WHERE result_json IS NOT NULL
      AND (result_json->>'timestamp')::date >= ${startDate}::date
      AND (result_json->>'timestamp')::date <= ${endDate}::date
    ORDER BY completed_at ASC NULLS LAST, created_at ASC;
  `;

  const runs: BenchmarkRun[] = [];

  for (const row of rows) {
    try {
      runs.push(BenchmarkRunSchema.parse(row.result_json));
    } catch (err) {
      console.error("[getRunsForDateRange] Schema validation failed for run:",
        row.result_json?.id,
        err instanceof Error ? err.message : err
      );
    }
  }

  return runs;
}

export async function getLatestRun(): Promise<BenchmarkRun | null> {
  await ensureReady();

  const rows = await sql`
    SELECT result_json FROM runs
    WHERE result_json IS NOT NULL
    ORDER BY completed_at DESC NULLS LAST, created_at DESC
    LIMIT 1;
  `;

  if (rows.length === 0 || !rows[0].result_json) {
    return null;
  }

  return BenchmarkRunSchema.parse(rows[0].result_json);
}

export async function getRunsByIntentLibraryVersion(version: number): Promise<BenchmarkRun[]> {
  await ensureReady();

  // Use SQL filtering instead of loading all runs (performance optimization)
  const rows = await sql`
    SELECT result_json FROM runs
    WHERE result_json IS NOT NULL
      AND (result_json->>'intentLibraryVersion')::int = ${version}
    ORDER BY completed_at ASC NULLS LAST, created_at ASC;
  `;

  const runs: BenchmarkRun[] = [];

  for (const row of rows) {
    try {
      runs.push(BenchmarkRunSchema.parse(row.result_json));
    } catch (err) {
      console.error("[getRunsByIntentLibraryVersion] Schema validation failed for run:",
        row.result_json?.id,
        err instanceof Error ? err.message : err
      );
    }
  }

  return runs;
}

export async function deleteRun(runId: string): Promise<boolean> {
  await ensureReady();

  const result = await sql`
    DELETE FROM runs
    WHERE id = ${runId}::text::uuid
    RETURNING id;
  `;

  return result.length > 0;
}

export function createEmptyRun(
  brand: string,
  intentLibraryVersion: number,
  metricsConfigVersion: number
): BenchmarkRun {
  const id = generateRunId();

  return {
    id,
    timestamp: new Date().toISOString(),
    intentLibraryVersion,
    metricsConfigVersion,
    brand,
    summary: {
      overall: {
        recommendationRate: 0,
        discoveryRate: 0,
        avgSentiment: 0,
        avgWinRate: 0,
      },
    },
    cells: {},
  };
}

/**
 * Atomically upsert a single cell into a run (safe for concurrent writes)
 * Uses jsonb_set to avoid read-modify-write race conditions
 *
 * @param runId - The run ID to update
 * @param cellKey - The cell key (e.g., "move_up_explore")
 * @param cellResult - The cell result data
 * @param metadata - Run metadata (used only if creating new run)
 */
export async function upsertSingleCell(
  runId: string,
  cellKey: string,
  cellResult: CellResult,
  metadata: {
    brand: string;
    intentLibraryVersion: number;
    metricsConfigVersion: number;
  }
): Promise<void> {
  await ensureReady();

  const timestamp = new Date().toISOString();

  // Build initial run structure as a full JSON object
  // This avoids issues with jsonb_build_object and parameter type detection
  const initialRun = {
    id: runId,
    timestamp,
    intentLibraryVersion: metadata.intentLibraryVersion,
    metricsConfigVersion: metadata.metricsConfigVersion,
    brand: metadata.brand,
    summary: {
      overall: {
        discoveryRate: 0,
        avgSentiment: 0,
        avgWinRate: 0,
        recommendationRate: 0,
      },
    },
    cells: {
      [cellKey]: cellResult,
    },
  };

  const emptyRun = {
    id: runId,
    timestamp,
    intentLibraryVersion: metadata.intentLibraryVersion,
    metricsConfigVersion: metadata.metricsConfigVersion,
    brand: metadata.brand,
    summary: {
      overall: {
        discoveryRate: 0,
        avgSentiment: 0,
        avgWinRate: 0,
        recommendationRate: 0,
      },
    },
    cells: {},
  };

  // Use a single atomic upsert with jsonb_set
  // IMPORTANT: Use sql.json() NOT JSON.stringify()::jsonb to avoid double-serialization
  // The postgres library escapes strings, so JSON.stringify() + ::jsonb results in a JSON string, not object
  await sql`
    INSERT INTO runs (id, status, config_json, result_json, pending_count, completed_at)
    VALUES (
      ${runId}::text::uuid,
      'running',
      ${sql.json({ brand: metadata.brand })},
      ${sql.json(initialRun)},
      0,
      NULL
    )
    ON CONFLICT (id) DO UPDATE SET
      result_json = jsonb_set(
        CASE
          WHEN runs.result_json IS NULL THEN ${sql.json(emptyRun)}
          WHEN jsonb_typeof(runs.result_json) != 'object' THEN ${sql.json(emptyRun)}
          ELSE runs.result_json
        END,
        ARRAY['cells', ${cellKey}::text],
        ${sql.json(cellResult)},
        true
      )
  `;
}

/**
 * Create or update a run with new cells (for incremental stage-based cron jobs)
 * Now uses atomic jsonb_set per cell to prevent race conditions
 *
 * @param runId - The run ID to create/update
 * @param cells - New cells to add to the run
 * @param metadata - Run metadata (used only on first call to create the run)
 * @param isLastStage - If true, recalculate summary and mark as completed
 */
export async function upsertRunCells(
  runId: string,
  cells: Record<string, CellResult>,
  metadata: {
    brand: string;
    intentLibraryVersion: number;
    metricsConfigVersion: number;
  },
  isLastStage: boolean = false
): Promise<BenchmarkRun> {
  await ensureReady();

  // Upsert each cell atomically (safe for concurrent calls)
  for (const [cellKey, cellResult] of Object.entries(cells)) {
    await upsertSingleCell(runId, cellKey, cellResult, metadata);
  }

  // Now read the full run to calculate summary and return
  const rows = await sql`
    SELECT result_json FROM runs WHERE id = ${runId}::text::uuid LIMIT 1;
  `;

  if (rows.length === 0 || !rows[0].result_json) {
    throw new Error(`Run ${runId} not found after upsert`);
  }

  const run = BenchmarkRunSchema.parse(rows[0].result_json);

  // Recalculate summary using shared utility
  run.summary = calculateRunSummary(run.cells);

  // Update with recalculated summary
  // Note: separate branches avoid nested sql`` fragments which break under withRetry
  const validated = BenchmarkRunSchema.parse(run);
  if (isLastStage) {
    await sql`
      UPDATE runs
      SET result_json = ${sql.json(validated)},
          status = 'completed',
          completed_at = NOW()
      WHERE id = ${runId}::text::uuid;
    `;
  } else {
    await sql`
      UPDATE runs
      SET result_json = ${sql.json(validated)},
          status = 'running'
      WHERE id = ${runId}::text::uuid;
    `;
  }

  return validated;
}

/**
 * Get today's run ID (consistent across stage crons for the same day)
 * Format: date-based UUID seed to ensure same ID across all stages
 */
export function getTodayRunId(): string {
  const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
  // Use a deterministic seed based on date to generate consistent ID
  // This ensures all stage crons on the same day write to the same run
  const seed = `daily-run-${today}`;
  // Create a simple hash-based UUID v4-like string
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    const char = seed.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash | 0; // Convert to 32-bit integer
  }
  // Format as UUID-like string
  const hex = Math.abs(hash).toString(16).padStart(8, '0');
  return `${today.replace(/-/g, '')}-${hex.slice(0, 4)}-4${hex.slice(4, 7)}-8000-${hex}${hex.slice(0, 4)}`;
}

export { generateRunId, getRunFilename };
