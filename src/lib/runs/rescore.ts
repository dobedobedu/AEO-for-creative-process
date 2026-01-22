/**
 * Re-scoring utility for benchmark runs
 *
 * Uses Gemini to re-extract stage metrics from stored response text.
 * This allows historical runs to be re-scored with updated extraction logic.
 */

import type { BenchmarkRun, CellResult, Provider } from "./types";
import type {
  StageExtraction,
  ExploreExtraction,
  ConsiderExtraction,
  CompareExtraction,
  DecideExtraction,
} from "../scoring/schemas";
import {
  extractStageMetrics,
  calculateExploreMetrics,
  calculateConsiderMetrics,
  calculateCompareMetrics,
  calculateDecideMetrics,
} from "../scoring/extractor";
import type { Stage } from "../intents/types";

export interface RescoreProgress {
  completed: number;
  total: number;
  currentCell?: string;
}

export interface RescoreResult {
  success: boolean;
  run: BenchmarkRun;
  stats: {
    totalResponses: number;
    successfulExtractions: number;
    failedExtractions: number;
    cellsProcessed: number;
  };
  errors: string[];
}

/**
 * Re-scores all responses in a benchmark run using the current extraction logic.
 *
 * What gets updated:
 * - response.score - replaced with new StageExtraction from extractStageMetrics()
 * - Cell metrics (discovery/sentiment/win/recommendation rates)
 * - Overall run summary
 *
 * What stays unchanged:
 * - run.brand, run.brandAliases
 * - All intents, queries, response text
 * - Timestamps
 *
 * @param run - The benchmark run to rescore
 * @param brand - The brand name for extraction
 * @param brandAliases - Optional brand aliases
 * @param onProgress - Optional callback for progress updates
 * @returns The rescored run with updated metrics
 */
export async function rescoreRun(
  run: BenchmarkRun,
  brand: string,
  brandAliases: string[] = [],
  onProgress?: (progress: RescoreProgress) => void
): Promise<RescoreResult> {
  const errors: string[] = [];
  let totalResponses = 0;
  let successfulExtractions = 0;
  let failedExtractions = 0;
  let cellsProcessed = 0;

  // Count total responses for progress tracking
  for (const cellResult of Object.values(run.cells)) {
    for (const qr of cellResult.results) {
      totalResponses += Object.keys(qr.responses).length;
    }
  }

  let completed = 0;

  // Process each cell
  for (const [cellKey, cellResult] of Object.entries(run.cells)) {
    // Extract stage from cell key (format: "persona_stage", e.g., "move_up_explore")
    // Use lastIndexOf to handle personas with underscores
    const lastUnderscoreIdx = cellKey.lastIndexOf("_");
    const stage = cellKey.slice(lastUnderscoreIdx + 1) as Stage;

    onProgress?.({
      completed,
      total: totalResponses,
      currentCell: cellKey,
    });

    // Process each query result
    for (const queryResult of cellResult.results) {
      const query = queryResult.query;

      // Process each provider response
      for (const [provider, response] of Object.entries(queryResult.responses)) {
        const responseText = response.responseText;

        if (!responseText || responseText.trim().length === 0) {
          errors.push(`Empty response text for ${cellKey}/${query}/${provider}`);
          failedExtractions++;
          completed++;
          continue;
        }

        try {
          const result = await extractStageMetrics({
            stage,
            query,
            responseText,
            provider,
            brand,
            brandTerms: brandAliases,
          });

          if (result.success && result.extraction) {
            // Replace the score with the new extraction
            response.score = result.extraction;
            successfulExtractions++;
          } else {
            errors.push(
              `Extraction failed for ${cellKey}/${query}/${provider}: ${result.error || "Unknown error"}`
            );
            failedExtractions++;
          }
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : String(err);
          errors.push(`Exception for ${cellKey}/${query}/${provider}: ${errorMsg}`);
          failedExtractions++;
        }

        completed++;
        onProgress?.({
          completed,
          total: totalResponses,
          currentCell: cellKey,
        });
      }
    }

    // Recalculate cell metrics after re-scoring all responses
    recalculateCellMetrics(cellResult, stage);
    cellsProcessed++;
  }

  // Recalculate run summary
  recalculateRunSummary(run);

  return {
    success: failedExtractions === 0,
    run,
    stats: {
      totalResponses,
      successfulExtractions,
      failedExtractions,
      cellsProcessed,
    },
    errors,
  };
}

/**
 * Recalculates the metrics for a cell based on its current response scores.
 */
function recalculateCellMetrics(cell: CellResult, stage: Stage): void {
  // Collect all extractions from the cell's responses
  const allExtractions: StageExtraction[] = [];

  for (const qr of cell.results) {
    for (const response of Object.values(qr.responses)) {
      if (response.score) {
        allExtractions.push(response.score);
      }
    }
  }

  // Filter to relevant responses only
  const relevantExtractions = allExtractions.filter((e) => e.responseRelevant);
  const extractionsForMetrics =
    relevantExtractions.length > 0 ? relevantExtractions : allExtractions;

  // Calculate stage-specific metrics
  if (stage === "explore") {
    const { discoveryRate, topThreeRate } = calculateExploreMetrics(
      extractionsForMetrics as ExploreExtraction[]
    );
    cell.metrics.discoveryRate = discoveryRate;
    cell.metrics.topThreeRate = topThreeRate;
  } else if (stage === "consider") {
    const { avgSentiment } = calculateConsiderMetrics(
      extractionsForMetrics as ConsiderExtraction[]
    );
    cell.metrics.sentimentScore = avgSentiment;
  } else if (stage === "compare") {
    const { winRate } = calculateCompareMetrics(
      extractionsForMetrics as CompareExtraction[]
    );
    cell.metrics.winRate = winRate;
  } else if (stage === "decide") {
    const { recommendationRate } = calculateDecideMetrics(
      extractionsForMetrics as DecideExtraction[]
    );
    cell.metrics.recommendationRate = recommendationRate;
  }
}

/**
 * Recalculates the run summary from cell metrics.
 */
function recalculateRunSummary(run: BenchmarkRun): void {
  const cells = Object.values(run.cells);

  const discoveryRates = cells
    .map((c) => c.metrics.discoveryRate)
    .filter((v): v is number => v !== undefined);
  const sentimentScores = cells
    .map((c) => c.metrics.sentimentScore)
    .filter((v): v is number => v !== undefined);
  const winRates = cells
    .map((c) => c.metrics.winRate)
    .filter((v): v is number => v !== undefined);
  const recommendationRates = cells
    .map((c) => c.metrics.recommendationRate)
    .filter((v): v is number => v !== undefined);

  run.summary = {
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
        winRates.length > 0
          ? winRates.reduce((a, b) => a + b, 0) / winRates.length
          : 0,
      recommendationRate:
        recommendationRates.length > 0
          ? recommendationRates.reduce((a, b) => a + b, 0) / recommendationRates.length
          : 0,
    },
  };
}

/**
 * Dry run version that shows what would change without making changes.
 */
export async function dryRunRescore(
  run: BenchmarkRun
): Promise<{
  cellCount: number;
  queryCount: number;
  responseCount: number;
  stages: Record<Stage, number>;
}> {
  let queryCount = 0;
  let responseCount = 0;
  const stages: Record<Stage, number> = {
    explore: 0,
    consider: 0,
    compare: 0,
    decide: 0,
  };

  for (const [cellKey, cellResult] of Object.entries(run.cells)) {
    // Use lastIndexOf to handle personas with underscores (e.g., "move_up_explore")
    const lastUnderscoreIdx = cellKey.lastIndexOf("_");
    const stage = cellKey.slice(lastUnderscoreIdx + 1) as Stage;
    stages[stage]++;

    for (const qr of cellResult.results) {
      queryCount++;
      responseCount += Object.keys(qr.responses).length;
    }
  }

  return {
    cellCount: Object.keys(run.cells).length,
    queryCount,
    responseCount,
    stages,
  };
}
