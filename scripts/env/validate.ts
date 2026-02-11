type EnvironmentTarget = "local" | "preview" | "production";

interface ParsedArgs {
  target: EnvironmentTarget;
  cronEnabled: boolean;
}

interface ValidationResult {
  errors: string[];
  warnings: string[];
}

const REQUIRED_BASE = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "DATABASE_URL",
  "NEXT_PUBLIC_ADMIN_ENABLED",
];

function parseArgs(argv: string[]): ParsedArgs {
  let target: EnvironmentTarget = "local";
  let cronEnabled = process.env.CRON_ENABLED === "true";

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--target") {
      const val = argv[i + 1];
      if (!val || !["local", "preview", "production"].includes(val)) {
        throw new Error("Invalid --target. Use local|preview|production.");
      }
      target = val as EnvironmentTarget;
      i += 1;
    } else if (arg === "--cron-enabled") {
      cronEnabled = true;
    } else if (arg === "--cron-disabled") {
      cronEnabled = false;
    }
  }

  return { target, cronEnabled };
}

function isBlank(value: string | undefined): boolean {
  return !value || value.trim().length === 0;
}

function validateFormat(env: NodeJS.ProcessEnv): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
  if (!isBlank(supabaseUrl)) {
    try {
      const parsed = new URL(supabaseUrl as string);
      if (!parsed.hostname.includes("supabase.co") && parsed.hostname !== "localhost" && parsed.hostname !== "127.0.0.1") {
        warnings.push("NEXT_PUBLIC_SUPABASE_URL does not look like a Supabase host.");
      }
    } catch {
      errors.push("NEXT_PUBLIC_SUPABASE_URL is not a valid URL.");
    }
  }

  const dbUrl = env.DATABASE_URL;
  if (!isBlank(dbUrl) && !/^postgres(ql)?:\/\//.test(dbUrl as string)) {
    errors.push("DATABASE_URL must start with postgres:// or postgresql://");
  }

  return { errors, warnings };
}

function run(): number {
  let parsed: ParsedArgs;
  try {
    parsed = parseArgs(process.argv.slice(2));
  } catch (err) {
    console.error(`[env:validate] ${(err as Error).message}`);
    console.error("Usage: npm run env:validate -- --target <local|preview|production> [--cron-enabled|--cron-disabled]");
    return 2;
  }

  const required = [...REQUIRED_BASE];
  if (parsed.target !== "local" && parsed.cronEnabled) {
    required.push("CRON_SECRET");
  }

  const errors: string[] = [];
  const warnings: string[] = [];

  for (const key of required) {
    if (isBlank(process.env[key])) {
      errors.push(`Missing required env var: ${key}`);
    }
  }

  const format = validateFormat(process.env);
  errors.push(...format.errors);
  warnings.push(...format.warnings);

  if (warnings.length > 0) {
    for (const warning of warnings) {
      console.warn(`[env:validate] warning: ${warning}`);
    }
  }

  if (errors.length > 0) {
    for (const error of errors) {
      console.error(`[env:validate] error: ${error}`);
    }
    return 1;
  }

  console.log(
    `[env:validate] OK target=${parsed.target} cronEnabled=${parsed.cronEnabled}`
  );
  return 0;
}

process.exit(run());

export {};
