import { sql, ensureSchema } from "@/lib/db";
import {
  BenchmarkRun,
  BenchmarkRunSchema,
  RunMetadata,
  CellResult,
  generateRunId,
  getRunFilename,
} from "./types";

// Ensure schema is up to date on first query
let schemaReady = false;
async function ensureReady(): Promise<void> {
  if (!schemaReady) {
    await ensureSchema();
    schemaReady = true;
  }
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
      SET result_json = ${JSON.stringify(validated)}::jsonb,
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
        ${JSON.stringify({ brand: validated.brand })}::jsonb,
        ${JSON.stringify(validated)}::jsonb,
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
    try {
      runs.push(BenchmarkRunSchema.parse(row.result_json));
    } catch (err) {
      console.error("[loadRecentRuns] Schema validation failed for run:",
        row.result_json?.id,
        err instanceof Error ? err.message : err
      );
    }
  }

  return runs;
}

export async function getRunsForDateRange(startDate: string, endDate: string): Promise<BenchmarkRun[]> {
  const allRuns = await loadAllRuns();

  return allRuns.filter((run) => {
    const runDate = run.timestamp.split("T")[0];
    return runDate >= startDate && runDate <= endDate;
  });
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
  const allRuns = await loadAllRuns();
  return allRuns.filter((run) => run.intentLibraryVersion === version);
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
 * Create or update a run with new cells (for incremental stage-based cron jobs)
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

  // Check if run exists
  const existing = await sql`
    SELECT result_json FROM runs WHERE id = ${runId}::text::uuid
    LIMIT 1;
  `;

  let run: BenchmarkRun;

  if (existing.length > 0 && existing[0].result_json) {
    // Update existing run - merge new cells
    run = BenchmarkRunSchema.parse(existing[0].result_json);
    run.cells = { ...run.cells, ...cells };
  } else {
    // Create new run
    run = {
      id: runId,
      timestamp: new Date().toISOString(),
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
      cells,
    };
  }

  // Recalculate summary if this is the last stage or always keep it updated
  if (isLastStage || Object.keys(run.cells).length > 0) {
    const allCells = Object.values(run.cells);
    const discoveryRates = allCells.map(c => c.metrics.discoveryRate).filter((v): v is number => v !== undefined);
    const sentimentScores = allCells.map(c => c.metrics.sentimentScore).filter((v): v is number => v !== undefined);
    const winRates = allCells.map(c => c.metrics.winRate).filter((v): v is number => v !== undefined);
    const recommendationRates = allCells.map(c => c.metrics.recommendationRate).filter((v): v is number => v !== undefined);

    run.summary = {
      overall: {
        discoveryRate: discoveryRates.length > 0 ? discoveryRates.reduce((a, b) => a + b, 0) / discoveryRates.length : 0,
        avgSentiment: sentimentScores.length > 0 ? sentimentScores.reduce((a, b) => a + b, 0) / sentimentScores.length : 0,
        avgWinRate: winRates.length > 0 ? winRates.reduce((a, b) => a + b, 0) / winRates.length : 0,
        recommendationRate: recommendationRates.length > 0 ? recommendationRates.reduce((a, b) => a + b, 0) / recommendationRates.length : 0,
      },
    };
  }

  // Save to database
  const validated = BenchmarkRunSchema.parse(run);

  if (existing.length > 0) {
    await sql`
      UPDATE runs
      SET result_json = ${JSON.stringify(validated)}::jsonb,
          completed_at = ${isLastStage ? sql`NOW()` : sql`completed_at`}
      WHERE id = ${runId}::text::uuid;
    `;
  } else {
    await sql`
      INSERT INTO runs (id, status, config_json, result_json, pending_count, completed_at)
      VALUES (
        ${runId}::text::uuid,
        ${isLastStage ? 'completed' : 'running'},
        ${JSON.stringify({ brand: metadata.brand })}::jsonb,
        ${JSON.stringify(validated)}::jsonb,
        0,
        ${isLastStage ? sql`NOW()` : null}
      );
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
