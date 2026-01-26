import { describe, it, expect } from "vitest";
import { computeInsightMetrics } from "@/lib/matrix/insightMetrics";

describe("computeInsightMetrics", () => {
  it("computes Explore overall + per-provider mention and top3 rates", () => {
    const results = [
      {
        query: "q1",
        responses: [
          { provider: "openai", error: undefined, visibility: { mentioned: true, position: "1st" } },
          { provider: "gemini", error: undefined, visibility: { mentioned: false, position: "absent" } },
          { provider: "anthropic", error: "timeout", visibility: { mentioned: false, position: "absent" } },
        ],
      },
    ];

    const metrics = computeInsightMetrics("explore", results);
    expect(metrics.stage).toBe("explore");
    expect(metrics.overall.mentionRate).toBeCloseTo(0.5); // 1/2 valid
    expect(metrics.overall.top3Rate).toBeCloseTo(0.5); // 1/2 valid
    expect(metrics.byProvider.openai?.mentionRate).toBe(1);
    expect(metrics.byProvider.gemini?.mentionRate).toBe(0);
    expect(metrics.byProvider.anthropic).toBeUndefined(); // all errored
  });

  it("computes Explore top3 rate correctly for 1st, 2nd, 3rd positions", () => {
    const results = [
      {
        query: "q1",
        responses: [
          { provider: "openai", visibility: { mentioned: true, position: "1st" } },
          { provider: "gemini", visibility: { mentioned: true, position: "2nd" } },
          { provider: "anthropic", visibility: { mentioned: true, position: "3rd" } },
          { provider: "xai", visibility: { mentioned: true, position: "4th" } },
        ],
      },
    ];

    const metrics = computeInsightMetrics("explore", results);
    expect(metrics.overall.top3Rate).toBeCloseTo(0.75); // 3/4 in top 3
  });

  it("computes Consider overall + per-provider sentiment scores", () => {
    const results = [
      {
        query: "q1",
        responses: [
          { provider: "openai", visibility: { sentiment: "positive" } },
          { provider: "gemini", visibility: { sentiment: "neutral" } },
          { provider: "anthropic", visibility: { sentiment: "negative" } },
        ],
      },
    ];

    const metrics = computeInsightMetrics("consider", results);
    expect(metrics.stage).toBe("consider");
    expect(metrics.overall.avgSentiment).toBeCloseTo(0); // (1 + 0 - 1) / 3
    expect(metrics.byProvider.openai?.avgSentiment).toBe(1);
    expect(metrics.byProvider.anthropic?.avgSentiment).toBe(-1);
  });

  it("computes Compare overall + per-provider win rates", () => {
    const results = [
      {
        query: "q1",
        responses: [
          { provider: "openai", visibility: { comparisonOutcome: "favorable" } },
          { provider: "gemini", visibility: { comparisonOutcome: "unfavorable" } },
          { provider: "anthropic", visibility: { comparisonOutcome: "neutral" } },
        ],
      },
    ];

    const metrics = computeInsightMetrics("compare", results);
    expect(metrics.stage).toBe("compare");
    expect(metrics.overall.winRate).toBeCloseTo(1 / 3);
    expect(metrics.byProvider.openai?.winRate).toBe(1);
    expect(metrics.byProvider.gemini?.winRate).toBe(0);
  });

  it("computes Decide overall + per-provider recommendation rates", () => {
    const results = [
      {
        query: "q1",
        responses: [
          { provider: "openai", visibility: { recommendationStrength: "strong" } },
          { provider: "gemini", visibility: { recommendationStrength: "moderate" } },
          { provider: "anthropic", visibility: { recommendationStrength: "none" } },
        ],
      },
    ];

    const metrics = computeInsightMetrics("decide", results);
    expect(metrics.stage).toBe("decide");
    expect(metrics.overall.recommendationRate).toBeCloseTo(2 / 3);
    expect(metrics.byProvider.openai?.recommendationRate).toBe(1);
    expect(metrics.byProvider.anthropic?.recommendationRate).toBe(0);
  });

  it("handles empty results gracefully", () => {
    const metrics = computeInsightMetrics("explore", []);
    expect(metrics.overall.mentionRate).toBeNull();
    expect(metrics.overall.top3Rate).toBeNull();
    expect(Object.keys(metrics.byProvider).length).toBe(0);
  });

  it("excludes errored responses from calculations", () => {
    const results = [
      {
        query: "q1",
        responses: [
          { provider: "openai", visibility: { mentioned: true, position: "1st" } },
          { provider: "gemini", error: "timeout", visibility: { mentioned: true, position: "1st" } },
        ],
      },
    ];

    const metrics = computeInsightMetrics("explore", results);
    expect(metrics.overall.mentionRate).toBe(1); // only openai counts
    expect(metrics.byProvider.gemini).toBeUndefined();
  });

  it("handles multiple queries correctly", () => {
    const results = [
      {
        query: "q1",
        responses: [
          { provider: "openai", visibility: { mentioned: true, position: "1st" } },
        ],
      },
      {
        query: "q2",
        responses: [
          { provider: "openai", visibility: { mentioned: false, position: "absent" } },
        ],
      },
    ];

    const metrics = computeInsightMetrics("explore", results);
    expect(metrics.overall.mentionRate).toBe(0.5);
    expect(metrics.byProvider.openai?.mentionRate).toBe(0.5);
  });

  it("excludes comparisonOutcome 'none' from win-rate denominator", () => {
    const results = [
      {
        query: "q1",
        responses: [
          { provider: "openai", visibility: { comparisonOutcome: "favorable" } },
          { provider: "openai", visibility: { comparisonOutcome: "none" } },
          { provider: "gemini", visibility: { comparisonOutcome: "unfavorable" } },
          { provider: "gemini", visibility: { comparisonOutcome: "none" } },
        ],
      },
    ];

    const metrics = computeInsightMetrics("compare", results);
    // Only 2 valid comparisons (favorable + unfavorable), 2 "none" excluded
    expect(metrics.overall.winRate).toBe(0.5); // 1 favorable / 2 compared
    expect(metrics.byProvider.openai?.winRate).toBe(1); // 1/1 (none excluded)
    expect(metrics.byProvider.gemini?.winRate).toBe(0); // 0/1 (none excluded)
  });
});
