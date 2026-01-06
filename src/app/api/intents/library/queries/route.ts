import { z } from "zod";
import { loadIntentLibrary, saveIntentLibrary, updateIntent, createIntent, deactivateIntent } from "@/lib/intents/library";
import { PersonaSchema, StageSchema, type Persona, type Stage } from "@/lib/intents/types";

// Schema for an Intent Node (mirrors frontend)
const IntentNodeSchema = z.object({
  id: z.string(),
  text: z.string(),
  buyerMightAsk: z.array(z.string()),
  role: z.enum(["cpo", "family_unit"]).default("cpo"),
  creativity: z.number().min(0.2).max(1.2).default(0.7)
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
      Record<Stage, { intents: Array<{ id: string; text: string; buyerMightAsk: string[]; role?: "cpo" | "family_unit"; creativity?: number }> }>
    ]>) {
      for (const [stage, entry] of Object.entries(stages) as Array<[Stage, { intents: Array<{ id: string; text: string; buyerMightAsk: string[]; role?: "cpo" | "family_unit"; creativity?: number }> }]>) {

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
              defaultQueries: incoming.buyerMightAsk,
              role: incoming.role,
              creativity: incoming.creativity
            });
          } else {
            // Create new (if ID looks like a temp ID or just missing, create fresh)
            // But if the frontend generates IDs, we might want to respect them or map them.
            // For now, let's create a new intent with the library's ID generator 
            // but we need to know which one matches the frontend's ID if we want to return it.
            // However, this endpoint is a "save all" dump.

            // NOTE: If the frontend sends a newly generated ID (e.g. "new-uuid"), 
            // and we treat it as a create, we should just create it.
            // The library.createIntent generates its own ID.
            // Ideally, the frontend should use an API to create intents first.
            // But for this "Save Query Bank" bulk operation, we'll assume unmatched IDs are new.

            library = createIntent(library, {
              persona,
              stage,
              text: incoming.text,
              defaultQueries: incoming.buyerMightAsk,
              role: incoming.role || "cpo",
              creativity: incoming.creativity || 0.7
            });
          }
        }

        // 4. Process Deletions
        // Any existing ID that is NOT in incoming IDs should be deactivated/deleted
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
