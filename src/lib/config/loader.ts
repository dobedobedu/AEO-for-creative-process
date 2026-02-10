/**
 * Tenant Configuration Loader
 *
 * Loads tenant configuration with a DB-first strategy:
 *   1. Check DB (tenant_config table) via getTenantConfigFromDB()
 *   2. Fall back to config/tenant.json
 *   3. Fall back to DEFAULT_CONFIG
 *   4. Apply environment variable overrides (always last)
 *
 * The sync getTenantConfig() returns the cached value (populated by the async
 * loader or the legacy file-based loader). Use initConfigFromDB() at app
 * startup to pre-populate the cache from the database.
 */

import { readFileSync, existsSync } from "node:fs";
import { join } from "path";
import { TenantConfigSchema, type TenantConfig } from "./types";

// In-memory cache for the loaded config
let cachedConfig: TenantConfig | null = null;

// Default embedded configuration (fallback if file missing and DB unavailable)
const DEFAULT_CONFIG: TenantConfig = {
  brand: {
    name: "My Brand",
    aliases: [],
    highlightColor: "#dcf3dc",
  },
  competitors: [],
  personas: [
    { id: "persona_1", label: "Persona 1", description: "Primary persona" },
    { id: "persona_2", label: "Persona 2", description: "Secondary persona" },
  ],
  stages: [
    { id: "explore", label: "Explore", description: "Starting research" },
    { id: "consider", label: "Consider", description: "Evaluating options" },
    { id: "compare", label: "Compare", description: "Narrowing choices" },
    { id: "decide", label: "Decide", description: "Ready to decide" },
  ],
  entityCategories: [],
  providers: {
    weights: { openai: 0.25, gemini: 0.25, anthropic: 0.25, xai: 0.25 },
    models: {
      openai: "gpt-4.5-preview",
      gemini: "gemini-3-pro-preview",
      anthropic: "claude-3-5-haiku-20241022",
      xai: "grok-3-preview",
    },
    providers: [
      { id: "openai", label: "OpenAI", model: "gpt-4.5-preview", weight: 0.25, active: true, apiKeyEnvVar: "OPENAI_API_KEY" },
      { id: "anthropic", label: "Anthropic", model: "claude-3-5-haiku-20241022", weight: 0.25, active: true, apiKeyEnvVar: "ANTHROPIC_API_KEY" },
      { id: "gemini", label: "Google Gemini", model: "gemini-3-pro-preview", weight: 0.25, active: true, apiKeyEnvVar: "GEMINI_API_KEY" },
      { id: "xai", label: "xAI", model: "grok-3-preview", weight: 0.25, active: true, apiKeyEnvVar: "XAI_API_KEY" },
    ],
  },
  thresholds: { strong: 0.7, moderate: 0.4, weak: 0.2 },
  industry: "other",
  metadata: { version: "1.0.0" },
};

/**
 * Get the path to the tenant config file
 */
function getConfigPath(): string {
  // In Next.js, process.cwd() points to the project root
  return join(process.cwd(), "config", "tenant.json");
}

/**
 * Apply environment variable overrides to the config.
 * Environment overrides are always applied last, regardless of the config source.
 */
function applyEnvOverrides(config: TenantConfig): TenantConfig {
  const result = { ...config };

  // Brand overrides
  if (process.env.BRAND_NAME) {
    result.brand = { ...result.brand, name: process.env.BRAND_NAME };
  }
  if (process.env.BRAND_ALIASES) {
    result.brand = {
      ...result.brand,
      aliases: process.env.BRAND_ALIASES.split(",").map((s) => s.trim()),
    };
  }
  if (process.env.BRAND_DOMAIN) {
    result.brand = { ...result.brand, domain: process.env.BRAND_DOMAIN };
  }
  if (process.env.BRAND_HIGHLIGHT_COLOR) {
    result.brand = { ...result.brand, highlightColor: process.env.BRAND_HIGHLIGHT_COLOR };
  }

  return result;
}

/**
 * Load tenant configuration from the config/tenant.json file.
 * Returns null if the file doesn't exist or can't be parsed.
 */
function loadFromFile(): TenantConfig | null {
  const configPath = getConfigPath();

  try {
    if (!existsSync(configPath)) {
      return null;
    }

    const rawConfig = readFileSync(configPath, "utf-8");
    const jsonConfig = JSON.parse(rawConfig);
    return TenantConfigSchema.parse(jsonConfig);
  } catch (error) {
    if (error instanceof SyntaxError) {
      console.error(`[config] Invalid JSON in ${configPath}:`, error.message);
    } else if (error instanceof Error && error.name === "ZodError") {
      console.error(`[config] Config validation failed:`, error.message);
    } else {
      console.error(`[config] Error loading config from file:`, error);
    }
    return null;
  }
}

/**
 * Load tenant configuration from file (legacy sync loader).
 *
 * Load order: config/tenant.json → DEFAULT_CONFIG → env overrides.
 * This is the original sync loader preserved for backward compatibility.
 *
 * @param forceReload - Force reload from disk, ignoring cache
 * @returns The tenant configuration
 */
export function loadTenantConfig(forceReload = false): TenantConfig {
  // Return cached config if available and not forcing reload
  if (cachedConfig && !forceReload) {
    return cachedConfig;
  }

  const fileConfig = loadFromFile();

  if (fileConfig) {
    cachedConfig = applyEnvOverrides(fileConfig);
    console.log(`[config] Loaded tenant config from file: ${cachedConfig.brand.name}`);
  } else {
    console.warn(`[config] Config file not found or invalid, using default configuration`);
    cachedConfig = applyEnvOverrides(DEFAULT_CONFIG);
  }

  return cachedConfig;
}

/**
 * Load tenant configuration asynchronously with DB-first strategy.
 *
 * Load order:
 *   1. DB via getTenantConfigFromDB() from @/lib/tenant/db
 *   2. Fall back to config/tenant.json
 *   3. Fall back to DEFAULT_CONFIG
 *   4. Apply environment variable overrides (always last)
 *
 * The result is cached so subsequent calls to getTenantConfig() return
 * the DB-loaded value without needing another async call.
 *
 * @returns The tenant configuration
 */
export async function loadTenantConfigAsync(): Promise<TenantConfig> {
  // 1. Try DB first
  try {
    // Dynamic import to avoid circular dependencies and to keep the DB
    // layer optional (e.g. in environments without a database).
    const { getTenantConfigFromDB } = await import("@/lib/tenant/db");
    const dbConfig = await getTenantConfigFromDB();

    if (dbConfig) {
      cachedConfig = applyEnvOverrides(dbConfig);
      console.log(`[config] Loaded tenant config from DB: ${cachedConfig.brand.name}`);
      return cachedConfig;
    }
  } catch (error) {
    console.warn("[config] DB unavailable for config load, falling back to file:", error);
  }

  // 2. Fall back to file
  const fileConfig = loadFromFile();
  if (fileConfig) {
    cachedConfig = applyEnvOverrides(fileConfig);
    console.log(`[config] Loaded tenant config from file: ${cachedConfig.brand.name}`);
    return cachedConfig;
  }

  // 3. Fall back to DEFAULT_CONFIG
  console.warn("[config] No DB or file config found, using default configuration");
  cachedConfig = applyEnvOverrides(DEFAULT_CONFIG);
  return cachedConfig;
}

/**
 * Pre-populate the config cache from the database at app startup.
 *
 * Call this once during server initialization (e.g. in instrumentation.ts
 * or a top-level layout server component) so that subsequent sync calls
 * to getTenantConfig() return the DB-loaded value.
 *
 * If the DB is unavailable, falls back to file → defaults → env overrides
 * (same as loadTenantConfigAsync).
 */
export async function initConfigFromDB(): Promise<void> {
  await loadTenantConfigAsync();
}

/**
 * Get tenant configuration (server-side only)
 *
 * This is the primary function to use throughout the application.
 * It returns the cached config or loads it synchronously from file if
 * the cache hasn't been populated yet.
 *
 * For DB-first loading, call initConfigFromDB() at startup so the cache
 * is pre-populated before any sync access.
 */
export function getTenantConfig(): TenantConfig {
  return loadTenantConfig();
}

/**
 * Clear the cached configuration.
 *
 * Call this after saving config changes (e.g. from admin endpoints)
 * so the next getTenantConfig() or loadTenantConfigAsync() call
 * picks up the updated values.
 */
export function clearConfigCache(): void {
  cachedConfig = null;
}

/**
 * Check if running on the server
 */
export function isServer(): boolean {
  return typeof window === "undefined";
}
