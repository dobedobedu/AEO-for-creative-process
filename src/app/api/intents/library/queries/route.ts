import { z } from "zod";
import { loadIntentLibrary, saveIntentLibrary, updateIntent } from "@/lib/intents/library";
import { PersonaSchema, StageSchema, type Persona, type Stage } from "@/lib/intents/types";

const PersonaStageQueryBankSchema = z.record(
  PersonaSchema,
  z.record(StageSchema, z.array(z.string().min(1)).min(1))
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
      Record<Stage, string[]>
    ]>) {
      for (const [stage, queries] of Object.entries(stages) as Array<[Stage, string[]]>) {
        const intents = library.intents
          .filter((i) => i.persona === persona && i.stage === stage && i.active)
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

        const intent = intents[0];
        if (!intent) continue;

        library = updateIntent(library, intent.id, { defaultQueries: queries });
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
