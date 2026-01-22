import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock before imports
vi.mock("@/lib/matrix/db", () => ({
  getActiveMatrixConfig: vi.fn(async () => ({
    personas: [
      { id: "move_up", label: "Move Up Buyer", orderIndex: 0, active: true },
      { id: "retiree", label: "Retiree", orderIndex: 1, active: true },
    ],
    stages: [
      {
        id: "explore",
        label: "Explore",
        orderIndex: 0,
        active: true,
        coreStage: true,
        coreStageMapping: "explore",
      },
      {
        id: "custom_research",
        label: "Custom Research",
        orderIndex: 1,
        active: true,
        coreStage: false,
        coreStageMapping: "explore",
      },
    ],
  })),
}));

import {
  getActiveMatrixConfigCached,
  assertValidPersonaStage,
  getCoreStageMapping,
  getActivePersonaIds,
  getActiveStageIds,
  clearConfigCache,
  parseCellKey,
} from "@/lib/matrix/runtime";

describe("matrix runtime", () => {
  beforeEach(() => {
    clearConfigCache();
  });

  it("loads active config and caches it", async () => {
    const cfg1 = await getActiveMatrixConfigCached();
    const cfg2 = await getActiveMatrixConfigCached();
    expect(cfg1).toBe(cfg2); // Same reference = cached
    expect(cfg1.personas[0].id).toBe("move_up");
  });

  it("validates persona/stage combinations", async () => {
    const cfg = await getActiveMatrixConfigCached();
    expect(() => assertValidPersonaStage("move_up", "explore", cfg)).not.toThrow();
    expect(() => assertValidPersonaStage("invalid", "explore", cfg)).toThrow("Invalid or inactive persona");
    expect(() => assertValidPersonaStage("move_up", "invalid", cfg)).toThrow("Invalid or inactive stage");
  });

  it("validates against inactive personas/stages", async () => {
    const cfg = await getActiveMatrixConfigCached();
    // Add an inactive persona for testing
    cfg.personas.push({ id: "inactive_persona", label: "Inactive", orderIndex: 99, active: false });
    expect(() => assertValidPersonaStage("inactive_persona", "explore", cfg)).toThrow("Invalid or inactive persona");
  });

  it("maps stage to core stage for scoring", async () => {
    const cfg = await getActiveMatrixConfigCached();
    expect(getCoreStageMapping("explore", cfg)).toBe("explore");
    expect(getCoreStageMapping("custom_research", cfg)).toBe("explore"); // Maps to explore
    expect(() => getCoreStageMapping("invalid", cfg)).toThrow("Stage not found");
  });

  it("throws error for stage without coreStageMapping", async () => {
    const cfg = await getActiveMatrixConfigCached();
    // Add a stage without mapping
    cfg.stages.push({
      id: "broken_stage",
      label: "Broken",
      orderIndex: 99,
      active: true,
      coreStage: false,
    });
    expect(() => getCoreStageMapping("broken_stage", cfg)).toThrow("missing coreStageMapping");
  });

  it("gets active persona IDs", async () => {
    const cfg = await getActiveMatrixConfigCached();
    const ids = getActivePersonaIds(cfg);
    expect(ids).toEqual(["move_up", "retiree"]);
  });

  it("gets active stage IDs", async () => {
    const cfg = await getActiveMatrixConfigCached();
    const ids = getActiveStageIds(cfg);
    expect(ids).toEqual(["explore", "custom_research"]);
  });

  it("parses cell keys", () => {
    expect(parseCellKey("move_up_explore")).toEqual({ persona: "move_up", stage: "explore" });
    expect(parseCellKey("first_time_decide")).toEqual({ persona: "first_time", stage: "decide" });
    // Note: persona IDs can contain underscores, only the LAST underscore separates persona from stage
    expect(parseCellKey("custom_persona_custom_stage")).toEqual({ persona: "custom_persona_custom", stage: "stage" });
    expect(() => parseCellKey("invalid")).toThrow("Invalid cell key format");
  });
});
