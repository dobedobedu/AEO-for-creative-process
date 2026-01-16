import { loadIntentLibrary, saveIntentLibrary } from "@/lib/intents/library";
import { IntentLibrarySchema } from "@/lib/intents/types";
import { z } from "zod";

export async function GET() {
  const library = loadIntentLibrary();
  return Response.json(library);
}

export async function PUT(req: Request) {
  try {
    const payload = await req.json();
    const validated = IntentLibrarySchema.parse(payload);

    saveIntentLibrary(validated);

    return Response.json({ success: true, library: validated });
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
