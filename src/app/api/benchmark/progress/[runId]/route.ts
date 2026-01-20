import { getProgress, cleanupOldProgress } from "@/lib/benchmark/progress";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ runId: string }> }
) {
  const { runId } = await params;

  if (!runId) {
    return Response.json({ error: "runId is required" }, { status: 400 });
  }

  // Occasionally clean up old progress entries (1% of requests)
  if (Math.random() < 0.01) {
    cleanupOldProgress().catch(console.error);
  }

  const progress = await getProgress(runId);

  if (!progress) {
    return Response.json({ error: "Run not found" }, { status: 404 });
  }

  return Response.json(progress);
}
