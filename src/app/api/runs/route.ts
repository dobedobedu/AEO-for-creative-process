import { sql } from "@/lib/db";

export async function GET() {
  const rows = await sql`
    SELECT
      r.id,
      r.status,
      r.pending_count,
      r.created_at,
      r.started_at,
      r.completed_at,
      r.config_json,
      (SELECT COUNT(*)::int FROM queries q WHERE q.run_id = r.id) AS query_count,
      (SELECT COUNT(*)::int FROM responses rs WHERE rs.run_id = r.id) AS response_count,
      (SELECT COUNT(*)::int FROM insights i WHERE i.run_id = r.id) AS insight_count
    FROM runs r
    ORDER BY r.created_at DESC
    LIMIT 30;
  `;

  return Response.json({ runs: rows });
}
