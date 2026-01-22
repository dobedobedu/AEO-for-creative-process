/**
 * Backup utility for benchmark runs
 *
 * Saves a copy of run data before re-scoring to enable rollback if needed.
 */

import { writeFile, mkdir } from "fs/promises";
import path from "path";
import type { BenchmarkRun } from "./types";

const BACKUP_DIR = path.join(process.cwd(), "data", "runs", "backup");

/**
 * Backs up a benchmark run to the backup directory.
 * Creates a timestamped backup file.
 *
 * @param run - The benchmark run to back up
 * @returns The path to the backup file
 */
export async function backupRun(run: BenchmarkRun): Promise<string> {
  // Ensure backup directory exists
  await mkdir(BACKUP_DIR, { recursive: true });

  // Create filename with date and run ID
  const date = run.timestamp.split("T")[0];
  const backupTimestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filename = `${date}_${run.id}_backup_${backupTimestamp}.json`;
  const filepath = path.join(BACKUP_DIR, filename);

  // Write the backup
  await writeFile(filepath, JSON.stringify(run, null, 2), "utf-8");

  console.log(`[Backup] Saved backup to ${filepath}`);
  return filepath;
}

/**
 * Lists all backup files in the backup directory.
 *
 * @returns Array of backup file paths
 */
export async function listBackups(): Promise<string[]> {
  const { readdir } = await import("fs/promises");

  try {
    await mkdir(BACKUP_DIR, { recursive: true });
    const files = await readdir(BACKUP_DIR);
    return files
      .filter((f) => f.endsWith(".json"))
      .map((f) => path.join(BACKUP_DIR, f))
      .sort()
      .reverse(); // Most recent first
  } catch {
    return [];
  }
}
