/**
 * Migration script: Copy intent library from library.json to Postgres
 *
 * Run with: npx tsx scripts/migrate-intents-to-db.ts
 *
 * This script:
 * 1. Creates the intent tables if they don't exist
 * 2. Reads the existing library.json file
 * 3. Inserts all intents and history into the database
 * 4. Sets the version number to match the JSON file
 */

import dotenv from "dotenv";
import postgres from "postgres";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

// Load .env.local for local development
dotenv.config({ path: ".env.local" });

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}

// Disable SSL for local connections (localhost/127.0.0.1)
const isLocal = DATABASE_URL.includes("127.0.0.1") || DATABASE_URL.includes("localhost");
const sql = postgres(DATABASE_URL, { ssl: isLocal ? false : "require" });

const LIBRARY_PATH = join(process.cwd(), "data", "intents", "library.json");

interface Intent {
  id: string;
  persona: string;
  stage: string;
  text: string;
  defaultQueries?: string[];
  role: string;
  queryStyle: number;
  generatedQueries?: string[];
  createdAt: string;
  active: boolean;
}

interface HistoryEntry {
  version: number;
  date: string;
  changes: unknown[];
}

interface IntentLibrary {
  version: number;
  updatedAt: string;
  intents: Intent[];
  history: HistoryEntry[];
}

async function migrate() {
  console.log("Starting intent library migration to Postgres...\n");

  try {
    // Step 1: Create tables
    console.log("1. Creating database tables...");

    await sql`
      CREATE TABLE IF NOT EXISTS intent_library_meta (
        id INT PRIMARY KEY DEFAULT 1,
        version INT NOT NULL DEFAULT 0,
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      );
    `;
    console.log("   ✓ Created intent_library_meta table");

    await sql`
      INSERT INTO intent_library_meta (id, version, updated_at)
      VALUES (1, 0, NOW())
      ON CONFLICT (id) DO NOTHING;
    `;
    console.log("   ✓ Initialized metadata row");

    await sql`
      CREATE TABLE IF NOT EXISTS intents (
        id TEXT PRIMARY KEY,
        persona TEXT NOT NULL,
        stage TEXT NOT NULL,
        text TEXT NOT NULL,
        default_queries JSONB,
        role TEXT DEFAULT 'cpo',
        query_style FLOAT DEFAULT 0.75,
        generated_queries JSONB,
        active BOOLEAN DEFAULT true,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `;
    console.log("   ✓ Created intents table");

    await sql`
      CREATE TABLE IF NOT EXISTS intent_history (
        id SERIAL PRIMARY KEY,
        version INT NOT NULL,
        date DATE NOT NULL,
        changes JSONB NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `;
    console.log("   ✓ Created intent_history table");

    // Create indexes
    try {
      await sql`CREATE INDEX IF NOT EXISTS idx_intents_persona_stage ON intents(persona, stage);`;
      await sql`CREATE INDEX IF NOT EXISTS idx_intents_active ON intents(active);`;
      await sql`CREATE INDEX IF NOT EXISTS idx_intent_history_version ON intent_history(version);`;
      console.log("   ✓ Created indexes");
    } catch {
      console.log("   ⚠ Indexes may already exist");
    }

    // Step 2: Check for existing data
    console.log("\n2. Checking for existing data...");
    const existingIntents = await sql`SELECT COUNT(*) as count FROM intents;`;
    const intentCount = Number(existingIntents[0].count);

    if (intentCount > 0) {
      console.log(`   ⚠ Found ${intentCount} existing intents in database`);
      console.log("   ⚠ Clearing existing data to perform fresh migration...");
      await sql`DELETE FROM intents;`;
      await sql`DELETE FROM intent_history;`;
      console.log("   ✓ Cleared existing data");
    }

    // Step 3: Read library.json
    console.log("\n3. Reading library.json...");

    if (!existsSync(LIBRARY_PATH)) {
      console.log("   ⚠ No library.json found at:", LIBRARY_PATH);
      console.log("   ⚠ Skipping data migration (starting with empty library)");
      await sql`
        UPDATE intent_library_meta
        SET version = 0, updated_at = NOW()
        WHERE id = 1;
      `;
      console.log("\n✅ Migration completed (empty library initialized)");
      return;
    }

    const raw = readFileSync(LIBRARY_PATH, "utf-8");
    const library: IntentLibrary = JSON.parse(raw);
    console.log(`   ✓ Loaded library with version ${library.version}`);
    console.log(`   ✓ Found ${library.intents.length} intents`);
    console.log(`   ✓ Found ${library.history.length} history entries`);

    // Step 4: Insert intents
    console.log("\n4. Inserting intents...");
    let insertedCount = 0;
    let errorCount = 0;

    for (const intent of library.intents) {
      try {
        await sql`
          INSERT INTO intents (id, persona, stage, text, default_queries, role, query_style, generated_queries, active, created_at)
          VALUES (
            ${intent.id},
            ${intent.persona},
            ${intent.stage},
            ${intent.text},
            ${intent.defaultQueries ? JSON.stringify(intent.defaultQueries) : null}::jsonb,
            ${intent.role},
            ${intent.queryStyle},
            ${intent.generatedQueries ? JSON.stringify(intent.generatedQueries) : null}::jsonb,
            ${intent.active},
            ${intent.createdAt}::timestamptz
          );
        `;
        insertedCount++;
      } catch (err) {
        errorCount++;
        console.error(`   ✗ Failed to insert intent ${intent.id}:`, err);
      }
    }
    console.log(`   ✓ Inserted ${insertedCount} intents (${errorCount} errors)`);

    // Step 5: Insert history (optional - can be large)
    console.log("\n5. Inserting history...");
    let historyInserted = 0;
    let historyErrors = 0;

    for (const entry of library.history) {
      try {
        await sql`
          INSERT INTO intent_history (version, date, changes)
          VALUES (${entry.version}, ${entry.date}::date, ${JSON.stringify(entry.changes)}::jsonb);
        `;
        historyInserted++;
      } catch (err) {
        historyErrors++;
        // Don't log every history error as there may be many
        if (historyErrors <= 5) {
          console.error(`   ✗ Failed to insert history version ${entry.version}:`, err);
        }
      }
    }
    console.log(`   ✓ Inserted ${historyInserted} history entries (${historyErrors} errors)`);

    // Step 6: Set version
    console.log("\n6. Setting library version...");
    await sql`
      UPDATE intent_library_meta
      SET version = ${library.version}, updated_at = ${library.updatedAt}::timestamptz
      WHERE id = 1;
    `;
    console.log(`   ✓ Set version to ${library.version}`);

    // Final verification
    console.log("\n7. Verifying migration...");
    const finalIntents = await sql`SELECT COUNT(*) as count FROM intents;`;
    const finalHistory = await sql`SELECT COUNT(*) as count FROM intent_history;`;
    const finalMeta = await sql`SELECT version FROM intent_library_meta WHERE id = 1;`;

    console.log(`   ✓ Intents in DB: ${finalIntents[0].count}`);
    console.log(`   ✓ History entries in DB: ${finalHistory[0].count}`);
    console.log(`   ✓ Library version: ${finalMeta[0].version}`);

    console.log("\n✅ Migration completed successfully!");

  } catch (error) {
    console.error("\n❌ Migration failed:", error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

migrate();
