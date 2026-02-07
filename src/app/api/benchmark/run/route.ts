import { z } from "zod";
import { runBenchmark } from "@/lib/benchmark";
import type { BenchmarkResult } from "@/lib/benchmark/runner";
import { loadIntentLibrary } from "@/lib/intents/library";
import { loadMetricsConfig } from "@/lib/metrics/config";
import { saveRun, generateRunId } from "@/lib/runs/storage";
import type { BenchmarkRun, CellResult } from "@/lib/runs/types";
import type { StageExtraction, ExploreExtraction, ConsiderExtraction, CompareExtraction, DecideExtraction } from "@/lib/scoring/schemas";
import {
  calculateExploreMetrics,
  calculateConsiderMetrics,
  calculateCompareMetrics,
  calculateDecideMetrics,
} from "@/lib/scoring/extractor";
import { uploadRunAsync } from "@/lib/filesearch/uploader";
import { saveRunAggregates } from "@/lib/runs/aggregator";
import { DEFAULT_PROVIDERS, getCellKey, emptyExtraction, calculateRunSummary } from "@/lib/runs/utils";
import { generateQueriesFromIntent } from "@/lib/intents/queryGenerator";
import { getActiveMatrixConfigCached, assertValidPersonaStage, getCoreStageMapping } from "@/lib/matrix/runtime";
import { cookies } from "next/headers";
import { initProgress, logProgress, incrementProgress, completeProgress, failProgress } from "@/lib/benchmark/progress";
import { getCurrentUser } from "@/lib/auth/supabase";
import { touchUserActivity } from "@/lib/auth/activity";

// 16 cells × 4 providers in parallel needs headroom
export const maxDuration = 300;

const RequestSchema = z.object({
  brand: z.string().min(1),
  brandAliases: z.array(z.string()).optional(),
  quickTest: z.boolean().optional(),
  cells: z
    .array(
      z.object({
        persona: z.string().min(1),
        stage: z.string().min(1),
      })
    )
    .min(1)
    .max(16),
  providers: z
    .array(
      z.object({
        provider: z.enum(["openai", "anthropic", "gemini", "xai"]),
        model: z.string().min(1),
      })
    )
    .optional(),
});

export async function POST(req: Request) {
  // Generate runId early for progress tracking (accessible in catch block)
  const id = generateRunId();

  try {
    const payload = await req.json();
    const data = RequestSchema.parse(payload);

    // Load active matrix config
    const cfg = await getActiveMatrixConfigCached();

    // Validate all cells against active config
    for (const cell of data.cells) {
      try {
        assertValidPersonaStage(cell.persona, cell.stage, cfg);
      } catch (err) {
        return Response.json(
          { error: `Invalid cell: ${cell.persona}/${cell.stage} - ${err instanceof Error ? err.message : "Not in active config"}` },
          { status: 400 }
        );
      }
    }

    const providers = data.providers ?? DEFAULT_PROVIDERS;

    // Get current user for attribution
    const cookieStore = await cookies();
    const user = await getCurrentUser(cookieStore);
    const actorUserId = user?.id;

    // Track user activity
    if (actorUserId) await touchUserActivity(actorUserId);

    const intentLibrary = await loadIntentLibrary();
    const metricsConfig = loadMetricsConfig();

    const quickTest = data.quickTest ?? false;

    // Estimate total steps: cells * providers (rough estimate before we know query counts)
    const estimatedSteps = data.cells.length * providers.length;
    await initProgress(id, estimatedSteps, "cells", actorUserId);

    const resultsByCell: Record<string, BenchmarkResult> = {};
    const runCells: Record<string, CellResult> = {};

    // Process cells in batches of 4 to avoid provider rate limits
    // (16 cells × 3 queries × 4 providers = 192 API calls; batching keeps
    // concurrent Anthropic calls at ~12 instead of ~48)
    const BATCH_SIZE = 4;
    const allCellResults: PromiseSettledResult<{
      cell: { persona: string; stage: string };
      benchmarkResult: BenchmarkResult;
      cellResult: CellResult;
    } | null>[] = [];

    for (let i = 0; i < data.cells.length; i += BATCH_SIZE) {
      const batch = data.cells.slice(i, i + BATCH_SIZE);
      const batchResults = await Promise.allSettled(
        batch.map(async (cell) => {
        // Fetch all active intents for this cell from the library
        const activeIntents = intentLibrary.intents
          .filter((i) => i.persona === cell.persona && i.stage === cell.stage && i.active)
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

        if (activeIntents.length === 0) return null;

        // Generate queries via DeepSeek for each intent
        const coreStage = getCoreStageMapping(cell.stage, cfg);
        const intentsToRun = await Promise.all(
          activeIntents.map(async (intent) => {
            const generated = await generateQueriesFromIntent({
              persona: cell.persona,
              stage: cell.stage,
              coreStage,
              intent: intent.text,
              role: intent.role,
              queryStyle: intent.queryStyle,
              count: quickTest ? 1 : 3,
            });
            return {
              id: intent.id,
              queries: generated.queries,
            };
          })
        );

        const benchmarkResult = await runBenchmark({
          stage: cell.stage,
          coreStage,
          intents: intentsToRun,
          brand: data.brand,
          brandAliases: data.brandAliases,
          providers,
          concurrency: 4,
        });

        // Calculate aggregate metrics across ALL intents in this cell
        const allExtractions = benchmarkResult.queries
          .flatMap((qr) => qr.responses)
          .map((r) => r.stageExtraction)
          .filter((e): e is StageExtraction => Boolean(e));

        const relevantExtractions = allExtractions.filter((e) => e.responseRelevant);
        const extractionsForMetrics = (relevantExtractions.length > 0 ? relevantExtractions : allExtractions) as StageExtraction[];

        const metrics: CellResult["metrics"] = {};

        if (cell.stage === "explore") {
          const { discoveryRate, topThreeRate } = calculateExploreMetrics(extractionsForMetrics as ExploreExtraction[]);
          metrics.discoveryRate = discoveryRate;
          metrics.topThreeRate = topThreeRate;
        } else if (cell.stage === "consider") {
          const { avgSentiment } = calculateConsiderMetrics(extractionsForMetrics as ConsiderExtraction[]);
          metrics.sentimentScore = avgSentiment;
        } else if (cell.stage === "compare") {
          const { winRate } = calculateCompareMetrics(extractionsForMetrics as CompareExtraction[]);
          metrics.winRate = winRate;
        } else if (cell.stage === "decide") {
          const { recommendationRate } = calculateDecideMetrics(extractionsForMetrics as DecideExtraction[]);
          metrics.recommendationRate = recommendationRate;
        }

        const queryResults: CellResult["results"] = benchmarkResult.queries.map((qr) => {
          const responses: Record<string, { model: string; responseText: string; score: StageExtraction; citations?: { url: string; domain: string; title?: string; snippet?: string; sourceType: "url_citation" | "grounding_chunk" }[] }> = {};

          for (const resp of qr.responses) {
            const storedCitations = resp.citations?.map(c => ({
              url: c.url,
              domain: c.domain,
              title: c.title,
              snippet: c.snippet,
              sourceType: c.sourceType,
            }));

            responses[resp.provider] = {
              model: resp.model,
              responseText: resp.text,
              score: resp.stageExtraction ?? emptyExtraction(cell.stage),
              citations: storedCitations,
            };
          }

          return {
            query: qr.query,
            intentId: qr.intentId,
            responses
          };
        });

        const cellResult: CellResult = {
          intentId: activeIntents[0].id,
          intentText: activeIntents[0].text,
          queriesUsed: benchmarkResult.queries.map(q => q.query),
          metrics,
          results: queryResults,
        };

        return { cell, benchmarkResult, cellResult };
        })
      );
      allCellResults.push(...batchResults);
      console.log(`[benchmark/run] Batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(data.cells.length / BATCH_SIZE)} complete`);
    }

    // Collect results and track progress
    for (const result of allCellResults) {
      if (result.status === "fulfilled" && result.value) {
        const { cell, benchmarkResult, cellResult } = result.value;
        const uiKey = `${cell.persona}-${cell.stage}`;
        resultsByCell[uiKey] = benchmarkResult;
        runCells[getCellKey(cell.persona, cell.stage)] = cellResult;
        await incrementProgress(id, 1);
        await logProgress(id, {
          message: `Completed ${cell.persona}/${cell.stage}`,
          persona: cell.persona,
          stage: cell.stage,
        });
      } else if (result.status === "rejected") {
        console.error("[benchmark/run] Cell failed:", result.reason instanceof Error ? result.reason.message : result.reason);
      }
    }

    const timestamp = new Date().toISOString();

    // Build run with summary calculated from cells
    const run: BenchmarkRun = {
      id,
      timestamp,
      intentLibraryVersion: intentLibrary.version,
      metricsConfigVersion: metricsConfig.version,
      brand: data.brand,
      summary: calculateRunSummary(runCells),
      cells: runCells,
    };

    // Persist + upload
    await saveRun(run);
    uploadRunAsync(run);

    // Save aggregates to optimization tables (run_metrics, run_citations, run_summary)
    try {
      await saveRunAggregates(run);
    } catch (aggErr) {
      console.error("[benchmark/run] Aggregation failed (non-fatal):", aggErr instanceof Error ? aggErr.message : aggErr);
    }

    // Mark progress complete
    await completeProgress(id);

    return Response.json({ run, resultsByCell });
  } catch (err) {
    // Log error message safely without passing raw error object
    let logMsg = "Unknown error";
    try {
      logMsg = err instanceof Error ? err.message : String(err);
    } catch {
      logMsg = "Error details unavailable";
    }
    console.error("[benchmark/run] Error:", logMsg);

    // Mark progress as failed
    await failProgress(id, logMsg);

    if (err instanceof z.ZodError) {
      return Response.json({ error: "Invalid request", details: err.errors }, { status: 400 });
    }

    // Defensive error message extraction to handle read-only error objects
    let errorMessage = "Unknown error";
    try {
      if (err instanceof Error) {
        errorMessage = err.message;
      } else if (err && typeof err === "object" && "message" in err) {
        errorMessage = String((err as { message: unknown }).message);
      } else if (typeof err === "string") {
        errorMessage = err;
      }
    } catch {
      errorMessage = "Error processing failed";
    }

    return Response.json({ error: errorMessage }, { status: 500 });
  }
}
