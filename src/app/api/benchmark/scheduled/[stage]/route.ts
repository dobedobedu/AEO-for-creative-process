/**
 * Stage-Specific Scheduled Benchmark Endpoint
 *
 * Handles a single stage (explore/consider/compare/decide) to stay under
 * Vercel's 800s Pro plan timeout limit.
 *
 * Each stage processes 4 personas for that stage only.
 * All stages for the same day write to the same run ID.
 */

import { runBenchmark } from "@/lib/benchmark";
import { loadIntentLibrary, updateIntent } from "@/lib/intents/library";
import { loadMetricsConfig } from "@/lib/metrics/config";
import { upsertRunCells, getTodayRunId } from "@/lib/runs/storage";
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
import type { Persona, Stage } from "@/lib/intents/types";
import { generateQueriesFromIntent } from "@/lib/intents/queryGenerator";
import { saveRunAggregates, refreshRunMetadata } from "@/lib/runs/aggregator";
import {
  DEFAULT_PROVIDERS,
  ALL_PERSONAS,
  ALL_STAGES,
  DEFAULT_BRAND,
  DEFAULT_ALIASES,
  getCellKey,
  emptyExtraction,
} from "@/lib/runs/utils";

// Each stage should complete in ~90s with parallelized providers
// Set to 300s (5 min) for safety margin
export const maxDuration = 300;

// Valid stages for URL validation
const VALID_STAGES = new Set<Stage>(ALL_STAGES);

export async function GET(
  req: Request,
  { params }: { params: Promise<{ stage: string }> }
) {
  const startTime = Date.now();
  const { stage: stageParam } = await params;

  // Validate stage parameter
  if (!VALID_STAGES.has(stageParam as Stage)) {
    return Response.json(
      { error: `Invalid stage: ${stageParam}. Must be one of: ${ALL_STAGES.join(", ")}` },
      { status: 400 }
    );
  }

  const stage = stageParam as Stage;
  const isLastStage = stage === "decide";

  console.log(`[cron/${stage}] Starting stage-specific benchmark...`);

  // Verify cron secret
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    console.error(`[cron/${stage}] Unauthorized - invalid or missing CRON_SECRET`);
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const intentLibrary = await loadIntentLibrary();
    console.log(`[cron/${stage}] Loaded ${intentLibrary.intents.length} intents from library`);

    const metricsConfig = loadMetricsConfig();
    const runCells: Record<string, CellResult> = {};
    const errors: Array<{ persona: string; stage: string; error: string }> = [];

    // Get consistent run ID for today (all stages write to same run)
    const runId = getTodayRunId();
    console.log(`[cron/${stage}] Using run ID: ${runId}`);

    // Process all 4 personas for THIS stage IN PARALLEL
    // This reduces time from 4×75s=300s to ~75s (slowest persona)
    const personaResults = await Promise.allSettled(
      ALL_PERSONAS.map(async (persona) => {
        console.log(`[cron/${stage}] Processing ${persona}/${stage}...`);

        // Fetch active intents for this cell
        const activeIntents = intentLibrary.intents
          .filter((i) => i.persona === persona && i.stage === stage && i.active)
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

        if (activeIntents.length === 0) {
          console.log(`[cron/${stage}] Skipping ${persona}/${stage} - no active intents`);
          return null; // Skip this persona
        }

        // Generate queries via DeepSeek for each intent (3 queries)
        const intentsToRun = await Promise.all(
          activeIntents.map(async (intent) => {
            const generated = await generateQueriesFromIntent({
              persona,
              stage,
              intent: intent.text,
              role: intent.role,
              queryStyle: intent.queryStyle,
              count: 3,
            });

            // Save generated queries to intent library
            await updateIntent(intent.id, {
              generatedQueries: generated.queries,
            });

            return {
              id: intent.id,
              queries: generated.queries,
            };
          })
        );

        const benchmarkResult = await runBenchmark({
          stage,
          intents: intentsToRun,
          brand: DEFAULT_BRAND,
          brandAliases: DEFAULT_ALIASES,
          providers: DEFAULT_PROVIDERS,
          concurrency: 4, // Increased from 2 to 4 for more throughput
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

        console.log(`[cron/${stage}] Completed ${persona}/${stage}`);
        return { persona, cellResult };
      })
    );

    // Collect results from parallel execution
    for (let i = 0; i < personaResults.length; i++) {
      const result = personaResults[i];
      const persona = ALL_PERSONAS[i];

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

    // Save cells to the shared run
    console.log(`[cron/${stage}] Saving ${Object.keys(runCells).length} cells to run ${runId}...`);
    const updatedRun = await upsertRunCells(
      runId,
      runCells,
      {
        brand: DEFAULT_BRAND,
        intentLibraryVersion: intentLibrary.version,
        metricsConfigVersion: metricsConfig.version,
      },
      isLastStage
    );

    // Save aggregates to optimization tables
    console.log(`[cron/${stage}] Saving aggregates to run_metrics, run_citations, run_summary...`);
    await saveRunAggregates(updatedRun);

    // Refresh materialized view after last stage completes
    if (isLastStage) {
      console.log(`[cron/${stage}] Last stage complete, refreshing materialized view...`);
      await refreshRunMetadata();
    }

    // Upload to FileSearch only after last stage completes
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
    console.error(`[cron/${stage}] Error:`, err instanceof Error ? err.message : err);
    return Response.json(
      {
        success: false,
        stage,
        error: err instanceof Error ? err.message : "Unknown error",
        executionTimeMs: Date.now() - startTime,
      },
      { status: 500 }
    );
  }
}
