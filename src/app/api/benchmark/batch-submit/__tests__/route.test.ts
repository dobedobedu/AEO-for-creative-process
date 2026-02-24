import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "@/app/api/benchmark/batch-submit/route";

vi.mock("@/lib/intents/library", () => ({
  loadIntentLibrary: vi.fn(),
  updateIntent: vi.fn(),
}));

vi.mock("@/lib/intents/queryGenerator", () => ({
  generateQueriesFromIntent: vi.fn(),
}));

vi.mock("@/lib/matrix/runtime", () => ({
  getActiveMatrixConfigCached: vi.fn(),
  getActivePersonaIds: vi.fn(),
  getActiveStageIds: vi.fn(),
  getCoreStageMapping: vi.fn(),
}));

vi.mock("@/lib/runs/storage", () => ({
  getTodayRunId: vi.fn().mockReturnValue("run-1"),
}));

vi.mock("@/lib/providers/batch", () => ({
  createBatchJob: vi.fn(),
  generateBatchCustomId: vi.fn(),
}));

vi.mock("@/lib/providers/anthropic", () => ({
  submitAnthropicBatch: vi.fn(),
}));

vi.mock("@/lib/providers/gemini", () => ({
  submitGeminiBatch: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  sql: vi.fn().mockResolvedValue([]),
}));

import { loadIntentLibrary, updateIntent } from "@/lib/intents/library";
import { generateQueriesFromIntent } from "@/lib/intents/queryGenerator";
import { getActiveMatrixConfigCached, getActivePersonaIds, getActiveStageIds, getCoreStageMapping } from "@/lib/matrix/runtime";
import { createBatchJob, generateBatchCustomId } from "@/lib/providers/batch";
import { submitAnthropicBatch } from "@/lib/providers/anthropic";
import { submitGeminiBatch } from "@/lib/providers/gemini";

const CRON_SECRET = "test-secret";

function makeRequest(): Request {
  return new Request("http://localhost/api/benchmark/batch-submit", {
    headers: { authorization: `Bearer ${CRON_SECRET}` },
  });
}

describe("GET /api/benchmark/batch-submit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = CRON_SECRET;

    vi.mocked(getActiveMatrixConfigCached).mockResolvedValue({
      stages: [{ id: "explore", active: true, orderIndex: 0 }],
    } as unknown as { stages: Array<{ id: string; active: boolean; orderIndex: number }> });
    vi.mocked(getActivePersonaIds).mockReturnValue(["move_up"]);
    vi.mocked(getActiveStageIds).mockReturnValue(["explore"]);
    vi.mocked(getCoreStageMapping).mockReturnValue("explore");

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
          createdAt: new Date().toISOString(),
        },
      ],
    });

    vi.mocked(generateQueriesFromIntent).mockResolvedValue({
      queries: ["q1", "q2", "q3"],
    });

    vi.mocked(generateBatchCustomId).mockImplementation(({ queryIndex }: { queryIndex: number }) => `cid-${queryIndex}`);

    vi.mocked(submitAnthropicBatch).mockResolvedValue({
      batchId: "batch-1",
      requestCount: 3,
    });
  });

  it("stores intentIdMap metadata on batch submit", async () => {
    const res = await GET(makeRequest());
    expect(res.status).toBe(200);

    expect(updateIntent).toHaveBeenCalledWith(
      "intent-1",
      expect.objectContaining({
        generatedQueries: ["q1", "q2", "q3"],
        generatedQueriesAt: expect.any(String),
      })
    );

    expect(createBatchJob).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: "anthropic",
        batchType: "search",
        metadata: {
          intentIdMap: {
            "cid-0": "intent-1",
            "cid-1": "intent-1",
            "cid-2": "intent-1",
          },
        },
      })
    );

    // Gemini should not be batched
    expect(submitGeminiBatch).not.toHaveBeenCalled();
  });
});
