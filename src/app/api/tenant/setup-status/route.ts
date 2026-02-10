/**
 * Setup Status API
 *
 * GET /api/tenant/setup-status
 *
 * Returns whether the initial setup wizard has been completed.
 * Used by middleware to redirect to /admin/setup on first run.
 *
 * No auth required — this endpoint is called before the user is
 * fully set up, so it must be accessible without authentication.
 *
 * Returns: { setupComplete: boolean }
 */

import { isSetupComplete } from "@/lib/tenant/db";

export async function GET() {
  try {
    const setupComplete = await isSetupComplete();

    return Response.json(
      { setupComplete },
      {
        headers: {
          // Short cache — setup status can change when the wizard completes
          "Cache-Control": "private, max-age=10, stale-while-revalidate=5",
        },
      }
    );
  } catch (error) {
    console.error("[api/tenant/setup-status] Error checking setup status:", error);
    return Response.json(
      { error: "Failed to check setup status" },
      { status: 500 }
    );
  }
}
