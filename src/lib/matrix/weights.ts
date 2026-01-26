export type ProviderKey = "openai" | "anthropic" | "gemini" | "xai";

export const DEFAULT_PROVIDER_WEIGHTS: Record<ProviderKey, number> = {
  openai: 0.64,
  gemini: 0.22,
  anthropic: 0.02,
  xai: 0.04,
};

export type WeightMode = "equal" | "weighted";

export function normalizeWeights(weights: Record<ProviderKey, number>): Record<ProviderKey, number> {
  const entries = Object.entries(weights) as [ProviderKey, number][];
  const total = entries.reduce((sum, [, value]) => sum + value, 0);

  if (total <= 0) {
    const equal = entries.length > 0 ? 1 / entries.length : 0;
    return entries.reduce((acc, [key]) => {
      acc[key] = equal;
      return acc;
    }, {} as Record<ProviderKey, number>);
  }

  return entries.reduce((acc, [key, value]) => {
    acc[key] = value / total;
    return acc;
  }, {} as Record<ProviderKey, number>);
}

export function applyProviderWeight(
  value: number,
  provider: ProviderKey,
  mode: WeightMode,
  weights: Record<ProviderKey, number>
): number {
  if (mode !== "weighted") return value;
  const normalized = normalizeWeights(weights);
  return value * (normalized[provider] ?? 0);
}
