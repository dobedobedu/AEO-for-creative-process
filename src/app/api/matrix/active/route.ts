import { NextResponse } from "next/server";
import { getActiveMatrixConfigCached } from "@/lib/matrix/runtime";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const cfg = await getActiveMatrixConfigCached();
    return NextResponse.json(cfg);
  } catch (err) {
    console.error("[matrix/active] Error:", err instanceof Error ? err.message : err);
    return NextResponse.json(
      { error: "Matrix config not available" },
      { status: 500 }
    );
  }
}
