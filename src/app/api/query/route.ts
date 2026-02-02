import { z } from "zod";
import { callOpenAIWebSearch } from "@/lib/providers/openai";
import { callGeminiWebSearch } from "@/lib/providers/gemini";
import { callAnthropicWebSearch } from "@/lib/providers/anthropic";
import { callXaiSearch } from "@/lib/providers/xai";
import { ingestOpenAIResponse } from "@/lib/ingest/openaiIngest";
import { ingestGeminiResponse } from "@/lib/ingest/geminiIngest";
import { ingestAnthropicResponse } from "@/lib/ingest/anthropicIngest";
import { ingestXaiResponse } from "@/lib/ingest/xaiIngest";
import { getSearchMode } from "@/lib/appSettings";

const RequestSchema = z.object({
  runId: z.string().uuid(),
  queryId: z.string().uuid(),
  provider: z.enum(["openai", "gemini", "anthropic", "xai"]),
  model: z.string().min(1),
  query: z.string().min(1),
  memory: z
    .object({
      enabled: z.boolean(),
      context: z.string().optional(),
    })
    .optional(),
});

export async function POST(req: Request) {
  const payload = await req.json();
  const data = RequestSchema.parse(payload);
  const memoryContext = data.memory?.enabled ? data.memory.context?.trim() : null;
  const finalQuery = memoryContext ? `${memoryContext}\n\nUser query: ${data.query}` : data.query;

  if (data.provider === "openai") {
    const response = await callOpenAIWebSearch({
      model: data.model,
      query: finalQuery,
    });

    const responseId = await ingestOpenAIResponse({
      runId: data.runId,
      queryId: data.queryId,
      model: data.model,
      response,
    });

    return Response.json({ responseId });
  }

  if (data.provider === "gemini") {
    const response = await callGeminiWebSearch({
      model: data.model,
      query: finalQuery,
    });

    const responseId = await ingestGeminiResponse({
      runId: data.runId,
      queryId: data.queryId,
      model: data.model,
      response,
    });

    return Response.json({ responseId });
  }

  if (data.provider === "anthropic") {
    const response = await callAnthropicWebSearch({
      model: data.model,
      query: finalQuery,
    });

    const responseId = await ingestAnthropicResponse({
      runId: data.runId,
      queryId: data.queryId,
      model: data.model,
      response,
    });

    return Response.json({ responseId });
  }

  const response = await callXaiSearch({
    model: data.model,
    query: finalQuery,
    searchMode: await getSearchMode(),
  });

  const responseId = await ingestXaiResponse({
    runId: data.runId,
    queryId: data.queryId,
    model: data.model,
    response,
  });

  return Response.json({ responseId });
}
