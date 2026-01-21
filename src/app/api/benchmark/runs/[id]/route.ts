import { loadRun } from "@/lib/runs/storage";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const run = await loadRun(id);
  if (!run) return new Response("Not found", { status: 404 });
  return Response.json(run);
}
