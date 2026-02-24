import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/benchmark/scheduled/route";

vi.mock("@/lib/matrix/runtime", () => ({
  getActiveMatrixConfigCached: vi.fn(),
}));

vi.mock("@/app/api/benchmark/scheduled/[stage]/route", () => ({
  GET: vi.fn(),
}));

import { getActiveMatrixConfigCached } from "@/lib/matrix/runtime";
import { GET as runStage } from "@/app/api/benchmark/scheduled/[stage]/route";

const CRON_SECRET = "test-secret";

function makeRequest(): Request {
  return new Request("http://localhost/api/benchmark/scheduled", {
    headers: { authorization: `Bearer ${CRON_SECRET}` },
  });
}

describe("GET /api/benchmark/scheduled", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = CRON_SECRET;
  });

  it("dispatches active stages in order", async () => {
    vi.mocked(getActiveMatrixConfigCached).mockResolvedValue({
      stages: [
        { id: "compare", active: true, orderIndex: 2 },
        { id: "explore", active: true, orderIndex: 0 },
        { id: "consider", active: true, orderIndex: 1 },
        { id: "draft", active: false, orderIndex: 3 },
      ],
    } as unknown as { stages: Array<{ id: string; active: boolean; orderIndex: number }> });

    vi.mocked(runStage).mockResolvedValue(
      Response.json({ success: true }, { status: 200 })
    );

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);

    const stageOrder = vi
      .mocked(runStage)
      .mock.calls.map(([, ctx]) => ctx.params)
      .map(async (p) => (await p).stage);
    await expect(Promise.all(stageOrder)).resolves.toEqual([
      "explore",
      "consider",
      "compare",
    ]);
  });
});
