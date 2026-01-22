/**
 * Run Aggregation Library
 *
 * Computes and stores pre-aggregated metrics from run results.
 * This enables fast queries without parsing large JSONB documents.
 *
 * Tables populated:
 * - run_metrics: Per (run, persona, stage, provider) metrics
 * - run_citations: Per (run, persona, stage, provider, domain) citation counts
 * - run_summary: Overall run metrics for quick dashboard loading
 */

import { sql } from "@/lib/db";
import { getActiveMatrixConfigCached, getCoreStageMapping } from "@/lib/matrix/runtime";
import type {
  BenchmarkRun,
  CellResult,
  Provider,
  QueryResult,
  ResponseResult,
} from "./types";
import type {
  ExploreExtraction,
  ConsiderExtraction,
  CompareExtraction,
  DecideExtraction,
  StageExtraction,
} from "@/lib/scoring/schemas";
import { parseCellKey } from "./utils";

// ============================================
// Type Definitions
// ============================================

export interface RunMetricRow {
  run_id: string;
  persona: string;
  stage_id: string;      // The actual stage ID from config
  core_stage: string;    // explore|consider|compare|decide for scoring
  provider: Provider;
  responses_count: number;
  mentions_count: number;
  mention_rate: number;
  sentiment_score?: number;
  win_rate?: number;
  recommendation_rate?: number;
  top3_rate?: number;
}

export interface RunCitationRow {
  run_id: string;
  persona: string;
  stage_id: string;      // The actual stage ID from config
  core_stage: string;    // explore|consider|compare|decide for scoring
  provider: Provider;
  domain: string;
  citation_count: number;
  sample_url?: string;
}

export interface RunSummaryRow {
  run_id: string;
  discovery_rate: number;
  avg_sentiment: number;
  avg_win_rate: number;
  recommendation_rate: number;
  brand: string;
  completed_at: Date | null;
}

export interface MetricFilters {
  persona?: string;
  stage?: string;
  provider?: Provider;
}

// ============================================
// Computation Functions
// ============================================

/**
 * Compute run_metrics rows from a benchmark run
 */
export async function computeRunMetrics(run: BenchmarkRun): Promise<RunMetricRow[]> {
  const cfg = await getActiveMatrixConfigCached();
  const metrics: RunMetricRow[] = [];

  for (const [cellKey, cell] of Object.entries(run.cells)) {
    const { persona, stage: stageId } = parseCellKey(cellKey);

    // Get core stage for scoring
    const coreStage = getCoreStageMapping(stageId, cfg);

    // Collect all responses by provider
    const providerResponses: Record<Provider, ResponseResult[]> = {
      openai: [],
      anthropic: [],
      gemini: [],
      xai: [],
    };

    for (const queryResult of cell.results) {
      for (const [provider, response] of Object.entries(queryResult.responses)) {
        providerResponses[provider as Provider].push({
          provider: provider as Provider,
          ...response,
        });
      }
    }

    // Compute metrics for each provider
    for (const [provider, responses] of Object.entries(providerResponses)) {
      if (responses.length === 0) continue;

      const metricRow = await computeMetricsForProvider(
        run.id,
        persona,
        stageId,
        coreStage,
        provider as Provider,
        responses
      );

      metrics.push(metricRow);
    }
  }

  return metrics;
}

/**
 * Compute metrics for a single (run, persona, stage, provider) combination
 */
async function computeMetricsForProvider(
  runId: string,
  persona: string,
  stageId: string,
  coreStage: string,
  provider: Provider,
  responses: ResponseResult[]
): Promise<RunMetricRow> {
  const totalResponses = responses.length;
  const mentioned = responses.filter((r) => r.score.mentioned === true);
  const mentionsCount = mentioned.length;
  const mentionRate = totalResponses > 0 ? mentionsCount / totalResponses : 0;

  const baseMetrics: RunMetricRow = {
    run_id: runId,
    persona,
    stage_id: stageId,      // Store actual stage ID
    core_stage: coreStage,    // Store core stage for scoring
    provider,
    responses_count: totalResponses,
    mentions_count: mentionsCount,
    mention_rate: mentionRate,
  };

  // Stage-specific metrics based on core stage
  if (coreStage === "explore") {
    const topThree = mentioned.filter((r) => {
      const extraction = r.score as ExploreExtraction;
      return extraction.inTopThree === true;
    });
    baseMetrics.top3_rate = mentionsCount > 0 ? topThree.length / mentionsCount : 0;
  } else if (coreStage === "consider") {
    const sentimentScores = mentioned.map((r) => {
      const extraction = r.score as ConsiderExtraction;
      return extraction.sentimentScore;
    });
    const avgSentiment =
      sentimentScores.length > 0
        ? sentimentScores.reduce((a, b) => a + b, 0) / sentimentScores.length
        : 0;
    baseMetrics.sentiment_score = avgSentiment;
  } else if (coreStage === "compare") {
    const extractions = mentioned.map((r) => r.score as CompareExtraction);
    const comparisons = extractions.filter((e) => e.outcome !== "not_compared");
    const wins = comparisons.filter((e) => e.outcome === "win");
    baseMetrics.win_rate = comparisons.length > 0 ? wins.length / comparisons.length : 0;
  } else if (coreStage === "decide") {
    const recommended = mentioned.filter((r) => {
      const extraction = r.score as DecideExtraction;
      return extraction.recommended === true;
    });
    baseMetrics.recommendation_rate =
      totalResponses > 0 ? recommended.length / totalResponses : 0;
  }

  return baseMetrics;
}

/**
 * Compute run_citations rows from a benchmark run
 */
export async function computeRunCitations(run: BenchmarkRun): Promise<RunCitationRow[]> {
  const cfg = await getActiveMatrixConfigCached();
  const citations: RunCitationRow[] = [];

  for (const [cellKey, cell] of Object.entries(run.cells)) {
    const { persona, stage: stageId } = parseCellKey(cellKey);
    const coreStage = getCoreStageMapping(stageId, cfg);

    // Group citations by (provider, domain)
    const citationGroups: Map<string, RunCitationRow> = new Map();

    for (const queryResult of cell.results) {
      for (const [provider, response] of Object.entries(queryResult.responses)) {
        if (!response.citations || response.citations.length === 0) continue;

        for (const citation of response.citations) {
          const key = `${provider}:${citation.domain}`;

          if (!citationGroups.has(key)) {
            citationGroups.set(key, {
              run_id: run.id,
              persona,
              stage_id: stageId,      // Actual stage ID
              core_stage: coreStage,    // Core stage for scoring
              provider: provider as Provider,
              domain: citation.domain,
              citation_count: 0,
              sample_url: citation.url,
            });
          }

          const group = citationGroups.get(key)!;
          group.citation_count++;
        }
      }
    }

    citations.push(...Array.from(citationGroups.values()));
  }

  return citations;
}

/**
 * Compute run_summary row from a benchmark run
 */
export function computeRunSummary(run: BenchmarkRun): RunSummaryRow {
  const summary = run.summary.overall;

  return {
    run_id: run.id,
    discovery_rate: summary.discoveryRate,
    avg_sentiment: summary.avgSentiment,
    avg_win_rate: summary.avgWinRate,
    recommendation_rate: summary.recommendationRate,
    brand: run.brand,
    completed_at: run.timestamp ? new Date(run.timestamp) : null,
  };
}

// ============================================
// Database Operations
// ============================================

/**
 * Save all aggregates for a run (metrics, citations, summary)
 */
export async function saveRunAggregates(run: BenchmarkRun): Promise<void> {
  const metrics = await computeRunMetrics(run);
  const citations = await computeRunCitations(run);
  const summary = computeRunSummary(run);

  // Use transaction for consistency
  await sql.begin(async (sql) => {
    // Upsert run_metrics
    for (const metric of metrics) {
      await sql`
        INSERT INTO run_metrics (
          run_id, persona, stage_id, core_stage, provider,
          responses_count, mentions_count, mention_rate,
          sentiment_score, win_rate, recommendation_rate, top3_rate
        )
        VALUES (
          ${metric.run_id}::uuid,
          ${metric.persona},
          ${metric.stage_id},
          ${metric.core_stage},
          ${metric.provider},
          ${metric.responses_count},
          ${metric.mentions_count},
          ${metric.mention_rate},
          ${metric.sentiment_score ?? null},
          ${metric.win_rate ?? null},
          ${metric.recommendation_rate ?? null},
          ${metric.top3_rate ?? null}
        )
        ON CONFLICT (run_id, persona, stage_id, provider)
        DO UPDATE SET
          responses_count = EXCLUDED.responses_count,
          mentions_count = EXCLUDED.mentions_count,
          mention_rate = EXCLUDED.mention_rate,
          sentiment_score = EXCLUDED.sentiment_score,
          win_rate = EXCLUDED.win_rate,
          recommendation_rate = EXCLUDED.recommendation_rate,
          top3_rate = EXCLUDED.top3_rate,
          updated_at = NOW()
      `;
    }

    // Upsert run_citations
    for (const citation of citations) {
      await sql`
        INSERT INTO run_citations (
          run_id, persona, stage_id, core_stage, provider, domain, citation_count, sample_url
        )
        VALUES (
          ${citation.run_id}::uuid,
          ${citation.persona},
          ${citation.stage_id},
          ${citation.core_stage},
          ${citation.provider},
          ${citation.domain},
          ${citation.citation_count},
          ${citation.sample_url ?? null}
        )
        ON CONFLICT (run_id, persona, stage_id, provider, domain)
        DO UPDATE SET
          citation_count = EXCLUDED.citation_count,
          sample_url = EXCLUDED.sample_url
      `;
    }

    // Upsert run_summary
    await sql`
      INSERT INTO run_summary (
        run_id, discovery_rate, avg_sentiment, avg_win_rate,
        recommendation_rate, brand, completed_at
      )
      VALUES (
        ${summary.run_id}::uuid,
        ${summary.discovery_rate},
        ${summary.avg_sentiment},
        ${summary.avg_win_rate},
        ${summary.recommendation_rate},
        ${summary.brand},
        ${summary.completed_at ?? null}
      )
      ON CONFLICT (run_id)
      DO UPDATE SET
        discovery_rate = EXCLUDED.discovery_rate,
        avg_sentiment = EXCLUDED.avg_sentiment,
        avg_win_rate = EXCLUDED.avg_win_rate,
        recommendation_rate = EXCLUDED.recommendation_rate,
        brand = EXCLUDED.brand,
        completed_at = EXCLUDED.completed_at,
        updated_at = NOW()
    `;
  });
}

/**
 * Refresh materialized view (call after saving new runs)
 */
export async function refreshRunMetadata(): Promise<void> {
  await sql`SELECT refresh_run_metadata_mv()`;
}

/**
 * Refresh summary for a specific run
 */
export async function refreshRunSummary(runId: string): Promise<void> {
  const rows = await sql`
    SELECT result_json FROM runs
    WHERE id = ${runId}::uuid AND result_json IS NOT NULL
    LIMIT 1
  `;

  if (rows.length === 0) return;

  const run = rows[0].result_json;
  const summary = {
    run_id: runId,
    discovery_rate: run.summary?.overall?.discoveryRate ?? 0,
    avg_sentiment: run.summary?.overall?.avgSentiment ?? 0,
    avg_win_rate: run.summary?.overall?.avgWinRate ?? 0,
    recommendation_rate: run.summary?.overall?.recommendationRate ?? 0,
    brand: run.brand ?? "",
    completed_at: run.timestamp ? new Date(run.timestamp) : null,
  };

  await sql`
    INSERT INTO run_summary (
      run_id, discovery_rate, avg_sentiment, avg_win_rate,
      recommendation_rate, brand, completed_at
    )
    VALUES (
      ${summary.run_id}::uuid,
      ${summary.discovery_rate},
      ${summary.avg_sentiment},
      ${summary.avg_win_rate},
      ${summary.recommendation_rate},
      ${summary.brand},
      ${summary.completed_at ?? null}
    )
    ON CONFLICT (run_id)
    DO UPDATE SET
      discovery_rate = EXCLUDED.discovery_rate,
      avg_sentiment = EXCLUDED.avg_sentiment,
      avg_win_rate = EXCLUDED.avg_win_rate,
      recommendation_rate = EXCLUDED.recommendation_rate,
      brand = EXCLUDED.brand,
      completed_at = EXCLUDED.completed_at,
      updated_at = NOW()
  `;
}

// ============================================
// Query Helpers (Optimized Access)
// ============================================

/**
 * Get metrics for a run with optional filters
 */
export async function getRunMetrics(
  runId: string,
  filters?: MetricFilters
): Promise<RunMetricRow[]> {
  // Build query with proper parameterization to prevent SQL injection
  const hasPersona = !!filters?.persona;
  const hasStage = !!filters?.stage;
  const hasProvider = !!filters?.provider;

  let rows;
  if (hasPersona && hasStage && hasProvider) {
    rows = await sql`
      SELECT * FROM run_metrics
      WHERE run_id = ${runId}::uuid
        AND persona = ${filters!.persona}
        AND stage = ${filters!.stage}
        AND provider = ${filters!.provider}
    `;
  } else if (hasPersona && hasStage) {
    rows = await sql`
      SELECT * FROM run_metrics
      WHERE run_id = ${runId}::uuid
        AND persona = ${filters!.persona}
        AND stage = ${filters!.stage}
    `;
  } else if (hasPersona && hasProvider) {
    rows = await sql`
      SELECT * FROM run_metrics
      WHERE run_id = ${runId}::uuid
        AND persona = ${filters!.persona}
        AND provider = ${filters!.provider}
    `;
  } else if (hasStage && hasProvider) {
    rows = await sql`
      SELECT * FROM run_metrics
      WHERE run_id = ${runId}::uuid
        AND stage = ${filters!.stage}
        AND provider = ${filters!.provider}
    `;
  } else if (hasPersona) {
    rows = await sql`
      SELECT * FROM run_metrics
      WHERE run_id = ${runId}::uuid AND persona = ${filters!.persona}
    `;
  } else if (hasStage) {
    rows = await sql`
      SELECT * FROM run_metrics
      WHERE run_id = ${runId}::uuid AND stage = ${filters!.stage}
    `;
  } else if (hasProvider) {
    rows = await sql`
      SELECT * FROM run_metrics
      WHERE run_id = ${runId}::uuid AND provider = ${filters!.provider}
    `;
  } else {
    rows = await sql`
      SELECT * FROM run_metrics WHERE run_id = ${runId}::uuid
    `;
  }
  return rows.map((row: any) => ({
    run_id: row.run_id,
    persona: row.persona,
    stage: row.stage,
    provider: row.provider,
    responses_count: row.responses_count,
    mentions_count: row.mentions_count,
    mention_rate: parseFloat(row.mention_rate),
    sentiment_score: row.sentiment_score ? parseFloat(row.sentiment_score) : undefined,
    win_rate: row.win_rate ? parseFloat(row.win_rate) : undefined,
    recommendation_rate: row.recommendation_rate ? parseFloat(row.recommendation_rate) : undefined,
    top3_rate: row.top3_rate ? parseFloat(row.top3_rate) : undefined,
  }));
}

/**
 * Get top cited domains for a run
 */
export async function getTopCitedDomains(
  runId: string,
  limit: number = 10,
  filters?: MetricFilters
): Promise<RunCitationRow[]> {
  // Build query with all filter combinations
  const conditions: string[] = ["run_id = $1"];
  const params: (string | number)[] = [runId];
  let paramIdx = 2;

  if (filters?.persona) {
    conditions.push(`persona = $${paramIdx}`);
    params.push(filters.persona);
    paramIdx++;
  }

  if (filters?.stage) {
    conditions.push(`stage = $${paramIdx}`);
    params.push(filters.stage);
    paramIdx++;
  }

  if (filters?.provider) {
    conditions.push(`provider = $${paramIdx}`);
    params.push(filters.provider);
    paramIdx++;
  }

  params.push(limit);

  const query = sql.unsafe(
    `SELECT domain, SUM(citation_count) as total_count, MAX(sample_url) as sample_url
     FROM run_citations
     WHERE ${conditions.join(" AND ")}
     GROUP BY domain
     ORDER BY total_count DESC
     LIMIT $${paramIdx}`,
    params
  );

  const rows = await query;
  return rows.map((row: any) => ({
    run_id: runId,
    persona: filters?.persona ?? "all",
    stage: filters?.stage ?? "all",
    provider: filters?.provider ?? ("all" as Provider),
    domain: row.domain,
    citation_count: parseInt(row.total_count),
    sample_url: row.sample_url,
  }));
}

/**
 * Get summary for a specific run
 */
export async function getRunSummary(runId: string): Promise<RunSummaryRow | null> {
  const rows = await sql`
    SELECT * FROM run_summary WHERE run_id = ${runId}::uuid
  `;

  if (rows.length === 0) return null;

  const row = rows[0];
  return {
    run_id: row.run_id,
    discovery_rate: parseFloat(row.discovery_rate),
    avg_sentiment: parseFloat(row.avg_sentiment),
    avg_win_rate: parseFloat(row.avg_win_rate),
    recommendation_rate: parseFloat(row.recommendation_rate),
    brand: row.brand,
    completed_at: row.completed_at,
  };
}

/**
 * Get run metadata for history listing (from materialized view)
 */
export async function getRunMetadataList(limit: number = 20): Promise<any[]> {
  const rows = await sql`
    SELECT * FROM run_metadata_mv
    ORDER BY timestamp DESC NULLS LAST, created_at DESC
    LIMIT ${limit}
  `;

  return rows.map((row: any) => ({
    id: row.id,
    timestamp: row.timestamp,
    brand: row.brand,
    intentLibraryVersion: row.intent_library_version,
    metricsConfigVersion: row.metrics_config_version,
    summary: row.summary,
    completed_at: row.completed_at,
    created_at: row.created_at,
  }));
}
