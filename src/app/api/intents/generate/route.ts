import { z } from "zod";
import { generateQueriesFromIntent } from "@/lib/intents/queryGenerator";
import { getActiveMatrixConfigCached, assertValidPersonaStage, getCoreStageMapping } from "@/lib/matrix/runtime";

const GenerateRequestSchema = z.object({
  persona: z.string().min(1),
  stage: z.string().min(1),
  intent: z.string(),
  role: z.enum(["cpo", "family_unit"]),
  queryStyle: z.number().min(0.5).max(1),
  existingQueries: z.array(z.string()).optional(),
  count: z.number().min(1).max(10).optional(),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const params = GenerateRequestSchema.parse(body);

    // Load active matrix config
    const cfg = await getActiveMatrixConfigCached();

    // Validate persona/stage against active config
    try {
      assertValidPersonaStage(params.persona, params.stage, cfg);
    } catch (err) {
      return Response.json(
        { error: err instanceof Error ? err.message : "Invalid persona or stage" },
        { status: 400 }
      );
    }

    // Get core stage for prompt context
    const coreStage = getCoreStageMapping(params.stage, cfg);

    const result = await generateQueriesFromIntent({
      persona: params.persona,
      stage: params.stage,
      coreStage, // Pass core stage for prompt context
      intent: params.intent,
      role: params.role,
      queryStyle: params.queryStyle,
      existingQueries: params.existingQueries,
      count: params.count,
    });

    return Response.json({ queries: result.queries, reasoning: result.reasoning });
  } catch (err) {
    console.error("[API Intent Generate] Error:", err);
    if (err instanceof z.ZodError) {
      return Response.json({ error: "Invalid request", details: err.errors }, { status: 400 });
    }
    return Response.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
