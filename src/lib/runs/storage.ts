import { readFileSync, writeFileSync, existsSync, readdirSync, mkdirSync, unlinkSync } from "fs";
import { join } from "path";
import {
  BenchmarkRun,
  BenchmarkRunSchema,
  RunMetadata,
  generateRunId,
  getRunFilename,
} from "./types";

const DATA_DIR = join(process.cwd(), "data", "runs");

function ensureDataDir(): void {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }
}

export function saveRun(run: BenchmarkRun): string {
  ensureDataDir();
  
  const validated = BenchmarkRunSchema.parse(run);
  const filename = getRunFilename(validated);
  const filepath = join(DATA_DIR, filename);
  
  writeFileSync(filepath, JSON.stringify(validated, null, 2), "utf-8");
  return filepath;
}

export function loadRun(runId: string): BenchmarkRun | null {
  ensureDataDir();
  
  const files = readdirSync(DATA_DIR).filter((f) => f.endsWith(".json"));
  const matchingFile = files.find((f) => f.includes(runId));
  
  if (!matchingFile) {
    return null;
  }
  
  const filepath = join(DATA_DIR, matchingFile);
  const raw = readFileSync(filepath, "utf-8");
  const parsed = JSON.parse(raw);
  return BenchmarkRunSchema.parse(parsed);
}

export function loadRunByFilename(filename: string): BenchmarkRun | null {
  ensureDataDir();
  
  const filepath = join(DATA_DIR, filename);
  if (!existsSync(filepath)) {
    return null;
  }
  
  const raw = readFileSync(filepath, "utf-8");
  const parsed = JSON.parse(raw);
  return BenchmarkRunSchema.parse(parsed);
}

export function listRunMetadata(): RunMetadata[] {
  ensureDataDir();
  
  const files = readdirSync(DATA_DIR)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .reverse();
  
  const metadata: RunMetadata[] = [];
  
  for (const file of files) {
    try {
      const filepath = join(DATA_DIR, file);
      const raw = readFileSync(filepath, "utf-8");
      const parsed = JSON.parse(raw);
      const run = BenchmarkRunSchema.parse(parsed);
      
      metadata.push({
        id: run.id,
        timestamp: run.timestamp,
        brand: run.brand,
        intentLibraryVersion: run.intentLibraryVersion,
        metricsConfigVersion: run.metricsConfigVersion,
        summary: run.summary,
      });
    } catch {
      // Skip invalid files
    }
  }
  
  return metadata;
}

export function loadAllRuns(): BenchmarkRun[] {
  ensureDataDir();
  
  const files = readdirSync(DATA_DIR)
    .filter((f) => f.endsWith(".json"))
    .sort();
  
  const runs: BenchmarkRun[] = [];
  
  for (const file of files) {
    try {
      const filepath = join(DATA_DIR, file);
      const raw = readFileSync(filepath, "utf-8");
      const parsed = JSON.parse(raw);
      runs.push(BenchmarkRunSchema.parse(parsed));
    } catch {
      // Skip invalid files
    }
  }
  
  return runs;
}

export function getRunsForDateRange(startDate: string, endDate: string): BenchmarkRun[] {
  const allRuns = loadAllRuns();
  
  return allRuns.filter((run) => {
    const runDate = run.timestamp.split("T")[0];
    return runDate >= startDate && runDate <= endDate;
  });
}

export function getLatestRun(): BenchmarkRun | null {
  const metadata = listRunMetadata();
  if (metadata.length === 0) {
    return null;
  }
  
  return loadRun(metadata[0].id);
}

export function getRunsByIntentLibraryVersion(version: number): BenchmarkRun[] {
  const allRuns = loadAllRuns();
  return allRuns.filter((run) => run.intentLibraryVersion === version);
}

export function deleteRun(runId: string): boolean {
  ensureDataDir();

  const files = readdirSync(DATA_DIR).filter((f) => f.endsWith(".json"));
  const matchingFile = files.find((f) => f.includes(runId));

  if (!matchingFile) {
    return false;
  }

  const filepath = join(DATA_DIR, matchingFile);
  unlinkSync(filepath);
  return true;
}

export function createEmptyRun(
  brand: string,
  intentLibraryVersion: number,
  metricsConfigVersion: number
): BenchmarkRun {
  const id = generateRunId();
  
  return {
    id,
    timestamp: new Date().toISOString(),
    intentLibraryVersion,
    metricsConfigVersion,
    brand,
    summary: {
      overall: {
        recommendationRate: 0,
        discoveryRate: 0,
        avgSentiment: 0,
        avgWinRate: 0,
      },
    },
    cells: {},
  };
}

export { generateRunId, getRunFilename };
