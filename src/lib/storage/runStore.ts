import { sql } from "@/lib/db";

export type CreateRunInput = {
  personaText: string;
  personaName?: string;
  triggerStage: "explore" | "consider" | "compare";
  queries: string[];
  config?: Record<string, unknown>;
};

export type CreateRunResult = {
  runId: string;
  personaId: string;
  queryIds: string[];
};

export async function createRunWithQueries(input: CreateRunInput): Promise<CreateRunResult> {
  const runConfig = {
    personaText: input.personaText,
    triggerStage: input.triggerStage,
    queries: input.queries,
    ...(input.config ?? {}),
  };

  const runRows = await sql<{ id: string }[]>`
    INSERT INTO runs (status, config_json, pending_count)
    VALUES ('queued', ${runConfig}, 0)
    RETURNING id;
  `;

  const runId = runRows[0]?.id;
  if (!runId) {
    throw new Error("Failed to create run");
  }

  const personaRows = await sql<{ id: string }[]>`
    INSERT INTO personas (run_id, name, text)
    VALUES (${runId}, ${input.personaName ?? null}, ${input.personaText})
    RETURNING id;
  `;

  const personaId = personaRows[0]?.id;
  if (!personaId) {
    throw new Error("Failed to create persona");
  }

  const queryRows = await Promise.all(
    input.queries.map((query) => sql<{ id: string }[]>`
      INSERT INTO queries (run_id, persona_id, trigger_stage, query_text)
      VALUES (${runId}, ${personaId}, ${input.triggerStage}, ${query})
      RETURNING id;
    `)
  );

  const queryIds = queryRows.map((rows) => rows[0]?.id).filter(Boolean) as string[];

  return { runId, personaId, queryIds };
}

export async function updateRunStatus(runId: string, status: string): Promise<void> {
  await sql`
    UPDATE runs
    SET status = ${status}
    WHERE id = ${runId};
  `;
}

export async function setRunPendingCount(runId: string, count: number): Promise<void> {
  await sql`
    UPDATE runs
    SET pending_count = ${count}
    WHERE id = ${runId};
  `;
}

export async function setRunExecutionConfig(runId: string, execution: Record<string, unknown>) {
  await sql`
    UPDATE runs
    SET config_json = jsonb_set(
      COALESCE(config_json, '{}'::jsonb),
      '{execution}',
      ${sql.json(execution)}::jsonb,
      true
    )
    WHERE id = ${runId};
  `;
}

export async function decrementRunPendingCount(runId: string): Promise<number> {
  const rows = await sql<{ pending_count: number }[]>`
    UPDATE runs
    SET pending_count = GREATEST(pending_count - 1, 0)
    WHERE id = ${runId}
    RETURNING pending_count;
  `;

  return rows[0]?.pending_count ?? 0;
}

export async function getRunSummary(runId: string) {
  const runRows = await sql`
    SELECT id, status, pending_count, config_json, created_at, started_at, completed_at
    FROM runs
    WHERE id = ${runId}
    LIMIT 1;
  `;

  const run = runRows[0];
  if (!run) return null;

  const queryRows = await sql`
    SELECT id, query_text
    FROM queries
    WHERE run_id = ${runId}
    ORDER BY id;
  `;

  const responseRows = await sql`
    SELECT query_id, provider, model, COUNT(*)::int AS count
    FROM responses
    WHERE run_id = ${runId}
    GROUP BY query_id, provider, model;
  `;

  const completedRows = await sql`
    SELECT COUNT(*)::int AS total
    FROM responses
    WHERE run_id = ${runId};
  `;

  const completedCalls = completedRows[0]?.total ?? 0;
  const execution = run.config_json?.execution ?? null;
  const totalCalls = execution?.totalCalls ?? null;

  return {
    run,
    queries: queryRows,
    responses: responseRows,
    progress: {
      completedCalls,
      totalCalls,
    },
  };
}
