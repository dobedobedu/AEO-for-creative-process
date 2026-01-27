import { describe, it, expect, vi } from "vitest";
import { recomputeKanbanSummary, resolveKanbanRunId } from "@/lib/kanban/recompute";

function makeSql(results: Array<unknown[]>) {
  const calls: string[] = [];
  const sql = (strings: TemplateStringsArray, ..._values: unknown[]) => {
    calls.push(strings.join("").replace(/\s+/g, " ").trim());
    const next = results.shift();
    return Promise.resolve(next ?? []);
  };
  return { sql, calls };
}

describe("resolveKanbanRunId", () => {
  it("returns latest run with entity summary", async () => {
    const { sql, calls } = makeSql([[{ id: "run-summary" }]]);

    const runId = await resolveKanbanRunId(sql);

    expect(runId).toBe("run-summary");
    expect(calls.length).toBe(1);
  });

  it("falls back to latest run with cells when no summary exists", async () => {
    const { sql, calls } = makeSql([[], [{ id: "run-cells" }]]);

    const runId = await resolveKanbanRunId(sql);

    expect(runId).toBe("run-cells");
    expect(calls.length).toBe(2);
  });

  it("falls back to latest completed run when no summary or cells exist", async () => {
    const { sql, calls } = makeSql([[], [], [{ id: "run-completed" }]]);

    const runId = await resolveKanbanRunId(sql);

    expect(runId).toBe("run-completed");
    expect(calls.length).toBe(3);
  });

  it("returns null when no runs are available", async () => {
    const { sql } = makeSql([[], [], []]);

    const runId = await resolveKanbanRunId(sql);

    expect(runId).toBeNull();
  });
});

describe("recomputeKanbanSummary", () => {
  it("deletes existing summary and recomputes for explicit runId", async () => {
    const { sql, calls } = makeSql([[]]);
    const computeSummary = vi.fn().mockResolvedValue(undefined);

    const runId = await recomputeKanbanSummary({
      runId: "run-123",
      sqlClient: sql,
      computeSummary,
    });

    expect(runId).toBe("run-123");
    expect(calls[0]).toContain("DELETE FROM run_entity_summary");
    expect(computeSummary).toHaveBeenCalledWith("run-123");
  });

  it("returns null when no runId can be resolved", async () => {
    const { sql } = makeSql([[], [], []]);
    const computeSummary = vi.fn().mockResolvedValue(undefined);

    const runId = await recomputeKanbanSummary({
      sqlClient: sql,
      computeSummary,
    });

    expect(runId).toBeNull();
    expect(computeSummary).not.toHaveBeenCalled();
  });
});
