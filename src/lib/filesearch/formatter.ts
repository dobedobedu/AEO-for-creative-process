/**
 * Format benchmark results for FileSearchStore upload
 * 
 * Supports both legacy format and new Intent Library + Stage-Aware Scoring format.
 */

import type { BenchmarkResult, QueryResult, ProviderResponse } from "@/lib/benchmark/runner";
import type { CustomMetadata } from "@google/genai";
import type { BenchmarkRun, CellResult } from "@/lib/runs/types";
import type { Stage } from "@/lib/intents/types";
import type { StageExtraction } from "@/lib/scoring/schemas";

import { getBrandName } from "@/lib/config";

export interface FormattedBenchmark {
  content: string;
  metadata: CustomMetadata[];
  displayName: string;
}

/**
 * Format a single provider response for optimal chunking
 */
function formatResponse(resp: ProviderResponse, queryText: string): string {
  const lines = [
    `## Provider: ${resp.provider.toUpperCase()} (${resp.model})`,
    `Query: "${queryText}"`,
    `Position: ${resp.visibility.position}`,
    `Score: ${(resp.visibility.score * 100).toFixed(0)}%`,
    `Sentiment: ${resp.visibility.sentiment}`,
    `Mentioned: ${resp.visibility.mentioned ? "Yes" : "No"}`,
    resp.visibility.competitorsMentioned.length > 0
      ? `Competitors: ${resp.visibility.competitorsMentioned.join(", ")}`
      : null,
    "",
    "### Response:",
    resp.text,
    "",
    "---",
    "",
  ];

  return lines.filter(Boolean).join("\n");
}

/**
 * Format benchmark results for upload to FileSearchStore
 */
export function formatBenchmarkForUpload(
  results: BenchmarkResult,
  persona: string,
  stage: string,
  brand?: string
): FormattedBenchmark {
  const resolvedBrand = brand ?? getBrandName();
  const runDate = new Date().toISOString().split("T")[0];
  const timestamp = new Date().toISOString();

  // Build document header
  const header = [
    `# AI Visibility Benchmark Results`,
    ``,
    `- **Brand**: ${resolvedBrand}`,
    `- **Persona**: ${persona}`,
    `- **Stage**: ${stage}`,
    `- **Run Date**: ${runDate}`,
    `- **Total Queries**: ${results.summary.totalQueries}`,
    `- **Providers**: ${results.summary.providersUsed.join(", ")}`,
    ``,
    `## Summary`,
    ``,
  ];

  // Add provider stats
  for (const provider of results.summary.providersUsed) {
    const mentionRate = results.summary.brandMentionRate[provider] ?? 0;
    const avgScore = results.summary.avgVisibilityScore[provider] ?? 0;
    header.push(
      `- **${provider}**: Mention Rate ${(mentionRate * 100).toFixed(0)}%, Avg Score ${(avgScore * 100).toFixed(0)}%`
    );
  }

  header.push("", "---", "", "# Query Results", "");

  // Format each query and its responses
  const queryBlocks: string[] = [];
  for (const queryResult of results.queries) {
    queryBlocks.push(`# Query: "${queryResult.query}"`, "");

    for (const response of queryResult.responses) {
      if (!response.error) {
        queryBlocks.push(formatResponse(response, queryResult.query));
      }
    }
  }

  const content = [...header, ...queryBlocks].join("\n");

  // Calculate aggregate metrics for metadata
  const allResponses = results.queries.flatMap((q) => q.responses);
  const mentionedCount = allResponses.filter((r) => r.visibility.mentioned).length;
  const avgScore =
    allResponses.length > 0
      ? allResponses.reduce((sum, r) => sum + r.visibility.score, 0) / allResponses.length
      : 0;

  // Extract competitive intelligence for metadata
  const allCompetitors = new Set<string>();
  for (const r of allResponses) {
    for (const comp of r.visibility.competitorsMentioned) {
      allCompetitors.add(comp);
    }
  }

  // Build metadata for filtering
  const metadata: CustomMetadata[] = [
    { key: "persona", stringValue: persona },
    { key: "stage", stringValue: stage },
    { key: "brand", stringValue: resolvedBrand },
    { key: "run_date", stringValue: runDate },
    { key: "timestamp", stringValue: timestamp },
    { key: "total_queries", numericValue: results.summary.totalQueries },
    { key: "total_responses", numericValue: allResponses.length },
    { key: "mention_count", numericValue: mentionedCount },
    { key: "avg_score", numericValue: Math.round(avgScore * 100) },
    // Competitive intelligence metadata
    { key: "competitors_mentioned", stringValue: [...allCompetitors].slice(0, 10).join(", ") },
  ];

  if (searchMode) {
    metadata.push({ key: "search_mode", stringValue: searchMode });
  }

  const displayName = `${persona}_${stage}_${runDate}_${Date.now()}`;

  return { content, metadata, displayName };
}

/**
 * Format a single query result (for incremental uploads)
 */
export function formatQueryResult(
  queryResult: QueryResult,
  persona: string,
  stage: string,
  brand?: string
): FormattedBenchmark {
  const resolvedBrand = brand ?? getBrandName();
  const runDate = new Date().toISOString().split("T")[0];
  const timestamp = new Date().toISOString();

  const lines = [
    `# AI Response: "${queryResult.query}"`,
    ``,
    `- **Brand**: ${resolvedBrand}`,
    `- **Persona**: ${persona}`,
    `- **Stage**: ${stage}`,
    `- **Run Date**: ${runDate}`,
    ``,
    "---",
    "",
  ];

  for (const response of queryResult.responses) {
    if (!response.error) {
      lines.push(formatResponse(response, queryResult.query));
    }
  }

  const content = lines.join("\n");

  const mentionedCount = queryResult.responses.filter((r) => r.visibility.mentioned).length;
  const avgScore =
    queryResult.responses.length > 0
      ? queryResult.responses.reduce((sum, r) => sum + r.visibility.score, 0) /
        queryResult.responses.length
      : 0;

  const metadata: CustomMetadata[] = [
    { key: "persona", stringValue: persona },
    { key: "stage", stringValue: stage },
    { key: "brand", stringValue: resolvedBrand },
    { key: "run_date", stringValue: runDate },
    { key: "timestamp", stringValue: timestamp },
    { key: "query", stringValue: queryResult.query.slice(0, 200) },
    { key: "mention_count", numericValue: mentionedCount },
    { key: "avg_score", numericValue: Math.round(avgScore * 100) },
  ];

  if (searchMode) {
    metadata.push({ key: "search_mode", stringValue: searchMode });
  }

  const querySlug = queryResult.query.slice(0, 30).replace(/[^a-z0-9]/gi, "_");
  const displayName = `${persona}_${stage}_${querySlug}_${Date.now()}`;

  return { content, metadata, displayName };
}

// ============================================================================
// New Intent Library + Stage-Aware Scoring Format
// ============================================================================

/**
 * Format stage-specific extraction results for display
 */
function formatStageExtraction(stage: Stage, extraction: StageExtraction): string {
  const lines: string[] = [];

  if ("inTopThree" in extraction) {
    // EXPLORE
    lines.push(`- Mentioned: ${extraction.mentioned ? "Yes" : "No"}`);
    lines.push(`- In Top 3: ${extraction.inTopThree ? "Yes" : "No"}`);
    lines.push(`- Total Options Listed: ${extraction.totalOptionsListed}`);
    if (extraction.competitors.length > 0) {
      lines.push(`- Competitors: ${extraction.competitors.join(", ")}`);
    }
    lines.push(`- Description: ${extraction.howDescribed}`);
  } else if ("sentimentScore" in extraction) {
    // CONSIDER
    lines.push(`- Mentioned: ${extraction.mentioned ? "Yes" : "No"}`);
    lines.push(`- Sentiment: ${extraction.sentiment} (${extraction.sentimentScore.toFixed(2)})`);
    if (extraction.strengthsMentioned.length > 0) {
      lines.push(`- Strengths: ${extraction.strengthsMentioned.join(", ")}`);
    }
    if (extraction.concernsRaised.length > 0) {
      lines.push(`- Concerns: ${extraction.concernsRaised.join(", ")}`);
    }
    lines.push(`- Portrayal: ${extraction.overallPortrayal}`);
  } else if ("outcome" in extraction) {
    // COMPARE
    lines.push(`- Mentioned: ${extraction.mentioned ? "Yes" : "No"}`);
    lines.push(`- Outcome: ${extraction.outcome}`);
    if (extraction.comparedTo.length > 0) {
      lines.push(`- Compared To: ${extraction.comparedTo.join(", ")}`);
    }
    if (extraction.winsOn.length > 0) {
      lines.push(`- Wins On: ${extraction.winsOn.join(", ")}`);
    }
    if (extraction.losesOn.length > 0) {
      lines.push(`- Loses On: ${extraction.losesOn.join(", ")}`);
    }
    lines.push(`- AI Conclusion: ${extraction.aiConclusion}`);
  } else if ("recommendationStrength" in extraction) {
    // DECIDE
    lines.push(`- Mentioned: ${extraction.mentioned ? "Yes" : "No"}`);
    lines.push(`- Recommended: ${extraction.recommended ? "Yes" : "No"}`);
    lines.push(`- Strength: ${extraction.recommendationStrength}`);
    if (extraction.qualifiers.length > 0) {
      lines.push(`- Qualifiers: ${extraction.qualifiers.join(", ")}`);
    }
    if (extraction.alternativesOffered.length > 0) {
      lines.push(`- Alternatives: ${extraction.alternativesOffered.join(", ")}`);
    }
    lines.push(`- Rationale: ${extraction.decisionRationale}`);
  }

  return lines.join("\n");
}

/**
 * Format a full benchmark run for FileSearchStore
 * Uses the new Intent Library + Stage-Aware Scoring format
 */
export function formatRunForUpload(run: BenchmarkRun, searchMode?: string): FormattedBenchmark[] {
  const documents: FormattedBenchmark[] = [];
  const runDate = run.timestamp.split("T")[0];

  if (!run.cells) return documents;

  // Create a document for each cell
  for (const [cellKey, cell] of Object.entries(run.cells)) {
    // Split from end - stage is always last part (e.g., "move_up_explore" → ["move_up", "explore"])
    const lastUnderscoreIdx = cellKey.lastIndexOf("_");
    const persona = cellKey.slice(0, lastUnderscoreIdx);
    const stage = cellKey.slice(lastUnderscoreIdx + 1) as Stage;
    
    const header = [
      `# Benchmark Run: ${runDate} (${run.id})`,
      `Intent Library Version: ${run.intentLibraryVersion}`,
      `Metrics Config Version: ${run.metricsConfigVersion}`,
      ``,
      `## Cell: ${persona.charAt(0).toUpperCase() + persona.slice(1)} × ${stage.charAt(0).toUpperCase() + stage.slice(1)}`,
      `Intent ID: ${cell.intentId}`,
      `Intent Text: "${cell.intentText}"`,
      ``,
      `### Metrics`,
    ];

    // Add stage-specific metrics
    if (stage === "explore" && cell.metrics.discoveryRate !== undefined) {
      header.push(`- Discovery Rate: ${(cell.metrics.discoveryRate * 100).toFixed(0)}%`);
      if (cell.metrics.topThreeRate !== undefined) {
        header.push(`- Top-3 Rate: ${(cell.metrics.topThreeRate * 100).toFixed(0)}%`);
      }
    } else if (stage === "consider" && cell.metrics.sentimentScore !== undefined) {
      header.push(`- Sentiment Score: ${cell.metrics.sentimentScore.toFixed(2)}`);
    } else if (stage === "compare" && cell.metrics.winRate !== undefined) {
      header.push(`- Win Rate: ${(cell.metrics.winRate * 100).toFixed(0)}%`);
    } else if (stage === "decide" && cell.metrics.recommendationRate !== undefined) {
      header.push(`- Recommendation Rate: ${(cell.metrics.recommendationRate * 100).toFixed(0)}%`);
    }

    header.push(``, `---`, ``);

    // Add query results
    const queryBlocks: string[] = [];
    if (!cell.results) continue;
    for (const queryResult of cell.results) {
      queryBlocks.push(`## Query: "${queryResult.query}"`, ``);

      if (!queryResult.responses) continue;
      for (const [provider, response] of Object.entries(queryResult.responses)) {
        queryBlocks.push(
          `### ${provider.toUpperCase()} (${response.model})`,
          ``
        );
        
        // Add stage-specific extraction
        queryBlocks.push(formatStageExtraction(stage as Stage, response.score as StageExtraction));
        queryBlocks.push(``);

        // Add full response text
        queryBlocks.push(`**Response:**`, `> ${response.responseText.slice(0, 2000)}${response.responseText.length > 2000 ? "..." : ""}`, ``);
        queryBlocks.push(`---`, ``);
      }
    }

    const content = [...header, ...queryBlocks].join("\n");

    // Extract competitive intelligence from cell results
    const competitors = new Set<string>();
    const winsOn = new Set<string>();
    const losesOn = new Set<string>();

    if (cell.results) {
      for (const result of cell.results) {
        if (!result.responses) continue;
        for (const response of Object.values(result.responses)) {
          const score = response.score as StageExtraction;
          // Extract competitors from any stage
          if ("competitors" in score) {
            for (const comp of score.competitors) competitors.add(comp);
          }
          if ("comparedTo" in score) {
            for (const comp of score.comparedTo) competitors.add(comp);
          }
          if ("alternativesOffered" in score) {
            for (const alt of score.alternativesOffered) competitors.add(alt);
          }
          // Extract wins/losses from compare stage
          if ("winsOn" in score) {
            for (const attr of score.winsOn) winsOn.add(attr);
          }
          if ("losesOn" in score) {
            for (const attr of score.losesOn) losesOn.add(attr);
          }
        }
      }
    }

    // Build metadata
    const metadata: CustomMetadata[] = [
      { key: "run_id", stringValue: run.id },
      { key: "run_date", stringValue: runDate },
      { key: "timestamp", stringValue: run.timestamp },
      { key: "brand", stringValue: run.brand },
      { key: "persona", stringValue: persona },
      { key: "stage", stringValue: stage },
      { key: "intent_id", stringValue: cell.intentId },
      { key: "intent_text", stringValue: cell.intentText.slice(0, 500) },
      { key: "intent_library_version", numericValue: run.intentLibraryVersion },
      { key: "metrics_config_version", numericValue: run.metricsConfigVersion },
      { key: "query_count", numericValue: cell.queriesUsed.length },
    ];

    if (searchMode) {
      metadata.push({ key: "search_mode", stringValue: searchMode });
    }

    // Add competitive intelligence to metadata
    if (competitors.size > 0) {
      metadata.push({ key: "competitors_mentioned", stringValue: [...competitors].slice(0, 10).join(", ") });
    }
    if (winsOn.size > 0) {
      metadata.push({ key: "attributes_won", stringValue: [...winsOn].slice(0, 10).join(", ") });
    }
    if (losesOn.size > 0) {
      metadata.push({ key: "attributes_lost", stringValue: [...losesOn].slice(0, 10).join(", ") });
    }

    // Add stage-specific metric to metadata
    if (stage === "explore" && cell.metrics.discoveryRate !== undefined) {
      metadata.push({ key: "discovery_rate", numericValue: Math.round(cell.metrics.discoveryRate * 100) });
    }
    if (stage === "consider" && cell.metrics.sentimentScore !== undefined) {
      metadata.push({ key: "sentiment_score", numericValue: Math.round(cell.metrics.sentimentScore * 100) });
    }
    if (stage === "compare" && cell.metrics.winRate !== undefined) {
      metadata.push({ key: "win_rate", numericValue: Math.round(cell.metrics.winRate * 100) });
    }
    if (stage === "decide" && cell.metrics.recommendationRate !== undefined) {
      metadata.push({ key: "recommendation_rate", numericValue: Math.round(cell.metrics.recommendationRate * 100) });
    }

    const displayName = `${run.id}_${persona}_${stage}`;

    documents.push({ content, metadata, displayName });
  }

  return documents;
}

/**
 * Format a single cell result for incremental upload
 */
export function formatCellForUpload(
  cell: CellResult,
  runId: string,
  runDate: string,
  brand: string,
  persona: string,
  stage: Stage,
  intentLibraryVersion: number,
  metricsConfigVersion: number,
  searchMode?: string
): FormattedBenchmark {
  const header = [
    `# Benchmark Result: ${persona} × ${stage}`,
    `Run: ${runId} (${runDate})`,
    `Intent: "${cell.intentText}"`,
    ``,
  ];

  // Add metrics
  if (stage === "explore" && cell.metrics.discoveryRate !== undefined) {
    header.push(`Discovery Rate: ${(cell.metrics.discoveryRate * 100).toFixed(0)}%`);
  } else if (stage === "consider" && cell.metrics.sentimentScore !== undefined) {
    header.push(`Sentiment Score: ${cell.metrics.sentimentScore.toFixed(2)}`);
  } else if (stage === "compare" && cell.metrics.winRate !== undefined) {
    header.push(`Win Rate: ${(cell.metrics.winRate * 100).toFixed(0)}%`);
  } else if (stage === "decide" && cell.metrics.recommendationRate !== undefined) {
    header.push(`Recommendation Rate: ${(cell.metrics.recommendationRate * 100).toFixed(0)}%`);
  }

  header.push(``, `Queries: ${cell.queriesUsed.join("; ")}`, ``, `---`, ``);

  // Add results
  const resultBlocks: string[] = [];
  if (cell.results) {
    for (const result of cell.results) {
      resultBlocks.push(`## "${result.query}"`, ``);
      if (!result.responses) continue;
      for (const [provider, response] of Object.entries(result.responses)) {
        resultBlocks.push(`### ${provider}: ${response.model}`);
        resultBlocks.push(formatStageExtraction(stage, response.score as StageExtraction));
        resultBlocks.push(``, `> ${response.responseText.slice(0, 1500)}...`, ``, `---`, ``);
      }
    }
  }

  const content = [...header, ...resultBlocks].join("\n");

  const metadata: CustomMetadata[] = [
    { key: "run_id", stringValue: runId },
    { key: "run_date", stringValue: runDate },
    { key: "brand", stringValue: brand },
    { key: "persona", stringValue: persona },
    { key: "stage", stringValue: stage },
    { key: "intent_id", stringValue: cell.intentId },
    { key: "intent_library_version", numericValue: intentLibraryVersion },
    { key: "metrics_config_version", numericValue: metricsConfigVersion },
  ];

  if (searchMode) {
    metadata.push({ key: "search_mode", stringValue: searchMode });
  }

  const displayName = `${runId}_${persona}_${stage}_${Date.now()}`;

  return { content, metadata, displayName };
}
