import postgres from "postgres";

type SqlClient = ReturnType<typeof postgres>;

const globalForSql = globalThis as unknown as { sql?: SqlClient };

// Lazy initialization - only connect when first query is made
// This prevents build-time errors when DATABASE_URL is not set
function getClient(): SqlClient {
  if (globalForSql.sql) {
    return globalForSql.sql;
  }

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }

  // Disable SSL for local connections (localhost/127.0.0.1)
  const isLocal = connectionString.includes("127.0.0.1") || connectionString.includes("localhost");

  const client = postgres(connectionString, {
    ssl: isLocal ? false : "require",
    max: 5,
    prepare: false,
  });

  // Cache connection in development to avoid reconnecting on HMR
  globalForSql.sql = client;

  return client;
}

// Export as a function that returns the client for template literal use
// Usage: (await getSql())`SELECT * FROM table`
// Or use the sql template tag function directly
export function getSql(): SqlClient {
  return getClient();
}

// Template tag function for SQL queries - lazily initializes connection
// Also provides access to postgres helper methods like sql.array()
// Handles both template literal calls and regular function calls (for bulk inserts)
function sqlFn(stringsOrValues: TemplateStringsArray | unknown[], ...values: unknown[]) {
  const client = getClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (client as any)(stringsOrValues, ...values);
}

// Add helper methods to the sql function
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(sqlFn as any).array = function <T>(arr: readonly T[], oid?: number) {
  const client = getClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return client.array(arr as any, oid);
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
(sqlFn as any).json = function <T>(value: T) {
  const client = getClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return client.json(value as any);
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
(sqlFn as any).end = function () {
  const client = getClient();
  return client.end();
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
(sqlFn as any).unsafe = function (query: string, params?: unknown[]) {
  const client = getClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (client.unsafe as any)(query, params);
};

export const sql = sqlFn as typeof sqlFn & {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  array: <T>(arr: readonly T[], oid?: number) => any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  json: <T>(value: T) => any;
  end: () => Promise<void>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  unsafe: (query: string, params?: unknown[]) => any;
};

// Helper function for type-safe queries
export function query<T>(strings: TemplateStringsArray, ...values: unknown[]): Promise<T[]> {
  const client = getClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (client as any)(strings, ...values) as Promise<T[]>;
}

// Auto-migration: Add result_json column if it doesn't exist
let migrationRun = false;
export async function ensureSchema(): Promise<void> {
  if (migrationRun) return;
  migrationRun = true;

  try {
    await sql`
      ALTER TABLE runs
      ADD COLUMN IF NOT EXISTS result_json JSONB;
    `;
  } catch (e) {
    // Column may already exist or table doesn't exist yet
    console.warn("Schema migration warning:", e);
  }
}
