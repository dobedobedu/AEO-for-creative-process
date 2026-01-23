import { loadIntentLibrary } from "@/lib/intents/library";
import { bulkInsertIntents, bulkInsertHistory, setVersion, ensureIntentSchema } from "@/lib/intents/db";
import { IntentLibrarySchema } from "@/lib/intents/types";
import { sql } from "@/lib/db";
import { z } from "zod";

export async function GET() {
  try {
    const library = await loadIntentLibrary();
    // Short cache for navigation, serves stale while revalidating for polling
    return Response.json(library, {
      headers: {
        "Cache-Control": "public, s-maxage=10, stale-while-revalidate=60",
      },
    });
  } catch (err) {
    console.error("/api/intents/library GET failed:", err);
    return Response.json(
      { error: err instanceof Error ? err.message : "Failed to load intent library" },
      { status: 500 }
    );
  }
}

export async function PUT(req: Request) {
  try {
    const payload = await req.json();
    const validated = IntentLibrarySchema.parse(payload);

    await ensureIntentSchema();

    // Clear existing data and replace with new library
    // This is a full replacement operation
    await sql`DELETE FROM intents;`;
    await sql`DELETE FROM intent_history;`;

    // Insert all intents and history
    await bulkInsertIntents(validated.intents);
    await bulkInsertHistory(validated.history);
    await setVersion(validated.version);

    // Return the library from database to confirm persistence
    const savedLibrary = await loadIntentLibrary();

    return Response.json({ success: true, library: savedLibrary });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return Response.json(
        { error: "Invalid library format", details: err.errors },
        { status: 400 }
      );
    }
    console.error("/api/intents/library PUT failed:", err);
    return Response.json(
      { error: err instanceof Error ? err.message : "Failed to save intent library" },
      { status: 500 }
    );
  }
}
