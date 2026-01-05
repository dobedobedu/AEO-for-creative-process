import { loadIntentLibrary } from "@/lib/intents/library";

export async function GET() {
  const library = loadIntentLibrary();
  return Response.json(library);
}
