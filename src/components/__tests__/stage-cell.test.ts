import { describe, expect, it } from "vitest";

// Since StagCell exports only the component, we'll test the logic by extracting it
// These functions mirror the internal logic for testing

type Stage = "explore" | "consider" | "compare" | "decide";

function getMentionTone(mentionRate?: number): { bg: string; border: string } {
  if (mentionRate === undefined || Number.isNaN(mentionRate)) {
    return { bg: "bg-white", border: "border-[#e3dacb]/50" };
  }
  if (mentionRate >= 0.6) {
    return { bg: "bg-[#e3f1e6]", border: "border-[#b6d7bf]" };
  }
  if (mentionRate >= 0.4) {
    return { bg: "bg-[#edf1e0]", border: "border-[#cfd8b4]" };
  }
  if (mentionRate >= 0.2) {
    return { bg: "bg-[#f6efe0]", border: "border-[#e3dacb]" };
  }
  return { bg: "bg-[#f7e6e3]", border: "border-[#e6c3bb]" };
}

function formatMetric(stage: Stage, value: number): string {
  if (stage === "consider") {
    return value >= 0 ? `+${value.toFixed(1)}` : value.toFixed(1);
  }
  return `${(value * 100).toFixed(0)}%`;
}

function getPrimaryMetric(
  stage: Stage,
  metrics: {
    discoveryRate?: number;
    sentimentScore?: number;
    winRate?: number;
    recommendationRate?: number;
  }
): number | null {
  switch (stage) {
    case "explore":
      return metrics.discoveryRate ?? null;
    case "consider":
      return metrics.sentimentScore ?? null;
    case "compare":
      return metrics.winRate ?? null;
    case "decide":
      return metrics.recommendationRate ?? null;
  }
}

describe("getMentionTone", () => {
  it("returns white background for undefined mentionRate", () => {
    const result = getMentionTone(undefined);
    expect(result.bg).toBe("bg-white");
    expect(result.border).toBe("border-[#e3dacb]/50");
  });

  it("returns white background for NaN mentionRate", () => {
    const result = getMentionTone(NaN);
    expect(result.bg).toBe("bg-white");
    expect(result.border).toBe("border-[#e3dacb]/50");
  });

  it("returns green for high mention rate (>= 60%)", () => {
    const result = getMentionTone(0.6);
    expect(result.bg).toBe("bg-[#e3f1e6]");
    expect(result.border).toBe("border-[#b6d7bf]");
  });

  it("returns green for very high mention rate (90%)", () => {
    const result = getMentionTone(0.9);
    expect(result.bg).toBe("bg-[#e3f1e6]");
    expect(result.border).toBe("border-[#b6d7bf]");
  });

  it("returns yellow-green for medium-high mention rate (40-59%)", () => {
    const result = getMentionTone(0.5);
    expect(result.bg).toBe("bg-[#edf1e0]");
    expect(result.border).toBe("border-[#cfd8b4]");
  });

  it("returns amber for medium mention rate (20-39%)", () => {
    const result = getMentionTone(0.3);
    expect(result.bg).toBe("bg-[#f6efe0]");
    expect(result.border).toBe("border-[#e3dacb]");
  });

  it("returns red for low mention rate (< 20%)", () => {
    const result = getMentionTone(0.1);
    expect(result.bg).toBe("bg-[#f7e6e3]");
    expect(result.border).toBe("border-[#e6c3bb]");
  });

  it("returns red for zero mention rate", () => {
    const result = getMentionTone(0);
    expect(result.bg).toBe("bg-[#f7e6e3]");
    expect(result.border).toBe("border-[#e6c3bb]");
  });

  it("handles boundary at 0.6 correctly", () => {
    const at60 = getMentionTone(0.6);
    const below60 = getMentionTone(0.59);
    expect(at60.bg).toBe("bg-[#e3f1e6]");
    expect(below60.bg).toBe("bg-[#edf1e0]");
  });

  it("handles boundary at 0.4 correctly", () => {
    const at40 = getMentionTone(0.4);
    const below40 = getMentionTone(0.39);
    expect(at40.bg).toBe("bg-[#edf1e0]");
    expect(below40.bg).toBe("bg-[#f6efe0]");
  });

  it("handles boundary at 0.2 correctly", () => {
    const at20 = getMentionTone(0.2);
    const below20 = getMentionTone(0.19);
    expect(at20.bg).toBe("bg-[#f6efe0]");
    expect(below20.bg).toBe("bg-[#f7e6e3]");
  });
});

describe("formatMetric", () => {
  it("formats sentiment score with plus sign for positive", () => {
    expect(formatMetric("consider", 0.5)).toBe("+0.5");
    expect(formatMetric("consider", 0.3)).toBe("+0.3");
  });

  it("formats sentiment score without plus for negative", () => {
    expect(formatMetric("consider", -0.5)).toBe("-0.5");
    expect(formatMetric("consider", -0.3)).toBe("-0.3");
  });

  it("formats zero sentiment with plus sign", () => {
    expect(formatMetric("consider", 0)).toBe("+0.0");
  });

  it("formats discovery rate as percentage", () => {
    expect(formatMetric("explore", 0.75)).toBe("75%");
    expect(formatMetric("explore", 0.5)).toBe("50%");
    expect(formatMetric("explore", 1)).toBe("100%");
  });

  it("formats win rate as percentage", () => {
    expect(formatMetric("compare", 0.6)).toBe("60%");
  });

  it("formats recommendation rate as percentage", () => {
    expect(formatMetric("decide", 0.85)).toBe("85%");
  });

  it("rounds percentages to nearest integer", () => {
    expect(formatMetric("explore", 0.333)).toBe("33%");
    expect(formatMetric("explore", 0.666)).toBe("67%");
  });
});

describe("getPrimaryMetric", () => {
  it("returns discoveryRate for explore stage", () => {
    expect(getPrimaryMetric("explore", { discoveryRate: 0.7 })).toBe(0.7);
  });

  it("returns sentimentScore for consider stage", () => {
    expect(getPrimaryMetric("consider", { sentimentScore: 0.3 })).toBe(0.3);
  });

  it("returns winRate for compare stage", () => {
    expect(getPrimaryMetric("compare", { winRate: 0.5 })).toBe(0.5);
  });

  it("returns recommendationRate for decide stage", () => {
    expect(getPrimaryMetric("decide", { recommendationRate: 0.8 })).toBe(0.8);
  });

  it("returns null when metric is not defined", () => {
    expect(getPrimaryMetric("explore", {})).toBeNull();
    expect(getPrimaryMetric("consider", {})).toBeNull();
    expect(getPrimaryMetric("compare", {})).toBeNull();
    expect(getPrimaryMetric("decide", {})).toBeNull();
  });

  it("ignores unrelated metrics", () => {
    expect(getPrimaryMetric("explore", { winRate: 0.5, recommendationRate: 0.8 })).toBeNull();
    expect(getPrimaryMetric("consider", { discoveryRate: 0.7, winRate: 0.5 })).toBeNull();
  });
});
