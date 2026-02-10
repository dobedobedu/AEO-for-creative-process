/**
 * Setup Complete API
 *
 * POST /api/tenant/setup-complete
 *
 * Marks the initial setup wizard as complete.
 * Called by the setup wizard after all configuration is saved.
 */

import { markSetupComplete } from "@/lib/tenant/db";

export async function POST() {
  try {
    await markSetupComplete();

    return Response.json({ success: true });
  } catch (error) {
    console.error("[api/tenant/setup-complete] Error:", error);
    return Response.json(
      { error: "Failed to mark setup as complete" },
      { status: 500 }
    );
  }
}
