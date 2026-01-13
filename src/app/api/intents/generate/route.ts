import { z } from "zod";
import { generateQueriesFromIntent } from "@/lib/intents/queryGenerator";
import { PersonaSchema, StageSchema } from "@/lib/intents/types";

const GenerateRequestSchema = z.object({
  persona: PersonaSchema,
  stage: StageSchema,
  intent: z.string(),
  role: z.enum(["cpo", "family_unit"]),
  queryStyle: z.number().min(0.5).max(1),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const params = GenerateRequestSchema.parse(body);

    const result = await generateQueriesFromIntent({
      persona: params.persona,
      stage: params.stage,
      intent: params.intent,
      role: params.role,
      queryStyle: params.queryStyle,
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
