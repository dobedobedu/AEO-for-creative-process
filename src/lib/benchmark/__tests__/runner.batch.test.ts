import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  runBenchmark,
  DEFAULT_VISIBILITY_SCORE,
  type BenchmarkConfig,
} from "../runner";

vi.mock("@/lib/scoring/extractor", async () => {
  const actual = await vi.importActual<typeof import("@/lib/scoring/extractor")>(
    "@/lib/scoring/extractor"
  );
  return {
    ...actual,
    extractStageMetrics: vi.fn(),
  };
});

vi.mock("@/lib/providers/anthropic", () => ({
  callAnthropicWebSearch: vi.fn(),
}));

vi.mock("@/lib/cache", () => ({
  getCachedResponse: vi.fn().mockReturnValue(null),
  setCachedResponse: vi.fn(),
}));

import { callAnthropicWebSearch } from "@/lib/providers/anthropic";
import { extractStageMetrics } from "@/lib/scoring/extractor";

function makeBatchResult(text: string) {
  return {
    text,
    citations: [],
    raw: { source: "batch" },
  };
}

describe("runBenchmark batch behavior (Anthropic)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uses batch result for cron runs when available", async () => {
    vi.mocked(callAnthropicWebSearch).mockResolvedValue({
      content: [{ type: "text", text: "sync response" }],
    });

    vi.mocked(extractStageMetrics).mockResolvedValue({
      success: true,
      extraction: {
        mentioned: false,
        responseRelevant: true,
        entitiesMentioned: [],
        inTopThree: false,
        totalOptionsListed: 0,
        competitors: [],
        howDescribed: "not mentioned",
      },
    });

    // Key format matches runner: `${provider}_${intentId}_${queryIndex}`
    const batchResults = new Map([
      ["anthropic_intent-1_0", makeBatchResult("batch response")],
    ]);

    const config: BenchmarkConfig = {
      stage: "explore",
      intents: [{ id: "intent-1", queries: ["q1"] }],
      brand: "Lakewood Ranch",
      providers: [{ provider: "anthropic", model: "claude-haiku-4-5" }],
      concurrency: 1,
      triggerMode: "cron",
      batchResults,
    };

    const results = await runBenchmark(config);

    const response = results.queries[0].responses[0];
    expect(callAnthropicWebSearch).not.toHaveBeenCalled();
    expect(response.text).toBe("batch response");
  });

  it("uses sync response for UI runs even when batch result exists", async () => {
    vi.mocked(callAnthropicWebSearch).mockResolvedValue({
      content: [{ type: "text", text: "sync response" }],
    });

    vi.mocked(extractStageMetrics).mockResolvedValue({
      success: true,
      extraction: {
        mentioned: false,
        responseRelevant: true,
        entitiesMentioned: [],
        inTopThree: false,
        totalOptionsListed: 0,
        competitors: [],
        howDescribed: "not mentioned",
      },
    });

    const batchResults = new Map([
      ["anthropic_intent-1_0", makeBatchResult("batch response")],
    ]);

    const config: BenchmarkConfig = {
      stage: "explore",
      intents: [{ id: "intent-1", queries: ["q1"] }],
      brand: "Lakewood Ranch",
      providers: [{ provider: "anthropic", model: "claude-haiku-4-5" }],
      concurrency: 1,
      triggerMode: "ui",
      batchResults,
    };

    const results = await runBenchmark(config);

    const response = results.queries[0].responses[0];
    expect(callAnthropicWebSearch).toHaveBeenCalled();
    expect(response.text).toBe("sync response");
  });

  it("falls back to sync when batch result is missing", async () => {
    vi.mocked(callAnthropicWebSearch).mockResolvedValue({
      content: [{ type: "text", text: "sync response" }],
    });

    vi.mocked(extractStageMetrics).mockResolvedValue({
      success: true,
      extraction: {
        mentioned: false,
        responseRelevant: true,
        entitiesMentioned: [],
        inTopThree: false,
        totalOptionsListed: 0,
        competitors: [],
        howDescribed: "not mentioned",
      },
    });

    // Empty batch results - should fall back to sync
    const batchResults = new Map<string, { text: string; citations: string[]; raw: unknown }>();

    const config: BenchmarkConfig = {
      stage: "explore",
      intents: [{ id: "intent-1", queries: ["q1"] }],
      brand: "Lakewood Ranch",
      providers: [{ provider: "anthropic", model: "claude-haiku-4-5" }],
      concurrency: 1,
      triggerMode: "cron",
      batchResults,
    };

    const results = await runBenchmark(config);

    const response = results.queries[0].responses[0];
    expect(callAnthropicWebSearch).toHaveBeenCalled();
    expect(response.text).toBe("sync response");
  });

  it("uses per-intent queryIndex for batch key", async () => {
    vi.mocked(callAnthropicWebSearch).mockResolvedValue({
      content: [{ type: "text", text: "sync response" }],
    });

    vi.mocked(extractStageMetrics).mockResolvedValue({
      success: true,
      extraction: {
        mentioned: false,
        responseRelevant: true,
        entitiesMentioned: [],
        inTopThree: false,
        totalOptionsListed: 0,
        competitors: [],
        howDescribed: "not mentioned",
      },
    });

    const batchResults = new Map([
      ["anthropic_intent-1_0", makeBatchResult("batch response 0")],
      ["anthropic_intent-1_1", makeBatchResult("batch response 1")],
    ]);

    const config: BenchmarkConfig = {
      stage: "explore",
      intents: [{ id: "intent-1", queries: ["q1", "q2"] }],
      brand: "Lakewood Ranch",
      providers: [{ provider: "anthropic", model: "claude-haiku-4-5" }],
      concurrency: 1,
      triggerMode: "cron",
      batchResults,
    };

    const results = await runBenchmark(config);

    const first = results.queries[0].responses[0];
    const second = results.queries[1].responses[0];
    expect(first.text).toBe("batch response 0");
    expect(second.text).toBe("batch response 1");
  });
});
