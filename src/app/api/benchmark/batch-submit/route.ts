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
import { getTodayRunId } from "@/lib/runs/storage";
import {
  createBatchJob,
  generateBatchCustomId,
  type BatchRequest,
} from "@/lib/providers/batch";
import { submitAnthropicBatch } from "@/lib/providers/anthropic";
import { submitGeminiBatch } from "@/lib/providers/gemini";
import { DEFAULT_PROVIDERS, DEFAULT_BRAND, DEFAULT_ALIASES } from "@/lib/runs/utils";

// Batch submission should be fast - 60 seconds max
export const maxDuration = 60;

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
            // Save generated queries to intent library
            await updateIntent(intent.id, {
              generatedQueries: generated.queries,
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

    // Wait for all query generation to complete
    await Promise.all(queryGenerationPromises);
    console.log(`[batch-submit] Generated ${allQueries.length} total queries`);

    if (allQueries.length === 0) {
      return Response.json({
        success: true,
        runId,
        message: "No queries to process",
        executionTimeMs: Date.now() - startTime,
      });
    }

    // 4. Build batch requests for each provider
    const anthropicModel = DEFAULT_PROVIDERS.find((p) => p.provider === "anthropic")?.model ?? "claude-haiku-4-5";
    const geminiModel = DEFAULT_PROVIDERS.find((p) => p.provider === "gemini")?.model ?? "gemini-3-flash-preview";

    const anthropicRequests: BatchRequest[] = allQueries.map((q) => ({
      customId: generateBatchCustomId({
        persona: q.persona,
        stage: q.stage,
        intentId: q.intentId,
        provider: "anthropic",
        queryIndex: q.queryIndex,
      }),
      query: q.query,
      model: anthropicModel,
      persona: q.persona,
      stage: q.stage,
      intentId: q.intentId,
    }));

    const geminiRequests: BatchRequest[] = allQueries.map((q) => ({
      customId: generateBatchCustomId({
        persona: q.persona,
        stage: q.stage,
        intentId: q.intentId,
        provider: "gemini",
        queryIndex: q.queryIndex,
      }),
      query: q.query,
      model: geminiModel,
      persona: q.persona,
      stage: q.stage,
      intentId: q.intentId,
    }));

    // 5. Submit batches in parallel
    const [anthropicResult, geminiResult] = await Promise.allSettled([
      submitAnthropicBatch(anthropicRequests),
      submitGeminiBatch(geminiRequests),
    ]);

    const results: {
      anthropic?: { batchId: string; requestCount: number };
      gemini?: { batchName: string; requestCount: number; immediateResults?: boolean };
    } = {};
    const errors: Array<{ provider: string; error: string }> = [];

    // 6. Store batch jobs in database
    if (anthropicResult.status === "fulfilled") {
      results.anthropic = anthropicResult.value;

      await createBatchJob({
        runId,
        provider: "anthropic",
        batchType: "search",
        batchId: anthropicResult.value.batchId,
        requestCount: anthropicResult.value.requestCount,
      });

      console.log(
        `[batch-submit] Anthropic batch submitted: ${anthropicResult.value.batchId} (${anthropicResult.value.requestCount} requests)`
      );
    } else {
      errors.push({
        provider: "anthropic",
        error: anthropicResult.reason?.message ?? "Unknown error",
      });
      console.error("[batch-submit] Anthropic batch failed:", anthropicResult.reason);
    }

    if (geminiResult.status === "fulfilled") {
      results.gemini = {
        batchName: geminiResult.value.batchName,
        requestCount: geminiResult.value.requestCount,
        immediateResults: !!geminiResult.value.responses?.length,
      };

      // Gemini's batchGenerateContent is synchronous, so we store the results immediately
      // Store as JSON in a separate table or cache for later retrieval
      await createBatchJob({
        runId,
        provider: "gemini",
        batchType: "search",
        batchId: geminiResult.value.batchName,
        requestCount: geminiResult.value.requestCount,
      });

      // If we got immediate results, store them (Gemini batch is synchronous)
      if (geminiResult.value.responses?.length) {
        // Store results in a temporary cache or database field
        // For now, we'll handle this in the scheduled cron by re-fetching
        console.log(
          `[batch-submit] Gemini batch completed synchronously: ${geminiResult.value.batchName} (${geminiResult.value.responses.length} results)`
        );
      }

      console.log(
        `[batch-submit] Gemini batch submitted: ${geminiResult.value.batchName} (${geminiResult.value.requestCount} requests)`
      );
    } else {
      errors.push({
        provider: "gemini",
        error: geminiResult.reason?.message ?? "Unknown error",
      });
      console.error("[batch-submit] Gemini batch failed:", geminiResult.reason);
    }

    const executionTimeMs = Date.now() - startTime;
    console.log(
      `[batch-submit] Completed in ${executionTimeMs}ms (${(executionTimeMs / 1000).toFixed(1)}s)`
    );

    return Response.json({
      success: true,
      runId,
      queriesGenerated: allQueries.length,
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
