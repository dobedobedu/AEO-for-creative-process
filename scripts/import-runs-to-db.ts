/**
 * Import historical run JSON files into Supabase database.
 *
 * Usage:
 *   npm run import:runs           # Import runs to database only
 *   npm run import:runs -- --upload-rag  # Also upload to RAG (Gemini FileSearch)
 *
 * This script:
 * 1. Reads all .json files from data/runs/
 * 2. Converts non-UUID IDs to proper UUIDs
 * 3. Saves runs to the database via saveRun()
 * 4. Optionally uploads to Gemini FileSearch for RAG
 */

// Load environment variables from .env.local
import { config } from "dotenv";
config({ path: ".env.local" });

import { readdirSync, readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";
import crypto from "crypto";

// Dynamic import to handle module resolution
const RUNS_DIR = join(process.cwd(), "data", "runs");
const UPLOAD_RAG = process.argv.includes("--upload-rag");
const DRY_RUN = process.argv.includes("--dry-run");

// UUID validation regex
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuid(id: string): boolean {
  return UUID_REGEX.test(id);
}

interface IdMapping {
  originalId: string;
  newId: string;
  filename: string;
}

async function main() {
  console.log("🚀 Starting historical runs import...\n");

  // Check if runs directory exists
  if (!existsSync(RUNS_DIR)) {
    console.error(`❌ Runs directory not found: ${RUNS_DIR}`);
    process.exit(1);
  }

  // Get all JSON files
  const files = readdirSync(RUNS_DIR).filter((f) => f.endsWith(".json") && !f.includes("run-id-map"));

  if (files.length === 0) {
    console.log("ℹ️  No run files found in data/runs/");
    process.exit(0);
  }

  console.log(`📁 Found ${files.length} run files\n`);

  // Track ID mappings for non-UUID conversions
  const idMappings: IdMapping[] = [];
  let successCount = 0;
  let errorCount = 0;

  // Dynamically import the storage module (handles @/ alias resolution)
  const { saveRun } = await import("../src/lib/runs/storage");

  for (const file of files) {
    const fullPath = join(RUNS_DIR, file);

    try {
      const raw = readFileSync(fullPath, "utf-8");
      const run = JSON.parse(raw);

      // Track original ID
      const originalId = run.id;

      // Convert non-UUID IDs to UUIDs
      if (!isUuid(run.id)) {
        const newId = crypto.randomUUID();
        idMappings.push({ originalId, newId, filename: file });
        run.id = newId;

        // Also update intentIds in cells if they're not UUIDs
        if (run.cells) {
          for (const cellKey of Object.keys(run.cells)) {
            const cell = run.cells[cellKey];
            if (cell.intentId && !isUuid(cell.intentId)) {
              cell.intentId = crypto.randomUUID();
            }
          }
        }
      }

      if (DRY_RUN) {
        console.log(`[DRY RUN] Would import: ${file} → ${run.id}`);
        successCount++;
        continue;
      }

      // Save to database
      await saveRun(run);
      console.log(`✅ Imported: ${file} → ${run.id}`);
      successCount++;

      // Optional: Upload to RAG (Gemini FileSearch)
      if (UPLOAD_RAG) {
        try {
          // Check if uploader exists
          const uploaderPath = join(process.cwd(), "src/lib/filesearch/uploader.ts");
          if (existsSync(uploaderPath)) {
            const { uploadRun } = await import("../src/lib/filesearch/uploader");
            await uploadRun(run);
            console.log(`   📤 Uploaded to RAG: ${run.id}`);
          } else {
            console.log(`   ⚠️  RAG uploader not found, skipping upload`);
          }
        } catch (ragError) {
          console.log(`   ⚠️  RAG upload failed: ${ragError instanceof Error ? ragError.message : "Unknown error"}`);
        }
      }
    } catch (err) {
      console.error(`❌ Failed to import ${file}:`, err instanceof Error ? err.message : err);
      errorCount++;
    }
  }

  // Save ID mapping if any IDs were converted
  if (idMappings.length > 0 && !DRY_RUN) {
    const mapPath = join(RUNS_DIR, "run-id-map.json");
    const existingMap = existsSync(mapPath)
      ? JSON.parse(readFileSync(mapPath, "utf-8"))
      : {};

    // Merge with existing mappings
    for (const mapping of idMappings) {
      existingMap[mapping.originalId] = {
        newId: mapping.newId,
        filename: mapping.filename,
        importedAt: new Date().toISOString(),
      };
    }

    writeFileSync(mapPath, JSON.stringify(existingMap, null, 2));
    console.log(`\n📝 Saved ID mappings to ${mapPath}`);
  }

  // Summary
  console.log("\n" + "─".repeat(50));
  console.log(`📊 Import Summary:`);
  console.log(`   ✅ Success: ${successCount}`);
  console.log(`   ❌ Errors: ${errorCount}`);
  if (idMappings.length > 0) {
    console.log(`   🔄 IDs converted: ${idMappings.length}`);
  }
  if (DRY_RUN) {
    console.log(`   ⚠️  DRY RUN - no changes made`);
  }
  console.log("─".repeat(50));
}

main().catch((err) => {
  console.error("\n❌ Import failed:", err);
  process.exit(1);
});
