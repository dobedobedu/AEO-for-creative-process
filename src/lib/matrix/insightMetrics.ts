import type { ProviderKey } from "@/lib/matrix/weights";

type Response = {
  provider: ProviderKey;
  error?: string;
  visibility?: {
    mentioned?: boolean;
    position?: string;
    sentiment?: "positive" | "neutral" | "negative";
    comparisonOutcome?: "favorable" | "unfavorable" | "neutral" | "none";
    recommendationStrength?: "strong" | "moderate" | "weak" | "none";
  };
};

type QueryResult = { responses?: Response[] };

export type ExploreMetrics = { mentionRate: number | null; top3Rate: number | null };
export type ConsiderMetrics = { avgSentiment: number | null };
export type CompareMetrics = { winRate: number | null };
export type DecideMetrics = { recommendationRate: number | null };

export type InsightMetrics =
  | { stage: "explore"; overall: ExploreMetrics; byProvider: Partial<Record<ProviderKey, ExploreMetrics>> }
  | { stage: "consider"; overall: ConsiderMetrics; byProvider: Partial<Record<ProviderKey, ConsiderMetrics>> }
  | { stage: "compare"; overall: CompareMetrics; byProvider: Partial<Record<ProviderKey, CompareMetrics>> }
  | { stage: "decide"; overall: DecideMetrics; byProvider: Partial<Record<ProviderKey, DecideMetrics>> };

function sentimentToScore(sentiment?: string): number {
  if (sentiment === "positive") return 1;
  if (sentiment === "negative") return -1;
  return 0;
}

export function computeInsightMetrics(stage: string, results: QueryResult[]): InsightMetrics {
  const validResponses: Response[] = [];
  const byProvider: Partial<Record<ProviderKey, Response[]>> = {};

  for (const r of results || []) {
    for (const resp of r.responses || []) {
      if (resp.error) continue;
      validResponses.push(resp);
      const p = resp.provider as ProviderKey;
      if (!byProvider[p]) byProvider[p] = [];
      byProvider[p]?.push(resp);
    }
  }

  if (stage === "explore") {
    const total = validResponses.length;
    const mentioned = validResponses.filter((r) => r.visibility?.mentioned).length;
    const top3 = validResponses.filter((r) =>
      ["1st", "2nd", "3rd"].includes(r.visibility?.position || "")
    ).length;

    const overall: ExploreMetrics = {
      mentionRate: total > 0 ? mentioned / total : null,
      top3Rate: total > 0 ? top3 / total : null,
    };

    const per: Partial<Record<ProviderKey, ExploreMetrics>> = {};
    for (const [p, arr] of Object.entries(byProvider) as [ProviderKey, Response[]][]) {
      const t = arr.length;
      const m = arr.filter((r) => r.visibility?.mentioned).length;
      const top = arr.filter((r) => ["1st", "2nd", "3rd"].includes(r.visibility?.position || "")).length;
      per[p] = {
        mentionRate: t > 0 ? m / t : null,
        top3Rate: t > 0 ? top / t : null,
      };
    }

    return { stage: "explore", overall, byProvider: per };
  }

  if (stage === "consider") {
    const total = validResponses.length;
    const sum = validResponses.reduce(
      (acc, r) => acc + sentimentToScore(r.visibility?.sentiment),
      0
    );

    const overall: ConsiderMetrics = {
      avgSentiment: total > 0 ? sum / total : null,
    };

    const per: Partial<Record<ProviderKey, ConsiderMetrics>> = {};
    for (const [p, arr] of Object.entries(byProvider) as [ProviderKey, Response[]][]) {
      const t = arr.length;
      const s = arr.reduce(
        (acc, r) => acc + sentimentToScore(r.visibility?.sentiment),
        0
      );
      per[p] = { avgSentiment: t > 0 ? s / t : null };
    }

    return { stage: "consider", overall, byProvider: per };
  }

  if (stage === "compare") {
    // Filter out "none" outcomes - these represent responses where no comparison was made
    const compared = validResponses.filter(
      (r) => r.visibility?.comparisonOutcome && r.visibility.comparisonOutcome !== "none"
    );
    const total = compared.length;
    const wins = compared.filter(
      (r) => r.visibility?.comparisonOutcome === "favorable"
    ).length;

    const overall: CompareMetrics = {
      winRate: total > 0 ? wins / total : null,
    };

    const per: Partial<Record<ProviderKey, CompareMetrics>> = {};
    for (const [p, arr] of Object.entries(byProvider) as [ProviderKey, Response[]][]) {
      // Also filter per-provider to exclude "none" outcomes
      const providerCompared = arr.filter(
        (r) => r.visibility?.comparisonOutcome && r.visibility.comparisonOutcome !== "none"
      );
      const t = providerCompared.length;
      const w = providerCompared.filter((r) => r.visibility?.comparisonOutcome === "favorable").length;
      per[p] = { winRate: t > 0 ? w / t : null };
    }

    return { stage: "compare", overall, byProvider: per };
  }

  // Decide stage
  const total = validResponses.length;
  const recommended = validResponses.filter(
    (r) => (r.visibility?.recommendationStrength || "none") !== "none"
  ).length;

  const overall: DecideMetrics = {
    recommendationRate: total > 0 ? recommended / total : null,
  };

  const per: Partial<Record<ProviderKey, DecideMetrics>> = {};
  for (const [p, arr] of Object.entries(byProvider) as [ProviderKey, Response[]][]) {
    const t = arr.length;
    const rec = arr.filter(
      (r) => (r.visibility?.recommendationStrength || "none") !== "none"
    ).length;
    per[p] = { recommendationRate: t > 0 ? rec / t : null };
  }

  return { stage: "decide", overall, byProvider: per };
}
