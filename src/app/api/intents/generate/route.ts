import { z } from "zod";
import { generateQueries } from "@/lib/intents/generator";
import { PersonaSchema, StageSchema } from "@/lib/intents/types";

const GenerateRequestSchema = z.object({
  persona: PersonaSchema,
  stage: StageSchema,
  intent: z.string(),
  role: z.enum(["cpo", "family_unit"]),
  creativity: z.number().min(0).max(1),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const params = GenerateRequestSchema.parse(body);

    const queries = await generateQueries(params);

    return Response.json({ queries });
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
