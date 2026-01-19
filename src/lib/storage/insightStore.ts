import { sql, query } from "@/lib/db";

export async function upsertInsight(runId: string, narrative: string, charts: unknown) {
  const chartsJson = JSON.parse(JSON.stringify(charts ?? null));
  await sql`
    INSERT INTO insights (run_id, narrative_text, charts_json)
    VALUES (${runId}, ${narrative}, ${sql.json(chartsJson)})
    ON CONFLICT (run_id)
    DO UPDATE SET narrative_text = EXCLUDED.narrative_text,
                  charts_json = EXCLUDED.charts_json,
                  created_at = NOW();
  `;
}

export async function getInsight(runId: string) {
  const rows = await sql`
    SELECT run_id, narrative_text, charts_json, created_at
    FROM insights
    WHERE run_id = ${runId}
    LIMIT 1;
  `;

  return rows[0] ?? null;
}

export type AnalysisVariant = {
  key: string;
  model: string;
  thinkingLevel: string;
  analysisKind: "consultant" | "hypothesis";
  analysis: Record<string, unknown>;
  thought_summaries: string[];
};

/**
 * Save all analysis variants for a run
 */
export async function saveAnalyses(runId: string, analyses: AnalysisVariant[]) {
  for (const variant of analyses) {
    const analysisJson = JSON.parse(JSON.stringify(variant.analysis));
    const thoughtsJson = JSON.parse(JSON.stringify(variant.thought_summaries ?? []));

    await sql`
      INSERT INTO analyses (run_id, variant_key, model, thinking_level, analysis_kind, analysis_json, thought_summaries)
      VALUES (
        ${runId},
        ${variant.key},
        ${variant.model},
        ${variant.thinkingLevel},
        ${variant.analysisKind},
        ${sql.json(analysisJson)},
        ${sql.json(thoughtsJson)}
      )
      ON CONFLICT (run_id, variant_key)
      DO UPDATE SET
        model = EXCLUDED.model,
        thinking_level = EXCLUDED.thinking_level,
        analysis_kind = EXCLUDED.analysis_kind,
        analysis_json = EXCLUDED.analysis_json,
        thought_summaries = EXCLUDED.thought_summaries,
        created_at = NOW();
    `;
  }
}

type AnalysisRow = {
  id: string;
  run_id: string;
  variant_key: string;
  model: string;
  thinking_level: string | null;
  analysis_kind: string;
  analysis_json: Record<string, unknown>;
  thought_summaries: string[] | null;
  created_at: string;
};

/**
 * Retrieve all analysis variants for a run
 */
export async function getAnalyses(runId: string): Promise<AnalysisVariant[]> {
  const rows = await query<AnalysisRow>`
    SELECT id, run_id, variant_key, model, thinking_level, analysis_kind, analysis_json, thought_summaries, created_at
    FROM analyses
    WHERE run_id = ${runId}
    ORDER BY created_at ASC;
  `;

  return rows.map((row) => ({
    key: row.variant_key,
    model: row.model,
    thinkingLevel: row.thinking_level ?? "medium",
    analysisKind: row.analysis_kind as "consultant" | "hypothesis",
    analysis: row.analysis_json,
    thought_summaries: row.thought_summaries ?? [],
  }));
}
