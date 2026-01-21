/**
 * Import historical runs using Supabase REST API
 * This bypasses the direct postgres connection issues
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import { readdirSync, readFileSync, existsSync } from "fs";
import { join } from "path";
import crypto from "crypto";

const RUNS_DIR = join(process.cwd(), "data", "runs");

// UUID validation regex
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuid(id: string): boolean {
  return UUID_REGEX.test(id);
}

// Load existing ID mappings
function loadIdMappings(): Record<string, { newId: string }> {
  const mapPath = join(RUNS_DIR, "run-id-map.json");
  if (existsSync(mapPath)) {
    return JSON.parse(readFileSync(mapPath, "utf-8"));
  }
  return {};
}

async function insertRun(run: Record<string, unknown>): Promise<void> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Missing Supabase credentials");
  }

  const response = await fetch(`${supabaseUrl}/rest/v1/runs`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": supabaseKey,
      "Authorization": `Bearer ${supabaseKey}`,
      "Prefer": "return=minimal",
    },
    body: JSON.stringify({
      id: run.id,
      status: "completed",
      config_json: { brand: run.brand },
      result_json: run,
      pending_count: 0,
      completed_at: run.timestamp || new Date().toISOString(),
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to insert run: ${response.status} - ${text}`);
  }
}

async function main() {
  console.log("🚀 Starting REST API import...\n");

  if (!existsSync(RUNS_DIR)) {
    console.error(`❌ Runs directory not found: ${RUNS_DIR}`);
    process.exit(1);
  }

  const files = readdirSync(RUNS_DIR).filter(
    (f) => f.endsWith(".json") && !f.includes("run-id-map")
  );

  if (files.length === 0) {
    console.log("ℹ️  No run files found in data/runs/");
    process.exit(0);
  }

  console.log(`📁 Found ${files.length} run files\n`);

  // Load existing ID mappings
  const idMappings = loadIdMappings();
  let successCount = 0;
  let errorCount = 0;

  for (const file of files) {
    const fullPath = join(RUNS_DIR, file);

    try {
      const raw = readFileSync(fullPath, "utf-8");
      const run = JSON.parse(raw);

      // Get new UUID from existing mapping or generate one
      const originalId = run.id;
      if (!isUuid(run.id)) {
        if (idMappings[originalId]) {
          run.id = idMappings[originalId].newId;
        } else {
          run.id = crypto.randomUUID();
        }
      }

      await insertRun(run);
      console.log(`✅ Imported: ${file} → ${run.id}`);
      successCount++;
    } catch (err) {
      console.error(
        `❌ Failed to import ${file}:`,
        err instanceof Error ? err.message : err
      );
      errorCount++;
    }
  }

  console.log("\n" + "─".repeat(50));
  console.log(`📊 Import Summary:`);
  console.log(`   ✅ Success: ${successCount}`);
  console.log(`   ❌ Errors: ${errorCount}`);
  console.log("─".repeat(50));
}

main().catch((err) => {
  console.error("\n❌ Import failed:", err);
  process.exit(1);
});
