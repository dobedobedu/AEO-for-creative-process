import { describe, it, expect } from "vitest";
import { buildProviderModelMap, DEFAULT_PROVIDER_MODELS, type SearchModelConfig } from "@/lib/models/providerModels";

describe("buildProviderModelMap", () => {
  it("returns defaults when models list is empty", () => {
    const map = buildProviderModelMap([]);
    expect(map).toEqual(DEFAULT_PROVIDER_MODELS);
  });

  it("selects the first model per provider", () => {
    const models: SearchModelConfig[] = [
      { provider: "openai", model: "gpt-5.2" },
      { provider: "openai", model: "gpt-5.2-mini" },
      { provider: "gemini", model: "models/gemini-3-flash-preview" },
      { provider: "gemini", model: "models/gemini-3-pro" },
      { provider: "anthropic", model: "claude-haiku-4-5" },
      { provider: "xai", model: "grok-4-1-fast-reasoning" },
    ];

    const map = buildProviderModelMap(models, {
      ...DEFAULT_PROVIDER_MODELS,
      openai: "default-openai",
    });

    expect(map.openai).toBe("gpt-5.2");
    expect(map.gemini).toBe("models/gemini-3-flash-preview");
    expect(map.anthropic).toBe("claude-haiku-4-5");
    expect(map.xai).toBe("grok-4-1-fast-reasoning");
  });

  it("ignores empty model values", () => {
    const models: SearchModelConfig[] = [
      { provider: "xai", model: "" },
    ];

    const map = buildProviderModelMap(models);

    expect(map.xai).toBe(DEFAULT_PROVIDER_MODELS.xai);
  });
});
