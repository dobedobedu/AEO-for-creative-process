/**
 * Provider Configuration Utilities
 *
 * Helper functions for accessing provider weights and models.
 * Supports both the legacy format (weights/models objects) and the new
 * ProviderEntry[] format. When the new format is present, functions derive
 * weights and models from the ProviderEntry array. Otherwise they fall back
 * to the legacy weights/models objects.
 */

import { getTenantConfig } from "./loader";
import { DEFAULT_PROVIDERS } from "@/lib/runs/utils";
import type {
  ProviderWeights,
  ProviderModels,
  ProvidersConfig,
  Provider,
  ProviderEntry,
} from "./types";

/**
 * Get full providers configuration
 */
export function getProvidersConfig(): ProvidersConfig {
  return getTenantConfig().providers;
}

/**
 * Get the ProviderEntry array if available.
 * Returns undefined if the config uses the legacy format only.
 */
export function getProviderEntries(): ProviderEntry[] | undefined {
  return getProvidersConfig().providers;
}

/**
 * Get provider weights.
 * If the new ProviderEntry[] format is present, derives weights from it.
 * Otherwise falls back to the legacy weights object.
 */
export function getProviderWeights(): ProviderWeights {
  const config = getProvidersConfig();
  const entries = config.providers;

  if (entries && entries.length > 0) {
    // Derive weights from ProviderEntry array
    const weights: Record<string, number> = {
      openai: 0,
      gemini: 0,
      anthropic: 0,
      xai: 0,
    };
    for (const entry of entries) {
      if (entry.id in weights) {
        weights[entry.id] = entry.weight;
      }
    }
    return weights as unknown as ProviderWeights;
  }

  return config.weights;
}

/**
 * Get provider models.
 * If the new ProviderEntry[] format is present, derives models from it.
 * Otherwise falls back to the legacy models object.
 */
export function getProviderModels(): ProviderModels {
  const config = getProvidersConfig();
  const entries = config.providers;

  if (entries && entries.length > 0) {
    // Derive models from ProviderEntry array
    const models: Record<string, string> = {
      openai: config.models.openai,
      gemini: config.models.gemini,
      anthropic: config.models.anthropic,
      xai: config.models.xai,
    };
    for (const entry of entries) {
      if (entry.id in models) {
        models[entry.id] = entry.model;
      }
    }
    return models as unknown as ProviderModels;
  }

  return config.models;
}

/**
 * Get weight for a specific provider
 */
export function getProviderWeight(provider: Provider): number {
  return getProviderWeights()[provider];
}

/**
 * Get model for a specific provider
 */
export function getProviderModel(provider: Provider): string {
  return getProviderModels()[provider];
}

/**
 * Get normalized weights (ensure they sum to 1)
 */
export function getNormalizedWeights(): ProviderWeights {
  const weights = getProviderWeights();
  const total = weights.openai + weights.gemini + weights.anthropic + weights.xai;

  if (total === 0) {
    // Equal weights if all are zero
    return { openai: 0.25, gemini: 0.25, anthropic: 0.25, xai: 0.25 };
  }

  return {
    openai: weights.openai / total,
    gemini: weights.gemini / total,
    anthropic: weights.anthropic / total,
    xai: weights.xai / total,
  };
}

/**
 * Get providers sorted by weight (descending)
 */
export function getProvidersByWeight(): Provider[] {
  const weights = getProviderWeights();
  const providers: Provider[] = ["openai", "gemini", "anthropic", "xai"];

  return providers.sort((a, b) => weights[b] - weights[a]);
}

/**
 * Check if a provider is enabled.
 * If the new ProviderEntry[] format is present, checks the `active` flag.
 * Otherwise falls back to checking if the provider has non-zero weight.
 */
export function isProviderEnabled(provider: Provider): boolean {
  const entries = getProviderEntries();

  if (entries && entries.length > 0) {
    const entry = entries.find((e) => e.id === provider);
    return entry?.active ?? false;
  }

  return getProviderWeight(provider) > 0;
}

/**
 * Get enabled providers.
 * If the new ProviderEntry[] format is present, returns providers with active=true.
 * Otherwise returns providers with non-zero weight (legacy behavior).
 */
export function getEnabledProviders(): Provider[] {
  const entries = getProviderEntries();

  if (entries && entries.length > 0) {
    return entries
      .filter((e) => e.active)
      .map((e) => e.id) as Provider[];
  }

  return (["openai", "gemini", "anthropic", "xai"] as Provider[]).filter(
    (p) => getProviderWeight(p) > 0
  );
}

/**
 * Get the provider list for benchmark runs, derived from tenant config.
 * Falls back to DEFAULT_PROVIDERS if no providers are configured.
 */
export function getConfiguredProviders(): Array<{ provider: Provider; model: string }> {
  const enabledProviders = getEnabledProviders();
  if (enabledProviders.length === 0) {
    return DEFAULT_PROVIDERS;
  }
  return enabledProviders.map((provider) => ({
    provider,
    model: getProviderModel(provider),
  }));
}

/**
 * Calculate weighted score across providers
 *
 * @param scores - Map of provider to score
 * @returns Weighted average score
 */
export function calculateWeightedScore(
  scores: Partial<Record<Provider, number>>
): number {
  const weights = getNormalizedWeights();
  let totalWeight = 0;
  let weightedSum = 0;

  for (const provider of Object.keys(scores) as Provider[]) {
    const score = scores[provider];
    if (score !== undefined && score !== null) {
      const weight = weights[provider];
      weightedSum += score * weight;
      totalWeight += weight;
    }
  }

  if (totalWeight === 0) return 0;
  return weightedSum / totalWeight;
}
