import { describe, it, expect } from "vitest";
import { formatBenchmarkForUpload, formatQueryResult } from "../formatter";
import type { BenchmarkResult, QueryResult } from "@/lib/benchmark/runner";

const mockVisibility = {
  score: 0.75,
  category: "recommended" as const,
  sentiment: "positive" as const,
  mentioned: true,
  mentionCount: 2,
  firstMentionPosition: 150,
  position: "2nd" as const,
  competitorsMentioned: ["The Villages", "Nocatee"],
  comparisonOutcome: "favorable" as const,
  recommendationStrength: "strong" as const,
};

const mockQueryResult: QueryResult = {
  query: "best florida retirement communities 2026",
  responses: [
    {
      provider: "openai",
      model: "gpt-5.2",
      text: "Here are the best Florida retirement communities: The Villages leads, followed by Lakewood Ranch...",
      citations: [],
      visibility: mockVisibility,
      latencyMs: 1200,
      raw: null,
    },
    {
      provider: "anthropic",
      model: "claude-haiku-4-5",
      text: "For retirees, Lakewood Ranch offers excellent amenities...",
      citations: [],
      visibility: { ...mockVisibility, position: "1st" as const },
      latencyMs: 800,
      raw: null,
    },
  ],
};

const mockBenchmarkResult: BenchmarkResult = {
  queries: [mockQueryResult],
  summary: {
    totalQueries: 1,
    providersUsed: ["openai", "anthropic"],
    brandMentionRate: { openai: 1, anthropic: 1, gemini: 0, xai: 0 },
    avgVisibilityScore: { openai: 0.75, anthropic: 0.8, gemini: 0, xai: 0 },
    executionTimeMs: 2000,
  },
};

describe("formatBenchmarkForUpload", () => {
  it("should format benchmark results with correct structure", () => {
    const result = formatBenchmarkForUpload(
      mockBenchmarkResult,
      "retiree",
      "explore",
      "Lakewood Ranch"
    );

    expect(result.content).toContain("# AI Visibility Benchmark Results");
    expect(result.content).toContain("**Brand**: Lakewood Ranch");
    expect(result.content).toContain("**Persona**: retiree");
    expect(result.content).toContain("**Stage**: explore");
    expect(result.content).toContain("## Provider: OPENAI");
    expect(result.content).toContain("Position: 2nd");
  });

  it("should include metadata with correct types", () => {
    const result = formatBenchmarkForUpload(
      mockBenchmarkResult,
      "luxury",
      "compare"
    );

    expect(result.metadata).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: "persona", stringValue: "luxury" }),
        expect.objectContaining({ key: "stage", stringValue: "compare" }),
        expect.objectContaining({ key: "total_queries", numericValue: 1 }),
      ])
    );
  });

  it("should generate display name with expected format", () => {
    const result = formatBenchmarkForUpload(
      mockBenchmarkResult,
      "retiree",
      "explore"
    );

    expect(result.displayName).toContain("retiree_explore_");
    // Should contain date and timestamp
    expect(result.displayName).toMatch(/retiree_explore_\d{4}-\d{2}-\d{2}_\d+/);
  });

  it("should include competitor information", () => {
    const result = formatBenchmarkForUpload(
      mockBenchmarkResult,
      "retiree",
      "explore"
    );

    expect(result.content).toContain("Competitors: The Villages, Nocatee");
  });

  it("should include visibility metrics", () => {
    const result = formatBenchmarkForUpload(
      mockBenchmarkResult,
      "retiree",
      "explore"
    );

    expect(result.content).toContain("Score: 75%");
    expect(result.content).toContain("Sentiment: positive");
  });
});

describe("formatQueryResult", () => {
  it("should format single query result", () => {
    const result = formatQueryResult(
      mockQueryResult,
      "first_time",
      "consider"
    );

    expect(result.content).toContain("# AI Response:");
    expect(result.content).toContain("best florida retirement communities");
    expect(result.content).toContain("**Persona**: first_time");
    expect(result.content).toContain("**Stage**: consider");
  });

  it("should include query in metadata", () => {
    const result = formatQueryResult(
      mockQueryResult,
      "first_time",
      "consider"
    );

    const queryMeta = result.metadata.find((m) => m.key === "query");
    expect(queryMeta).toBeDefined();
    expect(queryMeta?.stringValue).toContain("best florida retirement");
  });

  it("should calculate aggregate metrics", () => {
    const result = formatQueryResult(
      mockQueryResult,
      "first_time",
      "consider"
    );

    const mentionMeta = result.metadata.find((m) => m.key === "mention_count");
    expect(mentionMeta?.numericValue).toBe(2); // Both responses have mentioned: true

    const scoreMeta = result.metadata.find((m) => m.key === "avg_score");
    expect(scoreMeta?.numericValue).toBe(75); // Average of 0.75 and 0.75 = 0.75 = 75%
  });
});
