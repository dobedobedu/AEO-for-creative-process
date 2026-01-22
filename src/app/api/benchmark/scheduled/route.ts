/**
 * Scheduled Benchmark Endpoint
 *
 * Triggered by Vercel Cron daily at midnight EST (5 AM UTC).
 * Runs a full matrix benchmark across all personas × stages.
 * Generates 3 queries per intent (matching manual runs).
 */

import { runBenchmark } from "@/lib/benchmark";
import type { BenchmarkResult } from "@/lib/benchmark/runner";
import { loadIntentLibrary, updateIntent } from "@/lib/intents/library";
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
import type { Persona, Stage } from "@/lib/intents/types";
import { generateQueriesFromIntent } from "@/lib/intents/queryGenerator";
import {
    DEFAULT_PROVIDERS,
    ALL_PERSONAS,
    ALL_STAGES,
    DEFAULT_BRAND,
    DEFAULT_ALIASES,
    getCellKey,
    emptyExtraction,
} from "@/lib/runs/utils";

// Vercel cron functions need extended timeout for full matrix run
// 16 cells × 3 queries × 4 providers = ~10-13 minutes
export const maxDuration = 800; // Max for Pro plan (800 seconds)

export async function GET(req: Request) {
    const startTime = Date.now();

    console.log("[cron] Starting scheduled benchmark...");

    // Verify this is a legitimate cron request (Vercel adds this header)
    const authHeader = req.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    // In production, verify the cron secret
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
        console.error("[cron] Unauthorized - invalid or missing CRON_SECRET");
        return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const intentLibrary = await loadIntentLibrary();
        console.log(`[cron] Loaded ${intentLibrary.intents.length} intents from library`);

        const metricsConfig = loadMetricsConfig();
        const runCells: Record<string, CellResult> = {};
        const errors: Array<{ persona: string; stage: string; error: string }> = [];

        // Iterate through all persona × stage combinations
        for (const persona of ALL_PERSONAS) {
            for (const stage of ALL_STAGES) {
                try {
                    console.log(`[cron] Processing ${persona}/${stage}...`);

                    // Fetch active intents for this cell
                    const activeIntents = intentLibrary.intents
                        .filter((i) => i.persona === persona && i.stage === stage && i.active)
                        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

                    if (activeIntents.length === 0) {
                        console.log(`[cron] Skipping ${persona}/${stage} - no active intents`);
                        continue; // No intents for this cell
                    }

                    // Generate queries via DeepSeek for each intent (3 queries, matching manual runs)
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

                            // Save generated queries to intent library for reference
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
                        coreStage: stage, // Stage is already a core stage in this legacy route
                        intents: intentsToRun,
                        brand: DEFAULT_BRAND,
                        brandAliases: DEFAULT_ALIASES,
                        providers: DEFAULT_PROVIDERS,
                        concurrency: 2,
                    });

                    // Calculate aggregate metrics
                    const allExtractions = benchmarkResult.queries
                        .flatMap((qr) => qr.responses)
                        .map((r) => r.stageExtraction)
                        .filter((e): e is StageExtraction => Boolean(e));

                    const relevantExtractions = allExtractions.filter((e) => e.responseRelevant);
                    const extractionsForMetrics = (relevantExtractions.length > 0 ? relevantExtractions : allExtractions) as StageExtraction[];

                    const metrics: CellResult["metrics"] = {};

                    if (stage === "explore") {
                        const { discoveryRate, topThreeRate } = calculateExploreMetrics(extractionsForMetrics as ExploreExtraction[]);
                        metrics.discoveryRate = discoveryRate;
                        metrics.topThreeRate = topThreeRate;
                    } else if (stage === "consider") {
                        const { avgSentiment } = calculateConsiderMetrics(extractionsForMetrics as ConsiderExtraction[]);
                        metrics.sentimentScore = avgSentiment;
                    } else if (stage === "compare") {
                        const { winRate } = calculateCompareMetrics(extractionsForMetrics as CompareExtraction[]);
                        metrics.winRate = winRate;
                    } else if (stage === "decide") {
                        const { recommendationRate } = calculateDecideMetrics(extractionsForMetrics as DecideExtraction[]);
                        metrics.recommendationRate = recommendationRate;
                    }

                    // Convert to storage format
                    const queryResults: CellResult["results"] = benchmarkResult.queries.map((qr) => {
                        const responses: Record<string, { model: string; responseText: string; score: StageExtraction; citations?: { url: string; domain: string; title?: string; snippet?: string; sourceType: "url_citation" | "grounding_chunk" }[] }> = {};

                        for (const resp of qr.responses) {
                            // Convert citations to stored format (strip unnecessary fields)
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
                                score: resp.stageExtraction ?? emptyExtraction(stage),
                                citations: storedCitations,
                            };
                        }

                        return {
                            query: qr.query,
                            intentId: qr.intentId,
                            responses
                        };
                    });

                    runCells[getCellKey(persona, stage)] = {
                        intentId: activeIntents[0].id,
                        intentText: activeIntents[0].text,
                        queriesUsed: benchmarkResult.queries.map(q => q.query),
                        metrics,
                        results: queryResults,
                    };
                } catch (cellError) {
                    errors.push({
                        persona,
                        stage,
                        error: cellError instanceof Error ? cellError.message : String(cellError),
                    });
                }
            }
        }

        // Create and save run
        const id = generateRunId();
        const timestamp = new Date().toISOString();

        console.log(`[cron] All cells processed, creating run ${id}...`);

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
            brand: DEFAULT_BRAND,
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
        console.log(`[cron] Saving run ${id} to database...`);
        await saveRun(run);
        console.log(`[cron] Run saved, starting async upload to FileSearch...`);
        uploadRunAsync(run);

        const executionTimeMs = Date.now() - startTime;
        console.log(`[cron] Completed in ${executionTimeMs}ms (${(executionTimeMs / 1000).toFixed(1)}s)`);

        return Response.json({
            success: true,
            runId: id,
            timestamp,
            cellsProcessed: Object.keys(runCells).length,
            executionTimeMs,
            errors: errors.length > 0 ? errors : undefined,
        });
    } catch (err) {
        console.error("[cron] Error:", err instanceof Error ? err.message : err);
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
