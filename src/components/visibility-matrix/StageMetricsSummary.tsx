"use client";

import { useMemo } from "react";
import { Provider } from "./types";
import { TrendingUp, TrendingDown, Minus, BarChart3, Award, MessageCircle } from "lucide-react";

// Types - using string to support dynamic config
type Stage = string;

interface QueryResult {
  query: string;
  responses: {
    provider: Provider;
    model: string;
    text: string;
    visibility: {
      score: number;
      mentioned: boolean;
      sentiment: "positive" | "negative" | "neutral";
      position: string;
      competitorsMentioned: string[];
      comparisonOutcome?: string;
      recommendationStrength?: string;
    };
    latencyMs: number;
    error?: string;
  }[];
}

interface StageMetricsSummaryProps {
  stage: string;
  results: QueryResult[];
}

interface MetricCardProps {
  label: string;
  value: string | number;
  subValue?: string;
  trend?: "up" | "down" | "neutral";
  color?: "green" | "red" | "tan" | "default";
}

function MetricCard({ label, value, subValue, trend, color = "default" }: MetricCardProps) {
  const bgColor = {
    green: "bg-[#dcf3dc] border-[#1f3b2c]/20",
    red: "bg-[#fce9e9] border-[#b86f3a]/20",
    tan: "bg-[#faf5ef] border-[#b86f3a]/20",
    default: "bg-white border-[#e3dacb]",
  }[color];

  const TrendIcon = trend === "up" ? TrendingUp : trend === "down" ? TrendingDown : Minus;

  return (
    <div className={`flex flex-col gap-1 p-4 border ${bgColor} min-w-[120px]`}>
      <span className="text-[9px] font-bold uppercase tracking-[0.15em] text-black/40">
        {label}
      </span>
      <div className="flex items-end gap-2">
        <span className="text-2xl font-light tracking-tight text-black">
          {value}
        </span>
        {trend && (
          <TrendIcon className={`w-4 h-4 mb-1 ${
            trend === "up" ? "text-[#1f3b2c]" : trend === "down" ? "text-[#b86f3a]" : "text-black/30"
          }`} />
        )}
      </div>
      {subValue && (
        <span className="text-[10px] text-black/50">{subValue}</span>
      )}
    </div>
  );
}

export function StageMetricsSummary({ stage, results }: StageMetricsSummaryProps) {
  const metrics = useMemo(() => {
    if (results.length === 0) return null;

    // Flatten all responses
    const allResponses = results.flatMap(r => r.responses || []).filter(r => !r.error);
    const totalResponses = allResponses.length;

    if (totalResponses === 0) return null;

    switch (stage) {
      case "explore": {
        // Discovery Rate: % mentioned
        const mentionedCount = allResponses.filter(r => r.visibility?.mentioned).length;
        const discoveryRate = (mentionedCount / totalResponses) * 100;

        // Top 3 Rate: % in position 1st, 2nd, or 3rd
        const topThreeCount = allResponses.filter(r => {
          const pos = r.visibility?.position;
          return pos === "1st" || pos === "2nd" || pos === "3rd";
        }).length;
        const topThreeRate = mentionedCount > 0 ? (topThreeCount / mentionedCount) * 100 : 0;

        return {
          type: "explore" as const,
          discoveryRate: Math.round(discoveryRate),
          topThreeRate: Math.round(topThreeRate),
          queryCount: results.length,
        };
      }

      case "consider": {
        // Sentiment Score: average of -1 (negative), 0 (neutral), +1 (positive)
        const sentimentValues: number[] = allResponses.map(r => {
          const s = r.visibility?.sentiment;
          return s === "positive" ? 1 : s === "negative" ? -1 : 0;
        });
        const avgSentiment = sentimentValues.reduce((a, b) => a + b, 0) / sentimentValues.length;

        // Count positive and negative responses
        const positiveCount = allResponses.filter(r => r.visibility?.sentiment === "positive").length;
        const negativeCount = allResponses.filter(r => r.visibility?.sentiment === "negative").length;

        return {
          type: "consider" as const,
          sentimentScore: avgSentiment,
          positiveCount,
          negativeCount,
          totalResponses,
        };
      }

      case "compare": {
        // Win Rate: % favorable outcomes
        const comparisons = allResponses.filter(r =>
          r.visibility?.comparisonOutcome && r.visibility.comparisonOutcome !== "none"
        );
        const winCount = comparisons.filter(r => r.visibility?.comparisonOutcome === "favorable").length;
        const winRate = comparisons.length > 0 ? (winCount / comparisons.length) * 100 : 0;

        // Top competitors mentioned
        const competitorCounts: Record<string, number> = {};
        allResponses.forEach(r => {
          (r.visibility?.competitorsMentioned || []).forEach(c => {
            competitorCounts[c] = (competitorCounts[c] || 0) + 1;
          });
        });
        const topCompetitors = Object.entries(competitorCounts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .map(([name]) => name);

        return {
          type: "compare" as const,
          winRate: Math.round(winRate),
          comparisonsCount: comparisons.length,
          topCompetitors,
        };
      }

      case "decide": {
        // Recommendation Rate: % with recommendation strength != none
        const recommendations = allResponses.filter(r =>
          r.visibility?.recommendationStrength &&
          r.visibility.recommendationStrength !== "none" &&
          r.visibility.recommendationStrength !== "not_mentioned"
        );
        const recRate = (recommendations.length / totalResponses) * 100;

        // Strong recommendation count
        const strongRecs = recommendations.filter(r =>
          r.visibility?.recommendationStrength === "strong" ||
          r.visibility?.recommendationStrength === "strongly_recommended"
        ).length;

        return {
          type: "decide" as const,
          recommendationRate: Math.round(recRate),
          strongRecommendations: strongRecs,
          totalRecommendations: recommendations.length,
        };
      }

      default:
        return null;
    }
  }, [stage, results]);

  if (!metrics) {
    return (
      <div className="px-6 py-4 border-b border-[#e3dacb] bg-[#faf9f6]/50">
        <p className="text-[10px] text-black/30 uppercase tracking-wider">
          No data available for metrics
        </p>
      </div>
    );
  }

  const stageLabels: Record<Stage, string> = {
    explore: "Explore Metrics",
    consider: "Consider Metrics",
    compare: "Compare Metrics",
    decide: "Decide Metrics",
  };

  return (
    <div className="px-6 py-4 border-b border-[#e3dacb] bg-[#faf9f6]/50">
      <div className="flex items-center gap-2 mb-3">
        <BarChart3 className="w-3.5 h-3.5 text-black/30" />
        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-black/40">
          {stageLabels[stage]}
        </span>
      </div>

      <div className="flex gap-3 overflow-x-auto">
        {metrics.type === "explore" && (
          <>
            <MetricCard
              label="Discovery"
              value={`${metrics.discoveryRate}%`}
              subValue={`Mentioned in ${metrics.discoveryRate}% of responses`}
              color={metrics.discoveryRate >= 70 ? "green" : metrics.discoveryRate >= 40 ? "tan" : "red"}
            />
            <MetricCard
              label="Top 3 Rate"
              value={`${metrics.topThreeRate}%`}
              subValue="In first 3 positions when mentioned"
              color={metrics.topThreeRate >= 70 ? "green" : metrics.topThreeRate >= 40 ? "tan" : "red"}
            />
            <MetricCard
              label="Queries"
              value={metrics.queryCount}
              subValue="Total queries analyzed"
            />
          </>
        )}

        {metrics.type === "consider" && (
          <>
            <MetricCard
              label="Sentiment"
              value={metrics.sentimentScore.toFixed(2)}
              subValue={
                metrics.sentimentScore > 0.3 ? "Positive" :
                metrics.sentimentScore < -0.3 ? "Negative" : "Neutral"
              }
              color={
                metrics.sentimentScore > 0.3 ? "green" :
                metrics.sentimentScore < -0.3 ? "red" : "tan"
              }
            />
            <MetricCard
              label="Positive"
              value={metrics.positiveCount}
              subValue={`${Math.round((metrics.positiveCount / metrics.totalResponses) * 100)}% of responses`}
              color="green"
            />
            <MetricCard
              label="Negative"
              value={metrics.negativeCount}
              subValue={`${Math.round((metrics.negativeCount / metrics.totalResponses) * 100)}% of responses`}
              color={metrics.negativeCount > 0 ? "red" : "default"}
            />
          </>
        )}

        {metrics.type === "compare" && (
          <>
            <MetricCard
              label="Win Rate"
              value={`${metrics.winRate}%`}
              subValue={`${metrics.comparisonsCount} comparisons made`}
              color={metrics.winRate >= 70 ? "green" : metrics.winRate >= 40 ? "tan" : "red"}
            />
            <MetricCard
              label="Comparisons"
              value={metrics.comparisonsCount}
              subValue="Direct comparisons analyzed"
            />
            {metrics.topCompetitors.length > 0 && (
              <div className="flex flex-col gap-1 p-4 border border-[#e3dacb] bg-white min-w-[160px]">
                <span className="text-[9px] font-bold uppercase tracking-[0.15em] text-black/40">
                  Top Competitors
                </span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {metrics.topCompetitors.map((comp, idx) => (
                    <span
                      key={comp}
                      className="text-[10px] px-2 py-0.5 bg-[#faf5ef] text-black/70"
                    >
                      {idx + 1}. {comp}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {metrics.type === "decide" && (
          <>
            <MetricCard
              label="Rec Rate"
              value={`${metrics.recommendationRate}%`}
              subValue={`${metrics.totalRecommendations} recommendations`}
              color={metrics.recommendationRate >= 70 ? "green" : metrics.recommendationRate >= 40 ? "tan" : "red"}
            />
            <MetricCard
              label="Strong Recs"
              value={metrics.strongRecommendations}
              subValue={`${Math.round((metrics.strongRecommendations / Math.max(metrics.totalRecommendations, 1)) * 100)}% strong recommendations`}
              color={metrics.strongRecommendations > 0 ? "green" : "tan"}
            />
            <MetricCard
              label="Total Responses"
              value={metrics.totalRecommendations}
              subValue="Responses with recommendations"
            />
          </>
        )}
      </div>
    </div>
  );
}
