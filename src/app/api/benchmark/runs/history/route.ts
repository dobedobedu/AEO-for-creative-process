import { loadAllRuns } from "@/lib/runs/storage";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const limit = Math.min(Number(url.searchParams.get("limit") ?? "20") || 20, 100);

  const runs = loadAllRuns().sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  return Response.json({ runs: runs.slice(0, limit) });
}
