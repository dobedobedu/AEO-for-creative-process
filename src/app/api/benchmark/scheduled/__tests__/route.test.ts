import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "@/app/api/benchmark/scheduled/[stage]/route";

vi.mock("@/lib/matrix/runtime", () => ({
  getActiveMatrixConfigCached: vi.fn(),
  getActivePersonaIds: vi.fn(),
  getCoreStageMapping: vi.fn(),
}));

vi.mock("@/lib/intents/library", () => ({
  loadIntentLibrary: vi.fn(),
  updateIntent: vi.fn(),
}));

vi.mock("@/lib/intents/queryGenerator", () => ({
  generateQueriesFromIntent: vi.fn(),
}));

vi.mock("@/lib/metrics/config", () => ({
  loadMetricsConfig: vi.fn(),
}));

vi.mock("@/lib/scoring/extractor", () => ({
  calculateExploreMetrics: vi.fn().mockReturnValue({ discoveryRate: 0, topThreeRate: 0 }),
  calculateConsiderMetrics: vi.fn().mockReturnValue({ avgSentiment: 0 }),
  calculateCompareMetrics: vi.fn().mockReturnValue({ winRate: 0 }),
  calculateDecideMetrics: vi.fn().mockReturnValue({ recommendationRate: 0 }),
}));

vi.mock("@/lib/benchmark", () => ({
  runBenchmark: vi.fn(),
}));

vi.mock("@/lib/runs/storage", () => ({
  upsertRunCells: vi.fn(),
  upsertSingleCell: vi.fn(),
  getTodayRunId: vi.fn().mockReturnValue("run-1"),
}));

vi.mock("@/lib/runs/aggregator", () => ({
  saveRunAggregates: vi.fn(),
  refreshRunMetadata: vi.fn(),
}));

vi.mock("@/lib/filesearch/uploader", () => ({
  uploadRunAsync: vi.fn(),
}));

vi.mock("@/lib/providers/batch", () => ({
  getBatchJob: vi.fn(),
  updateBatchJobStatus: vi.fn(),
  parseBatchCustomId: vi.fn(),
  getBatchJobMetadata: vi.fn(),
}));

vi.mock("@/lib/providers/anthropic", () => ({
  getAnthropicBatchStatus: vi.fn(),
  getAnthropicBatchResults: vi.fn(),
}));

import { getActiveMatrixConfigCached, getActivePersonaIds, getCoreStageMapping } from "@/lib/matrix/runtime";
import { loadIntentLibrary, updateIntent } from "@/lib/intents/library";
import { loadMetricsConfig } from "@/lib/metrics/config";
import { runBenchmark } from "@/lib/benchmark";
import { getBatchJob, parseBatchCustomId, getBatchJobMetadata } from "@/lib/providers/batch";
import { getAnthropicBatchResults } from "@/lib/providers/anthropic";
import { generateQueriesFromIntent } from "@/lib/intents/queryGenerator";
import { upsertRunCells } from "@/lib/runs/storage";

const CRON_SECRET = "test-secret";

function makeRequest(): Request {
  return new Request("http://localhost/api/benchmark/scheduled/explore", {
    headers: { authorization: `Bearer ${CRON_SECRET}` },
  });
}

describe("GET /api/benchmark/scheduled/[stage]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = CRON_SECRET;

    vi.mocked(getActiveMatrixConfigCached).mockResolvedValue({
      stages: [{ id: "explore", active: true, orderIndex: 0 }],
    } as unknown as { stages: Array<{ id: string; active: boolean; orderIndex: number }> });
    vi.mocked(getActivePersonaIds).mockReturnValue(["move_up"]);
    vi.mocked(getCoreStageMapping).mockReturnValue("explore");
    vi.mocked(loadMetricsConfig).mockReturnValue({ version: "test" } as { version: string });
    vi.mocked(runBenchmark).mockResolvedValue({
      queries: [{ query: "q1", intentId: "intent-1", responses: [] }],
      summary: {
        totalQueries: 1,
        providersUsed: [],
        brandMentionRate: { openai: 0, anthropic: 0, gemini: 0, xai: 0 },
        avgVisibilityScore: { openai: 0, anthropic: 0, gemini: 0, xai: 0 },
        executionTimeMs: 0,
      },
    });
    vi.mocked(upsertRunCells).mockResolvedValue({ cells: {} } as { cells: Record<string, unknown> });
  });

  it("regenerates stale queries instead of returning 409", async () => {
    vi.mocked(generateQueriesFromIntent).mockResolvedValue({ queries: ["q1", "q2", "q3"] });

    vi.mocked(loadIntentLibrary).mockResolvedValueOnce({
      version: 1,
      intents: [
        {
          id: "intent-1",
          persona: "move_up",
          stage: "explore",
          active: true,
          text: "intent text",
          role: "cpo",
          queryStyle: 0.75,
          generatedQueries: ["q1", "q2", "q3"],
          // generatedQueriesAt intentionally missing
        },
      ],
    });
    vi.mocked(loadIntentLibrary).mockResolvedValueOnce({
      version: 1,
      intents: [
        {
          id: "intent-1",
          persona: "move_up",
          stage: "explore",
          active: true,
          text: "intent text",
          role: "cpo",
          queryStyle: 0.75,
          generatedQueries: ["q1", "q2", "q3"],
          generatedQueriesAt: new Date().toISOString(),
        },
      ],
    });

    const res = await GET(makeRequest(), { params: Promise.resolve({ stage: "explore" }) });
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.success).toBe(true);
    expect(generateQueriesFromIntent).toHaveBeenCalledTimes(1);
    expect(updateIntent).toHaveBeenCalledWith(
      "intent-1",
      expect.objectContaining({
        generatedQueries: ["q1", "q2", "q3"],
        generatedQueriesAt: expect.any(String),
      })
    );
  });

  it("uses cached queries and maps batch results to full intentId", async () => {
    const today = new Date().toISOString();
    vi.mocked(loadIntentLibrary).mockResolvedValue({
      version: 1,
      intents: [
        {
          id: "intent-1",
          persona: "move_up",
          stage: "explore",
          active: true,
          text: "intent text",
          role: "cpo",
          queryStyle: 0.75,
          generatedQueries: ["q1", "q2", "q3"],
          generatedQueriesAt: today,
        },
      ],
    });

    vi.mocked(getBatchJob).mockResolvedValue({
      id: "job-1",
      runId: "run-1",
      provider: "anthropic",
      batchType: "search",
      batchId: "batch-1",
      status: "completed",
      requestCount: 1,
      inputFileId: null,
      outputFileId: null,
      errorMessage: null,
      createdAt: today,
      completedAt: today,
    });

    vi.mocked(getAnthropicBatchResults).mockResolvedValue([
      { customId: "cid-0", success: true, text: "resp", citations: [], raw: {} },
    ]);

    vi.mocked(parseBatchCustomId).mockReturnValue({
      persona: "move_up",
      stage: "explore",
      intentIdPrefix: "ignored",
      provider: "anthropic",
      queryIndex: 0,
    });

    vi.mocked(getBatchJobMetadata).mockResolvedValue({
      intentIdMap: { "cid-0": "intent-1" },
    });

    const res = await GET(makeRequest(), { params: Promise.resolve({ stage: "explore" }) });
    expect(res.status).toBe(200);

    expect(generateQueriesFromIntent).not.toHaveBeenCalled();

    const calledConfig = vi.mocked(runBenchmark).mock.calls[0][0];
    const batchMap = calledConfig.batchResults as Map<string, unknown> | undefined;
    expect(batchMap?.has("anthropic_intent-1_0")).toBe(true);
  });
});
