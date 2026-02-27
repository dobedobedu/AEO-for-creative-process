import { z } from "zod";
import { callOpenRouter } from "@/lib/providers/openrouter";
import { getTenantConfig } from "@/lib/config";
import { safeAsync, safeErrorMessage } from "@/lib/utils";
import {
  getActiveMatrixConfigCached,
  assertValidPersonaStage,
  getCoreStageMapping,
} from "@/lib/matrix/runtime";

const RequestSchema = z.object({
  persona: z.string().min(1),
  stage: z.string().min(1),
});

const ModelOutputSchema = z.object({
  intent: z.string().min(1).max(220),
  role: z.enum(["cpo", "family_unit"]).optional(),
  queryStyle: z.number().min(0.5).max(1).optional(),
});

function stageDirective(coreStage: "explore" | "consider" | "compare" | "decide"): string {
  switch (coreStage) {
    case "explore":
      return "Focus on discovery questions, early evaluation criteria, and clarifying needs.";
    case "consider":
      return "Focus on due-diligence, feasibility, constraints, and trust/risk checks.";
    case "compare":
      return "Focus on side-by-side tradeoff analysis, alternatives, and decision criteria.";
    case "decide":
      return "Focus on final blockers, confidence checks, and commitment readiness.";
  }
}

function fallbackIntentText(personaLabel: string, stageLabel: string): string {
  return `Define the key questions ${personaLabel} needs answered during the ${stageLabel} stage to make a confident decision.`;
}

function cleanJsonResponse(raw: string): string {
  return raw.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
}

export async function POST(req: Request) {
  try {
    const body = RequestSchema.parse(await req.json());
    const cfg = await getActiveMatrixConfigCached();
    assertValidPersonaStage(body.persona, body.stage, cfg);

    const persona = cfg.personas.find((p) => p.id === body.persona);
    const stage = cfg.stages.find((s) => s.id === body.stage);
    if (!persona || !stage) {
      return Response.json({ error: "Persona or stage not found in active config" }, { status: 400 });
    }

    const coreStage = getCoreStageMapping(body.stage, cfg);
    const tenant = getTenantConfig();

    const systemPrompt = [
      "You generate one high-quality research objective for an AI visibility benchmark cell.",
      `Industry: ${tenant.industry}`,
      "Return only JSON with keys: intent, role, queryStyle.",
      "- intent: 1 sentence, specific and actionable, under 200 characters.",
      '- role: "cpo" or "family_unit".',
      "- queryStyle: number between 0.5 and 1.0 (0.5 common intent, 1.0 niche intent).",
      `Stage guidance: ${stageDirective(coreStage)}`,
    ].join("\n");

    const userPrompt = [
      `Persona label: ${persona.label}`,
      `Persona description: ${persona.description || "(none)"}`,
      `Stage label: ${stage.label}`,
      `Stage description: ${stage.description || "(none)"}`,
      "Write one objective tailored to this persona and stage.",
      "Do not mention implementation details or model names.",
    ].join("\n");

    const model = process.env.DEEPSEEK_MODEL || process.env.OPENROUTER_MODEL || "deepseek/deepseek-v3.2";
    const result = await safeAsync(
      () =>
        callOpenRouter({
          model,
          temperature: 0.4,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
        }),
      "IntentObjectiveGenerator"
    );

    if (!result.success) {
      return Response.json(
        {
          intent: {
            text: fallbackIntentText(persona.label, stage.label),
            role: "cpo",
            queryStyle: 0.75,
          },
          fallback: true,
          error: result.error,
        },
        { status: 200 }
      );
    }

    const cleaned = cleanJsonResponse(result.data);
    let parsed: z.infer<typeof ModelOutputSchema>;
    try {
      parsed = ModelOutputSchema.parse(JSON.parse(cleaned));
    } catch {
      return Response.json(
        {
          intent: {
            text: fallbackIntentText(persona.label, stage.label),
            role: "cpo",
            queryStyle: 0.75,
          },
          fallback: true,
          error: "Model returned invalid JSON",
        },
        { status: 200 }
      );
    }

    return Response.json({
      intent: {
        text: parsed.intent.trim(),
        role: parsed.role ?? "cpo",
        queryStyle: parsed.queryStyle ?? 0.75,
      },
      fallback: false,
    });
  } catch (err) {
    const message = safeErrorMessage(err, "Unknown error");
    if (err instanceof z.ZodError) {
      return Response.json({ error: "Invalid request", details: err.errors }, { status: 400 });
    }
    console.error("[/api/intents/generate-objective] Error:", message);
    return Response.json({ error: message }, { status: 500 });
  }
}

