#!/usr/bin/env npx tsx
/**
 * Re-score historical benchmark runs CLI
 *
 * Usage:
 *   npx tsx scripts/rescore-historical-runs.ts [--dry-run] [--run-id=xxx]
 *
 * Options:
 *   --dry-run         Show what would change without writing
 *   --run-id=xxx      Rescore a single run by ID
 *   --limit=N         Maximum number of runs to process (default: all)
 *
 * Environment:
 *   Requires GEMINI_API_KEY and DATABASE_URL to be set
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import { loadAllRuns, loadRun, saveRun } from "../src/lib/runs/storage";
import { backupRun } from "../src/lib/runs/backup";
import { rescoreRun, dryRunRescore } from "../src/lib/runs/rescore";

const DEFAULT_BRAND = "Lakewood Ranch";
const DEFAULT_BRAND_ALIASES = ["LWR", "Lakewood"];

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const runIdArg = args.find((a) => a.startsWith("--run-id="));
  const limitArg = args.find((a) => a.startsWith("--limit="));

  const targetRunId = runIdArg?.split("=")[1];
  const limit = limitArg ? parseInt(limitArg.split("=")[1], 10) : undefined;

  console.log("=".repeat(60));
  console.log("Re-score Historical Runs");
  console.log("=".repeat(60));
  console.log(`Mode: ${dryRun ? "DRY RUN (no changes)" : "LIVE"}`);
  if (targetRunId) console.log(`Target Run: ${targetRunId}`);
  if (limit) console.log(`Limit: ${limit} runs`);
  console.log();

  // Check environment
  if (!process.env.GEMINI_API_KEY && !dryRun) {
    console.error("ERROR: GEMINI_API_KEY environment variable is required");
    process.exit(1);
  }

  if (!process.env.DATABASE_URL) {
    console.error("ERROR: DATABASE_URL environment variable is required");
    process.exit(1);
  }

  try {
    let runs;

    if (targetRunId) {
      const run = await loadRun(targetRunId);
      if (!run) {
        console.error(`ERROR: Run not found: ${targetRunId}`);
        process.exit(1);
      }
      runs = [run];
    } else {
      runs = await loadAllRuns();
      if (limit && runs.length > limit) {
        runs = runs.slice(0, limit);
      }
    }

    console.log(`Found ${runs.length} run(s) to process\n`);

    let totalProcessed = 0;
    let totalSuccess = 0;
    let totalFailed = 0;

    for (const run of runs) {
      console.log("-".repeat(60));
      console.log(`Run: ${run.id}`);
      console.log(`Date: ${run.timestamp}`);
      console.log(`Brand: ${run.brand}`);

      // Dry run analysis
      const analysis = await dryRunRescore(run);
      console.log(`Cells: ${analysis.cellCount}`);
      console.log(`Queries: ${analysis.queryCount}`);
      console.log(`Responses: ${analysis.responseCount}`);
      console.log(
        `Stages: explore=${analysis.stages.explore}, consider=${analysis.stages.consider}, compare=${analysis.stages.compare}, decide=${analysis.stages.decide}`
      );

      if (dryRun) {
        console.log("(Dry run - skipping actual rescore)\n");
        continue;
      }

      // Create backup
      console.log("\nCreating backup...");
      const backupPath = await backupRun(run);
      console.log(`Backup saved: ${backupPath}`);

      // Rescore
      console.log("\nRe-scoring responses...");
      const result = await rescoreRun(run, DEFAULT_BRAND, DEFAULT_BRAND_ALIASES, (progress) => {
        process.stdout.write(
          `\r  Progress: ${progress.completed}/${progress.total} (${progress.currentCell || ""})`
        );
      });
      console.log(); // New line after progress

      console.log(`\nResults:`);
      console.log(`  Successful extractions: ${result.stats.successfulExtractions}`);
      console.log(`  Failed extractions: ${result.stats.failedExtractions}`);

      if (result.errors.length > 0) {
        console.log(`  Errors (first 3):`);
        result.errors.slice(0, 3).forEach((e) => console.log(`    - ${e}`));
      }

      // Save if any extractions succeeded
      if (result.stats.successfulExtractions > 0) {
        await saveRun(result.run);
        console.log(`  Run saved to database`);
        totalSuccess++;
      } else {
        console.log(`  No successful extractions - run not saved`);
        totalFailed++;
      }

      totalProcessed++;
      console.log();
    }

    console.log("=".repeat(60));
    console.log("Summary:");
    console.log(`  Total processed: ${totalProcessed}`);
    console.log(`  Successfully rescored: ${totalSuccess}`);
    console.log(`  Failed: ${totalFailed}`);
    console.log("=".repeat(60));
  } catch (err) {
    console.error("ERROR:", err);
    process.exit(1);
  }
}

main().catch(console.error);
