/**
 * Intent-to-Query Generator using DeepSeek
 * 
 * Flow: Intent + Persona + Stage + Role + QueryStyle → Search Queries
 */

import { callOpenRouter } from "../providers/openrouter";
import { safeAsync } from "../utils";
import type { Persona, Stage } from "./types";

export interface QueryGenerationParams {
    persona: Persona;
    stage: Stage;
    intent: string;
    role: "cpo" | "family_unit";
    queryStyle: number;  // 0.5 (common) to 1.0 (niche)
    count?: number;
}

export interface GeneratedQueries {
    queries: string[];
    reasoning?: string;
}

// Persona descriptions
const PERSONA_DESCRIPTIONS: Record<Persona, string> = {
    move_up: "a growing family upgrading from their starter home, needing more space for kids",
    retiree: "an active adult 55+ couple seeking vibrant community with healthcare access",
    luxury: "a high-net-worth buyer seeking premium amenities and exclusivity",
    first_time: "a first-time homebuyer entering the market, budget-conscious and learning",
};

// Role descriptors for different perspectives
const ROLE_DESCRIPTORS: Record<"cpo" | "family_unit", string> = {
    cpo: "a chief purchasing officer focused on financial trade-offs, risks, and practical decision criteria",
    family_unit: "a family unit weighing lifestyle fit, community feel, schools, and day-to-day happiness",
};

// Stage context
const STAGE_CONTEXT: Record<Stage, { focus: string; brandPolicy: string }> = {
    explore: {
        focus: "Discovery phase - researching what's available, understanding options",
        brandPolicy: "Do NOT mention Lakewood Ranch or any specific brand. Keep queries generic and need-based.",
    },
    consider: {
        focus: "Evaluation phase - assessing specific options against criteria",
        brandPolicy: "Lakewood Ranch may be mentioned. Focus on feasibility and fit.",
    },
    compare: {
        focus: "Comparison phase - weighing alternatives head-to-head",
        brandPolicy: "Include Lakewood Ranch explicitly. Compare against alternatives (The Villages, Wellen Park, etc.).",
    },
    decide: {
        focus: "Decision phase - ready to commit, needs final validation",
        brandPolicy: "Lakewood Ranch is the presumed choice. Focus on next steps: agents, touring, deposits.",
    },
};

/**
 * Build system prompt for DeepSeek
 */
function buildSystemPrompt(params: QueryGenerationParams): string {
    const { persona, stage, role, queryStyle } = params;

    const personaDesc = PERSONA_DESCRIPTIONS[persona];
    const roleDesc = ROLE_DESCRIPTORS[role];
    const stageInfo = STAGE_CONTEXT[stage];

    const styleDirective = queryStyle < 0.7
        ? "Generate COMMON, high-volume queries that many buyers would type."
        : queryStyle > 0.85
            ? "Generate NICHE, long-tail queries revealing specific concerns or lifestyle needs."
            : "Generate a balanced mix of common and specific queries.";

    return `You are simulating a home buyer searching Google.

BUYER: ${personaDesc}
ROLE: Right now, ${roleDesc} is doing the research.
STAGE: ${stage.toUpperCase()} - ${stageInfo.focus}

BRAND POLICY:
${stageInfo.brandPolicy}

QUERY STYLE:
${styleDirective}

LOCAL CONTEXT (use when appropriate):
- Region: Southwest Florida (Sarasota, Bradenton, Lakewood Ranch area)
- Concerns: CDD fees, hurricane insurance, flood zones, HOA rules
- Villages: Waterside, Cresswind, Del Webb, Country Club East

OUTPUT:
Return ONLY a JSON object: {"queries": ["...", "...", ...], "reasoning": "brief explanation"}
No markdown, no extra text.`;
}

/**
 * Generate search queries from an intent using DeepSeek
 */
export async function generateQueriesFromIntent(
    params: QueryGenerationParams
): Promise<GeneratedQueries> {
    const { intent, queryStyle, count = 5 } = params;

    const systemPrompt = buildSystemPrompt(params);

    const userPrompt = `INTENT: "${intent}"

Generate exactly ${count} realistic Google search queries this buyer would type.`;

    // Use safeAsync to isolate SDK errors with read-only properties
    const result = await safeAsync(
        () => callOpenRouter({
            model: process.env.DEEPSEEK_MODEL || "deepseek/deepseek-v3.2",
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt },
            ],
            temperature: queryStyle,  // Direct mapping: 0.5 = common, 1.0 = niche
        }),
        `QueryGenerator/${params.stage}/${params.persona}`
    );

    if (!result.success) {
        // Return fallback queries on API failure
        return {
            queries: [
                `${intent} Florida`,
                `${intent} near me`,
                `best ${intent}`,
                `${intent} reviews`,
                `${intent} cost`,
            ].slice(0, count),
        };
    }

    const response = result.data;

    try {
        const cleaned = response
            .replace(/```json\s*/g, "")
            .replace(/```\s*/g, "")
            .trim();

        const parsed = JSON.parse(cleaned);

        if (!Array.isArray(parsed.queries)) {
            throw new Error("Missing queries array");
        }

        return {
            queries: parsed.queries.slice(0, count),
            reasoning: parsed.reasoning,
        };
    } catch (error) {
        // Defensive error logging to handle read-only error objects
        try {
            console.error("[QueryGenerator] Parse error:", error, "\nRaw:", response);
        } catch {
            console.error("[QueryGenerator] Parse error occurred, raw:", response);
        }

        // Fallback queries
        return {
            queries: [
                `${intent} Florida`,
                `${intent} near me`,
                `best ${intent}`,
                `${intent} reviews`,
                `${intent} cost`,
            ].slice(0, count),
        };
    }
}
