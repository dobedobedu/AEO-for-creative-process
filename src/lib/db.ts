import postgres from "postgres";

type SqlClient = ReturnType<typeof postgres>;

const globalForSql = globalThis as unknown as { sql?: SqlClient };

// Error codes that indicate stale pooler connections worth retrying
const RETRYABLE_CODES = new Set(["CONNECTION_CLOSED", "ECONNRESET"]);

/**
 * Retry wrapper for database operations that may fail due to stale pooler connections.
 * Retries once on CONNECTION_CLOSED or ECONNRESET errors.
 */
export async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code;
    if (code && RETRYABLE_CODES.has(code)) {
      console.warn(`[db] Retrying after ${code}`);
      // Reset cached connection to force reconnect
      globalForSql.sql = undefined;
      return await fn();
    }
    throw err;
  }
}

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
  const executeQuery = () => {
    const client = getClient();
    return (client as any)(stringsOrValues, ...values);
  };
  return withRetry(executeQuery);
}

// Add helper methods to the sql function
(sqlFn as any).array = function <T>(arr: readonly T[], oid?: number) {
  const client = getClient();
  return client.array(arr as any, oid);
};

(sqlFn as any).json = function <T>(value: T) {
  const client = getClient();
  return client.json(value as any);
};

(sqlFn as any).end = function () {
  const client = getClient();
  return client.end();
};

(sqlFn as any).unsafe = function (query: string, params?: unknown[]) {
  const executeQuery = () => {
    const client = getClient();
    return (client.unsafe as any)(query, params);
  };
  return withRetry(executeQuery);
};

// Add begin helper for transactions
// Note: Retry wraps the entire transaction. If connection fails at start,
// we reconnect and re-run the callback. Mid-transaction failures are not retried.
(sqlFn as any).begin = function<T>(callback: (sql: any) => Promise<T>): Promise<T> {
  const executeTransaction = () => {
    const client = getClient();
    return client.begin(callback) as Promise<T>;
  };
  return withRetry(executeTransaction);
};

type SqlTag = (stringsOrValues: TemplateStringsArray | unknown[], ...values: unknown[]) => Promise<any[]>;

export const sql = sqlFn as SqlTag & {
  array: <T>(arr: readonly T[], oid?: number) => any;
  json: <T>(value: T) => any;
  end: () => Promise<void>;
  unsafe: (query: string, params?: unknown[]) => any;
  begin: <T>(callback: (sql: any) => Promise<T>) => Promise<T>;
};

// Helper function for type-safe queries
export function query<T>(strings: TemplateStringsArray, ...values: unknown[]): Promise<T[]> {
  const executeQuery = () => {
    const client = getClient();
    return (client as any)(strings, ...values) as Promise<T[]>;
  };
  return withRetry(executeQuery);
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
    await sql`
      CREATE TABLE IF NOT EXISTS app_settings (
        key TEXT PRIMARY KEY,
        value JSONB NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        updated_by UUID
      );
    `;
  } catch (e) {
    // Column may already exist or table doesn't exist yet
    console.warn("Schema migration warning:", e);
  }
}
