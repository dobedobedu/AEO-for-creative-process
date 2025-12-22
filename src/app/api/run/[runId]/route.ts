import { getRunSummary } from "@/lib/storage/runStore";

export async function GET(_: Request, context: { params: Promise<{ runId: string }> }) {
  const params = await context.params;
  const runId = params.runId;

  const summary = await getRunSummary(runId);
  if (!summary) {
    return Response.json({ error: "Run not found" }, { status: 404 });
  }

  return Response.json(summary);
}
