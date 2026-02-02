import { describe, it, expect } from "vitest";
import { generateBatchCustomId, parseBatchCustomId } from "@/lib/providers/batch";

describe("generateBatchCustomId", () => {
  it("avoids collisions for intent IDs with the same prefix", () => {
    const base = {
      persona: "move_up",
      stage: "explore",
      provider: "anthropic",
      queryIndex: 0,
    } as const;

    const idA = generateBatchCustomId({ ...base, intentId: "int_move_aaaaaaaa" });
    const idB = generateBatchCustomId({ ...base, intentId: "int_move_bbbbbbbb" });

    expect(idA).not.toBe(idB);
  });

  it("parses stage/provider/queryIndex with hashed intent segment", () => {
    const customId = generateBatchCustomId({
      persona: "move_up",
      stage: "decide",
      provider: "anthropic",
      queryIndex: 2,
      intentId: "int_move_aaaaaaaa",
    });

    const parsed = parseBatchCustomId(customId);

    expect(parsed?.stage).toBe("decide");
    expect(parsed?.provider).toBe("anthropic");
    expect(parsed?.queryIndex).toBe(2);
  });
});
