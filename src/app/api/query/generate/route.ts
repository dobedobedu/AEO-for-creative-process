import { z } from "zod";
import { callOpenRouter } from "@/lib/providers/openrouter";

const RequestSchema = z.object({
  personaText: z.string().min(1),
  triggerStage: z.enum(["explore", "consider", "compare"]),
  count: z.number().int().min(1).max(10).optional(),
});

const ResponseSchema = z.object({
  queries: z.array(z.string().min(1)),
});

function getOpenRouterModel() {
  return process.env.OPENROUTER_MODEL?.trim() || "deepseek/deepseek-v3.2";
}

export async function POST(req: Request) {
  const payload = await req.json();
  const data = RequestSchema.parse(payload);

  const count = data.count ?? 5;
  const system =
    "You generate realistic real-estate search queries for a persona. Return only JSON.";
  const user = `Persona: ${data.personaText}
Stage: ${data.triggerStage}
Brand focus: Lakewood Ranch community + builder reputation

Generate exactly ${count} short search queries (max 16 words each).
Return JSON: {"queries": ["..."]}`;

  const content = await callOpenRouter({
    model: getOpenRouterModel(),
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  });

  const cleaned = content.trim();
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
}
