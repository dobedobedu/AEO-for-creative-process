/**
 * Import Historical Runs Script
 *
 * Imports benchmark runs from:
 * 1. Local JSON files in /data/runs/
 * 2. Gemini extraction logs (JSONL) - reconstructs partial runs
 *
 * Usage:
 *   npx tsx scripts/import-historical-runs.ts
 *   npx tsx scripts/import-historical-runs.ts --gemini-file /path/to/file.jsonl
 */

import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import * as fs from "fs";
import * as path from "path";
import { sql } from "../src/lib/db";
import { BenchmarkRunSchema, type BenchmarkRun, type CellResult } from "../src/lib/runs/types";
import { saveRunAggregates, refreshRunMetadata } from "../src/lib/runs/aggregator";
import type { Stage, Persona } from "../src/lib/intents/types";
import type { StageExtraction } from "../src/lib/scoring/schemas";

const DATA_RUNS_DIR = path.join(process.cwd(), "data", "runs");

// UUID validation regex
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidUuid(id: string): boolean {
  return UUID_REGEX.test(id);
}

// ============================================
// Local JSON Import
// ============================================

async function importLocalJsonRuns(): Promise<{ imported: number; skipped: number; errors: string[] }> {
  console.log("\n📁 Importing local JSON run files...");

  const files = fs.readdirSync(DATA_RUNS_DIR).filter((f) => f.endsWith(".json") && f !== "run-id-map.json");
  console.log(`Found ${files.length} JSON files`);

  let imported = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const file of files) {
    const filePath = path.join(DATA_RUNS_DIR, file);

    try {
      const content = fs.readFileSync(filePath, "utf-8");
      const data = JSON.parse(content);

      // Skip strict schema validation for legacy runs - just check basic structure
      if (!data.id || !data.cells || typeof data.cells !== "object") {
        throw new Error("Missing required fields: id, cells");
      }

      // Use data as-is (legacy format may have different extraction schemas)
      const run = data as BenchmarkRun;

      // Convert legacy IDs to proper UUIDs if needed
      if (!isValidUuid(run.id)) {
        const newId = generateDeterministicId(`legacy-${run.id}`);
        console.log(`  🔄 Converting ID ${run.id} → ${newId}`);
        run.id = newId;
      }

      // Check if run already exists
      const existing = await sql`SELECT id FROM runs WHERE id = ${run.id}::uuid`;
      if (existing.length > 0) {
        console.log(`  ⏭️  Skipping ${file} - already exists`);
        skipped++;
        continue;
      }

      // Ensure timestamp exists (use file date if missing)
      if (!run.timestamp) {
        const dateMatch = file.match(/^(\d{4}-\d{2}-\d{2})/);
        run.timestamp = dateMatch ? `${dateMatch[1]}T05:00:00.000Z` : new Date().toISOString();
      }

      // Calculate summary if missing
      if (!run.summary || !run.summary.overall) {
        try {
          run.summary = calculateRunSummary(run);
        } catch {
          run.summary = { overall: { discoveryRate: 0, avgSentiment: 0, avgWinRate: 0, recommendationRate: 0 } };
        }
      }

      // Insert run
      await sql`
        INSERT INTO runs (id, status, config_json, result_json, pending_count, completed_at, created_at)
        VALUES (
          ${run.id}::uuid,
          'completed',
          ${sql.json({ brand: run.brand || "Lakewood Ranch" })},
          ${sql.json(run)},
          0,
          ${run.timestamp ? new Date(run.timestamp) : null},
          ${run.timestamp ? new Date(run.timestamp) : new Date()}
        )
        ON CONFLICT (id) DO UPDATE SET
          result_json = EXCLUDED.result_json,
          completed_at = EXCLUDED.completed_at,
          status = 'completed'
      `;

      // Populate aggregation tables (may fail for legacy data - that's ok)
      try {
        await saveRunAggregates(run);
      } catch (aggErr) {
        console.log(`  ⚠️  Aggregation skipped for ${file}: ${aggErr instanceof Error ? aggErr.message : aggErr}`);
      }

      console.log(`  ✅ Imported ${file} (${Object.keys(run.cells).length} cells)`);
      imported++;
    } catch (err) {
      const msg = `Error importing ${file}: ${err instanceof Error ? err.message : err}`;
      console.error(`  ❌ ${msg}`);
      errors.push(msg);
    }
  }

  return { imported, skipped, errors };
}

// ============================================
// Gemini JSONL Import (Extraction Logs)
// ============================================

interface GeminiLogRecord {
  createTime: string;
  turnId: string;
  request: {
    contents: Array<{
      parts: Array<{ text: string }>;
    }>;
  };
  response: Array<{
    candidates: Array<{
      content: {
        parts: Array<{ text: string }>;
      };
    }>;
  }>;
}

interface ExtractedQuery {
  date: string;
  timestamp: string;
  stage: Stage;
  query: string;
  provider: string;
  responseText: string;
  extraction: StageExtraction | null;
}

function parseGeminiLog(record: GeminiLogRecord): ExtractedQuery | null {
  try {
    const promptText = record.request?.contents?.[0]?.parts?.[0]?.text || "";

    // Only process scoring extraction prompts
    if (!promptText.includes('Brand to analyze:')) {
      return null;
    }

    // Extract stage
    let stage: Stage | null = null;
    if (promptText.includes("EXPLORE stage")) stage = "explore";
    else if (promptText.includes("CONSIDER stage")) stage = "consider";
    else if (promptText.includes("COMPARE stage")) stage = "compare";
    else if (promptText.includes("DECIDE stage")) stage = "decide";

    if (!stage) return null;

    // Extract query
    const queryMatch = promptText.match(/Original query: "([^"]+)"/);
    const query = queryMatch?.[1] || "";
    if (!query) return null;

    // Extract provider
    const providerMatch = promptText.match(/AI Response \(from (\w+)\):/);
    const provider = providerMatch?.[1] || "";
    if (!["openai", "anthropic", "gemini", "xai"].includes(provider)) return null;

    // Extract response text
    const responseMatch = promptText.match(/AI Response \(from \w+\):\n"""\n([\s\S]*?)(?:\n"""|\n\nReturn your analysis)/);
    const responseText = responseMatch?.[1]?.trim() || "";

    // Extract the extraction result
    let extraction: StageExtraction | null = null;
    try {
      const extractionText = record.response?.[0]?.candidates?.[0]?.content?.parts?.[0]?.text || "";
      extraction = JSON.parse(extractionText);
    } catch {
      // Extraction failed, continue without it
    }

    const date = record.createTime.split("T")[0];

    return {
      date,
      timestamp: record.createTime,
      stage,
      query,
      provider,
      responseText,
      extraction,
    };
  } catch {
    return null;
  }
}

async function importGeminiLogs(filePath: string): Promise<{ runsCreated: number; recordsProcessed: number }> {
  console.log(`\n📊 Processing Gemini extraction logs from ${filePath}...`);

  if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
    return { runsCreated: 0, recordsProcessed: 0 };
  }

  const content = fs.readFileSync(filePath, "utf-8");
  const lines = content.trim().split("\n");
  console.log(`Found ${lines.length} records`);

  // Parse all records
  const extractedQueries: ExtractedQuery[] = [];
  for (const line of lines) {
    try {
      const record = JSON.parse(line) as GeminiLogRecord;
      const extracted = parseGeminiLog(record);
      if (extracted) {
        extractedQueries.push(extracted);
      }
    } catch {
      // Skip malformed lines
    }
  }

  console.log(`Parsed ${extractedQueries.length} extraction records`);

  // Group by date
  const byDate = new Map<string, ExtractedQuery[]>();
  for (const eq of extractedQueries) {
    if (!byDate.has(eq.date)) {
      byDate.set(eq.date, []);
    }
    byDate.get(eq.date)!.push(eq);
  }

  console.log(`Found data for ${byDate.size} dates`);

  // Check which dates already have runs
  const existingRuns = await sql`
    SELECT DISTINCT DATE(completed_at) as run_date
    FROM runs
    WHERE result_json IS NOT NULL
  `;
  const existingDates = new Set(existingRuns.map((r: { run_date: string }) => r.run_date));

  let runsCreated = 0;

  // Create partial runs for dates without existing data
  for (const [date, queries] of byDate) {
    if (existingDates.has(date)) {
      console.log(`  ⏭️  Skipping ${date} - already has run data`);
      continue;
    }

    // Group queries by (stage, query) to form cells
    // Note: We don't have persona info, so we'll create a simplified structure
    const cells = reconstructCells(queries);

    if (Object.keys(cells).length === 0) {
      console.log(`  ⚠️  Skipping ${date} - no valid cells reconstructed`);
      continue;
    }

    // Create run
    const runId = generateDeterministicId(`gemini-import-${date}`);
    const run: BenchmarkRun = {
      id: runId,
      timestamp: `${date}T05:00:00.000Z`,
      brand: "Lakewood Ranch",
      intentLibraryVersion: 1,
      metricsConfigVersion: 1,
      cells,
      summary: { overall: { discoveryRate: 0, avgSentiment: 0, avgWinRate: 0, recommendationRate: 0 } },
    };

    // Calculate actual summary
    run.summary = calculateRunSummary(run);

    // Check if this run ID already exists
    const existing = await sql`SELECT id FROM runs WHERE id = ${runId}::uuid`;
    if (existing.length > 0) {
      console.log(`  ⏭️  Skipping ${date} - run already imported`);
      continue;
    }

    // Insert run
    await sql`
      INSERT INTO runs (id, status, config_json, result_json, pending_count, completed_at, created_at)
      VALUES (
        ${runId}::uuid,
        'completed',
        ${sql.json({ brand: run.brand })},
        ${sql.json(run)},
        0,
        ${new Date(`${date}T05:00:00.000Z`)},
        ${new Date(`${date}T05:00:00.000Z`)}
      )
    `;

    // Populate aggregation tables (may fail for partial data)
    try {
      await saveRunAggregates(run);
    } catch (aggErr) {
      console.log(`  ⚠️  Aggregation skipped for ${date}: ${aggErr instanceof Error ? aggErr.message : aggErr}`);
    }

    console.log(`  ✅ Created partial run for ${date} (${Object.keys(cells).length} cells)`);
    runsCreated++;
  }

  return { runsCreated, recordsProcessed: extractedQueries.length };
}

// Query keywords to persona mapping (based on stable intent patterns)
const PERSONA_KEYWORDS: Record<Persona, string[]> = {
  "first_time": ["first-time", "first time", "affordable", "budget", "starter", "entry-level", "fha", "down payment"],
  "move_up": ["family", "families", "schools", "growing", "kids", "children", "remote work", "millennial", "trading up"],
  "retiree": ["retire", "55+", "active adult", "senior", "downsiz", "pension", "social security", "medicare"],
  "luxury": ["luxury", "affluent", "premium", "high-end", "country club", "golf", "waterfront", "exclusive", "upscale"],
};

function inferPersonaFromQuery(query: string): Persona {
  const lower = query.toLowerCase();

  // Check each persona's keywords
  for (const [persona, keywords] of Object.entries(PERSONA_KEYWORDS)) {
    for (const kw of keywords) {
      if (lower.includes(kw)) {
        return persona as Persona;
      }
    }
  }

  // Default fallback based on common patterns
  if (lower.includes("retire") || lower.includes("55")) return "retiree";
  if (lower.includes("family") || lower.includes("school")) return "move_up";
  if (lower.includes("invest") || lower.includes("rental")) return "luxury";

  return "first_time"; // Default
}

function reconstructCells(queries: ExtractedQuery[]): Record<string, CellResult> {
  const cells: Record<string, CellResult> = {};

  // Group by (inferred persona, stage) for proper cell assignment
  const byPersonaStage = new Map<string, ExtractedQuery[]>();
  for (const q of queries) {
    const persona = inferPersonaFromQuery(q.query);
    const key = `${persona}_${q.stage}`;
    if (!byPersonaStage.has(key)) {
      byPersonaStage.set(key, []);
    }
    byPersonaStage.get(key)!.push(q);
  }

  // Process each (persona, stage) cell
  for (const [cellKey, cellQueries] of byPersonaStage) {
    const [persona, stage] = cellKey.split("_") as [Persona, Stage];

    // Group by query text within this cell
    const byQuery = new Map<string, ExtractedQuery[]>();
    for (const q of cellQueries) {
      if (!byQuery.has(q.query)) {
        byQuery.set(q.query, []);
      }
      byQuery.get(q.query)!.push(q);
    }

    // Take first 3 queries max (standard is 3 per intent)
    const queryGroups = Array.from(byQuery.entries()).slice(0, 3);
    if (queryGroups.length === 0) continue;

    // Build query results
    const results: CellResult["results"] = queryGroups.map(([queryText, responses]) => {
      const responseMap: Record<string, {
        model: string;
        responseText: string;
        score: StageExtraction;
      }> = {};

      for (const resp of responses) {
        if (resp.extraction) {
          responseMap[resp.provider] = {
            model: getModelForProvider(resp.provider),
            responseText: resp.responseText,
            score: resp.extraction,
          };
        }
      }

      return {
        query: queryText,
        intentId: `imported-${persona}-${stage}`,
        responses: responseMap,
      };
    });

    cells[cellKey] = {
      intentId: `imported-${persona}-${stage}`,
      intentText: `Imported ${stage} intent for ${persona}`,
      queriesUsed: queryGroups.map(([q]) => q),
      metrics: calculateCellMetrics(stage, results),
      results,
    };
  }

  return cells;
}

function getModelForProvider(provider: string): string {
  const models: Record<string, string> = {
    openai: "gpt-5.2",
    anthropic: "claude-haiku-4.5",
    gemini: "gemini-3-flash",
    xai: "grok-4",
  };
  return models[provider] || provider;
}

function calculateCellMetrics(stage: Stage, results: CellResult["results"]): CellResult["metrics"] {
  const metrics: CellResult["metrics"] = {};

  const allExtractions = results
    .flatMap((r) => Object.values(r.responses))
    .map((r) => r.score)
    .filter((s): s is StageExtraction => Boolean(s));

  if (allExtractions.length === 0) return metrics;

  const mentioned = allExtractions.filter((e) => e.mentioned);
  const mentionRate = mentioned.length / allExtractions.length;

  if (stage === "explore") {
    metrics.discoveryRate = mentionRate;
    const topThree = mentioned.filter((e) => (e as any).inTopThree);
    metrics.topThreeRate = mentioned.length > 0 ? topThree.length / mentioned.length : 0;
  } else if (stage === "consider") {
    const sentiments = mentioned.map((e) => (e as any).sentimentScore || 0);
    metrics.sentimentScore = sentiments.length > 0
      ? sentiments.reduce((a, b) => a + b, 0) / sentiments.length
      : 0;
  } else if (stage === "compare") {
    const outcomes = mentioned.map((e) => (e as any).outcome);
    const compared = outcomes.filter((o) => o !== "not_compared");
    const wins = compared.filter((o) => o === "win");
    metrics.winRate = compared.length > 0 ? wins.length / compared.length : 0;
  } else if (stage === "decide") {
    const recommended = mentioned.filter((e) => (e as any).recommended);
    metrics.recommendationRate = allExtractions.length > 0
      ? recommended.length / allExtractions.length
      : 0;
  }

  return metrics;
}

function calculateRunSummary(run: BenchmarkRun): BenchmarkRun["summary"] {
  let totalDiscovery = 0, discoveryCount = 0;
  let totalSentiment = 0, sentimentCount = 0;
  let totalWinRate = 0, winRateCount = 0;
  let totalRecommendation = 0, recommendationCount = 0;

  for (const [cellKey, cell] of Object.entries(run.cells)) {
    const stage = cellKey.split("_")[1] as Stage;

    if (stage === "explore" && cell.metrics?.discoveryRate !== undefined) {
      totalDiscovery += cell.metrics.discoveryRate;
      discoveryCount++;
    }
    if (stage === "consider" && cell.metrics?.sentimentScore !== undefined) {
      totalSentiment += cell.metrics.sentimentScore;
      sentimentCount++;
    }
    if (stage === "compare" && cell.metrics?.winRate !== undefined) {
      totalWinRate += cell.metrics.winRate;
      winRateCount++;
    }
    if (stage === "decide" && cell.metrics?.recommendationRate !== undefined) {
      totalRecommendation += cell.metrics.recommendationRate;
      recommendationCount++;
    }
  }

  return {
    overall: {
      discoveryRate: discoveryCount > 0 ? totalDiscovery / discoveryCount : 0,
      avgSentiment: sentimentCount > 0 ? totalSentiment / sentimentCount : 0,
      avgWinRate: winRateCount > 0 ? totalWinRate / winRateCount : 0,
      recommendationRate: recommendationCount > 0 ? totalRecommendation / recommendationCount : 0,
    },
  };
}

function generateDeterministicId(seed: string): string {
  // Simple hash-based UUID generation for deterministic IDs
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    const char = seed.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }

  const hex = Math.abs(hash).toString(16).padStart(8, "0");
  return `${hex.slice(0, 8)}-${hex.slice(0, 4)}-4${hex.slice(1, 4)}-8${hex.slice(0, 3)}-${hex.slice(0, 12).padEnd(12, "0")}`;
}

// ============================================
// Main
// ============================================

async function main() {
  console.log("🚀 Historical Runs Import Script\n");
  console.log("=".repeat(50));

  // Parse args
  const args = process.argv.slice(2);
  const geminiFileIndex = args.indexOf("--gemini-file");
  const geminiFile = geminiFileIndex !== -1 ? args[geminiFileIndex + 1] : null;

  // Step 1: Import local JSON files
  const localResult = await importLocalJsonRuns();
  console.log(`\n📊 Local import: ${localResult.imported} imported, ${localResult.skipped} skipped`);
  if (localResult.errors.length > 0) {
    console.log(`   Errors: ${localResult.errors.length}`);
  }

  // Step 2: Import from Gemini logs if provided
  if (geminiFile) {
    const geminiResult = await importGeminiLogs(geminiFile);
    console.log(`\n📊 Gemini import: ${geminiResult.runsCreated} runs created from ${geminiResult.recordsProcessed} records`);
  }

  // Step 3: Refresh materialized view
  console.log("\n🔄 Refreshing materialized view...");
  await refreshRunMetadata();

  // Summary
  console.log("\n" + "=".repeat(50));
  console.log("✅ Import complete!");

  // Show what's now in the database
  const runCount = await sql`SELECT COUNT(*) as count FROM runs WHERE result_json IS NOT NULL`;
  console.log(`\n📈 Total runs in database: ${runCount[0].count}`);

  await sql.end();
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
