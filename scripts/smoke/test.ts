import postgres from "postgres";

interface Endpoint {
  path: string;
  expectedStatus: number;
  validateBody?: (body: unknown) => boolean;
}

const ENDPOINTS: Endpoint[] = [
  { path: "/api/tenant/config", expectedStatus: 200 },
  {
    path: "/api/tenant/setup-status",
    expectedStatus: 200,
    validateBody: (body: unknown) => {
      if (!body || typeof body !== "object") return false;
      return typeof (body as { setupComplete?: unknown }).setupComplete === "boolean";
    },
  },
  { path: "/api/tenant/templates", expectedStatus: 200 },
];

function getArg(name: string): string | undefined {
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === name) return argv[i + 1];
  }
  return undefined;
}

async function checkEndpoints(baseUrl: string): Promise<string[]> {
  const errors: string[] = [];

  for (const endpoint of ENDPOINTS) {
    const url = `${baseUrl.replace(/\/$/, "")}${endpoint.path}`;
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(10_000) });
      if (response.status !== endpoint.expectedStatus) {
        errors.push(`${endpoint.path}: expected ${endpoint.expectedStatus}, got ${response.status}`);
        continue;
      }

      if (endpoint.validateBody) {
        const body = await response.json();
        if (!endpoint.validateBody(body)) {
          errors.push(`${endpoint.path}: response body failed validation`);
        }
      }
    } catch (err) {
      errors.push(`${endpoint.path}: request failed (${(err as Error).message})`);
    }
  }

  return errors;
}

async function checkDatabase(databaseUrl: string): Promise<string[]> {
  const errors: string[] = [];
  const sql = postgres(databaseUrl, {
    ssl: /localhost|127\.0\.0\.1/.test(databaseUrl) ? undefined : "require",
    max: 1,
  });

  try {
    const table = await sql`
      select table_name
      from information_schema.tables
      where table_schema = 'public' and table_name = 'tenant_config'
      limit 1
    `;
    if (table.length === 0) {
      errors.push("db: missing table tenant_config");
      return errors;
    }

    const row = await sql`
      select id from tenant_config where id = 'default' limit 1
    `;
    if (row.length === 0) {
      errors.push("db: missing tenant_config default row (id='default')");
    }
  } catch (err) {
    errors.push(`db: check failed (${(err as Error).message})`);
  } finally {
    await sql.end();
  }

  return errors;
}

async function run(): Promise<number> {
  const baseUrl = getArg("--base-url") ?? "http://localhost:3000";
  const databaseUrl = getArg("--database-url") ?? process.env.DATABASE_URL;

  const endpointErrors = await checkEndpoints(baseUrl);
  const dbErrors = databaseUrl ? await checkDatabase(databaseUrl) : [];

  const allErrors = [...endpointErrors, ...dbErrors];
  if (allErrors.length > 0) {
    for (const error of allErrors) {
      console.error(`[smoke] error: ${error}`);
    }
    return 1;
  }

  console.log(`[smoke] OK baseUrl=${baseUrl}`);
  return 0;
}

run()
  .then((code) => process.exit(code))
  .catch((err) => {
    console.error(`[smoke] fatal: ${(err as Error).message}`);
    process.exit(1);
  });
