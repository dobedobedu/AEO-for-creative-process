/**
 * Backfill xAI responses for historical runs.
 *
 * Usage:
 *   npx tsx scripts/backfill-xai.ts --start 2026-01-24 --end 2026-01-26
 *   npx tsx scripts/backfill-xai.ts --start 2026-01-24 --end 2026-01-26 --apply
 */

import { config } from "dotenv";
config({ path: ".env.local" });

if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY && process.env.GEMINI_API_KEY) {
  process.env.GOOGLE_GENERATIVE_AI_API_KEY = process.env.GEMINI_API_KEY;
}

import { callXaiSearch, type XaiSearchMode } from "../src/lib/providers/xai";
import { parseXaiResponse } from "../src/lib/ingest/xaiIngest";
import { extractStageMetrics, calculateExploreMetrics, calculateConsiderMetrics, calculateCompareMetrics, calculateDecideMetrics } from "../src/lib/scoring/extractor";
import { emptyExtraction, parseCellKey, calculateRunSummary } from "../src/lib/runs/utils";
import { getRunsForDateRange, saveRun } from "../src/lib/runs/storage";
import { saveRunAggregates } from "../src/lib/runs/aggregator";
import { extractDomain } from "../src/lib/parsers/utils";
import type { Citation } from "../src/lib/parsers/types";
import type { BenchmarkRun, CellResult } from "../src/lib/runs/types";
import type { StageExtraction } from "../src/lib/scoring/schemas";

const DEFAULT_XAI_MODEL = "grok-4-1-fast-reasoning";
const DEFAULT_XAI_SEARCH_MODE: XaiSearchMode =
  process.env.XAI_SEARCH_MODE === "web_search" ? "web_search" : "x_search";
const DEFAULT_BRAND = "Brand";
const DEFAULT_ALIASES: string[] = [];

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function callXaiWithRetry(
  params: { model: string; query: string; searchMode: XaiSearchMode },
  attempts = 3
) {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await callXaiSearch(params);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`[backfill] xAI call failed (${attempt}/${attempts}): ${message}`);
      if (attempt === attempts) {
        return null;
      }
      await sleep(1000 * attempt);
    }
  }
  return null;
}

function getArg(flag: string): string | undefined {
  const idx = process.argv.indexOf(flag);
  if (idx === -1) return undefined;
  return process.argv[idx + 1];
}

function hasFlag(flag: string): boolean {
  return process.argv.includes(flag);
}

function normalizeDate(input: string | undefined, fallback: string): string {
  if (!input) return fallback;
  return input;
}

function toStoredCitations(citations: Citation[]) {
  return citations.map((citation) => ({
    url: citation.url,
    domain: citation.domain || extractDomain(citation.url),
    sourceType: citation.sourceType ?? ("url_citation" as const),
  }));
}

function recalculateCellMetrics(cell: CellResult, stage: string) {
  const allExtractions: StageExtraction[] = [];
  for (const qr of cell.results) {
    for (const response of Object.values(qr.responses)) {
      if (response.score) {
        allExtractions.push(response.score as StageExtraction);
      }
    }
  }

  const relevantExtractions = allExtractions.filter((e) => e.responseRelevant);
  const extractionsForMetrics = relevantExtractions.length > 0 ? relevantExtractions : allExtractions;

  if (stage === "explore") {
    const { discoveryRate, topThreeRate } = calculateExploreMetrics(extractionsForMetrics as any);
    cell.metrics.discoveryRate = discoveryRate;
    cell.metrics.topThreeRate = topThreeRate;
  } else if (stage === "consider") {
    const { avgSentiment } = calculateConsiderMetrics(extractionsForMetrics as any);
    cell.metrics.sentimentScore = avgSentiment;
  } else if (stage === "compare") {
    const { winRate } = calculateCompareMetrics(extractionsForMetrics as any);
    cell.metrics.winRate = winRate;
  } else if (stage === "decide") {
    const { recommendationRate } = calculateDecideMetrics(extractionsForMetrics as any);
    cell.metrics.recommendationRate = recommendationRate;
  }
}

async function backfillRun(run: BenchmarkRun, apply: boolean, limit: number | null) {
  let updatedResponses = 0;
  let totalXaiResponses = 0;
  let missingXaiResponses = 0;

  for (const [cellKey, cell] of Object.entries(run.cells)) {
    const { stage } = parseCellKey(cellKey);
    let cellUpdated = false;

    for (const qr of cell.results) {
      const xaiResponse = qr.responses.xai;
      if (!xaiResponse) continue;

      totalXaiResponses++;
      if (xaiResponse.responseText && xaiResponse.responseText.trim().length > 0) {
        continue;
      }

      missingXaiResponses++;
      if (!apply) continue;

      if (limit !== null && updatedResponses >= limit) {
        break;
      }

      const model = xaiResponse.model || process.env.XAI_MODEL || DEFAULT_XAI_MODEL;
      const query = qr.query;

      const raw = await callXaiWithRetry({ model, query, searchMode: DEFAULT_XAI_SEARCH_MODE });
      if (!raw) {
        console.warn(`[backfill] Giving up on xAI response for query: ${query}`);
        continue;
      }
      const parsed = parseXaiResponse(raw);

      if (!parsed.text || parsed.text.trim().length === 0) {
        console.warn(`[backfill] Empty xAI response for query: ${query}`);
        continue;
      }

      const brand = run.brand || DEFAULT_BRAND;
      const scoreResult = await extractStageMetrics({
        stage,
        query,
        responseText: parsed.text,
        provider: "xai",
        brand,
        brandTerms: DEFAULT_ALIASES,
      });

      xaiResponse.responseText = parsed.text;
      xaiResponse.citations = toStoredCitations(parsed.citations);
      xaiResponse.score = scoreResult.success && scoreResult.extraction
        ? scoreResult.extraction
        : emptyExtraction(stage);

      updatedResponses++;
      cellUpdated = true;
    }

    if (cellUpdated) {
      recalculateCellMetrics(cell, stage);
    }

    if (limit !== null && updatedResponses >= limit) {
      break;
    }
  }

  return { updatedResponses, totalXaiResponses, missingXaiResponses };
}

async function main() {
  const start = normalizeDate(getArg("--start"), "2026-01-24");
  const end = normalizeDate(getArg("--end"), "2026-01-26");
  const apply = hasFlag("--apply");
  const limitArg = getArg("--limit");
  const limit = limitArg ? Number(limitArg) : null;

  console.log(`\n[xai-backfill] Range: ${start} → ${end}`);
  console.log(`[xai-backfill] Mode: ${apply ? "APPLY" : "REPORT ONLY"}`);
  if (limit !== null) {
    console.log(`[xai-backfill] Limit: ${limit} responses`);
  }

  const runs = await getRunsForDateRange(start, end);
  if (runs.length === 0) {
    console.log("[xai-backfill] No runs found in date range.");
    return;
  }

  const dateSummary = new Map<string, { total: number; missing: number; runs: number }>();
  let totalUpdated = 0;
  let totalMissing = 0;
  let totalResponses = 0;
  let lastDateWithData = "";

  for (const run of runs) {
    const date = run.timestamp.slice(0, 10);
    const summary = dateSummary.get(date) ?? { total: 0, missing: 0, runs: 0 };
    summary.runs += 1;

    const result = await backfillRun(run, apply, limit);

    summary.total += result.totalXaiResponses;
    summary.missing += result.missingXaiResponses;

    totalResponses += result.totalXaiResponses;
    totalMissing += result.missingXaiResponses;
    totalUpdated += result.updatedResponses;

    if (result.totalXaiResponses - result.missingXaiResponses > 0) {
      lastDateWithData = date;
    }

    console.log(
      `[xai-backfill] Run ${run.id} (${date}) missing ${result.missingXaiResponses}/${result.totalXaiResponses}`
    );

    if (apply && result.updatedResponses > 0) {
      const summaryUpdate = calculateRunSummary(run.cells);
      run.summary = { ...run.summary, overall: summaryUpdate.overall };
      await saveRun(run);
      await saveRunAggregates(run);
      console.log(`[xai-backfill] Updated run ${run.id} (responses: ${result.updatedResponses})`);
    }

    if (limit !== null && totalUpdated >= limit) {
      console.log(`[xai-backfill] Limit reached after ${totalUpdated} updates.`);
      break;
    }
  }

  console.log("\n[xai-backfill] Date summary:");
  for (const [date, summary] of [...dateSummary.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    console.log(
      `  ${date}: runs=${summary.runs}, xai=${summary.total}, missing=${summary.missing}`
    );
  }

  console.log(`\n[xai-backfill] Total xAI responses: ${totalResponses}`);
  console.log(`[xai-backfill] Missing xAI responses: ${totalMissing}`);
  if (apply) {
    console.log(`[xai-backfill] Updated responses: ${totalUpdated}`);
  }
  if (lastDateWithData) {
    console.log(`[xai-backfill] Last date with non-empty xAI responses: ${lastDateWithData}`);
  }
}

main().catch((err) => {
  console.error("[xai-backfill] Fatal error:", err instanceof Error ? err.message : err);
  process.exit(1);
});
