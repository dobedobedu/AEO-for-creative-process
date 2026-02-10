import { z } from "zod";
import { callOpenRouter } from "@/lib/providers/openrouter";
import { getBrandName, getCompetitorNames, getPrompt, getTenantConfig } from "@/lib/config";

const RequestSchema = z.object({
  personaText: z.string().min(1),
  triggerStage: z.enum(["explore", "consider", "compare"]),
  geo: z.string().optional(),
  queryLength: z.enum(["auto", "short", "medium", "long"]).optional(),
  triggers: z.array(z.string().min(1)).optional(),
  count: z.number().int().min(1).max(10).optional(),
});

const ResponseSchema = z.object({
  queries: z.array(z.string().min(1)),
});

function getOpenRouterModel() {
  return process.env.OPENROUTER_MODEL?.trim() || "deepseek/deepseek-v3.2";
}

function fallbackExtractQueries(content: string, count: number): string[] {
  const lines = content
    .split(/\r?\n/)
    .map((line) => line.replace(/^[-*\d.\)\s]+/, "").trim())
    .filter(Boolean);

  const queries = lines.filter((line) => line.length > 3).slice(0, count);
  if (queries.length > 0) return queries;

  return content
    .split("?")
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .slice(0, count)
    .map((chunk) => `${chunk}?`);
}

/**
 * Build a stage guardrail string from the prompt template system.
 * Falls back to a generic guardrail if the template is not found.
 */
function getStageGuardrail(stage: string): string {
  const brand = getBrandName();
  const competitors = getCompetitorNames();

  // Load the stage-specific prompt template (e.g., explore.txt, consider.txt, compare.txt)
  const stagePrompt = getPrompt("query-generation", stage, {
    brand,
    competitors: competitors.join(", "),
    competitor: competitors[0] ?? "competitor",
  });

  if (stagePrompt) {
    return stagePrompt.trim();
  }

  // Fallback guardrails if templates are missing
  switch (stage) {
    case "explore":
      return `Explore stage: do NOT mention ${brand} or any specific community/brand. Keep queries generic, need-based, and location-agnostic.`;
    case "consider":
      return `Consider stage: ${brand} may be mentioned, but keep phrasing balanced with needs and constraints.`;
    case "compare":
      return `Compare stage: include ${brand} explicitly and compare against alternatives.`;
    default:
      return `${stage} stage: use ${brand} as appropriate for the stage context.`;
  }
}

export async function POST(req: Request) {
  const payload = await req.json();
  const data = RequestSchema.parse(payload);

  const brand = getBrandName();
  const config = getTenantConfig();
  const industry = config.industry !== "other" ? config.industry : "search";

  const count = data.count ?? 5;
  const triggers = (data.triggers ?? []).filter(Boolean);
  const triggerList = triggers.length > 0 ? triggers.join("; ") : "None provided";
  const geo = data.geo?.trim();
  const geoLine = geo ? `Geography: ${geo}` : "Geography: (not specified)";
  const lengthHint =
    data.queryLength === "short"
      ? "Query length: short (5-9 words)."
      : data.queryLength === "medium"
        ? "Query length: medium (10-16 words)."
        : data.queryLength === "long"
          ? "Query length: long (16-26 words)."
          : "Query length: auto (match the persona's natural search style; mix short and long if appropriate).";
  const stageGuardrail = getStageGuardrail(data.triggerStage);
  const system =
    `You generate realistic ${industry} search queries for a persona. Embody the persona's priorities, constraints, and life context. Use the triggers and stage intent to shape the queries. Return only JSON.`;
  const user = `Persona: ${data.personaText}
Stage: ${data.triggerStage}
${stageGuardrail}
${geoLine}
${lengthHint}
Selected triggers: ${triggerList}
Brand focus: ${brand}

Stage intent:
- Explore: broad discovery, needs-based, no brand names, focus on lifestyle + fit + tradeoffs.
- Consider: feasibility, costs, constraints, financing, risks, quality, value.
- Compare: side-by-side comparisons, tradeoffs, best-fit decision support.

Generate exactly ${count} search queries.
- Each query should reflect at least one trigger.
- If triggers > ${count}, prioritize the most impactful triggers.
- Avoid duplicate phrasing.
Return JSON: {"queries": ["..."]}`;

  const content = await callOpenRouter({
    model: getOpenRouterModel(),
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  });

  const cleaned = content.trim();
  try {
    let parsed: unknown;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      const jsonStart = cleaned.indexOf("{");
      const jsonEnd = cleaned.lastIndexOf("}");
      if (jsonStart === -1 || jsonEnd === -1) {
        throw new Error("Failed to parse OpenRouter JSON response");
      }
      parsed = JSON.parse(cleaned.slice(jsonStart, jsonEnd + 1));
    }

    const result = ResponseSchema.parse(parsed);
    return Response.json(result);
  } catch {
    const queries = fallbackExtractQueries(cleaned, count);
    return Response.json({ queries });
  }
}
