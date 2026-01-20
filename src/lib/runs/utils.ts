/**
 * Shared utilities for benchmark runs
 */

import type { Persona, Stage } from "@/lib/intents/types";
import type { Provider } from "@/lib/runs/types";
import type { StageExtraction } from "@/lib/scoring/schemas";

/**
 * Generate a cell key from persona and stage
 */
export function getCellKey(persona: Persona, stage: Stage): string {
    return `${persona}_${stage}`;
}

/**
 * Default provider configuration
 */
export const DEFAULT_PROVIDERS: Array<{ provider: Provider; model: string }> = [
    { provider: "openai", model: "gpt-5.2" },
    { provider: "anthropic", model: "claude-haiku-4-5" },
    { provider: "gemini", model: "gemini-3-flash-preview" },
    { provider: "xai", model: "grok-4-latest" },
];

/**
 * All personas in the system
 */
export const ALL_PERSONAS: Persona[] = ["move_up", "retiree", "luxury", "first_time"];

/**
 * All stages in the buyer journey
 */
export const ALL_STAGES: Stage[] = ["explore", "consider", "compare", "decide"];

/**
 * Default brand configuration
 */
export const DEFAULT_BRAND = "Lakewood Ranch";
export const DEFAULT_ALIASES = ["LWR", "Lakewood"];

/**
 * Generate an empty extraction for a given stage (used for error cases)
 */
export function emptyExtraction(stage: Stage): StageExtraction {
    switch (stage) {
        case "explore":
            return {
                mentioned: false,
                responseRelevant: false,
                inTopThree: false,
                totalOptionsListed: 0,
                competitors: [],
                howDescribed: "Not mentioned",
            };
        case "consider":
            return {
                mentioned: false,
                responseRelevant: false,
                sentiment: "neutral",
                sentimentScore: 0,
                strengthsMentioned: [],
                concernsRaised: [],
                overallPortrayal: "Not mentioned",
            };
        case "compare":
            return {
                mentioned: false,
                responseRelevant: false,
                outcome: "not_compared",
                comparedTo: [],
                winsOn: [],
                losesOn: [],
                aiConclusion: "Not compared",
            };
        case "decide":
            return {
                mentioned: false,
                responseRelevant: false,
                recommended: false,
                recommendationStrength: "not_mentioned",
                qualifiers: [],
                alternativesOffered: [],
                decisionRationale: "Not mentioned",
                concernsAddressed: [],
                concernsUnaddressed: [],
                actionableGuidance: false,
            };
    }
}
