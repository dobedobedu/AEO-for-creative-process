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

const DEFAULT_PROVIDERS: Array<{ provider: Provider; model: string }> = [
  { provider: "openai", model: "gpt-5.2" },
  { provider: "anthropic", model: "claude-haiku-4-5" },
  { provider: "gemini", model: "gemini-3-flash-preview" },
  { provider: "xai", model: "grok-4-latest" },
];

function getCellKey(persona: Persona, stage: Stage): string {
  return `${persona}_${stage}`;
}

function emptyExtraction(stage: Stage): StageExtraction {
  switch (stage) {
    case "explore":
      return {
        mentioned: false,
        responseRelevant: false,
        inTopThree: false,
        totalOptionsListed: 0,
        competitors: [],
        howDescribed: "not mentioned",
      };
    case "consider":
      return {
        mentioned: false,
        responseRelevant: false,
        sentiment: "neutral",
        sentimentScore: 0,
        strengthsMentioned: [],
        concernsRaised: [],
        overallPortrayal: "not mentioned",
      };
    case "compare":
      return {
        mentioned: false,
        responseRelevant: false,
        comparedTo: [],
        outcome: "not_compared",
        winsOn: [],
        losesOn: [],
        aiConclusion: "not compared",
      };
    case "decide":
      return {
        mentioned: false,
        responseRelevant: false,
        recommended: false,
        recommendationStrength: "not_mentioned",
        qualifiers: [],
        alternativesOffered: [],
        decisionRationale: "not mentioned",
      };
  }
}

export async function POST(req: Request) {
  try {
    const payload = await req.json();
    const data = RequestSchema.parse(payload);

    const providers = data.providers ?? DEFAULT_PROVIDERS;

    const intentLibrary = loadIntentLibrary();
    const metricsConfig = loadMetricsConfig();

    const quickTest = data.quickTest ?? false;

    const resultsByCell: Record<string, BenchmarkResult> = {};
    const runCells: Record<string, CellResult> = {};

    for (const cell of data.cells) {
      const intents = intentLibrary.intents
        .filter((i) => i.persona === cell.persona && i.stage === cell.stage && i.active)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

      const intent = intents[0];
      if (!intent) continue;

      const queriesToRun = quickTest ? [intent.defaultQueries[0]] : intent.defaultQueries;

      const benchmarkResult = await runBenchmark({
        stage: cell.stage,
        queries: queriesToRun,
        brand: data.brand,
        brandAliases: data.brandAliases,
        providers,
        concurrency: 2,
      });

      const uiKey = `${cell.persona}-${cell.stage}`;
      resultsByCell[uiKey] = benchmarkResult;

      // Convert to run storage format
      const queryResults: CellResult["results"] = benchmarkResult.queries.map((qr) => {
        const responses: Record<string, { model: string; responseText: string; score: StageExtraction }> = {};

        for (const resp of qr.responses) {
          responses[resp.provider] = {
            model: resp.model,
            responseText: resp.text,
            score: resp.stageExtraction ?? emptyExtraction(cell.stage),
          };
        }

        return { query: qr.query, responses };
      });

      const allExtractions = benchmarkResult.queries
        .flatMap((qr) => qr.responses)
        .map((r) => r.stageExtraction)
        .filter((e): e is StageExtraction => Boolean(e));

      const relevantExtractions = allExtractions.filter((e) => e.responseRelevant);

      const extractionsForMetrics = (relevantExtractions.length > 0
        ? relevantExtractions
        : allExtractions) as StageExtraction[];

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

      runCells[getCellKey(cell.persona, cell.stage)] = {
        intentId: intent.id,
        intentText: intent.text,
        queriesUsed: queriesToRun,
        metrics,
        results: queryResults,
      };
    }

    const id = generateRunId();
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
    saveRun(run);
    uploadRunAsync(run);

    return Response.json({ run, resultsByCell });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return Response.json({ error: "Invalid request", details: err.errors }, { status: 400 });
    }
    return Response.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
