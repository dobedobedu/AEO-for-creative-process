import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSearchMode, setAppSetting, clearSearchModeCache } from "@/lib/appSettings";
import { getCurrentUser } from "@/lib/auth/supabase";
import { cookies } from "next/headers";

const UpdateSchema = z.object({
  searchMode: z.enum(["x_search", "web_search"]),
});

export async function GET() {
  const searchMode = await getSearchMode();
  return NextResponse.json({ searchMode });
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const data = UpdateSchema.parse(body);

    const cookieStore = await cookies();
    const user = await getCurrentUser(cookieStore);

    await setAppSetting("xai_search_mode", data.searchMode, user?.id ?? null);
    clearSearchModeCache();

    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid request", details: err.errors }, { status: 400 });
    }

    console.error("/api/app-settings failed:", err);
    return NextResponse.json({ error: "Failed to update settings" }, { status: 500 });
  }
}
