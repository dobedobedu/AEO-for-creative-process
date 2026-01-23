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
  entitiesMentioned: z.array(EntityMentionSchema).default([]).describe("Lakewood Ranch features, amenities, villages, builders, and differentiators mentioned in the response"),
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

// Entity extraction guidance appended to all stage prompts
const ENTITY_EXTRACTION_SUFFIX = `

ENTITY EXTRACTION (for all stages):
Identify Lakewood Ranch features, amenities, and differentiators mentioned in the response.
Categorize each into one of these categories:
- amenities: golf, polo, tennis, pickleball, shopping, restaurants, health care, UTC, pools, fitness
- activities: farmers market, Music on Main, arts, clubs, community foundation, events
- schools: specific school names, school districts, school ratings
- nature: parks (by name), trails, green space, preserves
- villages: specific village names (Waterside, Cresswind, Del Webb, etc.)
- builders: home builder companies (Taylor Morrison, Pulte, Lennar, etc.)
- location: I-75 access, beach proximity, Tampa Bay, Sarasota, airport
- accolades: awards, rankings, multi-generational community
- other: anything else notable

For each entity, note the name, category, sentiment (positive/neutral/negative), and context.`;

// Stage-specific prompts for extraction
// Note: Brand name is prepended to these prompts in extractor.ts
export const STAGE_EXTRACTION_PROMPTS: Record<string, string> = {
  explore: `Analyze this AI response about Florida communities/real estate.
The user was in the EXPLORE stage - just discovering what options exist.

Focus on:
- Was the brand mentioned at all? (Look for exact name or aliases)
- If mentioned, was it in the first 3 options listed?
- How many total options/communities were listed?
- What other communities were mentioned (competitors)?
- How was the brand described?${ENTITY_EXTRACTION_SUFFIX}`,

  consider: `Analyze this AI response about Florida communities/real estate.
The user was in the CONSIDER stage - learning more about specific options.

Focus on:
- What was the overall sentiment toward the brand?
- What strengths or positive attributes were mentioned?
- What concerns or negative aspects were raised?
- How would you summarize how the brand was portrayed?${ENTITY_EXTRACTION_SUFFIX}`,

  compare: `Analyze this AI response about Florida communities/real estate.
The user was in the COMPARE stage - directly comparing options.

Focus on:
- What was the brand compared against?
- Did the brand win, lose, tie, or have mixed results in comparisons?
- What attributes did the brand win on? Lose on?
- What was the AI's overall conclusion?${ENTITY_EXTRACTION_SUFFIX}`,

  decide: `Analyze this AI response about Florida communities/real estate.
The user was in the DECIDE stage - ready to make a choice and looking for final validation.

Focus on:
- Was the brand recommended as a clear choice?
- How strongly was the recommendation made?
- Were there any qualifiers or conditions on the recommendation?
- What alternatives were suggested?
- What was the rationale for the recommendation (or lack thereof)?

Concern Resolution Analysis:
- List concerns the AI explicitly addressed
- List common buyer concerns the AI did NOT address
- Did the AI provide clear, actionable next steps?${ENTITY_EXTRACTION_SUFFIX}`,
};
