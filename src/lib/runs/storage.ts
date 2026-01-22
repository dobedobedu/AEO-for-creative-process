import { sql, ensureSchema } from "@/lib/db";
import {
  BenchmarkRun,
  BenchmarkRunSchema,
  RunMetadata,
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

export { generateRunId, getRunFilename };
