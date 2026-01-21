import { z } from "zod";
import { PersonaSchema, StageSchema } from "../intents/types";
import {
  ExploreExtractionSchema,
  ConsiderExtractionSchema,
  CompareExtractionSchema,
  DecideExtractionSchema,
} from "../scoring/schemas";

export const ProviderSchema = z.enum(["openai", "anthropic", "gemini", "xai"]);
export type Provider = z.infer<typeof ProviderSchema>;

// Citation stored with responses (simplified from full Citation type)
export const StoredCitationSchema = z.object({
  url: z.string(),
  domain: z.string(),
  title: z.string().optional(),
  snippet: z.string().optional(),
  sourceType: z.enum(["url_citation", "grounding_chunk"]),
});

export type StoredCitation = z.infer<typeof StoredCitationSchema>;

// Response with stage-specific score
export const ResponseResultSchema = z.object({
  provider: ProviderSchema,
  model: z.string(),
  responseText: z.string(),
  score: z.union([
    ExploreExtractionSchema,
    ConsiderExtractionSchema,
    CompareExtractionSchema,
    DecideExtractionSchema,
  ]),
  // Citations extracted from provider response (optional for backwards compatibility)
  citations: z.array(StoredCitationSchema).optional(),
});

export type ResponseResult = z.infer<typeof ResponseResultSchema>;

// Query result contains all provider responses
export const QueryResultSchema = z.object({
  query: z.string(),
  responses: z.record(ProviderSchema, ResponseResultSchema.omit({ provider: true })),
});

export type QueryResult = z.infer<typeof QueryResultSchema>;

// Cell metrics (aggregated from query results)
export const CellMetricsSchema = z.object({
  // Explore metrics
  discoveryRate: z.number().min(0).max(1).optional(),
  topThreeRate: z.number().min(0).max(1).optional(),
  // Consider metrics
  sentimentScore: z.number().min(-1).max(1).optional(),
  // Compare metrics
  winRate: z.number().min(0).max(1).optional(),
  // Decide metrics
  recommendationRate: z.number().min(0).max(1).optional(),
});

export type CellMetrics = z.infer<typeof CellMetricsSchema>;

// Cell result for a specific persona×stage
export const CellResultSchema = z.object({
  intentId: z.string(),
  intentText: z.string(),
  queriesUsed: z.array(z.string()),
  metrics: CellMetricsSchema,
  results: z.array(QueryResultSchema),
});

export type CellResult = z.infer<typeof CellResultSchema>;

// Run summary (pre-computed aggregates)
export const RunSummarySchema = z.object({
  overall: z.object({
    recommendationRate: z.number().min(0).max(1),
    discoveryRate: z.number().min(0).max(1),
    avgSentiment: z.number().min(-1).max(1),
    avgWinRate: z.number().min(0).max(1),
  }),
  byProvider: z.record(ProviderSchema, z.object({
    recommendationRate: z.number().min(0).max(1),
    discoveryRate: z.number().min(0).max(1),
  })).optional(),
});

export type RunSummary = z.infer<typeof RunSummarySchema>;

// Aggregates by persona or stage
export const DimensionSummarySchema = z.object({
  discoveryRate: z.number().min(0).max(1).optional(),
  sentimentScore: z.number().min(-1).max(1).optional(),
  winRate: z.number().min(0).max(1).optional(),
  recommendationRate: z.number().min(0).max(1).optional(),
});

export type DimensionSummary = z.infer<typeof DimensionSummarySchema>;

// Full benchmark run
export const BenchmarkRunSchema = z.object({
  id: z.string(),
  timestamp: z.string().datetime(),
  intentLibraryVersion: z.number().int().positive(),
  metricsConfigVersion: z.number().int().positive(),
  brand: z.string(),
  summary: RunSummarySchema,
  byPersona: z.record(PersonaSchema, DimensionSummarySchema).optional(),
  byStage: z.record(StageSchema, DimensionSummarySchema).optional(),
  cells: z.record(z.string(), CellResultSchema),
});

export type BenchmarkRun = z.infer<typeof BenchmarkRunSchema>;

// Run metadata for listing (without full results)
export const RunMetadataSchema = z.object({
  id: z.string(),
  timestamp: z.string().datetime(),
  brand: z.string(),
  intentLibraryVersion: z.number().int().positive(),
  metricsConfigVersion: z.number().int().positive(),
  summary: RunSummarySchema,
});

export type RunMetadata = z.infer<typeof RunMetadataSchema>;

export function generateRunId(): string {
  // Use crypto.randomUUID() for proper UUID format expected by database
  return crypto.randomUUID();
}

export function getRunFilename(run: BenchmarkRun | RunMetadata): string {
  const date = run.timestamp.split("T")[0];
  return `${date}_${run.id}.json`;
}
