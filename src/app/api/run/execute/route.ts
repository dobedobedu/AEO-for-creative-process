import { z } from "zod";
import { query, sql } from "@/lib/db";
import { callOpenAIWebSearch } from "@/lib/providers/openai";
import { callGeminiWebSearch } from "@/lib/providers/gemini";
import { ingestOpenAIResponse } from "@/lib/ingest/openaiIngest";
import { ingestGeminiResponse } from "@/lib/ingest/geminiIngest";
import {
  decrementRunPendingCount,
  getRunSummary,
  setRunExecutionConfig,
  setRunPendingCount,
  updateRunStatus,
} from "@/lib/storage/runStore";
import { getDefaultSearchModels, type SearchModelConfig } from "@/lib/models/searchModels";

const RequestSchema = z.object({
  runId: z.string().uuid(),
  models: z
    .array(
      z.object({
        provider: z.enum(["openai", "gemini"]),
        model: z.string().min(1),
      })
    )
    .optional(),
  mode: z.enum(["server", "client"]).optional(),
});

export async function POST(req: Request) {
  const payload = await req.json();
  const data = RequestSchema.parse(payload);

  const run = await sql`SELECT id FROM runs WHERE id = ${data.runId} LIMIT 1` as Array<{ id: string }>;
  if (run.length === 0) {
    return Response.json({ error: "Run not found" }, { status: 404 });
  }

  const queries = await query<
    { id: string; query_text: string }
  >`SELECT id, query_text FROM queries WHERE run_id = ${data.runId} ORDER BY id`;

  if (queries.length === 0) {
    return Response.json({ error: "No queries for run" }, { status: 400 });
  }

  const modelList: SearchModelConfig[] = data.models?.length ? data.models : getDefaultSearchModels();
  if (modelList.length === 0) {
    return Response.json({ error: "No models configured" }, { status: 400 });
  }

  const total = queries.length * modelList.length;
  await updateRunStatus(data.runId, "running");
  await setRunPendingCount(data.runId, total);
  await setRunExecutionConfig(data.runId, {
    totalCalls: total,
    models: modelList,
  });

  if (data.mode === "client") {
    return Response.json({
      runId: data.runId,
      total,
      models: modelList,
    });
  }

  const errors: Array<{ queryId: string; provider: string; model: string; error: string }> = [];

  for (const query of queries) {
    for (const model of modelList) {
      try {
        if (model.provider === "openai") {
          const response = await callOpenAIWebSearch({
            model: model.model,
            query: query.query_text,
          });
          await ingestOpenAIResponse({
            runId: data.runId,
            queryId: query.id,
            model: model.model,
            response,
          });
        } else {
          const response = await callGeminiWebSearch({
            model: model.model,
            query: query.query_text,
          });
          await ingestGeminiResponse({
            runId: data.runId,
            queryId: query.id,
            model: model.model,
            response,
          });
        }
      } catch (err) {
        errors.push({
          queryId: query.id,
          provider: model.provider,
          model: model.model,
          error: err instanceof Error ? err.message : String(err),
        });
      } finally {
        await decrementRunPendingCount(data.runId);
      }
    }
  }

  await updateRunStatus(data.runId, errors.length ? "complete_with_errors" : "complete");

  const summary = await getRunSummary(data.runId);

  return Response.json({
    runId: data.runId,
    total,
    errors,
    summary,
  });
}
