import { z } from "zod";
import { runBenchmark, type Provider } from "@/lib/benchmark";
import type { BenchmarkResult } from "@/lib/benchmark/runner";
import { PersonaSchema, StageSchema, type Persona, type Stage } from "@/lib/intents/types";
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
import { DEFAULT_PROVIDERS, getCellKey, emptyExtraction } from "@/lib/runs/utils";
import { generateQueriesFromIntent } from "@/lib/intents/queryGenerator";
import { cookies } from "next/headers";
import { initProgress, logProgress, incrementProgress, completeProgress, failProgress } from "@/lib/benchmark/progress";
import { getCurrentUser } from "@/lib/auth/supabase";
import { touchUserActivity } from "@/lib/auth/activity";

const RequestSchema = z.object({
  brand: z.string().min(1),
  brandAliases: z.array(z.string()).optional(),
  quickTest: z.boolean().optional(),
  cells: z
    .array(
      z.object({
        persona: PersonaSchema,
        stage: StageSchema,
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

    for (const cell of data.cells) {
      // Fetch all active intents for this cell from the library
      const activeIntents = intentLibrary.intents
        .filter((i) => i.persona === cell.persona && i.stage === cell.stage && i.active)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

      if (activeIntents.length === 0) continue;

      // Generate queries via DeepSeek for each intent
      const intentsToRun = await Promise.all(
        activeIntents.map(async (intent) => {
          const generated = await generateQueriesFromIntent({
            persona: cell.persona,
            stage: cell.stage,
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
        intents: intentsToRun,
        brand: data.brand,
        brandAliases: data.brandAliases,
        providers,
        concurrency: 2,
      });

      const uiKey = `${cell.persona}-${cell.stage}`;
      resultsByCell[uiKey] = benchmarkResult;

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

      // Convert to run storage format
      // Note: We currently store one intent text as "primary" for the cell summary in old format
      // but queries now have intentId attached.
      const queryResults: CellResult["results"] = benchmarkResult.queries.map((qr) => {
        const responses: Record<string, { model: string; responseText: string; score: StageExtraction }> = {};

        for (const resp of qr.responses) {
          responses[resp.provider] = {
            model: resp.model,
            responseText: resp.text,
            score: resp.stageExtraction ?? emptyExtraction(cell.stage),
          };
        }

        return {
          query: qr.query,
          // Inject intentId if available from runner, otherwise fallback to first intent
          intentId: qr.intentId,
          responses
        };
      });

      runCells[getCellKey(cell.persona, cell.stage)] = {
        // Use the most recent intent as the "primary" label for legacy views
        intentId: activeIntents[0].id,
        intentText: activeIntents[0].text,
        queriesUsed: benchmarkResult.queries.map(q => q.query),
        metrics,
        results: queryResults,
      };

      // Track progress
      await incrementProgress(id, 1);
      await logProgress(id, {
        message: `Completed ${cell.persona}/${cell.stage}`,
        persona: cell.persona,
        stage: cell.stage,
      });
    }

    const timestamp = new Date().toISOString();

    // Overall summary across all returned cells
    const cells = Object.values(runCells);
    const discoveryRates = cells.map((c) => c.metrics.discoveryRate).filter((v): v is number => v !== undefined);
    const sentimentScores = cells.map((c) => c.metrics.sentimentScore).filter((v): v is number => v !== undefined);
    const winRates = cells.map((c) => c.metrics.winRate).filter((v): v is number => v !== undefined);
    const recommendationRates = cells.map((c) => c.metrics.recommendationRate).filter((v): v is number => v !== undefined);

    const run: BenchmarkRun = {
      id,
      timestamp,
      intentLibraryVersion: intentLibrary.version,
      metricsConfigVersion: metricsConfig.version,
      brand: data.brand,
      summary: {
        overall: {
          discoveryRate:
            discoveryRates.length > 0
              ? discoveryRates.reduce((a, b) => a + b, 0) / discoveryRates.length
              : 0,
          avgSentiment:
            sentimentScores.length > 0
              ? sentimentScores.reduce((a, b) => a + b, 0) / sentimentScores.length
              : 0,
          avgWinRate:
            winRates.length > 0 ? winRates.reduce((a, b) => a + b, 0) / winRates.length : 0,
          recommendationRate:
            recommendationRates.length > 0
              ? recommendationRates.reduce((a, b) => a + b, 0) / recommendationRates.length
              : 0,
        },
      },
      cells: runCells,
    };

    // Persist + upload
    await saveRun(run);
    uploadRunAsync(run);

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
