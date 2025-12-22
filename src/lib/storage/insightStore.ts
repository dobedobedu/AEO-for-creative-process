import { sql } from "@/lib/db";

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
