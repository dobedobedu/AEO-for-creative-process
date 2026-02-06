/**
 * Batch Submit Cron Endpoint
 *
 * Submits batch jobs for Anthropic and Gemini at 09:00 UTC.
 * The scheduled stage crons at 10:00-10:30 UTC will retrieve results.
 *
 * This endpoint:
 * 1. Creates a new run record (or gets today's run ID)
 * 2. Generates all queries for all personas/stages
 * 3. Submits Anthropic batch for all queries
 * 4. Submits Gemini batch for all queries
 * 5. Stores batch job IDs in database
 */

import { loadIntentLibrary, updateIntent } from "@/lib/intents/library";
import { generateQueriesFromIntent } from "@/lib/intents/queryGenerator";
import {
  getActiveMatrixConfigCached,
  getActivePersonaIds,
  getActiveStageIds,
  getCoreStageMapping,
} from "@/lib/matrix/runtime";
import { sql } from "@/lib/db";
import { getTodayRunId } from "@/lib/runs/storage";
import {
  createBatchJob,
  generateBatchCustomId,
  type BatchRequest,
} from "@/lib/providers/batch";
import { submitAnthropicBatch } from "@/lib/providers/anthropic";
import { DEFAULT_PROVIDERS } from "@/lib/runs/utils";

// Query gen for ~21 intents via OpenRouter needs headroom
export const maxDuration = 180;

interface GeneratedQuery {
  persona: string;
  stage: string;
  coreStage: string;
  intentId: string;
  queryIndex: number;
  query: string;
}

export async function GET(req: Request) {
  const startTime = Date.now();
  console.log("[batch-submit] Starting batch submission...");

  // Verify cron secret
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    console.error("[batch-submit] Unauthorized - invalid or missing CRON_SECRET");
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // 1. Get run ID for today
    const runId = getTodayRunId();
    console.log(`[batch-submit] Using run ID: ${runId}`);

    // Ensure today's run record exists (needed for batch_jobs FK constraint)
    await sql`
      INSERT INTO runs (id, status, config_json, pending_count)
      VALUES (${runId}::text::uuid, 'pending', '{}'::jsonb, 0)
      ON CONFLICT (id) DO NOTHING
    `;

    // 2. Load matrix config and intent library
    const [cfg, intentLibrary] = await Promise.all([
      getActiveMatrixConfigCached(),
      loadIntentLibrary(),
    ]);

    const activePersonas = getActivePersonaIds(cfg);
    const activeStages = getActiveStageIds(cfg);

    console.log(
      `[batch-submit] Active personas: ${activePersonas.length}, stages: ${activeStages.length}`
    );
    console.log(`[batch-submit] Loaded ${intentLibrary.intents.length} intents from library`);

    // 3. Generate all queries for all personas/stages
    const allQueries: GeneratedQuery[] = [];
    const queryGenerationPromises: Promise<void>[] = [];

    for (const persona of activePersonas) {
      for (const stage of activeStages) {
        const coreStage = getCoreStageMapping(stage, cfg);

        // Get active intents for this cell
        const activeIntents = intentLibrary.intents
          .filter((i) => i.persona === persona && i.stage === stage && i.active)
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

        if (activeIntents.length === 0) {
          console.log(`[batch-submit] Skipping ${persona}/${stage} - no active intents`);
          continue;
        }

        // Generate queries for each intent
        for (const intent of activeIntents) {
          const promise = generateQueriesFromIntent({
            persona,
            stage,
            coreStage,
            intent: intent.text,
            role: intent.role,
            queryStyle: intent.queryStyle,
            count: 3,
          }).then(async (generated) => {
            // Save generated queries with timestamp to intent library
            await updateIntent(intent.id, {
              generatedQueries: generated.queries,
              generatedQueriesAt: new Date().toISOString(),
            });

            // Add to all queries
            for (let i = 0; i < generated.queries.length; i++) {
              allQueries.push({
                persona,
                stage,
                coreStage,
                intentId: intent.id,
                queryIndex: i,
                query: generated.queries[i],
              });
            }
          });

          queryGenerationPromises.push(promise);
        }
      }
    }

    // Wait for all query generation — partial success is fine since each
    // intent's queries are saved independently via updateIntent
    const queryGenResults = await Promise.allSettled(queryGenerationPromises);
    const queryGenSucceeded = queryGenResults.filter((r) => r.status === "fulfilled").length;
    const queryGenFailed = queryGenResults.filter((r) => r.status === "rejected").length;
    console.log(
      `[batch-submit] Query gen: ${queryGenSucceeded} succeeded, ${queryGenFailed} failed out of ${queryGenResults.length}`
    );
    if (queryGenFailed > 0) {
      for (const r of queryGenResults) {
        if (r.status === "rejected") {
          console.error("[batch-submit] Query gen failure:", r.reason instanceof Error ? r.reason.message : r.reason);
        }
      }
    }
    console.log(`[batch-submit] Generated ${allQueries.length} total queries`);

    if (allQueries.length === 0) {
      return Response.json({
        success: true,
        runId,
        message: "No queries to process",
        executionTimeMs: Date.now() - startTime,
      });
    }

    // 4-6. Batch submission is best-effort — queries are already saved to DB
    // If batch fails, stage crons will use the sync fallback
    const results: {
      anthropic?: { batchId: string; requestCount: number };
    } = {};
    const errors: Array<{ provider: string; error: string }> = [];

    try {
      // Build batch requests (Anthropic only)
      const anthropicModel = DEFAULT_PROVIDERS.find((p) => p.provider === "anthropic")?.model ?? "claude-haiku-4-5";
      const intentIdMap: Record<string, string> = {};

      const anthropicRequests: BatchRequest[] = allQueries.map((q) => {
        const customId = generateBatchCustomId({
          persona: q.persona,
          stage: q.stage,
          intentId: q.intentId,
          provider: "anthropic",
          queryIndex: q.queryIndex,
        });
        intentIdMap[customId] = q.intentId;
        return {
          customId,
          query: q.query,
          model: anthropicModel,
          persona: q.persona,
          stage: q.stage,
          intentId: q.intentId,
        };
      });

      // Submit Anthropic batch
      const anthropicResult = await submitAnthropicBatch(anthropicRequests);
      results.anthropic = anthropicResult;

      // Store batch job in database
      await createBatchJob({
        runId,
        provider: "anthropic",
        batchType: "search",
        batchId: anthropicResult.batchId,
        requestCount: anthropicResult.requestCount,
        metadata: { intentIdMap },
      });

      console.log(
        `[batch-submit] Anthropic batch submitted: ${anthropicResult.batchId} (${anthropicResult.requestCount} requests)`
      );
    } catch (batchErr) {
      const msg = batchErr instanceof Error ? batchErr.message : String(batchErr);
      console.error("[batch-submit] Batch submission failed (non-fatal):", msg);
      errors.push({ provider: "anthropic", error: msg });
      // Queries are already saved — stage crons will use sync fallback
    }

    const executionTimeMs = Date.now() - startTime;
    console.log(
      `[batch-submit] Completed in ${executionTimeMs}ms (${(executionTimeMs / 1000).toFixed(1)}s)`
    );

    return Response.json({
      success: true,
      runId,
      queriesGenerated: allQueries.length,
      queryGenFailed,
      batches: results,
      errors: errors.length > 0 ? errors : undefined,
      executionTimeMs,
    });
  } catch (err) {
    console.error("[batch-submit] Error:", err instanceof Error ? err.message : err);
    return Response.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Unknown error",
        executionTimeMs: Date.now() - startTime,
      },
      { status: 500 }
    );
  }
}
