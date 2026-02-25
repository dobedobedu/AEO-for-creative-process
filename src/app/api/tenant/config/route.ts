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
import { publishConfig } from "@/lib/matrix/db";
import { clearConfigCache as clearMatrixConfigCache } from "@/lib/matrix/runtime";

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
    const hasPersonas = Array.isArray(partialConfig.personas);
    const hasStages = Array.isArray(partialConfig.stages);

    // Personas and stages must be provided together when updating matrix config.
    if (hasPersonas !== hasStages) {
      return Response.json(
        {
          error: "Invalid matrix configuration",
          details: "Both personas and stages must be provided together.",
        },
        { status: 400 }
      );
    }

    if (hasPersonas && hasStages) {
      const personas = partialConfig.personas ?? [];
      const stages = partialConfig.stages ?? [];

      const matrixConfig = {
        personas: personas.map((persona, index) => ({
          id: persona.id,
          label: persona.label,
          description: persona.description,
          fullText: persona.description,
          orderIndex: index,
          active: true,
        })),
        stages: stages.map((stage, index) => ({
          id: stage.id,
          label: stage.label,
          description: stage.description,
          orderIndex: index,
          active: true,
          coreStage: true,
          coreStageMapping: inferCoreStageMapping(stage.id),
          primaryMetric: inferPrimaryMetric(stage.id),
        })),
      };

      await publishConfig(matrixConfig);
      clearMatrixConfigCache();
    }

    // Matrix config is persisted to matrix_* tables; keep tenant config focused
    // on tenant metadata and provider/entity settings.
    const { personas, stages, ...tenantConfigPartial } = partialConfig;

    // Persist to the tenant_config table (read-merge-write under the hood)
    await saveTenantConfig(tenantConfigPartial);

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

function inferCoreStageMapping(stageId: string): "explore" | "consider" | "compare" | "decide" {
  const normalized = stageId.toLowerCase();

  if (normalized === "discover" || normalized === "explore") return "explore";
  if (normalized === "research" || normalized === "consider") return "consider";
  if (normalized === "compare") return "compare";
  if (normalized === "apply" || normalized === "decide") return "decide";

  return "explore";
}

function inferPrimaryMetric(stageId: string):
  | "discovery_rate"
  | "mention_rate"
  | "top3_rate"
  | "sentiment_score"
  | "win_rate"
  | "recommendation_rate" {
  const mapping = inferCoreStageMapping(stageId);
  if (mapping === "explore") return "discovery_rate";
  if (mapping === "consider") return "mention_rate";
  if (mapping === "compare") return "win_rate";
  return "recommendation_rate";
}
