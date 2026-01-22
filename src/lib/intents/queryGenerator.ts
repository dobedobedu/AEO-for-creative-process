/**
 * Intent-to-Query Generator using DeepSeek
 * 
 * Flow: Intent + Persona + Stage + Role + QueryStyle → Search Queries
 */

import { callOpenRouter } from "../providers/openrouter";
import { safeAsync } from "../utils";

export interface QueryGenerationParams {
    persona: string;
    stage: string;
    coreStage?: string; // For prompt context - maps custom stages to core stages
    intent: string;
    role: "cpo" | "family_unit";
    queryStyle: number;  // 0.5 (common) to 1.0 (niche)
    count?: number;
}

export interface GeneratedQueries {
    queries: string[];
    reasoning?: string;
}

// Persona descriptions - now as Record<string, string> to support dynamic personas
const PERSONA_DESCRIPTIONS: Record<string, string> = {
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

// Stage context - keyed by core stage for prompt generation
// Custom stages map to core stages for scoring, but prompts use core stage context
const STAGE_CONTEXT: Record<string, { focus: string; brandPolicy: string }> = {
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
    const { persona, stage, coreStage, role, queryStyle } = params;

    // Use coreStage for context, fallback to stage if not provided
    const stageKey = coreStage || stage;
    const personaDesc = PERSONA_DESCRIPTIONS[persona] || `a ${persona} home buyer`;
    const roleDesc = ROLE_DESCRIPTORS[role];
    const stageInfo = STAGE_CONTEXT[stageKey] || STAGE_CONTEXT.explore; // Default to explore context

    const styleDirective = queryStyle < 0.7
        ? "Generate COMMON, high-volume queries that many buyers would type."
        : queryStyle > 0.85
            ? "Generate NICHE, long-tail queries revealing specific concerns or lifestyle needs."
            : "Generate a balanced mix of common and specific queries.";

    return `You are simulating a home buyer searching Google.

BUYER: ${personaDesc}
ROLE: Right now, ${roleDesc} is doing the research.
STAGE: ${stage.toUpperCase()} (${stageKey.toUpperCase()} phase) - ${stageInfo.focus}

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
