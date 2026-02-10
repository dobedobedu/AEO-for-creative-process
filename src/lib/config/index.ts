/**
 * Configuration Module
 *
 * Central export point for all configuration utilities.
 *
 * Usage:
 *   import { getTenantConfig, getBrand, getCompetitors } from "@/lib/config";
 */

// Types
export type {
  TenantConfig,
  BrandConfig,
  Competitor,
  PersonaConfig,
  StageConfig,
  EntityCategory,
  GeographyConfig,
  ProviderWeights,
  ProviderModels,
  ProvidersConfig,
  ProviderEntry,
  ThresholdsConfig,
  TenantMetadata,
  Industry,
  Provider,
} from "./types";

// Schemas (for validation)
export {
  TenantConfigSchema,
  BrandConfigSchema,
  CompetitorSchema,
  PersonaConfigSchema,
  StageConfigSchema,
  EntityCategorySchema,
  GeographyConfigSchema,
  ProviderWeightsSchema,
  ProviderModelsSchema,
  ProvidersConfigSchema,
  ProviderEntrySchema,
  ThresholdsConfigSchema,
  MetadataSchema,
  IndustrySchema,
} from "./types";

// Loader
export {
  getTenantConfig,
  loadTenantConfig,
  loadTenantConfigAsync,
  initConfigFromDB,
  clearConfigCache,
  isServer,
} from "./loader";

// Brand utilities
export {
  getBrand,
  getBrandName,
  getBrandAliases,
  getBrandTerms,
  getBrandDomain,
  getBrandHighlightColor,
  textContainsBrand,
  findBrandMentions,
} from "./brand";

// Competitor utilities
export {
  getCompetitors,
  getPrimaryCompetitors,
  getCompetitorNames,
  getCompetitorTerms,
  getCompetitorLookup,
  matchCompetitor,
  findCompetitorMentions,
  textContainsCompetitor,
  getCompetitorByName,
} from "./competitors";

// Entity utilities
export {
  getEntityCategories,
  getEntityCategoryById,
  getEntityCategoryLabels,
  getEntityCategoryIds,
  buildEntityPromptSuffix,
  getAllEntityExamples,
} from "./entities";

// Threshold utilities
export {
  getThresholds,
  getStrongThreshold,
  getModerateThreshold,
  getWeakThreshold,
  categorizeScore,
  getScoreColor,
  getHeatmapColorClass,
  getScoreTextClass,
  getScoreDescription,
  type ScoreCategory,
} from "./thresholds";

// Provider utilities
export {
  getProvidersConfig,
  getProviderEntries,
  getProviderWeights,
  getProviderModels,
  getProviderWeight,
  getProviderModel,
  getNormalizedWeights,
  getProvidersByWeight,
  isProviderEnabled,
  getEnabledProviders,
  getConfiguredProviders,
  calculateWeightedScore,
} from "./providers";

// Client-side utilities (re-exported for convenience, but use "@/lib/config/client" for "use client" modules)
// Note: These are only usable in client components
export {
  useTenantConfig,
  useBrandConfig,
  useCompetitors,
  usePersonas,
  useStages,
  clearClientConfigCache,
  prefetchConfig,
  DEFAULT_BRAND,
  DEFAULT_PERSONAS,
  DEFAULT_STAGES,
} from "./client";

// Prompt utilities
export {
  loadPromptTemplate,
  interpolatePrompt,
  getDefaultPromptContext,
  getPrompt,
  getExtractionPrompt,
  getQueryGenerationPrompt,
  getChatSystemPrompt,
  getFileSearchSystemPrompt,
  clearPromptCache,
} from "./prompts";
