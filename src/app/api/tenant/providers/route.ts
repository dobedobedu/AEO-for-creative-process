/**
 * Provider Configuration API
 *
 * POST /api/tenant/providers
 * Saves the provider configuration to the tenant_config table.
 *
 * Body: { providers: ProviderEntry[] }
 * - Validates with Zod: non-empty model strings, weights in [0,1]
 * - Requires at least one active provider
 * - Saves to tenant_config.providers_json via saveTenantConfig()
 * - Clears config cache after save
 *
 * Returns 200 on success, 400 on validation error.
 */

import { z } from "zod";
import { ProviderEntrySchema, type ProvidersConfig } from "@/lib/config/types";
import { saveTenantConfig } from "@/lib/tenant/db";
import { clearConfigCache } from "@/lib/config/loader";

/** Request body schema: array of provider entries with at least one active */
const SaveProvidersBodySchema = z.object({
  providers: z
    .array(ProviderEntrySchema)
    .min(1, "At least one provider is required"),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Validate the request body with Zod
    const parsed = SaveProvidersBodySchema.safeParse(body);

    if (!parsed.success) {
      return Response.json(
        {
          error: "Validation failed",
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { providers } = parsed.data;

    // Ensure at least one provider is active
    const hasActiveProvider = providers.some((p) => p.active);
    if (!hasActiveProvider) {
      return Response.json(
        {
          error: "At least one provider must be active",
        },
        { status: 400 }
      );
    }

    // Save to tenant_config.providers_json via saveTenantConfig()
    // Include empty weights/models — the ProviderEntry[] is the source of truth
    await saveTenantConfig({ providers: { providers, weights: {} as ProvidersConfig["weights"], models: {} as ProvidersConfig["models"] } });

    // Clear config cache so the next read picks up the new values
    clearConfigCache();

    return Response.json({ success: true });
  } catch (error) {
    console.error("[api/tenant/providers] Error saving providers:", error);
    return Response.json(
      { error: "Failed to save provider configuration" },
      { status: 500 }
    );
  }
}
