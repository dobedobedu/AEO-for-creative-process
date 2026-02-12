import fs from "node:fs";
import path from "node:path";
import postgres from "postgres";

type EnvironmentTarget = "local" | "preview" | "production";

interface ProviderConfig {
  id: string;
  envVar: string;
}

const PROVIDERS: ProviderConfig[] = [
  { id: "openai", envVar: "OPENAI_API_KEY" },
  { id: "anthropic", envVar: "ANTHROPIC_API_KEY" },
  { id: "gemini", envVar: "GEMINI_API_KEY" },
  { id: "xai", envVar: "XAI_API_KEY" },
  { id: "openrouter", envVar: "OPENROUTER_API_KEY" },
];

function getArg(name: string): string | undefined {
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === name) return argv[i + 1];
  }
  return undefined;
}

function getTarget(): EnvironmentTarget {
  const raw = getArg("--target") ?? "local";
  if (!["local", "preview", "production"].includes(raw)) {
    throw new Error("Invalid --target. Use local|preview|production.");
  }
  return raw as EnvironmentTarget;
}

function parseEnabledProvidersFromArg(): string[] {
  const raw = getArg("--enabled-providers");
  if (!raw) return [];
  return raw
    .split(",")
    .map((v) => v.trim().toLowerCase())
    .filter(Boolean);
}

function needsSsl(connectionString: string): boolean {
  return !/localhost|127\.0\.0\.1/.test(connectionString);
}

async function parseEnabledProvidersFromDB(): Promise<string[]> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) return [];

  try {
    const sql = postgres(databaseUrl, {
      ssl: needsSsl(databaseUrl) ? "require" : undefined,
      max: 1,
    });

    const rows = await sql`
      SELECT providers_json FROM tenant_config WHERE id = 'default' LIMIT 1
    `;
    await sql.end();

    if (rows.length === 0) return [];

    const providersJson = rows[0].providers_json as {
      providers?: Array<{ id: string; active: boolean }>;
    };
    if (!providersJson?.providers) return [];

    return providersJson.providers
      .filter((p) => p.active)
      .map((p) => p.id.toLowerCase());
  } catch {
    return [];
  }
}

function parseEnabledProvidersFromTenantFile(): string[] {
  const tenantPath = path.join(process.cwd(), "config", "tenant.json");
  if (!fs.existsSync(tenantPath)) return [];

  try {
    const raw = JSON.parse(fs.readFileSync(tenantPath, "utf8")) as Record<string, unknown>;
    const providers = raw.providers as Record<string, unknown> | undefined;
    if (!providers) return [];

    const entries = providers.providers as Array<Record<string, unknown>> | undefined;
    if (Array.isArray(entries) && entries.length > 0) {
      return entries
        .filter((entry) => entry.active === true && typeof entry.id === "string")
        .map((entry) => String(entry.id).toLowerCase());
    }

    const weights = providers.weights as Record<string, number> | undefined;
    if (weights && typeof weights === "object") {
      return Object.entries(weights)
        .filter(([, value]) => Number(value) > 0)
        .map(([key]) => key.toLowerCase());
    }
  } catch {
    return [];
  }

  return [];
}

async function run(): Promise<number> {
  let target: EnvironmentTarget;
  try {
    target = getTarget();
  } catch (err) {
    console.error(`[secrets:check] ${(err as Error).message}`);
    return 2;
  }

  const enabledFromArg = parseEnabledProvidersFromArg();
  let enabledProviders = enabledFromArg;

  if (enabledProviders.length === 0) {
    enabledProviders = await parseEnabledProvidersFromDB();
  }

  if (enabledProviders.length === 0) {
    enabledProviders = parseEnabledProvidersFromTenantFile();
  }

  if (enabledProviders.length === 0) {
    console.log(
      "[secrets:check] No enabled providers detected (use --enabled-providers, configure DB tenant_config, or configure providers in config/tenant.json)."
    );
    return 0;
  }

  const enabledSet = new Set(enabledProviders);
  const missing: string[] = [];

  for (const provider of PROVIDERS) {
    if (!enabledSet.has(provider.id)) continue;
    const value = process.env[provider.envVar];
    if (!value || value.trim() === "") {
      missing.push(`${provider.id}:${provider.envVar}`);
    }
  }

  if (missing.length === 0) {
    console.log(`[secrets:check] OK target=${target} enabledProviders=${enabledProviders.join(",")}`);
    return 0;
  }

  if (target === "local") {
    for (const item of missing) {
      console.warn(`[secrets:check] warning: missing provider key (${item})`);
    }
    return 0;
  }

  for (const item of missing) {
    console.error(`[secrets:check] error: missing provider key (${item})`);
  }
  return 1;
}

run()
  .then((code) => process.exit(code))
  .catch((err) => {
    console.error(`[secrets:check] fatal: ${(err as Error).message}`);
    process.exit(1);
  });
