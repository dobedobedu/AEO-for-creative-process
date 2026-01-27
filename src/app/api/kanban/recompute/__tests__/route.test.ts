import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { POST } from "@/app/api/kanban/recompute/route";
import { recomputeKanbanSummary } from "@/lib/kanban/recompute";

vi.mock("@/lib/kanban/recompute", () => ({
  recomputeKanbanSummary: vi.fn(),
}));

describe("POST /api/kanban/recompute", () => {
  const originalSecret = process.env.CRON_SECRET;

  beforeEach(() => {
    process.env.CRON_SECRET = "test-secret";
  });

  afterEach(() => {
    process.env.CRON_SECRET = originalSecret;
    vi.resetAllMocks();
  });

  it("returns 401 when unauthorized", async () => {
    const req = new Request("http://localhost/api/kanban/recompute", {
      method: "POST",
      headers: { authorization: "Bearer wrong" },
      body: "{}",
    });

    const res = await POST(req);

    expect(res.status).toBe(401);
  });

  it("returns 404 when no run can be resolved", async () => {
    vi.mocked(recomputeKanbanSummary).mockResolvedValueOnce(null);

    const req = new Request("http://localhost/api/kanban/recompute", {
      method: "POST",
      headers: {
        authorization: "Bearer test-secret",
        "content-type": "application/json",
      },
      body: "{}",
    });

    const res = await POST(req);

    expect(res.status).toBe(404);
  });

  it("returns success with resolved runId", async () => {
    const runId = "11111111-1111-4111-8111-111111111111";
    vi.mocked(recomputeKanbanSummary).mockResolvedValueOnce(runId);

    const req = new Request("http://localhost/api/kanban/recompute", {
      method: "POST",
      headers: {
        authorization: "Bearer test-secret",
        "content-type": "application/json",
      },
      body: JSON.stringify({ runId }),
    });

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ success: true, runId });
  });
});
