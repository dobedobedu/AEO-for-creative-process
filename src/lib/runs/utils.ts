/**
 * Shared utilities for benchmark runs
 */

import type { Persona, Stage } from "@/lib/intents/types";
import type { Provider, CellResult, RunSummary } from "@/lib/runs/types";
import type { StageExtraction } from "@/lib/scoring/schemas";

/**
 * Parse a cell key back into persona and stage
 * Cell keys are formatted as "{persona}_{stage}" e.g., "move_up_explore"
 */
export function parseCellKey(cellKey: string): { persona: Persona; stage: Stage } {
    // Stage is always the last segment after underscore
    const lastUnderscore = cellKey.lastIndexOf("_");
    if (lastUnderscore === -1) {
        throw new Error(`Invalid cell key format: ${cellKey}`);
    }
    const persona = cellKey.slice(0, lastUnderscore) as Persona;
    const stage = cellKey.slice(lastUnderscore + 1) as Stage;
    return { persona, stage };
}

/**
 * Calculate run summary from cells
 * Extracts stage-specific metrics and computes averages
 */
export function calculateRunSummary(cells: Record<string, CellResult>): RunSummary {
    const allCells = Object.values(cells);

    const discoveryRates = allCells
        .map(c => c.metrics.discoveryRate)
        .filter((v): v is number => v !== undefined);
    const sentimentScores = allCells
        .map(c => c.metrics.sentimentScore)
        .filter((v): v is number => v !== undefined);
    const winRates = allCells
        .map(c => c.metrics.winRate)
        .filter((v): v is number => v !== undefined);
    const recommendationRates = allCells
        .map(c => c.metrics.recommendationRate)
        .filter((v): v is number => v !== undefined);

    return {
        overall: {
            discoveryRate: discoveryRates.length > 0
                ? discoveryRates.reduce((a, b) => a + b, 0) / discoveryRates.length
                : 0,
            avgSentiment: sentimentScores.length > 0
                ? sentimentScores.reduce((a, b) => a + b, 0) / sentimentScores.length
                : 0,
            avgWinRate: winRates.length > 0
                ? winRates.reduce((a, b) => a + b, 0) / winRates.length
                : 0,
            recommendationRate: recommendationRates.length > 0
                ? recommendationRates.reduce((a, b) => a + b, 0) / recommendationRates.length
                : 0,
        },
    };
}

/**
 * Generate a cell key from persona and stage
 */
export function getCellKey(persona: string, stage: string): string {
    return `${persona}_${stage}`;
}

/**
 * Default provider configuration
 */
export const DEFAULT_PROVIDERS: Array<{ provider: Provider; model: string }> = [
    { provider: "openai", model: "gpt-5.2" },
    { provider: "anthropic", model: "claude-haiku-4-5" },
    { provider: "gemini", model: "gemini-3-flash-preview" },
    { provider: "xai", model: "grok-4-1-fast-reasoning" },
];

/**
 * @deprecated Use getActivePersonaIds() from @/lib/matrix/runtime instead
 * This hardcoded list doesn't reflect the dynamic configuration
 */
export const ALL_PERSONAS: string[] = ["move_up", "retiree", "luxury", "first_time"];

/**
 * @deprecated Use getActiveStageIds() from @/lib/matrix/runtime instead
 * This hardcoded list doesn't reflect the dynamic configuration
 */
export const ALL_STAGES: string[] = ["explore", "consider", "compare", "decide"];

/**
 * Default brand configuration
 */
export const DEFAULT_BRAND = "Lakewood Ranch";
export const DEFAULT_ALIASES = ["LWR", "Lakewood"];

/**
 * Generate an empty extraction for a given stage (used for error cases)
 */
export function emptyExtraction(stage: string): StageExtraction {
    // Map custom stages to core stages for extraction generation
    const coreStage = stage === "explore" || stage === "consider" || stage === "compare" || stage === "decide"
        ? stage
        : "explore"; // Default to explore for unknown stages

    switch (coreStage) {
        case "explore":
            return {
                mentioned: false,
                responseRelevant: false,
                entitiesMentioned: [],
                inTopThree: false,
                totalOptionsListed: 0,
                competitors: [],
                howDescribed: "Not mentioned",
            };
        case "consider":
            return {
                mentioned: false,
                responseRelevant: false,
                entitiesMentioned: [],
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
                entitiesMentioned: [],
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
                entitiesMentioned: [],
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
