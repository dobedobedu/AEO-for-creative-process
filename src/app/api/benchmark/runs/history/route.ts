import { getRunMetadataList } from "@/lib/runs/aggregator";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const limit = Math.min(Number(url.searchParams.get("limit") ?? "20") || 20, 100);

  // Use optimized materialized view instead of loading all runs
  const metadata = await getRunMetadataList(limit);

  return Response.json({ runs: metadata });
}
