import { describe, it, expect } from "vitest";
import { applyProviderWeight, normalizeWeights, DEFAULT_PROVIDER_WEIGHTS } from "@/lib/matrix/weights";

describe("market weighting", () => {
  it("normalizes weights to sum to 1", () => {
    const normalized = normalizeWeights(DEFAULT_PROVIDER_WEIGHTS);
    const total = Object.values(normalized).reduce((sum, value) => sum + value, 0);
    expect(total).toBeCloseTo(1, 6);
    expect(normalized.openai).toBeCloseTo(0.64 / 0.92, 6);
  });

  it("returns raw values in equal mode", () => {
    expect(applyProviderWeight(80, "openai", "equal", DEFAULT_PROVIDER_WEIGHTS)).toBe(80);
  });

  it("scales values by normalized share in weighted mode", () => {
    const weighted = applyProviderWeight(80, "openai", "weighted", DEFAULT_PROVIDER_WEIGHTS);
    expect(weighted).toBeCloseTo(80 * (0.64 / 0.92), 6);
  });
});
