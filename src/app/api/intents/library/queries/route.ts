import { z } from "zod";
import { loadIntentLibrary, saveIntentLibrary, updateIntent } from "@/lib/intents/library";
import { PersonaSchema, StageSchema, type Persona, type Stage } from "@/lib/intents/types";

const PersonaStageQueryBankSchema = z.record(
  PersonaSchema,
  z.record(StageSchema, z.object({
    queries: z.array(z.string()),
    intentText: z.string(),
  }))
);

const RequestSchema = z.object({
  queryBank: PersonaStageQueryBankSchema,
});

export async function POST(req: Request) {
  try {
    const payload = await req.json();
    const data = RequestSchema.parse(payload);

    let library = loadIntentLibrary();

    for (const [persona, stages] of Object.entries(data.queryBank) as Array<[
      Persona,
      Record<Stage, { queries: string[]; intentText: string }>
    ]>) {
      for (const [stage, entry] of Object.entries(stages) as Array<[Stage, { queries: string[]; intentText: string }]>) {
        const intents = library.intents
          .filter((i) => i.persona === persona && i.stage === stage && i.active)
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

        const intent = intents[0];
        if (!intent) continue;

        library = updateIntent(library, intent.id, { 
          defaultQueries: entry.queries,
          text: entry.intentText
        });
      }
    }

    saveIntentLibrary(library);
    return Response.json({ success: true, library });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return Response.json({ error: "Invalid request", details: err.errors }, { status: 400 });
    }
    console.error("/api/intents/library/queries failed:", err);
    return Response.json({ error: "Failed to update intent queries" }, { status: 500 });
  }
}
