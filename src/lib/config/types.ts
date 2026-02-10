/**
 * Tenant Configuration Types
 *
 * Defines the schema and types for tenant configuration.
 * Used by config/tenant.json and environment variable overrides.
 */

import { z } from "zod";

// Brand configuration
export const BrandConfigSchema = z.object({
  name: z.string().min(1),
  aliases: z.array(z.string()).default([]),
  domain: z.string().optional(),
  highlightColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#dcf3dc"),
});

export type BrandConfig = z.infer<typeof BrandConfigSchema>;

// Competitor configuration
export const CompetitorSchema = z.object({
  name: z.string().min(1),
  aliases: z.array(z.string()).default([]),
  isPrimary: z.boolean().default(false),
});

export type Competitor = z.infer<typeof CompetitorSchema>;

// Persona configuration
export const PersonaConfigSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  description: z.string().default(""),
});

export type PersonaConfig = z.infer<typeof PersonaConfigSchema>;

// Stage configuration
export const StageConfigSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  description: z.string().default(""),
});

export type StageConfig = z.infer<typeof StageConfigSchema>;

// Entity category configuration
export const EntityCategorySchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  examples: z.array(z.string()).default([]),
});

export type EntityCategory = z.infer<typeof EntityCategorySchema>;

// Geography configuration
export const GeographyConfigSchema = z.object({
  region: z.string().min(1),
  localities: z.array(z.string()).default([]),
  nearbyMetros: z.array(z.string()).default([]),
});

export type GeographyConfig = z.infer<typeof GeographyConfigSchema>;

// Provider configuration
export const ProviderWeightsSchema = z.object({
  openai: z.number().min(0).max(1).default(0.25),
  gemini: z.number().min(0).max(1).default(0.25),
  anthropic: z.number().min(0).max(1).default(0.25),
  xai: z.number().min(0).max(1).default(0.25),
});

export type ProviderWeights = z.infer<typeof ProviderWeightsSchema>;

export const ProviderModelsSchema = z.object({
  openai: z.string().default("gpt-4.5-preview"),
  gemini: z.string().default("gemini-3-pro-preview"),
  anthropic: z.string().default("claude-3-5-haiku-20241022"),
  xai: z.string().default("grok-3-preview"),
});

export type ProviderModels = z.infer<typeof ProviderModelsSchema>;

// Provider entry configuration (new dynamic format)
export const ProviderEntrySchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  model: z.string().min(1),
  weight: z.number().min(0).max(1),
  active: z.boolean(),
  apiKeyEnvVar: z.string().min(1),
});

export type ProviderEntry = z.infer<typeof ProviderEntrySchema>;

export const ProvidersConfigSchema = z.object({
  weights: ProviderWeightsSchema.default({}),
  models: ProviderModelsSchema.default({}),
  providers: z.array(ProviderEntrySchema).optional(),
});

export type ProvidersConfig = z.infer<typeof ProvidersConfigSchema>;

// Thresholds configuration
export const ThresholdsConfigSchema = z.object({
  strong: z.number().min(0).max(1).default(0.7),
  moderate: z.number().min(0).max(1).default(0.4),
  weak: z.number().min(0).max(1).default(0.2),
});

export type ThresholdsConfig = z.infer<typeof ThresholdsConfigSchema>;

// Metadata
export const MetadataSchema = z.object({
  version: z.string().default("1.0.0"),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

export type TenantMetadata = z.infer<typeof MetadataSchema>;

// Industry type
export const IndustrySchema = z.enum([
  "real_estate",
  "education",
  "healthcare",
  "marketing",
  "other",
]);

export type Industry = z.infer<typeof IndustrySchema>;

// Full tenant configuration
export const TenantConfigSchema = z.object({
  brand: BrandConfigSchema,
  competitors: z.array(CompetitorSchema).default([]),
  personas: z.array(PersonaConfigSchema).default([]),
  stages: z.array(StageConfigSchema).default([]),
  entityCategories: z.array(EntityCategorySchema).default([]),
  geography: GeographyConfigSchema.optional(),
  providers: ProvidersConfigSchema.default({}),
  thresholds: ThresholdsConfigSchema.default({}),
  industry: IndustrySchema.default("other"),
  metadata: MetadataSchema.default({}),
});

export type TenantConfig = z.infer<typeof TenantConfigSchema>;

// Provider type (used throughout the app)
export type Provider = "openai" | "anthropic" | "gemini" | "xai";
