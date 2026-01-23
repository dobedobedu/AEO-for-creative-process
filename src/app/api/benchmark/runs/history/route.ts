import { loadRecentRuns } from "@/lib/runs/storage";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const limit = Math.min(Number(url.searchParams.get("limit") ?? "30") || 30, 100);

  // Load full runs with cells data for UI timeline
  const runs = await loadRecentRuns(limit);

  // Cache for 30s, serve stale for 5min while revalidating
  return Response.json(
    { runs },
    {
      headers: {
        "Cache-Control": "public, s-maxage=30, stale-while-revalidate=300",
      },
    }
  );
}
