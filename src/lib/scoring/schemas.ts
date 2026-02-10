/**
 * Stage-Aware Scoring Schemas
 * 
 * These schemas define what Gemini 3 Flash extracts from each AI response
 * based on the buyer journey stage.
 */

import { z } from "zod";

// Entity categories for Kanban tracking
export const EntityCategorySchema = z.enum([
  "amenities",
  "activities",
  "schools",
  "nature",
  "villages",
  "builders",
  "location",
  "accolades",
  "other",
]);

export type EntityCategory = z.infer<typeof EntityCategorySchema>;

// Single entity mention extracted from response
export const EntityMentionSchema = z.object({
  name: z.string().describe("The feature, amenity, village, or differentiator mentioned"),
  category: EntityCategorySchema.describe("Category this entity belongs to"),
  sentiment: z.enum(["positive", "neutral", "negative"]).describe("How was this entity portrayed?"),
  contextSnippet: z.string().describe("The sentence or phrase where this entity was mentioned"),
});

export type EntityMention = z.infer<typeof EntityMentionSchema>;

// Base fields common to all stages
const BaseScoreSchema = z.object({
  mentioned: z.boolean().describe("Was the brand mentioned in the response?"),
  responseRelevant: z.boolean().describe("Was the response relevant to the query?"),
  entitiesMentioned: z.array(EntityMentionSchema).default([]).describe("Brand features, amenities, villages, builders, and differentiators mentioned in the response"),
});

// EXPLORE Stage: "What's out there?"
export const ExploreExtractionSchema = BaseScoreSchema.extend({
  inTopThree: z.boolean().describe("Was the brand in the first 3 options listed?"),
  totalOptionsListed: z.number().int().min(0).describe("How many options/communities were listed in total?"),
  competitors: z.array(z.string()).describe("Other communities or brands mentioned"),
  howDescribed: z.string().describe("Brief description of how the brand was characterized, or 'not mentioned'"),
});

export type ExploreExtraction = z.infer<typeof ExploreExtractionSchema>;

// CONSIDER Stage: "Tell me more"
export const ConsiderExtractionSchema = BaseScoreSchema.extend({
  sentiment: z.enum(["positive", "neutral", "negative"]).describe("Overall sentiment toward the brand"),
  sentimentScore: z.number().min(-1).max(1).describe("Sentiment score from -1 (very negative) to +1 (very positive)"),
  strengthsMentioned: z.array(z.string()).describe("Positive attributes or features mentioned about the brand"),
  concernsRaised: z.array(z.string()).describe("Negative aspects, concerns, or drawbacks mentioned"),
  overallPortrayal: z.string().describe("One-sentence summary of how the brand was portrayed"),
});

export type ConsiderExtraction = z.infer<typeof ConsiderExtractionSchema>;

// COMPARE Stage: "How does X vs Y?"
export const CompareExtractionSchema = BaseScoreSchema.extend({
  comparedTo: z.array(z.string()).describe("What other communities/brands was our brand compared against?"),
  outcome: z.enum(["win", "lose", "tie", "mixed", "not_compared"]).describe("Did our brand win, lose, tie, or have mixed results in comparisons?"),
  winsOn: z.array(z.string()).describe("Attributes where our brand was rated better"),
  losesOn: z.array(z.string()).describe("Attributes where our brand was rated worse"),
  aiConclusion: z.string().describe("The AI's overall conclusion or recommendation, if any"),
});

export type CompareExtraction = z.infer<typeof CompareExtractionSchema>;

// DECIDE Stage: "Which should I choose?"
export const DecideExtractionSchema = BaseScoreSchema.extend({
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

export type DecideExtraction = z.infer<typeof DecideExtractionSchema>;

// Union type for all extractions
export type StageExtraction = ExploreExtraction | ConsiderExtraction | CompareExtraction | DecideExtraction;

// Get the appropriate schema for a stage
export function getExtractionSchemaForStage(stage: string) {
  switch (stage) {
    case "explore":
      return ExploreExtractionSchema;
    case "consider":
      return ConsiderExtractionSchema;
    case "compare":
      return CompareExtractionSchema;
    case "decide":
      return DecideExtractionSchema;
    default:
      throw new Error(`Unknown stage: ${stage}`);
  }
}
