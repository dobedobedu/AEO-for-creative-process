/**
 * Intent-to-Query Generator using DeepSeek
 * 
 * Flow: Intent + Persona + Stage + Role + QueryStyle → Search Queries
 */

import { callOpenRouter } from "../providers/openrouter";
import { safeAsync } from "../utils";
import { getTenantConfig, getBrandName } from "@/lib/config";
import { loadPromptTemplate, interpolatePrompt, getDefaultPromptContext, getQueryGenerationPrompt } from "@/lib/config/prompts";

export interface QueryGenerationParams {
    persona: string;
    stage: string;
    coreStage?: string; // For prompt context - maps custom stages to core stages
    intent: string;
    role: "cpo" | "family_unit";
    queryStyle: number;  // 0.5 (common) to 1.0 (niche)
    count?: number;
    existingQueries?: string[];  // Queries to avoid duplicating
}

export interface GeneratedQueries {
    queries: string[];
    reasoning?: string;
}


// Role descriptors for different perspectives
const ROLE_DESCRIPTORS: Record<"cpo" | "family_unit", string> = {
    cpo: "a practical decision-maker focused on cost, risk, and measurable outcomes",
    family_unit: "a household decision-maker focused on fit, trust, day-to-day experience, and long-term value",
};


/**
 * Build system prompt using the Prompt_Template_System
 */
function buildSystemPrompt(params: QueryGenerationParams): string {
    const { persona, stage, coreStage, role, queryStyle } = params;

    // Use coreStage for context, fallback to stage if not provided
    const stageKey = coreStage || stage;

    // Get persona description from config, fallback to generic
    const config = getTenantConfig();
    const personaConfig = config.personas.find(p => p.id === persona);
    const personaDesc = personaConfig?.description || `a ${persona} buyer`;

    const roleDesc = ROLE_DESCRIPTORS[role];

    // Load stage-specific context from prompt templates
    const stageTemplate = loadPromptTemplate("query-generation", stageKey);
    let stageFocus = "Discovery phase - researching what's available";
    let brandPolicy = `Do NOT mention ${getBrandName()} or any specific brand. Keep queries generic and need-based.`;

    if (stageTemplate) {
        // Parse the template to extract focus and brand policy sections
        const context = getDefaultPromptContext();
        const interpolated = interpolatePrompt(stageTemplate, context);
        const focusMatch = interpolated.match(/## Focus\n(.+)/);
        const policyMatch = interpolated.match(/## Brand Policy\n(.+)/);
        if (focusMatch) stageFocus = focusMatch[1].trim();
        if (policyMatch) brandPolicy = policyMatch[1].trim();
    }

    const styleDirective = queryStyle < 0.7
        ? "Generate COMMON, high-volume queries that many buyers would type."
        : queryStyle > 0.85
            ? "Generate NICHE, long-tail queries revealing specific concerns or lifestyle needs."
            : "Generate a balanced mix of common and specific queries.";

    // Try to use the Prompt_Template_System for the full system prompt
    const templatePrompt = getQueryGenerationPrompt({
        persona_description: personaDesc,
        role_description: roleDesc,
        stage: stage.toUpperCase(),
        core_stage: stageKey.toUpperCase(),
        stage_focus: stageFocus,
        brand_policy: brandPolicy,
        style_directive: styleDirective,
    });

    if (templatePrompt) {
        return templatePrompt;
    }

    // Fallback: build inline prompt with config values
    const geography = config.geography;
    const localContext = geography
        ? `- Region: ${geography.region} (${geography.localities.join(", ")})\n- Nearby metros: ${geography.nearbyMetros?.join(", ") ?? ""}`
        : "";

    return `You are simulating a buyer searching Google.

BUYER: ${personaDesc}
ROLE: Right now, ${roleDesc} is doing the research.
STAGE: ${stage.toUpperCase()} (${stageKey.toUpperCase()} phase) - ${stageFocus}

BRAND POLICY:
${brandPolicy}

QUERY STYLE:
${styleDirective}

LOCAL CONTEXT (use when appropriate):
${localContext}

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
    const { intent, queryStyle, count = 3, existingQueries = [] } = params;

    const systemPrompt = buildSystemPrompt(params);

    // Build user prompt with existing queries context if present
    let userPrompt = `INTENT: "${intent}"

Generate exactly ${count} realistic Google search queries this buyer would type.`;

    if (existingQueries.length > 0) {
        userPrompt += `

IMPORTANT: Do NOT duplicate these existing queries (generate different ones):
${existingQueries.map(q => `- "${q}"`).join("\n")}`;
    }

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
                `${intent} options`,
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
                `${intent} options`,
                `${intent} near me`,
                `best ${intent}`,
                `${intent} reviews`,
                `${intent} cost`,
            ].slice(0, count),
        };
    }
}
