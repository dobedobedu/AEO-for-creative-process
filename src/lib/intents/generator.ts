import { callOpenRouter } from "../providers/openrouter";
import { Persona, Stage } from "./types";
import { getTenantConfig, getBrandName } from "@/lib/config";
import { getPrompt } from "@/lib/config/prompts";

export interface GenerationParams {
  persona: Persona;
  stage: Stage;
  intent: string;
  role: "cpo" | "family_unit";
  creativity: number;
}

/**
 * Get the label for a stage from config, with fallback
 */
function getStageLabel(stageId: string): string {
  const config = getTenantConfig();
  const stageConfig = config.stages.find(s => s.id === stageId);
  return stageConfig?.label ?? stageId.charAt(0).toUpperCase() + stageId.slice(1);
}

/**
 * Get the label for a persona from config, with fallback
 */
function getPersonaLabel(personaId: string): string {
  const config = getTenantConfig();
  const personaConfig = config.personas.find(p => p.id === personaId);
  return personaConfig?.label ?? personaId.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

/**
 * Generate 5 authentic search queries using DeepSeek via OpenRouter
 */
export async function generateQueries(params: GenerationParams): Promise<string[]> {
  const { persona, stage, intent, role, creativity } = params;

  const stageLabel = getStageLabel(stage);
  const personaLabel = getPersonaLabel(persona);

  const roleDirectives =
    role === "cpo"
      ? `Adopt the perspective of a chief purchasing officer. Focus on budget, risks, fees, and rational trade-offs.
         Consider total cost of ownership, long-term value, and downside scenarios.`
      : `Adopt the perspective of a family unit. Focus on lifestyle fit, schools, community feel, and day-to-day happiness.
         Consider the lived experience, social connections, and quality-of-life trade-offs.`;

  const creativityDirective =
    creativity < 0.3
      ? "Generate the most predictable, high-volume search queries that a typical user would type."
      : creativity > 0.7
      ? "Generate rare, niche, and highly specific long-tail queries that reveal deep-seated concerns or specific lifestyle needs."
      : "Generate a balanced mix of common and specific search queries.";

  // Try to use the Prompt_Template_System for the system prompt
  const templatePrompt = getPrompt("intent-generation", "system", {
    persona_label: personaLabel,
    stage_label: stageLabel,
    intent,
    role_directives: roleDirectives,
    creativity_directive: creativityDirective,
  });

  // Fallback: build inline prompt with config values
  const config = getTenantConfig();
  const geography = config.geography;
  const geographyRegion = geography?.region ?? "";
  const geographyLocalities = geography?.localities?.join(", ") ?? "";

  const systemPrompt = templatePrompt ?? `You are an expert in ${config.industry} psychographics and search behavior in ${geographyRegion} (${geographyLocalities}).
Task: Generate 5 distinct Google search queries for a ${personaLabel} in the ${stageLabel} stage.

Base Intent: "${intent}"

Role Perspective:
${roleDirectives}

Creativity Level:
${creativityDirective}

Guidelines:
- Queries must be in the first-person (what the user types into Google).
- Use local context where appropriate (${geographyLocalities}, ${geographyRegion}).
- Return ONLY a valid JSON array of strings. No markdown, no explanations.`;

  const response = await callOpenRouter({
    model: "deepseek/deepseek-chat",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: "Generate the 5 queries for this intent now." },
    ],
    // Map creativity 0-1 to temperature 0.2-1.2
    temperature: 0.2 + creativity * 1.0,
  });

  try {
    // Clean up potential markdown formatting if DeepSeek ignores "no markdown" instruction
    const cleaned = response.replace(/```json/g, "").replace(/```/g, "").trim();
    const queries = JSON.parse(cleaned);
    if (Array.isArray(queries)) {
      return queries.slice(0, 5);
    }
    throw new Error("Invalid format returned from LLM");
  } catch (error) {
    console.error("[Generator] Failed to parse queries:", response, error);
    // Fallback in case of parse error
    return [
      `${intent} for ${personaLabel}`,
      `${intent} ${stageLabel}`,
      `${intent} reviews`,
      `${intent} costs`,
      `${intent} ${geographyRegion || "near me"}`,
    ];
  }
}
