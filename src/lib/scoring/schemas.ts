/**
 * Stage-Aware Scoring Schemas
 * 
 * These schemas define what Gemini 3 Flash extracts from each AI response
 * based on the buyer journey stage.
 */

import { z } from "zod";

const FALLBACK_ENTITY_CATEGORY = "other" as const;

function createEntityCategorySchema(categoryIds: string[] = []) {
  if (categoryIds.length === 0) {
    return z.string().min(1);
  }

  const normalized = Array.from(
    new Set(
      categoryIds
        .map((id) => id.trim())
        .filter((id) => id.length > 0)
        .concat(FALLBACK_ENTITY_CATEGORY)
    )
  );
  const allowed = new Set(normalized);

  return z
    .string()
    .min(1)
    .refine((value) => allowed.has(value), {
      message: `Category must be one of: ${normalized.join(", ")}`,
    });
}

function createEntityMentionSchema(categorySchema: z.ZodType<string>) {
  return z.object({
    name: z
      .string()
      .describe("The feature, capability, differentiator, or key entity mentioned"),
    category: categorySchema.describe("Category this entity belongs to"),
    sentiment: z
      .enum(["positive", "neutral", "negative"])
      .describe("How was this entity portrayed?"),
    contextSnippet: z
      .string()
      .describe("The sentence or phrase where this entity was mentioned"),
  });
}

export type EntityCategory = z.infer<typeof EntityCategorySchema>;

export const EntityCategorySchema = createEntityCategorySchema();
export const EntityMentionSchema = createEntityMentionSchema(EntityCategorySchema);

export type EntityMention = z.infer<typeof EntityMentionSchema>;

function createBaseScoreSchema(entityMentionSchema: typeof EntityMentionSchema) {
  return z.object({
    mentioned: z.boolean().describe("Was the brand mentioned in the response?"),
    responseRelevant: z
      .boolean()
      .describe("Was the response relevant to the query?"),
    entitiesMentioned: z
      .array(entityMentionSchema)
      .default([])
      .describe(
        "Brand features, capabilities, and differentiators mentioned in the response"
      ),
  });
}

// EXPLORE Stage: "What's out there?"
const createExploreExtractionSchema = (
  baseScoreSchema: ReturnType<typeof createBaseScoreSchema>
) =>
  baseScoreSchema.extend({
  inTopThree: z.boolean().describe("Was the brand in the first 3 options listed?"),
  totalOptionsListed: z
    .number()
    .int()
    .min(0)
    .describe("How many options were listed in total?"),
  competitors: z.array(z.string()).describe("Other alternatives or brands mentioned"),
  howDescribed: z
    .string()
    .describe("Brief description of how the brand was characterized, or 'not mentioned'"),
});

const BaseScoreSchema = createBaseScoreSchema(EntityMentionSchema);
export const ExploreExtractionSchema = createExploreExtractionSchema(BaseScoreSchema);
export type ExploreExtraction = z.infer<typeof ExploreExtractionSchema>;

// CONSIDER Stage: "Tell me more"
const createConsiderExtractionSchema = (
  baseScoreSchema: ReturnType<typeof createBaseScoreSchema>
) =>
  baseScoreSchema.extend({
  sentiment: z.enum(["positive", "neutral", "negative"]).describe("Overall sentiment toward the brand"),
  sentimentScore: z.number().min(-1).max(1).describe("Sentiment score from -1 (very negative) to +1 (very positive)"),
  strengthsMentioned: z.array(z.string()).describe("Positive attributes or features mentioned about the brand"),
  concernsRaised: z.array(z.string()).describe("Negative aspects, concerns, or drawbacks mentioned"),
  overallPortrayal: z.string().describe("One-sentence summary of how the brand was portrayed"),
});

export const ConsiderExtractionSchema = createConsiderExtractionSchema(BaseScoreSchema);
export type ConsiderExtraction = z.infer<typeof ConsiderExtractionSchema>;

// COMPARE Stage: "How does X vs Y?"
const createCompareExtractionSchema = (
  baseScoreSchema: ReturnType<typeof createBaseScoreSchema>
) =>
  baseScoreSchema.extend({
  comparedTo: z.array(z.string()).describe("What other alternatives/brands was our brand compared against?"),
  outcome: z.enum(["win", "lose", "tie", "mixed", "not_compared"]).describe("Did our brand win, lose, tie, or have mixed results in comparisons?"),
  winsOn: z.array(z.string()).describe("Attributes where our brand was rated better"),
  losesOn: z.array(z.string()).describe("Attributes where our brand was rated worse"),
  aiConclusion: z.string().describe("The AI's overall conclusion or recommendation, if any"),
});

export const CompareExtractionSchema = createCompareExtractionSchema(BaseScoreSchema);
export type CompareExtraction = z.infer<typeof CompareExtractionSchema>;

// DECIDE Stage: "Which should I choose?"
const createDecideExtractionSchema = (
  baseScoreSchema: ReturnType<typeof createBaseScoreSchema>
) =>
  baseScoreSchema.extend({
  recommended: z.boolean().describe("Was our brand recommended as a choice?"),
  recommendationStrength: z.enum([
    "not_mentioned",
    "mentioned",
    "suggested",
    "recommended",
    "strongly_recommended"
  ]).describe("How strongly was our brand recommended?"),
  qualifiers: z.array(z.string()).describe("Conditions attached to the recommendation (e.g., 'if budget allows', 'for golf lovers')"),
  alternativesOffered: z.array(z.string()).describe("Other options the AI suggested as alternatives"),
  decisionRationale: z.string().describe("Why the AI did or did not recommend our brand"),
  // New fields for concern resolution tracking (AEO 2026)
  concernsAddressed: z.array(z.string()).describe("User concerns/objections the AI explicitly addressed (e.g., 'budget concerns', 'distance from airport')"),
  concernsUnaddressed: z.array(z.string()).describe("Common buyer concerns the AI did NOT address"),
  actionableGuidance: z.boolean().describe("Did the AI provide clear next steps or actionable guidance?"),
});

export const DecideExtractionSchema = createDecideExtractionSchema(BaseScoreSchema);
export type DecideExtraction = z.infer<typeof DecideExtractionSchema>;

// Union type for all extractions
export type StageExtraction = ExploreExtraction | ConsiderExtraction | CompareExtraction | DecideExtraction;

// Get the appropriate schema for a stage
export function getExtractionSchemaForStage(stage: string, categoryIds: string[] = []) {
  const dynamicCategorySchema = createEntityCategorySchema(categoryIds);
  const dynamicEntityMentionSchema = createEntityMentionSchema(dynamicCategorySchema);
  const dynamicBaseScoreSchema = createBaseScoreSchema(dynamicEntityMentionSchema);

  switch (stage) {
    case "explore":
      return createExploreExtractionSchema(dynamicBaseScoreSchema);
    case "consider":
      return createConsiderExtractionSchema(dynamicBaseScoreSchema);
    case "compare":
      return createCompareExtractionSchema(dynamicBaseScoreSchema);
    case "decide":
      return createDecideExtractionSchema(dynamicBaseScoreSchema);
    default:
      throw new Error(`Unknown stage: ${stage}`);
  }
}
