import { getAnalyses } from "@/lib/storage/insightStore";

export async function GET(
  _: Request,
  context: { params: Promise<{ runId: string }> }
) {
  const params = await context.params;
  const runId = params.runId;

  if (!runId) {
    return Response.json({ error: "Run ID required" }, { status: 400 });
  }

  const analyses = await getAnalyses(runId);

  return Response.json({
    runId,
    analyses,
  });
}
