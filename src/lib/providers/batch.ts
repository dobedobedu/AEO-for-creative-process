/**
 * Shared types and helpers for batch processing
 *
 * Supports Anthropic and Gemini batch APIs for cron-triggered benchmark runs.
 * UI-triggered runs continue to use synchronous API calls.
 */

import { sql, ensureSchema } from "@/lib/db";
import { z } from "zod";

// Batch job status enum matching database constraint
export type BatchStatus = "pending" | "in_progress" | "completed" | "failed" | "expired";

// Provider types that support batch processing
export type BatchProvider = "anthropic" | "gemini";

// Batch type - search for web search queries, scoring for extraction
export type BatchType = "search" | "scoring";

// Request to submit in a batch
export interface BatchRequest {
  customId: string; // Unique identifier for this request (e.g., "persona_stage_query_provider")
  query: string; // The search query
  model: string; // Model to use
  persona?: string; // Optional metadata
  stage?: string; // Optional metadata
  intentId?: string; // Optional metadata
}

// Result from a batch request
export interface BatchResult {
  customId: string;
  success: boolean;
  text?: string;
  citations?: string[];
  raw?: unknown;
  error?: string;
}

// Database batch job record
export const BatchJobSchema = z.object({
  id: z.string().uuid(),
  runId: z.string().uuid(),
  provider: z.enum(["anthropic", "gemini"]),
  batchType: z.enum(["search", "scoring"]),
  batchId: z.string(),
  status: z.enum(["pending", "in_progress", "completed", "failed", "expired"]),
  requestCount: z.number().int().nullable(),
  inputFileId: z.string().nullable(),
  outputFileId: z.string().nullable(),
  errorMessage: z.string().nullable(),
  createdAt: z.union([z.string().datetime(), z.date()]).transform((v) => (v instanceof Date ? v.toISOString() : v)),
  completedAt: z.union([z.string().datetime(), z.date(), z.null()]).transform((v) => (v instanceof Date ? v.toISOString() : v)),
});

export type BatchJob = z.infer<typeof BatchJobSchema>;

// Ensure database schema is ready
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

/**
 * Create a new batch job record
 */
export async function createBatchJob(params: {
  runId: string;
  provider: BatchProvider;
  batchType: BatchType;
  batchId: string;
  requestCount: number;
  inputFileId?: string;
  metadata?: Record<string, unknown>;
}): Promise<BatchJob> {
  await ensureReady();

  const rows = await sql`
    INSERT INTO batch_jobs (run_id, provider, batch_type, batch_id, status, request_count, input_file_id, metadata)
    VALUES (
      ${params.runId}::text::uuid,
      ${params.provider},
      ${params.batchType},
      ${params.batchId},
      'pending',
      ${params.requestCount},
      ${params.inputFileId ?? null},
      ${params.metadata ? JSON.stringify(params.metadata) : null}::jsonb
    )
    RETURNING
      id::text as id,
      run_id::text as "runId",
      provider,
      batch_type as "batchType",
      batch_id as "batchId",
      status,
      request_count as "requestCount",
      input_file_id as "inputFileId",
      output_file_id as "outputFileId",
      error_message as "errorMessage",
      created_at as "createdAt",
      completed_at as "completedAt"
  ` as unknown[];

  return BatchJobSchema.parse(rows[0]);
}

/**
 * Get batch job for a specific run, provider, and type
 */
export async function getBatchJob(
  runId: string,
  provider: BatchProvider,
  batchType: BatchType = "search"
): Promise<BatchJob | null> {
  await ensureReady();

  const rows = await sql`
    SELECT
      id::text as id,
      run_id::text as "runId",
      provider,
      batch_type as "batchType",
      batch_id as "batchId",
      status,
      request_count as "requestCount",
      input_file_id as "inputFileId",
      output_file_id as "outputFileId",
      error_message as "errorMessage",
      created_at as "createdAt",
      completed_at as "completedAt"
    FROM batch_jobs
    WHERE run_id = ${runId}::text::uuid
      AND provider = ${provider}
      AND batch_type = ${batchType}
    LIMIT 1
  ` as unknown[];

  if (rows.length === 0) return null;
  return BatchJobSchema.parse(rows[0]);
}

/**
 * Get all batch jobs for a run
 */
export async function getBatchJobsForRun(runId: string): Promise<BatchJob[]> {
  await ensureReady();

  const rows = await sql`
    SELECT
      id::text as id,
      run_id::text as "runId",
      provider,
      batch_type as "batchType",
      batch_id as "batchId",
      status,
      request_count as "requestCount",
      input_file_id as "inputFileId",
      output_file_id as "outputFileId",
      error_message as "errorMessage",
      created_at as "createdAt",
      completed_at as "completedAt"
    FROM batch_jobs
    WHERE run_id = ${runId}::text::uuid
    ORDER BY created_at ASC
  ` as unknown[];

  return rows.map((row: unknown) => BatchJobSchema.parse(row));
}

/**
 * Update batch job status
 */
export async function updateBatchJobStatus(
  jobId: string,
  status: BatchStatus,
  params?: {
    outputFileId?: string;
    errorMessage?: string;
  }
): Promise<void> {
  await ensureReady();

  // Separate branches avoid nested sql`` fragments which break under withRetry
  const shouldComplete = status === "completed" || status === "failed" || status === "expired";
  if (shouldComplete) {
    await sql`
      UPDATE batch_jobs
      SET
        status = ${status},
        output_file_id = COALESCE(${params?.outputFileId ?? null}, output_file_id),
        error_message = COALESCE(${params?.errorMessage ?? null}, error_message),
        completed_at = NOW()
      WHERE id = ${jobId}::text::uuid
    `;
  } else {
    await sql`
      UPDATE batch_jobs
      SET
        status = ${status},
        output_file_id = COALESCE(${params?.outputFileId ?? null}, output_file_id),
        error_message = COALESCE(${params?.errorMessage ?? null}, error_message)
      WHERE id = ${jobId}::text::uuid
    `;
  }
}

/**
 * Generate a unique custom ID for a batch request
 * Format: {persona}_{stage}_{intentHash}_{provider}_{queryIndex}
 */
export function generateBatchCustomId(params: {
  persona: string;
  stage: string;
  intentId: string;
  provider: string;
  queryIndex: number;
}): string {
  const { persona, stage, intentId, provider, queryIndex } = params;
  const intentHash = hashIntentId(intentId);
  return `${persona}_${stage}_${intentHash}_${provider}_${queryIndex}`;
}

/**
 * Parse a batch custom ID back into components
 */
export function parseBatchCustomId(customId: string): {
  persona: string;
  stage: string;
  intentIdPrefix: string;
  provider: string;
  queryIndex: number;
} | null {
  const parts = customId.split("_");
  if (parts.length < 5) return null;

  // Handle personas with underscores (e.g., "move_up")
  // The last 4 parts are: intentIdPrefix, provider, queryIndex
  const queryIndex = parseInt(parts[parts.length - 1], 10);
  const provider = parts[parts.length - 2];
  const intentIdPrefix = parts[parts.length - 3];
  const stage = parts[parts.length - 4];
  const persona = parts.slice(0, -4).join("_");

  if (isNaN(queryIndex)) return null;

  return { persona, stage, intentIdPrefix, provider, queryIndex };
}

function hashIntentId(intentId: string): string {
  let hash = 0;
  for (let i = 0; i < intentId.length; i += 1) {
    hash = (hash * 31 + intentId.charCodeAt(i)) >>> 0;
  }
  return hash.toString(36).padStart(8, "0").slice(0, 8);
}

/**
 * Get pending batch jobs that haven't been checked recently
 */
export async function getPendingBatchJobs(
  provider?: BatchProvider
): Promise<BatchJob[]> {
  await ensureReady();

  // Separate branches avoid nested sql`` fragments which break under withRetry
  const rows = provider
    ? await sql`
        SELECT
          id::text as id,
          run_id::text as "runId",
          provider,
          batch_type as "batchType",
          batch_id as "batchId",
          status,
          request_count as "requestCount",
          input_file_id as "inputFileId",
          output_file_id as "outputFileId",
          error_message as "errorMessage",
          created_at as "createdAt",
          completed_at as "completedAt"
        FROM batch_jobs
        WHERE status IN ('pending', 'in_progress')
          AND provider = ${provider}
        ORDER BY created_at ASC
      ` as unknown[]
    : await sql`
        SELECT
          id::text as id,
          run_id::text as "runId",
          provider,
          batch_type as "batchType",
          batch_id as "batchId",
          status,
          request_count as "requestCount",
          input_file_id as "inputFileId",
          output_file_id as "outputFileId",
          error_message as "errorMessage",
          created_at as "createdAt",
          completed_at as "completedAt"
        FROM batch_jobs
        WHERE status IN ('pending', 'in_progress')
        ORDER BY created_at ASC
      ` as unknown[];

  return rows.map((row: unknown) => BatchJobSchema.parse(row));
}

/**
 * Clean up old batch jobs (older than 7 days)
 */
export async function cleanupOldBatchJobs(): Promise<number> {
  await ensureReady();

  const result = await sql`
    DELETE FROM batch_jobs
    WHERE created_at < NOW() - INTERVAL '7 days'
    RETURNING id
  ` as unknown[];

  return result.length;
}

/**
 * Get batch job metadata (for intentId mapping retrieval)
 */
export async function getBatchJobMetadata(
  jobId: string
): Promise<Record<string, unknown> | null> {
  await ensureReady();

  const rows = await sql`
    SELECT metadata FROM batch_jobs WHERE id = ${jobId}::text::uuid
  ` as Array<{ metadata?: Record<string, unknown> | null }>;

  if (rows.length === 0 || !rows[0].metadata) return null;
  return rows[0].metadata;
}
