import { describe, it, expect, vi } from "vitest";
import {
  extractStageMetrics,
  calculateExploreMetrics,
  calculateConsiderMetrics,
  calculateCompareMetrics,
  calculateDecideMetrics,
  recommendationStrengthToScore,
  aggregateCompetitors,
  getTopCompetitors,
} from "../extractor";
import type { ExploreExtraction, ConsiderExtraction, CompareExtraction, DecideExtraction } from "../schemas";

// Mock AI SDK
vi.mock("ai", () => ({
  generateObject: vi.fn(),
}));

describe("extractStageMetrics", () => {
  it("returns error for empty response text", async () => {
    const result = await extractStageMetrics({
      stage: "explore",
      query: "test query",
      responseText: "",
      provider: "openai",
      brand: "Lakewood Ranch",
    });

    expect(result.success).toBe(false);
    expect(result.extraction).toBeNull();
    expect(result.error).toBe("Empty response text");
  });

  it("returns error for whitespace-only response text", async () => {
    const result = await extractStageMetrics({
      stage: "explore",
      query: "test query",
      responseText: "   \n\t   ",
      provider: "openai",
      brand: "Lakewood Ranch",
    });

    expect(result.success).toBe(false);
    expect(result.extraction).toBeNull();
    expect(result.error).toBe("Empty response text");
  });
});

describe("calculateExploreMetrics", () => {
  it("calculates discovery rate correctly", () => {
    const extractions: ExploreExtraction[] = [
      { mentioned: true, inTopThree: true, responseRelevant: true, totalOptionsListed: 3, competitors: [], howDescribed: "Great option" },
      { mentioned: true, inTopThree: false, responseRelevant: true, totalOptionsListed: 3, competitors: [], howDescribed: "Good option" },
      { mentioned: false, inTopThree: false, responseRelevant: true, totalOptionsListed: 3, competitors: [], howDescribed: "not mentioned" },
    ];

    const result = calculateExploreMetrics(extractions);

    expect(result.discoveryRate).toBe(2 / 3); // 2 out of 3 mentioned
    expect(result.topThreeRate).toBe(1 / 3); // 1 out of 3 in top three
  });

  it("handles empty array", () => {
    const result = calculateExploreMetrics([]);

    expect(result.discoveryRate).toBe(0);
    expect(result.topThreeRate).toBe(0);
  });

  it("handles all mentioned in top three", () => {
    const extractions: ExploreExtraction[] = [
      { mentioned: true, inTopThree: true, responseRelevant: true, totalOptionsListed: 3, competitors: [], howDescribed: "Top choice" },
      { mentioned: true, inTopThree: true, responseRelevant: true, totalOptionsListed: 3, competitors: [], howDescribed: "Top choice" },
      { mentioned: true, inTopThree: true, responseRelevant: true, totalOptionsListed: 3, competitors: [], howDescribed: "Top choice" },
    ];

    const result = calculateExploreMetrics(extractions);

    expect(result.discoveryRate).toBe(1);
    expect(result.topThreeRate).toBe(1);
  });
});

describe("calculateConsiderMetrics", () => {
  it("calculates average sentiment correctly", () => {
    const extractions: ConsiderExtraction[] = [
      { mentioned: true, responseRelevant: true, sentiment: "positive", sentimentScore: 0.8, strengthsMentioned: [], concernsRaised: [], overallPortrayal: "Great" },
      { mentioned: true, responseRelevant: true, sentiment: "negative", sentimentScore: -0.5, strengthsMentioned: [], concernsRaised: [], overallPortrayal: "Poor" },
      { mentioned: true, responseRelevant: true, sentiment: "neutral", sentimentScore: 0.2, strengthsMentioned: [], concernsRaised: [], overallPortrayal: "Okay" },
    ];

    const result = calculateConsiderMetrics(extractions);

    expect(result.avgSentiment).toBe((0.8 + (-0.5) + 0.2) / 3);
  });

  it("handles empty array", () => {
    const result = calculateConsiderMetrics([]);

    expect(result.avgSentiment).toBe(0);
  });

  it("handles extreme sentiment values", () => {
    const extractions: ConsiderExtraction[] = [
      { mentioned: true, responseRelevant: true, sentiment: "positive", sentimentScore: 1, strengthsMentioned: [], concernsRaised: [], overallPortrayal: "Excellent" },
      { mentioned: true, responseRelevant: true, sentiment: "negative", sentimentScore: -1, strengthsMentioned: [], concernsRaised: [], overallPortrayal: "Terrible" },
    ];

    const result = calculateConsiderMetrics(extractions);

    expect(result.avgSentiment).toBe(0);
  });
});

describe("calculateCompareMetrics", () => {
  it("calculates win rate correctly", () => {
    const extractions: CompareExtraction[] = [
      { mentioned: true, responseRelevant: true, comparedTo: ["The Villages"], outcome: "win", winsOn: [], losesOn: [], aiConclusion: "Lakewood wins" },
      { mentioned: true, responseRelevant: true, comparedTo: ["Nocatee"], outcome: "lose", winsOn: [], losesOn: [], aiConclusion: "Lakewood loses" },
      { mentioned: true, responseRelevant: true, comparedTo: ["The Villages"], outcome: "tie", winsOn: [], losesOn: [], aiConclusion: "Tie" },
      { mentioned: false, responseRelevant: false, comparedTo: [], outcome: "not_compared", winsOn: [], losesOn: [], aiConclusion: "No comparison" },
    ];

    const result = calculateCompareMetrics(extractions);

    // Wins: 1, Ties: 1, Total compared: 3
    // Win rate = (1 + 1 * 0.5) / 3 = 1.5 / 3 = 0.5
    expect(result.winRate).toBe(0.5);
  });

  it("handles empty array", () => {
    const result = calculateCompareMetrics([]);

    expect(result.winRate).toBe(0);
  });

  it("handles all wins", () => {
    const extractions: CompareExtraction[] = [
      { mentioned: true, responseRelevant: true, comparedTo: ["The Villages"], outcome: "win", winsOn: [], losesOn: [], aiConclusion: "Lakewood wins" },
      { mentioned: true, responseRelevant: true, comparedTo: ["Nocatee"], outcome: "win", winsOn: [], losesOn: [], aiConclusion: "Lakewood wins" },
    ];

    const result = calculateCompareMetrics(extractions);

    expect(result.winRate).toBe(1);
  });

  it("handles all losses", () => {
    const extractions: CompareExtraction[] = [
      { mentioned: true, responseRelevant: true, comparedTo: ["The Villages"], outcome: "lose", winsOn: [], losesOn: [], aiConclusion: "Lakewood loses" },
      { mentioned: true, responseRelevant: true, comparedTo: ["Nocatee"], outcome: "lose", winsOn: [], losesOn: [], aiConclusion: "Lakewood loses" },
    ];

    const result = calculateCompareMetrics(extractions);

    expect(result.winRate).toBe(0);
  });

  it("returns 0 when all are not_compared", () => {
    const extractions: CompareExtraction[] = [
      { mentioned: false, responseRelevant: false, comparedTo: [], outcome: "not_compared", winsOn: [], losesOn: [], aiConclusion: "No comparison" },
      { mentioned: false, responseRelevant: false, comparedTo: [], outcome: "not_compared", winsOn: [], losesOn: [], aiConclusion: "No comparison" },
    ];

    const result = calculateCompareMetrics(extractions);

    expect(result.winRate).toBe(0);
  });
});

describe("calculateDecideMetrics", () => {
  it("calculates recommendation rate correctly", () => {
    const extractions: DecideExtraction[] = [
      { mentioned: true, responseRelevant: true, recommended: true, recommendationStrength: "recommended", qualifiers: [], alternativesOffered: [], decisionRationale: "Great choice" },
      { mentioned: true, responseRelevant: true, recommended: false, recommendationStrength: "mentioned", qualifiers: [], alternativesOffered: [], decisionRationale: "Mentioned" },
      { mentioned: true, responseRelevant: true, recommended: true, recommendationStrength: "strongly_recommended", qualifiers: [], alternativesOffered: [], decisionRationale: "Strongly recommended" },
    ];

    const result = calculateDecideMetrics(extractions);

    expect(result.recommendationRate).toBe(2 / 3);
  });

  it("handles empty array", () => {
    const result = calculateDecideMetrics([]);

    expect(result.recommendationRate).toBe(0);
  });

  it("handles all recommended", () => {
    const extractions: DecideExtraction[] = [
      { mentioned: true, responseRelevant: true, recommended: true, recommendationStrength: "recommended", qualifiers: [], alternativesOffered: [], decisionRationale: "Good" },
      { mentioned: true, responseRelevant: true, recommended: true, recommendationStrength: "strongly_recommended", qualifiers: [], alternativesOffered: [], decisionRationale: "Strong" },
      { mentioned: true, responseRelevant: true, recommended: true, recommendationStrength: "recommended", qualifiers: [], alternativesOffered: [], decisionRationale: "Good" },
    ];

    const result = calculateDecideMetrics(extractions);

    expect(result.recommendationRate).toBe(1);
  });

  it("handles none recommended", () => {
    const extractions: DecideExtraction[] = [
      { mentioned: true, responseRelevant: true, recommended: false, recommendationStrength: "not_mentioned", qualifiers: [], alternativesOffered: [], decisionRationale: "Not mentioned" },
      { mentioned: true, responseRelevant: true, recommended: false, recommendationStrength: "mentioned", qualifiers: [], alternativesOffered: [], decisionRationale: "Only mentioned" },
      { mentioned: true, responseRelevant: true, recommended: false, recommendationStrength: "suggested", qualifiers: [], alternativesOffered: [], decisionRationale: "Suggested" },
    ];

    const result = calculateDecideMetrics(extractions);

    expect(result.recommendationRate).toBe(0);
  });
});

describe("recommendationStrengthToScore", () => {
  it("maps recommendation strengths correctly", () => {
    expect(recommendationStrengthToScore("not_mentioned")).toBe(0);
    expect(recommendationStrengthToScore("mentioned")).toBe(0.25);
    expect(recommendationStrengthToScore("suggested")).toBe(0.5);
    expect(recommendationStrengthToScore("recommended")).toBe(0.75);
    expect(recommendationStrengthToScore("strongly_recommended")).toBe(1);
  });
});

describe("aggregateCompetitors", () => {
  it("aggregates competitors from ExploreExtraction", () => {
    const extractions: ExploreExtraction[] = [
      { mentioned: true, inTopThree: true, responseRelevant: true, totalOptionsListed: 3, competitors: ["The Villages", "Nocatee"], howDescribed: "Good" },
      { mentioned: true, inTopThree: false, responseRelevant: true, totalOptionsListed: 3, competitors: ["The Villages"], howDescribed: "Okay" },
      { mentioned: false, inTopThree: false, responseRelevant: true, totalOptionsListed: 3, competitors: ["Nocatee", "Wesley Chapel"], howDescribed: "Bad" },
    ];

    const result = aggregateCompetitors(extractions);

    expect(result.get("the villages")).toBe(2);
    expect(result.get("nocatee")).toBe(2);
    expect(result.get("wesley chapel")).toBe(1);
  });

  it("normalizes competitor names to lowercase", () => {
    const extractions: ExploreExtraction[] = [
      { mentioned: true, inTopThree: true, responseRelevant: true, totalOptionsListed: 3, competitors: ["The Villages"], howDescribed: "Good" },
      { mentioned: true, inTopThree: false, responseRelevant: true, totalOptionsListed: 3, competitors: ["the villages"], howDescribed: "Okay" },
      { mentioned: false, inTopThree: false, responseRelevant: true, totalOptionsListed: 3, competitors: ["THE VILLAGES"], howDescribed: "Bad" },
    ];

    const result = aggregateCompetitors(extractions);

    expect(result.size).toBe(1);
    expect(result.get("the villages")).toBe(3);
  });

  it("handles CompareExtraction", () => {
    const extractions: CompareExtraction[] = [
      { mentioned: true, responseRelevant: true, comparedTo: ["The Villages"], outcome: "win", winsOn: [], losesOn: [], aiConclusion: "Win" },
      { mentioned: true, responseRelevant: true, comparedTo: ["Nocatee"], outcome: "lose", winsOn: [], losesOn: [], aiConclusion: "Lose" },
      { mentioned: true, responseRelevant: true, comparedTo: ["The Villages"], outcome: "win", winsOn: [], losesOn: [], aiConclusion: "Win" },
    ];

    const result = aggregateCompetitors(extractions);

    expect(result.get("the villages")).toBe(2);
    expect(result.get("nocatee")).toBe(1);
  });

  it("handles empty array", () => {
    const result = aggregateCompetitors([]);

    expect(result.size).toBe(0);
  });
});

describe("getTopCompetitors", () => {
  it("returns top N competitors by count", () => {
    const extractions: ExploreExtraction[] = [
      { mentioned: true, inTopThree: true, responseRelevant: true, totalOptionsListed: 3, competitors: ["The Villages", "Nocatee"], howDescribed: "Good" },
      { mentioned: true, inTopThree: false, responseRelevant: true, totalOptionsListed: 3, competitors: ["The Villages"], howDescribed: "Okay" },
      { mentioned: false, inTopThree: false, responseRelevant: true, totalOptionsListed: 3, competitors: ["Nocatee", "Wesley Chapel"], howDescribed: "Bad" },
      { mentioned: false, inTopThree: false, responseRelevant: true, totalOptionsListed: 3, competitors: ["The Villages", "Wesley Chapel"], howDescribed: "Bad" },
    ];

    const result = getTopCompetitors(extractions, 3);

    expect(result).toEqual(["the villages", "nocatee", "wesley chapel"]);
    expect(result.length).toBe(3);
  });

  it("returns all competitors when less than limit", () => {
    const extractions: ExploreExtraction[] = [
      { mentioned: true, inTopThree: true, responseRelevant: true, totalOptionsListed: 3, competitors: ["The Villages"], howDescribed: "Good" },
      { mentioned: true, inTopThree: false, responseRelevant: true, totalOptionsListed: 3, competitors: ["Nocatee"], howDescribed: "Okay" },
    ];

    const result = getTopCompetitors(extractions, 5);

    expect(result.length).toBe(2);
    expect(result).toContain("the villages");
    expect(result).toContain("nocatee");
  });

  it("handles empty array", () => {
    const result = getTopCompetitors([]);

    expect(result).toEqual([]);
  });

  it("sorts by count descending", () => {
    const extractions: ExploreExtraction[] = [
      { mentioned: true, inTopThree: true, responseRelevant: true, totalOptionsListed: 3, competitors: ["A"], howDescribed: "Good" },
      { mentioned: true, inTopThree: false, responseRelevant: true, totalOptionsListed: 3, competitors: ["B", "A"], howDescribed: "Okay" },
      { mentioned: false, inTopThree: false, responseRelevant: true, totalOptionsListed: 3, competitors: ["A", "B", "C"], howDescribed: "Bad" },
    ];

    const result = getTopCompetitors(extractions, 5);

    expect(result[0]).toBe("a"); // 4 mentions
    expect(result[1]).toBe("b"); // 3 mentions
    expect(result[2]).toBe("c"); // 1 mention
  });
});
