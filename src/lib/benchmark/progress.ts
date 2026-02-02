/**
 * DB-backed Progress Tracking
 *
 * Stores benchmark run progress in Postgres for persistence across
 * serverless function instances. Enables reliable progress tracking
 * even when polling spans multiple Vercel edge instances.
 */

import { sql } from "@/lib/db";

export type ProgressStatus = "running" | "complete" | "error";

export type ProgressEvent = {
  ts?: string;
  message: string;
  persona?: string;
  stage?: string;
  status?: ProgressStatus;
};

export type RunProgress = {
  runId: string;
  totalSteps: number;
  completedSteps: number;
  unit: "queries" | "cells" | "items";
  status: ProgressStatus;
  updatedAt: string;
  events: ProgressEvent[];
  startedBy?: string;
};

// DB row type
interface ProgressRow {
  run_id: string;
  status: string;
  total_steps: number;
  completed_steps: number;
  unit: string;
  updated_at: Date;
  events: ProgressEvent[];
  started_by: string | null;
  created_at: Date;
}

const MAX_EVENTS = 80;

function nowIso() {
  return new Date().toISOString();
}

/**
 * Ensures the run_progress table exists.
 */
let schemaEnsured = false;
async function ensureProgressSchema(): Promise<void> {
  if (schemaEnsured) return;

  await sql`
    CREATE TABLE IF NOT EXISTS run_progress (
      run_id UUID PRIMARY KEY,
      status TEXT NOT NULL CHECK (status IN ('running', 'complete', 'error')),
      total_steps INT NOT NULL,
      completed_steps INT NOT NULL DEFAULT 0,
      unit TEXT NOT NULL DEFAULT 'queries' CHECK (unit IN ('queries', 'cells', 'items')),
      updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      events JSONB DEFAULT '[]'::jsonb,
      started_by UUID NULL,
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    );
  `;

  schemaEnsured = true;
}

/**
 * Initializes a new progress entry in the database.
 */
export async function initProgress(
  runId: string,
  totalSteps: number,
  unit: "queries" | "cells" | "items" = "queries",
  startedBy?: string
): Promise<RunProgress> {
  await ensureProgressSchema();

  const now = nowIso();
  const initialEvent: ProgressEvent = {
    ts: now,
    message: "Benchmark started",
    status: "running",
  };

  const eventsJson = JSON.stringify([initialEvent]);

  await sql`
    INSERT INTO run_progress (run_id, status, total_steps, completed_steps, unit, updated_at, events, started_by)
    VALUES (
      ${runId}::uuid,
      'running',
      ${totalSteps},
      0,
      ${unit},
      NOW(),
      ${eventsJson}::jsonb,
      ${startedBy ?? null}
    )
    ON CONFLICT (run_id) DO UPDATE SET
      status = 'running',
      total_steps = ${totalSteps},
      completed_steps = 0,
      unit = ${unit},
      updated_at = NOW(),
      events = ${eventsJson}::jsonb,
      started_by = ${startedBy ?? null};
  `;

  return {
    runId,
    totalSteps,
    completedSteps: 0,
    unit,
    status: "running",
    updatedAt: now,
    events: [initialEvent],
    startedBy,
  };
}

/**
 * Logs a progress event.
 */
export async function logProgress(runId: string, event: ProgressEvent): Promise<void> {
  await ensureProgressSchema();

  const timestampedEvent = { ...event, ts: event.ts ?? nowIso() };

  // Append event to array, keeping only last MAX_EVENTS
  await sql`
    UPDATE run_progress
    SET
      events = (
        SELECT jsonb_agg(e)
        FROM (
          SELECT e
          FROM jsonb_array_elements(events || ${JSON.stringify(timestampedEvent)}::jsonb) e
          ORDER BY e->>'ts' DESC
          LIMIT ${MAX_EVENTS}
        ) sub
      ),
      updated_at = NOW()
    WHERE run_id = ${runId}::uuid;
  `;
}

/**
 * Increments the completed steps counter.
 */
export async function incrementProgress(runId: string, increment = 1): Promise<void> {
  await ensureProgressSchema();

  await sql`
    UPDATE run_progress
    SET
      completed_steps = LEAST(total_steps, completed_steps + ${increment}),
      updated_at = NOW()
    WHERE run_id = ${runId}::uuid;
  `;
}

/**
 * Marks progress as complete.
 */
export async function completeProgress(runId: string): Promise<void> {
  await ensureProgressSchema();

  const event: ProgressEvent = {
    ts: nowIso(),
    message: "Benchmark completed",
    status: "complete",
  };

  await sql`
    UPDATE run_progress
    SET
      status = 'complete',
      completed_steps = total_steps,
      events = (
        SELECT jsonb_agg(e)
        FROM (
          SELECT e
          FROM jsonb_array_elements(events || ${JSON.stringify(event)}::jsonb) e
          ORDER BY e->>'ts' DESC
          LIMIT ${MAX_EVENTS}
        ) sub
      ),
      updated_at = NOW()
    WHERE run_id = ${runId}::uuid;
  `;
}

/**
 * Marks progress as failed with an error message.
 */
export async function failProgress(runId: string, message: string): Promise<void> {
  await ensureProgressSchema();

  const event: ProgressEvent = {
    ts: nowIso(),
    message,
    status: "error",
  };

  await sql`
    UPDATE run_progress
    SET
      status = 'error',
      events = (
        SELECT jsonb_agg(e)
        FROM (
          SELECT e
          FROM jsonb_array_elements(events || ${JSON.stringify(event)}::jsonb) e
          ORDER BY e->>'ts' DESC
          LIMIT ${MAX_EVENTS}
        ) sub
      ),
      updated_at = NOW()
    WHERE run_id = ${runId}::uuid;
  `;
}

/**
 * Gets progress for a run.
 */
export async function getProgress(runId: string): Promise<RunProgress | null> {
  await ensureProgressSchema();

  const rows = (await sql`
    SELECT * FROM run_progress WHERE run_id = ${runId}::uuid LIMIT 1;
  `) as ProgressRow[];

  if (rows.length === 0) {
    return null;
  }

  const row = rows[0];
  return {
    runId: row.run_id,
    totalSteps: row.total_steps,
    completedSteps: row.completed_steps,
    unit: row.unit as "queries" | "cells" | "items",
    status: row.status as ProgressStatus,
    updatedAt: row.updated_at.toISOString(),
    events: row.events ?? [],
    startedBy: row.started_by ?? undefined,
  };
}

/**
 * Cleans up old progress entries (older than 24 hours and complete/error).
 * Call this periodically to prevent table bloat.
 */
export async function cleanupOldProgress(): Promise<number> {
  await ensureProgressSchema();

  const result = await sql`
    DELETE FROM run_progress
    WHERE updated_at < NOW() - INTERVAL '24 hours'
      AND status IN ('complete', 'error')
    RETURNING run_id;
  ` as Array<{ run_id: string }>;

  return result.length;
}

/**
 * For testing purposes - clears the progress for a specific run.
 */
export async function clearProgress(runId: string): Promise<void> {
  await ensureProgressSchema();

  await sql`
    DELETE FROM run_progress WHERE run_id = ${runId}::uuid;
  `;
}

/**
 * For testing purposes - clears all progress entries.
 */
export async function clearProgressStore(): Promise<void> {
  await ensureProgressSchema();

  await sql`DELETE FROM run_progress;`;
}
