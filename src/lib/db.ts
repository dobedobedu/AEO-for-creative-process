import postgres from "postgres";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not set");
}

type SqlClient = ReturnType<typeof postgres>;

const globalForSql = globalThis as unknown as { sql?: SqlClient };

export const sql =
  globalForSql.sql ??
  postgres(connectionString, {
    ssl: "require",
    max: 5,
    prepare: false,
  });

// Helper function for type-safe queries
// The postgres library uses `any[]` for values, which is acceptable here
// since SQL parameters can be of varying types
export function query<T>(strings: TemplateStringsArray, ...values: unknown[]): Promise<T[]> {
  const sqlAny = sql as unknown as (strings: TemplateStringsArray, ...values: unknown[]) => Promise<T[]>;
  return sqlAny(strings, ...values);
}

if (process.env.NODE_ENV !== "production") {
  globalForSql.sql = sql;
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
