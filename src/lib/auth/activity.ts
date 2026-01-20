/**
 * User Activity Tracking
 *
 * Lightweight usage tracking via last_active_at timestamp.
 * Upserts user record on key API actions.
 */

import { sql } from "@/lib/db";

/**
 * Updates the user's last_active_at timestamp.
 * Creates user record if it doesn't exist.
 */
export async function touchUserActivity(userId: string): Promise<void> {
  try {
    await sql`
      INSERT INTO app_users (user_id, last_active_at)
      VALUES (${userId}::uuid, NOW())
      ON CONFLICT (user_id)
      DO UPDATE SET last_active_at = NOW();
    `;
  } catch (error) {
    // Log but don't fail the request - activity tracking is non-critical
    console.error("[activity] Failed to update user activity:", error);
  }
}
