import { hasDocuments } from "@/lib/filesearch";

export async function GET() {
  try {
    const hasDocs = await hasDocuments();
    return Response.json({ hasDocuments: hasDocs });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
