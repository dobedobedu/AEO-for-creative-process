export type Provider = "openai" | "anthropic" | "gemini" | "xai";

export type SearchModelConfig = {
  provider: Provider;
  model: string;
};

export const DEFAULT_PROVIDER_MODELS: Record<Provider, string> = {
  openai: "gpt-5.2",
  anthropic: "claude-haiku-4-5",
  gemini: "gemini-3-flash-preview",
  xai: "grok-4-1-fast-reasoning",
};

export function buildProviderModelMap(
  models: SearchModelConfig[],
  defaults: Record<Provider, string> = DEFAULT_PROVIDER_MODELS
): Record<Provider, string> {
  const map: Record<Provider, string> = { ...defaults };
  const seen = new Set<Provider>();

  for (const model of models) {
    if (!(model.provider in map)) continue;
    const trimmed = model.model?.trim();
    if (!trimmed) continue;
    if (seen.has(model.provider)) continue;
    map[model.provider] = trimmed;
    seen.add(model.provider);
  }

  return map;
}
