import { sql } from "@/lib/db";
import { computeEntitySummary } from "@/lib/runs/aggregator";

type SqlClient = (strings: TemplateStringsArray, ...values: unknown[]) => Promise<unknown>;

type RecomputeDeps = {
  sqlClient?: SqlClient;
  computeSummary?: (runId: string) => Promise<void>;
};

export async function resolveKanbanRunId(sqlClient: SqlClient): Promise<string | null> {
  const latestWithSummary = await sqlClient`
    SELECT r.id::text FROM runs r
    WHERE EXISTS (
      SELECT 1 FROM run_entity_summary s WHERE s.run_id = r.id
    )
    ORDER BY COALESCE(r.completed_at, r.created_at) DESC
    LIMIT 1
  ` as Array<{ id: string }>;

  if (latestWithSummary.length > 0) {
    return (latestWithSummary[0] as { id: string }).id;
  }

  const latestWithCells = await sqlClient`
    SELECT id::text FROM runs
    WHERE result_json IS NOT NULL
      AND result_json ? 'cells'
      AND jsonb_typeof(result_json->'cells') = 'object'
      AND result_json->'cells' <> '{}'::jsonb
    ORDER BY created_at DESC
    LIMIT 1
  ` as Array<{ id: string }>;

  if (latestWithCells.length > 0) {
    return (latestWithCells[0] as { id: string }).id;
  }

  const latestCompleted = await sqlClient`
    SELECT id::text FROM runs
    WHERE status = 'completed'
    ORDER BY completed_at DESC NULLS LAST, created_at DESC
    LIMIT 1
  ` as Array<{ id: string }>;

  if (latestCompleted.length > 0) {
    return (latestCompleted[0] as { id: string }).id;
  }

  return null;
}

export async function recomputeKanbanSummary(
  args: { runId?: string } & RecomputeDeps = {}
): Promise<string | null> {
  const sqlClient = args.sqlClient ?? sql;
  const computeSummary = args.computeSummary ?? computeEntitySummary;

  const resolvedRunId = args.runId ?? (await resolveKanbanRunId(sqlClient));
  if (!resolvedRunId) return null;

  await sqlClient`
    DELETE FROM run_entity_summary
    WHERE run_id = ${resolvedRunId}::uuid
  `;

  await computeSummary(resolvedRunId);
  return resolvedRunId;
}
