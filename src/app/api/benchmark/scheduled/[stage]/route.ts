/**
 * Stage-Specific Scheduled Benchmark Endpoint
 *
 * Handles a single stage (explore/consider/compare/decide) to stay under
 * Vercel's 800s Pro plan timeout limit.
 *
 * Each stage processes 4 personas for that stage only.
 * All stages for the same day write to the same run ID.
 *
 * Batch Processing (v2):
 * - Checks for pre-submitted batch jobs from batch-submit cron
 * - Uses batch results for Anthropic/Gemini when available
 * - Falls back to sync calls for missing results (capped)
 * - OpenAI/xAI always use sync calls (no batch API support)
 */

import { runBenchmark } from "@/lib/benchmark";
import { loadIntentLibrary, updateIntent } from "@/lib/intents/library";
import { generateQueriesFromIntent } from "@/lib/intents/queryGenerator";
import { loadMetricsConfig } from "@/lib/metrics/config";
import { upsertRunCells, upsertSingleCell, getTodayRunId } from "@/lib/runs/storage";
import type { CellResult } from "@/lib/runs/types";
import type {
  StageExtraction,
  ExploreExtraction,
  ConsiderExtraction,
  CompareExtraction,
  DecideExtraction,
} from "@/lib/scoring/schemas";
import {
  calculateExploreMetrics,
  calculateConsiderMetrics,
  calculateCompareMetrics,
  calculateDecideMetrics,
} from "@/lib/scoring/extractor";
import { uploadRunAsync } from "@/lib/filesearch/uploader";
import { getActiveMatrixConfigCached, getActivePersonaIds, getCoreStageMapping } from "@/lib/matrix/runtime";
import type { Stage } from "@/lib/intents/types";
import { saveRunAggregates, refreshRunMetadata } from "@/lib/runs/aggregator";
import {
  DEFAULT_PROVIDERS,
  DEFAULT_BRAND,
  DEFAULT_ALIASES,
  getCellKey,
  emptyExtraction,
} from "@/lib/runs/utils";
import {
  getBatchJob,
  updateBatchJobStatus,
  parseBatchCustomId,
  getBatchJobMetadata,
} from "@/lib/providers/batch";
import {
  getAnthropicBatchStatus,
  getAnthropicBatchResults,
} from "@/lib/providers/anthropic";

// Each stage should complete in ~90s with parallelized providers
// Set to 300s (5 min) for safety margin
export const maxDuration = 300;

export async function GET(
  req: Request,
  { params }: { params: Promise<{ stage: string }> }
) {
  const startTime = Date.now();
  const { stage: stageParam } = await params;

  console.log(`[cron/${stageParam}] Starting stage-specific benchmark...`);

  // Verify cron secret
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    console.error(`[cron/${stageParam}] Unauthorized - invalid or missing CRON_SECRET`);
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Load active matrix config
    const cfg = await getActiveMatrixConfigCached();

    // Validate stage parameter against active config
    const activeStageIds = cfg.stages.filter((s) => s.active).map((s) => s.id);
    if (!activeStageIds.includes(stageParam)) {
      return Response.json(
        { error: `Invalid stage: ${stageParam}. Active stages: ${activeStageIds.join(", ")}` },
        { status: 400 }
      );
    }

    const stage = stageParam as Stage;
    const coreStage = getCoreStageMapping(stage, cfg);

    // Determine if this is the last stage (for finalization tasks)
    const sortedStages = cfg.stages
      .filter((s) => s.active)
      .sort((a, b) => a.orderIndex - b.orderIndex);
    const isLastStage = sortedStages.length > 0 && sortedStages[sortedStages.length - 1].id === stage;

    // Use config personas instead of hardcoded ALL_PERSONAS
    const activePersonas = getActivePersonaIds(cfg);

    // Get consistent run ID for today (all stages write to same run)
    const runId = getTodayRunId();
    console.log(`[cron/${stage}] Using run ID: ${runId}`);

    let intentLibrary = await loadIntentLibrary();
    console.log(`[cron/${stage}] Loaded ${intentLibrary.intents.length} intents from library`);

    // Self-healing: detect stale intents and regenerate queries on-the-fly
    // instead of aborting the entire stage with 409
    const REQUIRED_QUERY_COUNT = 1; // Relaxed: 1+ queries is enough, 3 is ideal
    const todayUtc = new Date().toISOString().slice(0, 10); // YYYY-MM-DD (UTC)
    const staleIntents = intentLibrary.intents.filter((intent) => {
      if (!intent.active) return false;
      if (intent.stage !== stage) return false;
      if (!activePersonas.includes(intent.persona)) return false;

      const hasEnough = (intent.generatedQueries?.length ?? 0) >= REQUIRED_QUERY_COUNT;
      const isFresh = intent.generatedQueriesAt?.slice(0, 10) === todayUtc;

      return !hasEnough || !isFresh;
    });

    if (staleIntents.length > 0) {
      console.log(
        `[cron/${stage}] ${staleIntents.length} intents need fresh queries, generating...`
      );

      const regenResults = await Promise.allSettled(
        staleIntents.map(async (intent) => {
          const generated = await generateQueriesFromIntent({
            persona: intent.persona,
            stage,
            coreStage,
            intent: intent.text,
            role: intent.role,
            queryStyle: intent.queryStyle,
            count: 3,
          });
          await updateIntent(intent.id, {
            generatedQueries: generated.queries,
            generatedQueriesAt: new Date().toISOString(),
          });
          return { id: intent.id, queryCount: generated.queries.length };
        })
      );

      const regenOk = regenResults.filter((r) => r.status === "fulfilled").length;
      const regenFail = regenResults.filter((r) => r.status === "rejected").length;
      console.log(`[cron/${stage}] Query regen: ${regenOk} succeeded, ${regenFail} failed`);
      if (regenFail > 0) {
        for (const r of regenResults) {
          if (r.status === "rejected") {
            console.error(`[cron/${stage}] Regen failure:`, r.reason instanceof Error ? r.reason.message : r.reason);
          }
        }
      }

      // Reload intent library with freshly generated queries
      intentLibrary = await loadIntentLibrary();
      console.log(`[cron/${stage}] Reloaded ${intentLibrary.intents.length} intents after regen`);
    }

    const metricsConfig = loadMetricsConfig();
    const runCells: Record<string, CellResult> = {};
    const errors: Array<{ persona: string; stage: string; error: string }> = [];

    // Check for batch results from batch-submit cron
    const batchResults = new Map<string, { text: string; citations: string[]; raw: unknown }>();
    const batchStats = { anthropic: { available: 0, total: 0 } };

    try {
      const anthropicBatchJob = await getBatchJob(runId, "anthropic", "search");

      // Process Anthropic batch results
      if (anthropicBatchJob) {
        console.log(`[cron/${stage}] Found Anthropic batch job: ${anthropicBatchJob.batchId} (status: ${anthropicBatchJob.status})`);
        batchStats.anthropic.total = anthropicBatchJob.requestCount ?? 0;

        if (anthropicBatchJob.status === "pending" || anthropicBatchJob.status === "in_progress") {
          // Check current status
          const status = await getAnthropicBatchStatus(anthropicBatchJob.batchId);
          console.log(`[cron/${stage}] Anthropic batch status: ${status.status} (${status.counts.succeeded}/${status.counts.processing + status.counts.succeeded} succeeded)`);

          if (status.status === "completed") {
            await updateBatchJobStatus(anthropicBatchJob.id, "completed", { outputFileId: status.resultsUrl ?? undefined });
            anthropicBatchJob.status = "completed";
          } else if (status.status === "failed" || status.status === "expired") {
            await updateBatchJobStatus(anthropicBatchJob.id, status.status);
            anthropicBatchJob.status = status.status;
          }
        }

        if (anthropicBatchJob.status === "completed") {
          const metadata = await getBatchJobMetadata(anthropicBatchJob.id);
          const intentIdMap = (metadata?.intentIdMap as Record<string, string>) ?? {};

          // Download and parse results
          const results = await getAnthropicBatchResults(anthropicBatchJob.batchId);
          console.log(`[cron/${stage}] Downloaded ${results.length} Anthropic batch results`);

          for (const result of results) {
            if (result.success && result.text) {
              // Parse customId to get the key format we use in runner
              const parsed = parseBatchCustomId(result.customId);
              if (parsed && parsed.stage === stage) {
                const fullIntentId = intentIdMap[result.customId];
                if (fullIntentId) {
                  // Store with a key that matches how runner looks it up
                  const key = `anthropic_${fullIntentId}_${parsed.queryIndex}`;
                  batchResults.set(key, {
                    text: result.text,
                    citations: result.citations ?? [],
                    raw: result.raw,
                  });
                  batchStats.anthropic.available++;
                } else {
                  console.warn(`[cron/${stage}] Missing intentId mapping for customId: ${result.customId}`);
                }
              }
            }
          }
        }
      }

      console.log(`[cron/${stage}] Batch results: Anthropic ${batchStats.anthropic.available}/${batchStats.anthropic.total}`);
    } catch (batchErr) {
      console.error(`[cron/${stage}] Batch result fetch failed (will use sync):`, batchErr instanceof Error ? batchErr.message : batchErr);
    }

    // Metadata for saving cells
    const runMetadata = {
      brand: DEFAULT_BRAND,
      intentLibraryVersion: intentLibrary.version,
      metricsConfigVersion: metricsConfig.version,
    };

    // Process all active personas for THIS stage IN PARALLEL
    // Each persona SAVES IMMEDIATELY after completion - no data lost on timeout!
    const personaResults = await Promise.allSettled(
      activePersonas.map(async (persona) => {
        console.log(`[cron/${stage}] Processing ${persona}/${stage}...`);

        // Fetch active intents for this cell
        const activeIntents = intentLibrary.intents
          .filter((i) => i.persona === persona && i.stage === stage && i.active)
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

        if (activeIntents.length === 0) {
          console.log(`[cron/${stage}] Skipping ${persona}/${stage} - no active intents`);
          return null; // Skip this persona
        }

        // Use cached queries from batch-submit (cron must not regenerate)
        const QUERY_COUNT = 3;
        const intentsToRun = activeIntents.map((intent) => ({
          id: intent.id,
          queries: (intent.generatedQueries ?? []).slice(0, QUERY_COUNT),
        }));

        const benchmarkResult = await runBenchmark({
          stage,
          coreStage, // Pass core stage for scoring
          intents: intentsToRun,
          brand: DEFAULT_BRAND,
          brandAliases: DEFAULT_ALIASES,
          providers: DEFAULT_PROVIDERS,
          concurrency: 4, // Increased from 2 to 4 for more throughput
          triggerMode: "cron",
          runId,
          batchResults: batchResults.size > 0 ? batchResults : undefined,
        });

        // Calculate stage-specific metrics
        const allExtractions = benchmarkResult.queries
          .flatMap((qr) => qr.responses)
          .map((r) => r.stageExtraction)
          .filter((e): e is StageExtraction => Boolean(e));

        const relevantExtractions = allExtractions.filter((e) => e.responseRelevant);
        const extractionsForMetrics =
          relevantExtractions.length > 0 ? relevantExtractions : allExtractions;

        const metrics: CellResult["metrics"] = {};

        if (stage === "explore") {
          const { discoveryRate, topThreeRate } = calculateExploreMetrics(
            extractionsForMetrics as ExploreExtraction[]
          );
          metrics.discoveryRate = discoveryRate;
          metrics.topThreeRate = topThreeRate;
        } else if (stage === "consider") {
          const { avgSentiment } = calculateConsiderMetrics(
            extractionsForMetrics as ConsiderExtraction[]
          );
          metrics.sentimentScore = avgSentiment;
        } else if (stage === "compare") {
          const { winRate } = calculateCompareMetrics(
            extractionsForMetrics as CompareExtraction[]
          );
          metrics.winRate = winRate;
        } else if (stage === "decide") {
          const { recommendationRate } = calculateDecideMetrics(
            extractionsForMetrics as DecideExtraction[]
          );
          metrics.recommendationRate = recommendationRate;
        }

        // Convert to storage format
        const queryResults: CellResult["results"] = benchmarkResult.queries.map((qr) => {
          const responses: Record<
            string,
            {
              model: string;
              responseText: string;
              score: StageExtraction;
              citations?: {
                url: string;
                domain: string;
                title?: string;
                snippet?: string;
                sourceType: "url_citation" | "grounding_chunk";
              }[];
            }
          > = {};

          for (const resp of qr.responses) {
            const storedCitations = resp.citations?.map((c) => ({
              url: c.url,
              domain: c.domain,
              title: c.title,
              snippet: c.snippet,
              sourceType: c.sourceType,
            }));

            responses[resp.provider] = {
              model: resp.model,
              responseText: resp.text,
              score: resp.stageExtraction ?? emptyExtraction(stage),
              citations: storedCitations,
            };
          }

          return {
            query: qr.query,
            intentId: qr.intentId,
            responses,
          };
        });

        const cellResult: CellResult = {
          intentId: activeIntents[0].id,
          intentText: activeIntents[0].text,
          queriesUsed: benchmarkResult.queries.map((q) => q.query),
          metrics,
          results: queryResults,
        };

        // SAVE IMMEDIATELY with atomic upsert - safe for concurrent writes!
        // Uses jsonb_set to avoid read-modify-write race conditions
        const cellKey = getCellKey(persona, stage);
        console.log(`[cron/${stage}] Saving ${cellKey} atomically to database...`);
        await upsertSingleCell(runId, cellKey, cellResult, runMetadata);
        console.log(`[cron/${stage}] Completed and saved ${persona}/${stage}`);
        return { persona, cellResult };
      })
    );

    // Collect results for response (cells already saved above)
    for (let i = 0; i < personaResults.length; i++) {
      const result = personaResults[i];
      const persona = activePersonas[i];

      if (result.status === "fulfilled" && result.value) {
        runCells[getCellKey(result.value.persona, stage)] = result.value.cellResult;
      } else if (result.status === "rejected") {
        console.error(`[cron/${stage}] Error processing ${persona}/${stage}:`, result.reason);
        errors.push({
          persona,
          stage,
          error: result.reason instanceof Error ? result.reason.message : String(result.reason),
        });
      }
    }

    // Load the full run with all cells (including from other stages)
    console.log(`[cron/${stage}] Loading full run to update aggregates...`);
    const updatedRun = await upsertRunCells(runId, {}, runMetadata, isLastStage);

    // Save aggregates to optimization tables (non-blocking error handling)
    console.log(`[cron/${stage}] Saving aggregates to run_metrics, run_citations, run_summary...`);
    try {
      await saveRunAggregates(updatedRun);
    } catch (aggErr) {
      console.error(`[cron/${stage}] Aggregation failed (non-fatal):`, aggErr instanceof Error ? aggErr.message : aggErr);
      errors.push({
        persona: "all",
        stage,
        error: `Aggregation failed: ${aggErr instanceof Error ? aggErr.message : String(aggErr)}`,
      });
    }

    // Refresh materialized view after last stage completes
    if (isLastStage) {
      console.log(`[cron/${stage}] Last stage complete, refreshing materialized view...`);
      try {
        await refreshRunMetadata();
      } catch (mvErr) {
        console.error(`[cron/${stage}] Materialized view refresh failed (non-fatal):`, mvErr instanceof Error ? mvErr.message : mvErr);
      }
    }

    // Upload to FileSearch only after last stage completes
    // Note: uploadRunAsync already handles errors internally with try/catch
    if (isLastStage) {
      console.log(`[cron/${stage}] Last stage complete, uploading run to FileSearch...`);
      uploadRunAsync(updatedRun);
    }

    const executionTimeMs = Date.now() - startTime;
    console.log(
      `[cron/${stage}] Completed in ${executionTimeMs}ms (${(executionTimeMs / 1000).toFixed(1)}s)`
    );

    return Response.json({
      success: true,
      stage,
      runId,
      cellsProcessed: Object.keys(runCells).length,
      totalCellsInRun: Object.keys(updatedRun.cells).length,
      isLastStage,
      executionTimeMs,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (err) {
    console.error(`[cron/${stageParam}] Error:`, err instanceof Error ? err.message : err);
    return Response.json(
      {
        success: false,
        stage: stageParam,
        error: err instanceof Error ? err.message : "Unknown error",
        executionTimeMs: Date.now() - startTime,
      },
      { status: 500 }
    );
  }
}
