import { describe, it, expect } from "vitest";
import { parseMatrixConfig, parseHistoryRuns, parseIntentLibrary } from "@/lib/matrix/data/parse";
import { toUiBenchmarkRun } from "@/lib/matrix/history";

describe("matrix data parsers", () => {
  describe("parseMatrixConfig", () => {
    it("parses valid matrix config", () => {
      const config = parseMatrixConfig({
        personas: [{ id: "cpo", label: "CPO" }],
        stages: [{ id: "explore", label: "Explore" }],
      });
      expect(config.personas[0].id).toBe("cpo");
      expect(config.stages[0].id).toBe("explore");
    });

    it("throws on invalid personas structure", () => {
      expect(() => parseMatrixConfig({ personas: [{ id: 123 }], stages: [] }))
        .toThrow();
    });

    it("accepts optional description field", () => {
      const config = parseMatrixConfig({
        personas: [{ id: "cpo", label: "CPO", description: "Chief role" }],
        stages: [{ id: "explore", label: "Explore", description: "Initial stage" }],
      });
      expect(config.personas[0].description).toBe("Chief role");
      expect(config.stages[0].description).toBe("Initial stage");
    });
  });

  describe("parseHistoryRuns", () => {
    it("parses valid history payload", () => {
      const history = parseHistoryRuns({
        runs: [
          {
            id: "run-1",
            timestamp: "2026-01-25T10:00:00Z",
            brand: "Test Brand",
            intentLibraryVersion: 1,
            metricsConfigVersion: 1,
            summary: {
              overall: {
                recommendationRate: 0.5,
                discoveryRate: 0.6,
                avgSentiment: 0.7,
                avgWinRate: 0.8,
              },
            },
            cells: {},
          },
          {
            id: "run-2",
            timestamp: "2026-01-24T10:00:00Z",
            brand: "Test Brand",
            intentLibraryVersion: 1,
            metricsConfigVersion: 1,
            summary: {
              overall: {
                recommendationRate: 0.5,
                discoveryRate: 0.6,
                avgSentiment: 0.7,
                avgWinRate: 0.8,
              },
            },
            cells: {},
          },
        ],
      });
      expect(history.runs).toHaveLength(2);
      expect(history.runs[0].id).toBe("run-1");
    });

    it("preserves full BenchmarkRun fields for downstream chart use", () => {
      const fullRun = {
        id: "run-1",
        timestamp: "2026-01-25T10:00:00Z",
        brand: "Test Brand",
        intentLibraryVersion: 1,
        metricsConfigVersion: 1,
        summary: {
          overall: {
            recommendationRate: 0.5,
            discoveryRate: 0.6,
            avgSentiment: 0.7,
            avgWinRate: 0.8,
          },
        },
        cells: {
          "luxury_explore": {
            intentId: "int-1",
            intentText: "Find luxury communities",
            queriesUsed: ["query 1"],
            metrics: {},
            results: [
              {
                query: "test query",
                responses: {
                  openai: {
                    model: "gpt-5.2",
                    responseText: "Response text",
                    score: {
                      mentioned: true,
                      responseRelevant: true,
                      entitiesMentioned: [],
                      inTopThree: true,
                      totalOptionsListed: 3,
                      competitors: ["Rival A"],
                      howDescribed: "Great community",
                    },
                  },
                },
              },
            ],
          },
        },
      };

      const history = parseHistoryRuns({ runs: [fullRun] });
      expect(history.runs[0]).toEqual(fullRun);
      expect(history.runs[0].cells).toBeDefined();
      expect(Object.keys(history.runs[0].cells || {})).toHaveLength(1);
    });

    it("parsed history works with toUiBenchmarkRun", () => {
      const fullRun = {
        id: "run-1",
        timestamp: "2026-01-25T10:00:00Z",
        brand: "Test Brand",
        intentLibraryVersion: 1,
        metricsConfigVersion: 1,
        summary: {
          overall: {
            recommendationRate: 0.5,
            discoveryRate: 0.6,
            avgSentiment: 0.7,
            avgWinRate: 0.8,
          },
        },
        cells: {
          "move_up_explore": {
            intentId: "int-1",
            intentText: "Find communities",
            queriesUsed: ["test query"],
            metrics: {},
            results: [
              {
                query: "test",
                responses: {
                  openai: {
                    model: "gpt-5.2",
                    responseText: "Response text",
                    score: {
                      mentioned: true,
                      responseRelevant: true,
                      entitiesMentioned: [],
                      inTopThree: true,
                      totalOptionsListed: 3,
                      competitors: ["Rival A"],
                      howDescribed: "Great community",
                    },
                  },
                },
              },
            ],
          },
        },
      };

      const history = parseHistoryRuns({ runs: [fullRun] });
      const uiRun = toUiBenchmarkRun(history.runs[0]);

      expect(uiRun.id).toBe("run-1");
      expect(uiRun.providerScores).toBeDefined();
      expect(uiRun.providerScores.openai).toBeDefined();
    });

    it("throws on invalid history payload", () => {
      expect(() => parseHistoryRuns({ runs: [{ id: 123 }] })).toThrow();
    });

    it("throws on missing runs array", () => {
      expect(() => parseHistoryRuns({})).toThrow();
    });
  });

  describe("parseIntentLibrary", () => {
    it("parses valid intent library", () => {
      const library = parseIntentLibrary({
        version: 1,
        updatedAt: "2026-01-25T10:00:00Z",
        intents: [{
          id: "int-1",
          persona: "move_up",
          stage: "explore",
          text: "Find communities",
          role: "cpo",
          queryStyle: 0.75,
          createdAt: "2026-01-25T10:00:00Z",
          active: true,
        }],
        history: [],
      });
      expect(library.intents).toHaveLength(1);
      expect(library.intents[0].id).toBe("int-1");
    });

    it("throws on invalid intent structure", () => {
      expect(() => parseIntentLibrary({
        version: "invalid",
        updatedAt: "2026-01-25T10:00:00Z",
        intents: [],
        history: [],
      })).toThrow();
    });

    it("throws on missing required fields", () => {
      expect(() => parseIntentLibrary({
        version: 1,
        intents: [],
        history: [],
      })).toThrow();
    });
  });
});
