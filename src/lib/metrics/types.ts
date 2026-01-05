import { z } from "zod";
import { StageSchema } from "../intents/types";

export const MetricTypeSchema = z.enum(["percentage", "score", "enum", "count"]);
export type MetricType = z.infer<typeof MetricTypeSchema>;

export const MetricDefinitionSchema = z.object({
  label: z.string(),
  type: MetricTypeSchema,
  description: z.string(),
  range: z.tuple([z.number(), z.number()]).optional(),
  values: z.array(z.string()).optional(),
});

export type MetricDefinition = z.infer<typeof MetricDefinitionSchema>;

export const StageMetricsConfigSchema = z.object({
  primary: z.string(),
  secondary: z.array(z.string()),
  context: z.array(z.string()),
});

export type StageMetricsConfig = z.infer<typeof StageMetricsConfigSchema>;

export const MetricsConfigChangeSchema = z.object({
  stage: StageSchema,
  field: z.enum(["primary", "secondary", "context"]),
  oldValue: z.unknown(),
  newValue: z.unknown(),
});

export type MetricsConfigChange = z.infer<typeof MetricsConfigChangeSchema>;

export const MetricsConfigHistoryEntrySchema = z.object({
  version: z.number().int().positive(),
  date: z.string(),
  changes: z.array(MetricsConfigChangeSchema),
});

export type MetricsConfigHistoryEntry = z.infer<typeof MetricsConfigHistoryEntrySchema>;

export const MetricsConfigSchema = z.object({
  version: z.number().int().positive(),
  updatedAt: z.string().datetime(),
  stageMetrics: z.object({
    explore: StageMetricsConfigSchema,
    consider: StageMetricsConfigSchema,
    compare: StageMetricsConfigSchema,
    decide: StageMetricsConfigSchema,
  }),
  availableMetrics: z.record(z.string(), MetricDefinitionSchema),
  history: z.array(MetricsConfigHistoryEntrySchema),
});

export type MetricsConfig = z.infer<typeof MetricsConfigSchema>;

// Stage-specific score schemas (what Gemini extracts)

export const ExploreScoreSchema = z.object({
  mentioned: z.boolean(),
  inTopThree: z.boolean(),
  totalOptionsListed: z.number().int().min(0),
  competitors: z.array(z.string()),
  howDescribed: z.string(),
});

export type ExploreScore = z.infer<typeof ExploreScoreSchema>;

export const ConsiderScoreSchema = z.object({
  mentioned: z.boolean(),
  sentiment: z.enum(["positive", "neutral", "negative"]),
  sentimentScore: z.number().min(-1).max(1),
  strengthsMentioned: z.array(z.string()),
  concernsRaised: z.array(z.string()),
});

export type ConsiderScore = z.infer<typeof ConsiderScoreSchema>;

export const CompareScoreSchema = z.object({
  mentioned: z.boolean(),
  comparedTo: z.array(z.string()),
  outcome: z.enum(["win", "lose", "tie", "mixed", "not_compared"]),
  winsOn: z.array(z.string()),
  losesOn: z.array(z.string()),
});

export type CompareScore = z.infer<typeof CompareScoreSchema>;

export const RecommendationStrengthSchema = z.enum([
  "not_mentioned",
  "mentioned",
  "suggested",
  "recommended",
  "strongly_recommended",
]);

export type RecommendationStrength = z.infer<typeof RecommendationStrengthSchema>;

export const DecideScoreSchema = z.object({
  mentioned: z.boolean(),
  recommended: z.boolean(),
  recommendationStrength: RecommendationStrengthSchema,
  qualifiers: z.array(z.string()),
  alternativesOffered: z.array(z.string()),
});

export type DecideScore = z.infer<typeof DecideScoreSchema>;

export type StageScore = ExploreScore | ConsiderScore | CompareScore | DecideScore;

export function getScoreSchemaForStage(stage: string) {
  switch (stage) {
    case "explore":
      return ExploreScoreSchema;
    case "consider":
      return ConsiderScoreSchema;
    case "compare":
      return CompareScoreSchema;
    case "decide":
      return DecideScoreSchema;
    default:
      throw new Error(`Unknown stage: ${stage}`);
  }
}
