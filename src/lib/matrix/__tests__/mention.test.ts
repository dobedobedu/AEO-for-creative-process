import { describe, it, expect } from "vitest";
import { getExploreMentionStats } from "@/lib/matrix/mention";
import type { ProviderKey } from "@/lib/matrix/weights";

describe("explore mention stats", () => {
  it("counts mention rate for explore stage only", () => {
    const cell = {
      stage: "explore",
      results: [
        {
          responses: [
            { provider: "openai" as ProviderKey, visibility: { mentioned: true } },
            { provider: "gemini" as ProviderKey, visibility: { mentioned: false } },
          ],
        },
      ],
    };

    const stats = getExploreMentionStats(cell);
    expect(stats.mentionCount).toBe(1);
    expect(stats.mentionTotalResponses).toBe(2);
    expect(stats.mentionRate).toBe(0.5);
  });

  it("returns zeroes for non-explore stages", () => {
    const cell = {
      stage: "consider",
      results: [
        {
          responses: [
            { provider: "openai" as ProviderKey, visibility: { mentioned: true } },
          ],
        },
      ],
    };

    const stats = getExploreMentionStats(cell);
    expect(stats.mentionCount).toBe(0);
    expect(stats.mentionTotalResponses).toBe(0);
    expect(stats.mentionRate).toBeNull();
  });

  it("filters by enabled providers", () => {
    const cell = {
      stage: "explore",
      results: [
        {
          responses: [
            { provider: "openai" as ProviderKey, visibility: { mentioned: true } },
            { provider: "gemini" as ProviderKey, visibility: { mentioned: true } },
          ],
        },
      ],
    };

    const stats = getExploreMentionStats(cell, new Set(["openai"]));
    expect(stats.mentionCount).toBe(1);
    expect(stats.mentionTotalResponses).toBe(1);
    expect(stats.mentionRate).toBe(1);
  });
});
