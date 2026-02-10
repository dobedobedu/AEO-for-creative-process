import type { BenchmarkRun as StoredRun } from "@/lib/runs/types";
import type { StageExtraction } from "@/lib/scoring/schemas";

type Provider = "openai" | "anthropic" | "gemini" | "xai";

type Stage = string;

type StageData = {
  positionCounts: { "1st": number; "2nd": number; "3rd": number; later: number; absent: number } | null;
  sentimentScore: number | null;
  winRate: number | null;
  recStrength: number | null;
};

export interface UiBenchmarkRun {
  id: string;
  timestamp: number;
  label: string;
  providerScores: Record<Provider, { avgScore: number; mentionRate: number | null }>;
  stageData?: StageData;
  competitorRanking?: string[];
}

function recommendationStrengthToScore(strength: string): number {
  switch (strength) {
    case "strongly_recommended":
      return 1;
    case "recommended":
      return 0.8;
    case "suggested":
      return 0.6;
    case "mentioned":
      return 0.4;
    case "not_mentioned":
    default:
      return 0;
  }
}

function extractionToScalarScore(stage: Stage, extraction: StageExtraction): number {
  if (stage === "explore" && "inTopThree" in extraction) {
    return extraction.mentioned ? 1 : 0;
  }
  if (stage === "consider" && "sentimentScore" in extraction) {
    return (extraction.sentimentScore + 1) / 2;
  }
  if (stage === "compare" && "outcome" in extraction) {
    if (extraction.outcome === "win") return 1;
    if (extraction.outcome === "tie" || extraction.outcome === "mixed") return 0.5;
    return 0;
  }
  if ((stage === "decide" || stage === "apply") && "recommendationStrength" in extraction) {
    return recommendationStrengthToScore(extraction.recommendationStrength);
  }
  return 0;
}

function extractionCompetitors(extraction: StageExtraction): string[] {
  if ("competitors" in extraction) return extraction.competitors;
  if ("comparedTo" in extraction) return extraction.comparedTo;
  if ("alternativesOffered" in extraction) return extraction.alternativesOffered;
  return [];
}

/**
 * Generate a stable cache key for a run based on id and timestamp.
 * This allows caching transformed UI runs to avoid re-processing.
 */
export function getRunCacheKey(run: StoredRun): string {
  const overall = run.summary?.overall;
  const cellCount = run.cells ? Object.keys(run.cells).length : 0;
  return [
    run.id,
    run.timestamp,
    overall?.discoveryRate,
    overall?.avgSentiment,
    overall?.avgWinRate,
    overall?.recommendationRate,
    cellCount,
  ].join("|");
}

export function toUiBenchmarkRun(run: StoredRun): UiBenchmarkRun {
  const totals: Record<Provider, { totalScore: number; totalCount: number }> = {
    openai: { totalScore: 0, totalCount: 0 },
    anthropic: { totalScore: 0, totalCount: 0 },
    gemini: { totalScore: 0, totalCount: 0 },
    xai: { totalScore: 0, totalCount: 0 },
  };

  const exploreTotals: Record<Provider, { totalMentions: number; totalCount: number }> = {
    openai: { totalMentions: 0, totalCount: 0 },
    anthropic: { totalMentions: 0, totalCount: 0 },
    gemini: { totalMentions: 0, totalCount: 0 },
    xai: { totalMentions: 0, totalCount: 0 },
  };

  const positionCounts = { "1st": 0, "2nd": 0, "3rd": 0, later: 0, absent: 0 };
  const sentimentScores: number[] = [];
  const compareOutcomes: { win: number; total: number } = { win: 0, total: 0 };
  const recStrengths: number[] = [];
  const competitorCounts: Record<string, number> = {};

  let hasExplore = false;
  let hasConsider = false;
  let hasCompare = false;
  let hasDecide = false;

  if (!run.cells) {
    // Return empty result for runs without cell data
    return {
      id: run.id,
      timestamp: run.timestamp ? new Date(run.timestamp).getTime() : Date.now(),
      label: run.timestamp ? new Date(run.timestamp).toLocaleDateString() : "Unknown",
      providerScores: {
        openai: { avgScore: 0, mentionRate: null },
        anthropic: { avgScore: 0, mentionRate: null },
        gemini: { avgScore: 0, mentionRate: null },
        xai: { avgScore: 0, mentionRate: null },
      },
    };
  }

  for (const [cellKey, cell] of Object.entries(run.cells)) {
    const parts = cellKey.split("_");
    const stage = parts[parts.length - 1] as Stage;
    if (!cell?.results) continue;
    for (const qr of cell.results) {
      if (!qr?.responses) continue;
      for (const [provider, resp] of Object.entries(qr.responses) as Array<[
        Provider,
        { score: StageExtraction }
      ]>) {
        const extraction = resp.score;

        totals[provider].totalCount++;
        totals[provider].totalScore += extractionToScalarScore(stage, extraction);

        if (stage === "explore") {
          hasExplore = true;
          exploreTotals[provider].totalCount++;
          if (extraction.mentioned) exploreTotals[provider].totalMentions++;
        }

        for (const comp of extractionCompetitors(extraction)) {
          competitorCounts[comp] = (competitorCounts[comp] || 0) + 1;
        }

        if (stage === "explore" && "inTopThree" in extraction) {
          if (!extraction.mentioned) positionCounts.absent++;
          else if (extraction.inTopThree) positionCounts["1st"]++;
          else positionCounts.later++;
        }

        if (stage === "consider" && "sentimentScore" in extraction) {
          hasConsider = true;
          sentimentScores.push(extraction.sentimentScore);
        }

        if (stage === "compare" && "outcome" in extraction && extraction.outcome !== "not_compared") {
          hasCompare = true;
          compareOutcomes.total++;
          if (extraction.outcome === "win") compareOutcomes.win++;
          if (extraction.outcome === "tie" || extraction.outcome === "mixed") compareOutcomes.win += 0.5;
        }

        if ((stage === "decide" || stage === "apply") && "recommendationStrength" in extraction) {
          hasDecide = true;
          recStrengths.push(recommendationStrengthToScore(extraction.recommendationStrength));
        }
      }
    }
  }

  const providerScores: UiBenchmarkRun["providerScores"] = {
    openai: {
      avgScore: totals.openai.totalCount ? totals.openai.totalScore / totals.openai.totalCount : 0,
      mentionRate: exploreTotals.openai.totalCount > 0
        ? (exploreTotals.openai.totalCount
          ? exploreTotals.openai.totalMentions / exploreTotals.openai.totalCount
          : 0)
        : null,
    },
    anthropic: {
      avgScore: totals.anthropic.totalCount ? totals.anthropic.totalScore / totals.anthropic.totalCount : 0,
      mentionRate: exploreTotals.anthropic.totalCount > 0
        ? (exploreTotals.anthropic.totalCount
          ? exploreTotals.anthropic.totalMentions / exploreTotals.anthropic.totalCount
          : 0)
        : null,
    },
    gemini: {
      avgScore: totals.gemini.totalCount ? totals.gemini.totalScore / totals.gemini.totalCount : 0,
      mentionRate: exploreTotals.gemini.totalCount > 0
        ? (exploreTotals.gemini.totalCount
          ? exploreTotals.gemini.totalMentions / exploreTotals.gemini.totalCount
          : 0)
        : null,
    },
    xai: {
      avgScore: totals.xai.totalCount ? totals.xai.totalScore / totals.xai.totalCount : 0,
      mentionRate: exploreTotals.xai.totalCount > 0
        ? (exploreTotals.xai.totalCount
          ? exploreTotals.xai.totalMentions / exploreTotals.xai.totalCount
          : 0)
        : null,
    },
  };

  const competitorRanking = Object.entries(competitorCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name]) => name);

  const runLabel = run.timestamp.split("T")[0];

  const stageData: StageData = {
    positionCounts: hasExplore ? positionCounts : null,
    sentimentScore: hasConsider
      ? (sentimentScores.length > 0
        ? sentimentScores.reduce((a, b) => a + b, 0) / sentimentScores.length
        : 0)
      : null,
    winRate: hasCompare
      ? (compareOutcomes.total > 0 ? compareOutcomes.win / compareOutcomes.total : 0)
      : null,
    recStrength: hasDecide
      ? (recStrengths.length > 0
        ? recStrengths.reduce((a, b) => a + b, 0) / recStrengths.length
        : 0)
      : null,
  };

  return {
    id: run.id,
    timestamp: Date.parse(run.timestamp),
    label: runLabel,
    providerScores,
    stageData,
    competitorRanking,
  };
}
