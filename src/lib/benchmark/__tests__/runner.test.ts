import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  type BenchmarkConfig,
  runBenchmark,
  runSingleQuery,
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

vi.mock("@/lib/providers/openai", () => ({
  callOpenAIWebSearch: vi.fn(),
}));

vi.mock("@/lib/providers/anthropic", () => ({
  callAnthropicWebSearch: vi.fn(),
}));

vi.mock("@/lib/providers/gemini", () => ({
  callGeminiWebSearch: vi.fn(),
}));

vi.mock("@/lib/providers/xai", () => ({
  callXaiSearch: vi.fn(),
}));

import { callOpenAIWebSearch } from "@/lib/providers/openai";
import { callAnthropicWebSearch } from "@/lib/providers/anthropic";
import { callGeminiWebSearch } from "@/lib/providers/gemini";
import { callXaiSearch } from "@/lib/providers/xai";
import { extractStageMetrics } from "@/lib/scoring/extractor";

describe("runSingleQuery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls OpenAI provider and returns structured response", async () => {
    const mockResponse = {
      id: "resp_123",
      output: [
        {
          type: "message",
          content: [{ type: "output_text", text: "Lakewood Ranch is great." }],
        },
      ],
    };
    vi.mocked(callOpenAIWebSearch).mockResolvedValue(mockResponse);

    const result = await runSingleQuery({
      query: "best florida communities",
      provider: "openai",
      model: "gpt-5.2",
    });

    expect(callOpenAIWebSearch).toHaveBeenCalledWith({
      model: "gpt-5.2",
      query: "best florida communities",
    });
    expect(result.provider).toBe("openai");
    expect(result.text).toContain("Lakewood Ranch");
    expect(result.raw).toEqual(mockResponse);
  });

  it("calls Anthropic provider and returns structured response", async () => {
    const mockResponse = {
      id: "msg_123",
      content: [{ type: "text", text: "The Villages is popular." }],
    };
    vi.mocked(callAnthropicWebSearch).mockResolvedValue(mockResponse);

    const result = await runSingleQuery({
      query: "florida retirement communities",
      provider: "anthropic",
      model: "claude-haiku-4-5",
    });

    expect(callAnthropicWebSearch).toHaveBeenCalled();
    expect(result.provider).toBe("anthropic");
    expect(result.text).toContain("Villages");
  });

  it("calls xAI provider and returns structured response", async () => {
    const mockResponse = {
      id: "xai_123",
      output: [{ type: "text", content: "Nocatee has great schools." }],
    };
    vi.mocked(callXaiSearch).mockResolvedValue(mockResponse);

    const result = await runSingleQuery({
      query: "best schools florida",
      provider: "xai",
      model: "grok-4-1-fast-reasoning",
    });

    expect(callXaiSearch).toHaveBeenCalled();
    expect(result.provider).toBe("xai");
    expect(result.text).toContain("Nocatee");
  });

  it("handles provider errors gracefully", async () => {
    vi.mocked(callOpenAIWebSearch).mockRejectedValue(new Error("API rate limit"));

    const result = await runSingleQuery({
      query: "test query",
      provider: "openai",
      model: "gpt-5.2",
    });

    expect(result.error).toBe("API rate limit");
    expect(result.text).toBe("");
  });
});

describe("runBenchmark", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("runs queries across all configured providers", async () => {
    vi.mocked(callOpenAIWebSearch).mockResolvedValue({
      output: [{ type: "message", content: [{ type: "output_text", text: "OpenAI response" }] }],
    });
    vi.mocked(callAnthropicWebSearch).mockResolvedValue({
      content: [{ type: "text", text: "Anthropic response" }],
    });
    vi.mocked(callGeminiWebSearch).mockResolvedValue({
      candidates: [{ content: { parts: [{ text: "Gemini response" }] } }],
    });
    vi.mocked(callXaiSearch).mockResolvedValue({
      output: [{ type: "text", content: "xAI response" }],
    });

    const config: BenchmarkConfig = {
      stage: "explore",
      intents: [{ id: "intent-1", queries: ["test query 1"] }],
      brand: "Lakewood Ranch",
      providers: [
        { provider: "openai", model: "gpt-5.2" },
        { provider: "anthropic", model: "claude-haiku-4-5" },
        { provider: "gemini", model: "gemini-3-flash-preview" },
        { provider: "xai", model: "grok-4-1-fast-reasoning" },
      ],
    };

    vi.mocked(extractStageMetrics).mockResolvedValue({
      success: true,
      extraction: {
        mentioned: false,
        responseRelevant: true,
        inTopThree: false,
        totalOptionsListed: 0,
        competitors: [],
        howDescribed: "not mentioned",
      },
    });

    const results = await runBenchmark(config);

    expect(results.queries).toHaveLength(1);
    expect(results.queries[0].responses).toHaveLength(4);
    expect(results.summary.totalQueries).toBe(1);
    expect(results.summary.providersUsed).toEqual(["openai", "anthropic", "gemini", "xai"]);
  });

  it("calculates brand visibility scores for each response", async () => {
    vi.mocked(callOpenAIWebSearch).mockResolvedValue({
      output: [{ type: "message", content: [{ type: "output_text", text: "Lakewood Ranch is recommended." }] }],
    });
    vi.mocked(callAnthropicWebSearch).mockResolvedValue({
      content: [{ type: "text", text: "The Villages is the best option." }],
    });

    const config: BenchmarkConfig = {
      stage: "explore",
      intents: [{ id: "intent-1", queries: ["best retirement community"] }],
      brand: "Lakewood Ranch",
      providers: [
        { provider: "openai", model: "gpt-5.2" },
        { provider: "anthropic", model: "claude-haiku-4-5" },
      ],
    };

    vi.mocked(extractStageMetrics)
      .mockResolvedValueOnce({
        success: true,
        extraction: {
          mentioned: true,
          responseRelevant: true,
          inTopThree: true,
          totalOptionsListed: 3,
          competitors: [],
          howDescribed: "Recommended",
        },
      })
      .mockResolvedValueOnce({
        success: true,
        extraction: {
          mentioned: false,
          responseRelevant: true,
          inTopThree: false,
          totalOptionsListed: 3,
          competitors: [],
          howDescribed: "not mentioned",
        },
      });

    const results = await runBenchmark(config);
    const openaiResponse = results.queries[0].responses.find(r => r.provider === "openai");
    const anthropicResponse = results.queries[0].responses.find(r => r.provider === "anthropic");

    expect(openaiResponse?.visibility.mentioned).toBe(true);
    expect(openaiResponse?.visibility.mentionCount).toBe(1);
    expect(anthropicResponse?.visibility.mentioned).toBe(false);
  });

  it("respects concurrency limits", async () => {
    let concurrentCalls = 0;
    let maxConcurrent = 0;

    vi.mocked(callOpenAIWebSearch).mockImplementation(async () => {
      concurrentCalls++;
      maxConcurrent = Math.max(maxConcurrent, concurrentCalls);
      await new Promise(r => setTimeout(r, 10));
      concurrentCalls--;
      return { output: [{ type: "message", content: [{ type: "output_text", text: "response" }] }] };
    });

    const config: BenchmarkConfig = {
      stage: "explore",
      intents: [{ id: "intent-1", queries: ["q1", "q2", "q3", "q4"] }],
      brand: "Test",
      providers: [{ provider: "openai", model: "gpt-5.2" }],
      concurrency: 2,
    };

    vi.mocked(extractStageMetrics).mockResolvedValue({
      success: true,
      extraction: {
        mentioned: false,
        responseRelevant: true,
        inTopThree: false,
        totalOptionsListed: 0,
        competitors: [],
        howDescribed: "not mentioned",
      },
    });

    await runBenchmark(config);
    expect(maxConcurrent).toBeLessThanOrEqual(2);
  });
});
