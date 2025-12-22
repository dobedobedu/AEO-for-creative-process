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

export function query<T>(strings: TemplateStringsArray, ...values: any[]): Promise<T[]> {
  const sqlAny = sql as unknown as (strings: TemplateStringsArray, ...values: any[]) => Promise<T[]>;
  return sqlAny(strings, ...values);
}

if (process.env.NODE_ENV !== "production") {
  globalForSql.sql = sql;
}
