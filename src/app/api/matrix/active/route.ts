import { NextResponse } from "next/server";
import { getActiveMatrixConfigCached } from "@/lib/matrix/runtime";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const cfg = await getActiveMatrixConfigCached();
    // Config rarely changes - cache for 5min, serve stale for 1hr
    return NextResponse.json(cfg, {
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600",
      },
    });
  } catch (err) {
    console.error("[matrix/active] Error:", err instanceof Error ? err.message : err);
    return NextResponse.json(
      { error: "Matrix config not available" },
      { status: 500 }
    );
  }
}
