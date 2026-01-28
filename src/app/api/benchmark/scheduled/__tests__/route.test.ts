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

vi.mock("@/lib/metrics/config", () => ({
  loadMetricsConfig: vi.fn(),
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
}));

vi.mock("@/lib/providers/anthropic", () => ({
  getAnthropicBatchStatus: vi.fn(),
  getAnthropicBatchResults: vi.fn(),
}));

import { getActiveMatrixConfigCached, getActivePersonaIds, getCoreStageMapping } from "@/lib/matrix/runtime";
import { loadIntentLibrary } from "@/lib/intents/library";
import { loadMetricsConfig } from "@/lib/metrics/config";
import { runBenchmark } from "@/lib/benchmark";

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
    vi.mocked(runBenchmark).mockRejectedValue(new Error("should not run"));
  });

  it("returns 409 when intents are missing fresh generated queries", async () => {
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
          // generatedQueriesAt intentionally missing
        },
      ],
    });

    const res = await GET(makeRequest(), { params: Promise.resolve({ stage: "explore" }) });
    expect(res.status).toBe(409);

    const body = await res.json();
    expect(body.error).toMatch(/queries/i);
  });
});
