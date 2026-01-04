import dotenv from "dotenv";
import postgres from "postgres";

// Load .env.local for local development
dotenv.config({ path: ".env.local" });

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}

const sql = postgres(DATABASE_URL, { ssl: "require" });

async function migrate() {
  console.log("Running migration to create analyses table...");

  try {
    await sql`
      CREATE TABLE IF NOT EXISTS analyses (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        run_id UUID REFERENCES runs(id) ON DELETE CASCADE,
        variant_key TEXT NOT NULL,
        model TEXT NOT NULL,
        thinking_level TEXT,
        analysis_kind TEXT NOT NULL,
        analysis_json JSONB NOT NULL,
        thought_summaries JSONB,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `;
    console.log("✓ Created analyses table");

    await sql`
      CREATE INDEX IF NOT EXISTS idx_analyses_run ON analyses(run_id);
    `;
    console.log("✓ Created idx_analyses_run index");

    await sql`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_analyses_run_variant ON analyses(run_id, variant_key);
    `;
    console.log("✓ Created idx_analyses_run_variant unique index");

    console.log("\n✅ Migration completed successfully!");
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

migrate();
