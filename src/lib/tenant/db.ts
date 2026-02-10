/**
 * Database helpers for tenant configuration.
 * Reads/writes the single-row `tenant_config` table.
 * Validates data with Zod schemas from config/types.ts.
 *
 * The table uses a single-row design with id='default'.
 * A DB trigger automatically updates `updated_at` on every UPDATE.
 */

import { sql } from "@/lib/db";
import {
  TenantConfigSchema,
  BrandConfigSchema,
  CompetitorSchema,
  GeographyConfigSchema,
  EntityCategorySchema,
  ProvidersConfigSchema,
  IndustrySchema,
  type TenantConfig,
} from "@/lib/config/types";
import { z } from "zod";

/** The single-row key for tenant config */
const DEFAULT_ROW_ID = "default";

/**
 * Shape of a raw row coming back from the tenant_config table.
 * JSONB columns arrive as already-parsed JS objects from the postgres driver.
 */
interface TenantConfigRow {
  id: string;
  brand_json: unknown;
  competitors_json: unknown;
  geography_json: unknown;
  entity_categories_json: unknown;
  providers_json: unknown;
  industry: string;
  setup_complete: boolean;
  created_at: string;
  updated_at: string;
  updated_by: string | null;
}

/**
 * Read the tenant configuration from the database.
 *
 * Reads the default row from `tenant_config`, parses each JSONB column
 * through its Zod schema, and assembles a full TenantConfig object.
 *
 * @returns The parsed TenantConfig, or null if no row exists or on DB error.
 */
export async function getTenantConfigFromDB(): Promise<TenantConfig | null> {
  try {
    const rows = await sql`
      SELECT
        id,
        brand_json,
        competitors_json,
        geography_json,
        entity_categories_json,
        providers_json,
        industry,
        setup_complete,
        created_at,
        updated_at,
        updated_by
      FROM tenant_config
      WHERE id = ${DEFAULT_ROW_ID}
    `;

    if (rows.length === 0) {
      return null;
    }

    const row = rows[0] as TenantConfigRow;

    // Parse each JSONB column through its Zod schema with safe fallbacks.
    // safeParse lets us degrade gracefully if stored data doesn't match
    // the current schema (e.g. after a schema migration).
    const brand = BrandConfigSchema.safeParse(row.brand_json);
    const competitors = z.array(CompetitorSchema).safeParse(row.competitors_json);
    const geography = row.geography_json
      ? GeographyConfigSchema.safeParse(row.geography_json)
      : { success: true as const, data: undefined };
    const entityCategories = z.array(EntityCategorySchema).safeParse(
      row.entity_categories_json
    );
    const providers = ProvidersConfigSchema.safeParse(row.providers_json);
    const industry = IndustrySchema.safeParse(row.industry);

    // Assemble the config, using Zod defaults for any invalid/missing fields.
    // TenantConfigSchema.parse fills in defaults for missing optional fields.
    const config: TenantConfig = TenantConfigSchema.parse({
      brand: brand.success ? brand.data : {},
      competitors: competitors.success ? competitors.data : [],
      geography: geography.success ? geography.data : undefined,
      entityCategories: entityCategories.success ? entityCategories.data : [],
      providers: providers.success ? providers.data : {},
      industry: industry.success ? industry.data : "other",
    });

    return config;
  } catch (error) {
    console.error("[tenant/db] Failed to read tenant config from DB:", error);
    return null;
  }
}

/**
 * Upsert tenant configuration to the database.
 *
 * Accepts a partial TenantConfig and only updates the provided fields.
 * Uses a read-merge-write strategy: reads the current row, merges the
 * provided fields over the existing values, then writes the full row back.
 * This avoids complex SQL CASE expressions and ensures partial updates
 * don't clobber unrelated columns.
 *
 * @param config - Partial tenant config with fields to update
 * @param userId - Optional user ID for the updated_by column
 */
export async function saveTenantConfig(
  config: Partial<TenantConfig>,
  userId?: string
): Promise<void> {
  const updatedBy = userId ?? null;

  // Read the current row to merge with (may not exist if migration hasn't seeded it)
  const existing = await getTenantConfigFromDB();

  // Merge: provided fields override existing; existing fields are preserved
  const merged = {
    brand: config.brand ?? existing?.brand ?? { name: "", aliases: [] },
    competitors: config.competitors ?? existing?.competitors ?? [],
    geography: config.geography !== undefined
      ? config.geography
      : (existing?.geography ?? null),
    entityCategories:
      config.entityCategories ?? existing?.entityCategories ?? [],
    providers: config.providers ?? existing?.providers ?? {},
    industry: config.industry ?? existing?.industry ?? "other",
  };

  await sql`
    INSERT INTO tenant_config (
      id,
      brand_json,
      competitors_json,
      geography_json,
      entity_categories_json,
      providers_json,
      industry,
      updated_by
    ) VALUES (
      ${DEFAULT_ROW_ID},
      ${sql.json(merged.brand)},
      ${sql.json(merged.competitors)},
      ${merged.geography ? sql.json(merged.geography) : null},
      ${sql.json(merged.entityCategories)},
      ${sql.json(merged.providers)},
      ${merged.industry},
      ${updatedBy}
    )
    ON CONFLICT (id) DO UPDATE SET
      brand_json = ${sql.json(merged.brand)},
      competitors_json = ${sql.json(merged.competitors)},
      geography_json = ${merged.geography ? sql.json(merged.geography) : null},
      entity_categories_json = ${sql.json(merged.entityCategories)},
      providers_json = ${sql.json(merged.providers)},
      industry = ${merged.industry},
      updated_by = ${updatedBy}
  `;
}

/**
 * Check whether the initial setup wizard has been completed.
 *
 * @returns true if setup_complete is true on the default row, false otherwise.
 */
export async function isSetupComplete(): Promise<boolean> {
  try {
    const rows = await sql`
      SELECT setup_complete
      FROM tenant_config
      WHERE id = ${DEFAULT_ROW_ID}
    `;

    if (rows.length === 0) {
      return false;
    }

    return rows[0].setup_complete === true;
  } catch (error) {
    console.error("[tenant/db] Failed to check setup status:", error);
    return false;
  }
}

/**
 * Mark the initial setup wizard as complete.
 *
 * If no row exists yet, inserts one with setup_complete = true.
 * The DB trigger will automatically set updated_at.
 *
 * @param userId - Optional user ID for the updated_by column
 */
export async function markSetupComplete(userId?: string): Promise<void> {
  const updatedBy = userId ?? null;

  await sql`
    INSERT INTO tenant_config (id, setup_complete, updated_by)
    VALUES (${DEFAULT_ROW_ID}, true, ${updatedBy})
    ON CONFLICT (id) DO UPDATE SET
      setup_complete = true,
      updated_by = ${updatedBy}
  `;
}
