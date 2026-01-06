import { callOpenRouter } from "../providers/openrouter";
import { Persona, Stage } from "./types";

export interface GenerationParams {
  persona: Persona;
  stage: Stage;
  intent: string;
  role: "cpo" | "family_unit";
  creativity: number;
}

const STAGE_LABELS: Record<Stage, string> = {
  explore: "Explore (Macro Research)",
  consider: "Consider (Evaluation & Quality)",
  compare: "Compare (Total Cost & Logistics)",
  decide: "Decide (Final Validation & Life Integration)",
};

const PERSONA_LABELS: Record<Persona, string> = {
  move_up: "Move-Up Buyer",
  retiree: "Active Retiree (55+)",
  luxury: "Luxury/Legacy Buyer",
  first_time: "First-Time Buyer",
};

/**
 * Generate 5 authentic search queries using DeepSeek via OpenRouter
 */
export async function generateQueries(params: GenerationParams): Promise<string[]> {
  const { persona, stage, intent, role, creativity } = params;

  const stageLabel = STAGE_LABELS[stage];
  const personaLabel = PERSONA_LABELS[persona];

  const roleDirectives =
    role === "cpo"
      ? `Adopt the persona of the 'She-Elite' Chief Purchasing Officer. You are evaluating the property as a strategic legacy asset. 
         Focus on risk (insurance premiums, flood zones), ROI (resale liquidity, CDD fees), and infrastructure (healthcare security, hurricane resilience). 
         Your tone is skeptical, financially literate, and protective of family wealth.`
      : `Adopt the persona of the Family Operations Manager. Focus on the 'Ecosystem' and the 'Ideal Tuesday Morning'. 
         Focus on social flow, 'Third Places' (village centers, coffee shops), connectivity (golf cart paths, biking to school), 
         and daily logistics (finding doctors, kid-friendly social scene, pet amenities).`;

  const creativityDirective =
    creativity < 0.3
      ? "Generate the most predictable, high-volume search queries that a typical user would type."
      : creativity > 0.7
      ? "Generate rare, niche, and highly specific long-tail queries that reveal deep-seated concerns or specific lifestyle needs."
      : "Generate a balanced mix of common and specific search queries.";

  const systemPrompt = `You are an expert in real estate psychographics and search behavior in Southwest Florida (Lakewood Ranch, Sarasota, Bradenton).
Task: Generate 5 distinct Google search queries for a ${personaLabel} in the ${stageLabel} stage.

Base Intent: "${intent}"

Role Perspective:
${roleDirectives}

Creativity Level:
${creativityDirective}

Guidelines:
- Queries must be in the first-person (what the user types into Google).
- Use local context where appropriate (Lakewood Ranch villages, Zone X, CDD fees, SRQ, UTC).
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
      `${intent} florida`,
    ];
  }
}
