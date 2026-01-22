import { GET } from "@/app/api/matrix/active/route";
import { vi, describe, it, expect, beforeEach } from "vitest";

const mockGetActiveMatrixConfigCached = vi.fn();

vi.mock("@/lib/matrix/runtime", () => ({
  getActiveMatrixConfigCached: () => mockGetActiveMatrixConfigCached(),
}));

describe("GET /api/matrix/active", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns active config with 200", async () => {
    mockGetActiveMatrixConfigCached.mockResolvedValueOnce({
      personas: [
        { id: "move_up", label: "Move Up", orderIndex: 0, active: true },
        { id: "retiree", label: "Retiree", orderIndex: 1, active: true },
      ],
      stages: [
        {
          id: "explore",
          label: "Explore",
          orderIndex: 0,
          active: true,
          coreStageMapping: "explore",
        },
      ],
    });

    const res = await GET();
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.personas).toHaveLength(2);
    expect(data.stages).toHaveLength(1);
    expect(data.personas[0].id).toBe("move_up");
  });

  it("returns 500 on error", async () => {
    mockGetActiveMatrixConfigCached.mockRejectedValueOnce(new Error("DB error"));

    const res = await GET();
    expect(res.status).toBe(500);

    const data = await res.json();
    expect(data.error).toBe("Matrix config not available");
  });
});
