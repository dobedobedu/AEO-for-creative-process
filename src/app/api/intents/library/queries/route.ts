import { z } from "zod";
import { loadIntentLibrary, saveIntentLibrary, updateIntent, createIntent, deactivateIntent } from "@/lib/intents/library";
import { PersonaSchema, StageSchema, type Persona, type Stage } from "@/lib/intents/types";

// Schema for an Intent Node (mirrors frontend)
const IntentNodeSchema = z.object({
  id: z.string(),
  text: z.string(),
  role: z.enum(["cpo", "family_unit"]).default("cpo"),
  queryStyle: z.number().min(0.5).max(1.0).default(0.75),
  generatedQueries: z.array(z.string()).optional()
});

// The incoming QueryBank is indexed by Persona -> Stage -> List of Intents
const PersonaStageQueryBankSchema = z.record(
  PersonaSchema,
  z.record(StageSchema, z.object({
    intents: z.array(IntentNodeSchema)
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
      Record<Stage, { intents: Array<{ id: string; text: string; role?: "cpo" | "family_unit"; queryStyle?: number; generatedQueries?: string[] }> }>
    ]>) {
      for (const [stage, entry] of Object.entries(stages) as Array<[Stage, { intents: Array<{ id: string; text: string; role?: "cpo" | "family_unit"; queryStyle?: number; generatedQueries?: string[] }> }]>) {

        // 1. Get existing intents for this cell
        const existingIntents = library.intents
          .filter((i) => i.persona === persona && i.stage === stage && i.active);
        const existingIds = new Set(existingIntents.map(i => i.id));

        // 2. Identify incoming IDs
        const incomingIds = new Set(entry.intents.map(i => i.id));

        // 3. Process Updates & Creations
        for (const incoming of entry.intents) {
          if (existingIds.has(incoming.id)) {
            // Update existing
            library = updateIntent(library, incoming.id, {
              text: incoming.text,
              role: incoming.role,
              queryStyle: incoming.queryStyle,
              generatedQueries: incoming.generatedQueries
            });
          } else {
            // Create new intent
            library = createIntent(library, {
              persona,
              stage,
              text: incoming.text,
              role: incoming.role || "cpo",
              queryStyle: incoming.queryStyle || 0.75,
              generatedQueries: incoming.generatedQueries
            });
          }
        }

        // 4. Process Deletions
        for (const existing of existingIntents) {
          if (!incomingIds.has(existing.id)) {
            library = deactivateIntent(library, existing.id);
          }
        }
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
