import { NextResponse } from "next/server";
import { recomputeKanbanSummary } from "@/lib/kanban/recompute";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type RecomputeBody = { runId?: string };

export async function POST(req: Request): Promise<NextResponse> {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: RecomputeBody = {};
  try {
    body = (await req.json()) as RecomputeBody;
  } catch {
    body = {};
  }

  if (body.runId && !UUID_REGEX.test(body.runId)) {
    return NextResponse.json({ error: "Invalid run ID format" }, { status: 400 });
  }

  const runId = await recomputeKanbanSummary({ runId: body.runId });
  if (!runId) {
    return NextResponse.json({ error: "No runs found" }, { status: 404 });
  }

  return NextResponse.json({ success: true, runId });
}
