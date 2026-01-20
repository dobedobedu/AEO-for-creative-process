import { z } from "zod";
import { cookies } from "next/headers";
import { loadIntentLibrary, updateIntent, createIntent, deactivateIntent } from "@/lib/intents/library";
import { PersonaSchema, StageSchema, type Persona, type Stage } from "@/lib/intents/types";
import { getCurrentUser } from "@/lib/auth/supabase";
import { touchUserActivity } from "@/lib/auth/activity";

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
    // Get current user from session
    const cookieStore = await cookies();
    const user = await getCurrentUser(cookieStore);
    const actorUserId = user?.id;

    // Track user activity
    if (actorUserId) await touchUserActivity(actorUserId);

    const payload = await req.json();
    const data = RequestSchema.parse(payload);

    let library = await loadIntentLibrary();

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
            // Update existing - pass actorUserId for attribution
            library = await updateIntent(incoming.id, {
              text: incoming.text,
              role: incoming.role,
              queryStyle: incoming.queryStyle,
              generatedQueries: incoming.generatedQueries
            }, actorUserId);
          } else {
            // Create new intent - pass actorUserId for attribution
            library = await createIntent({
              persona,
              stage,
              text: incoming.text,
              role: incoming.role || "cpo",
              queryStyle: incoming.queryStyle || 0.75,
              generatedQueries: incoming.generatedQueries
            }, actorUserId);
          }
        }

        // 4. Process Deletions - pass actorUserId for attribution
        for (const existing of existingIntents) {
          if (!incomingIds.has(existing.id)) {
            library = await deactivateIntent(existing.id, actorUserId);
          }
        }
      }
    }

    // Library is already persisted in DB, no need to save
    return Response.json({ success: true, library });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return Response.json({ error: "Invalid request", details: err.errors }, { status: 400 });
    }
    console.error("/api/intents/library/queries failed:", err);
    return Response.json({ error: "Failed to update intent queries" }, { status: 500 });
  }
}
