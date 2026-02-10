/**
 * Tenant Configuration API
 *
 * GET  /api/tenant/config  — Returns the current tenant configuration
 * POST /api/tenant/config  — Saves a partial tenant configuration update
 *
 * The POST handler accepts a Partial<TenantConfig> body, validates it with
 * Zod, persists to the tenant_config table via saveTenantConfig(), and
 * clears the in-memory config cache so subsequent reads pick up the change.
 */

import { TenantConfigSchema } from "@/lib/config/types";
import { loadTenantConfigAsync, clearConfigCache } from "@/lib/config/loader";
import { saveTenantConfig } from "@/lib/tenant/db";

/**
 * Partial schema for the POST body.
 * Every field is optional so callers can update just the sections they need.
 */
const PartialTenantConfigSchema = TenantConfigSchema.partial();

/**
 * GET /api/tenant/config
 *
 * Returns the full tenant configuration for admin pages to load.
 */
export async function GET() {
  try {
    const config = await loadTenantConfigAsync();

    return Response.json(config, {
      headers: {
        // Cache for 5 minutes (config rarely changes during runtime)
        "Cache-Control": "public, max-age=300, stale-while-revalidate=60",
      },
    });
  } catch (error) {
    console.error("[api/tenant/config] GET error:", error);
    return Response.json(
      { error: "Failed to load configuration" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/tenant/config
 *
 * Accepts a Partial<TenantConfig> body, validates with Zod, saves to the
 * tenant_config table, and clears the config cache.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Validate the request body as a partial TenantConfig
    const parsed = PartialTenantConfigSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json(
        {
          error: "Validation failed",
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const partialConfig = parsed.data;

    // Persist to the tenant_config table (read-merge-write under the hood)
    await saveTenantConfig(partialConfig);

    // Clear the in-memory config cache so the next read picks up the update
    clearConfigCache();

    // Re-populate cache from DB immediately so subsequent reads return the saved config
    await loadTenantConfigAsync();

    return Response.json({ success: true });
  } catch (error) {
    console.error("[api/tenant/config] POST error:", error);
    return Response.json(
      { error: "Failed to save configuration" },
      { status: 500 }
    );
  }
}
