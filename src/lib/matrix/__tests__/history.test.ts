import { describe, it, expect } from "vitest";
import { toUiBenchmarkRun, getRunCacheKey } from "@/lib/matrix/history";
import type { BenchmarkRun as StoredRun } from "@/lib/runs/types";

describe("getRunCacheKey", () => {
  it("generates stable cache key from id and timestamp", () => {
    const run = { id: "abc", timestamp: "2026-01-25T00:00:00Z" } as any;
    expect(getRunCacheKey(run)).toBe("abc:2026-01-25T00:00:00Z");
  });

  it("generates different keys for different runs", () => {
    const run1 = { id: "abc", timestamp: "2026-01-25T00:00:00Z" } as any;
    const run2 = { id: "def", timestamp: "2026-01-25T00:00:00Z" } as any;
    expect(getRunCacheKey(run1)).not.toBe(getRunCacheKey(run2));
  });
});

describe("benchmark history conversion", () => {
  it("computes mention rate from explore stage only", () => {
    const run: StoredRun = {
      id: "run-1",
      timestamp: "2026-01-20T00:00:00.000Z",
      intentLibraryVersion: 1,
      metricsConfigVersion: 1,
      brand: "Lakewood Ranch",
      summary: {
        overall: {
          recommendationRate: 0,
          discoveryRate: 0,
          avgSentiment: 0,
          avgWinRate: 0,
        },
      },
      cells: {
        family_explore: {
          intentId: "intent-1",
          intentText: "Explore",
          queriesUsed: ["q1"],
          metrics: {},
          results: [
            {
              query: "q1",
              responses: {
                openai: {
                  model: "gpt-5.2",
                  responseText: "response",
                  score: {
                    mentioned: false,
                    responseRelevant: true,
                    entitiesMentioned: [],
                    inTopThree: false,
                    totalOptionsListed: 4,
                    competitors: [],
                    howDescribed: "not mentioned",
                  },
                },
              },
            },
          ],
        },
        family_consider: {
          intentId: "intent-2",
          intentText: "Consider",
          queriesUsed: ["q2"],
          metrics: {},
          results: [
            {
              query: "q2",
              responses: {
                openai: {
                  model: "gpt-5.2",
                  responseText: "response",
                  score: {
                    mentioned: true,
                    responseRelevant: true,
                    entitiesMentioned: [],
                    sentiment: "positive",
                    sentimentScore: 0.7,
                    strengthsMentioned: ["amenities"],
                    concernsRaised: [],
                    overallPortrayal: "positive",
                  },
                },
              },
            },
          ],
        },
      },
    };

    const uiRun = toUiBenchmarkRun(run);
    expect(uiRun.providerScores.openai.mentionRate).toBe(0);
    expect(uiRun.stageData?.positionCounts).not.toBeNull();
  });

  it("returns null sentiment when consider data is missing", () => {
    const run: StoredRun = {
      id: "run-2",
      timestamp: "2026-01-21T00:00:00.000Z",
      intentLibraryVersion: 1,
      metricsConfigVersion: 1,
      brand: "Lakewood Ranch",
      summary: {
        overall: {
          recommendationRate: 0,
          discoveryRate: 0,
          avgSentiment: 0,
          avgWinRate: 0,
        },
      },
      cells: {
        family_explore: {
          intentId: "intent-1",
          intentText: "Explore",
          queriesUsed: ["q1"],
          metrics: {},
          results: [
            {
              query: "q1",
              responses: {
                openai: {
                  model: "gpt-5.2",
                  responseText: "response",
                  score: {
                    mentioned: true,
                    responseRelevant: true,
                    entitiesMentioned: [],
                    inTopThree: true,
                    totalOptionsListed: 4,
                    competitors: [],
                    howDescribed: "mentioned",
                  },
                },
              },
            },
          ],
        },
      },
    };

    const uiRun = toUiBenchmarkRun(run);
    expect(uiRun.stageData?.sentimentScore).toBeNull();
  });
});
