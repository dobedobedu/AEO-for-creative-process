import { z } from "zod";
import { callOpenAIWebSearch } from "@/lib/providers/openai";
import { callGeminiWebSearch } from "@/lib/providers/gemini";
import { ingestOpenAIResponse } from "@/lib/ingest/openaiIngest";
import { ingestGeminiResponse } from "@/lib/ingest/geminiIngest";

const RequestSchema = z.object({
  runId: z.string().uuid(),
  queryId: z.string().uuid(),
  provider: z.enum(["openai", "gemini"]),
  model: z.string().min(1),
  query: z.string().min(1),
});

export async function POST(req: Request) {
  const payload = await req.json();
  const data = RequestSchema.parse(payload);

  if (data.provider === "openai") {
    const response = await callOpenAIWebSearch({
      model: data.model,
      query: data.query,
    });

    const responseId = await ingestOpenAIResponse({
      runId: data.runId,
      queryId: data.queryId,
      model: data.model,
      response,
    });

    return Response.json({ responseId });
  }

  const response = await callGeminiWebSearch({
    model: data.model,
    query: data.query,
  });

  const responseId = await ingestGeminiResponse({
    runId: data.runId,
    queryId: data.queryId,
    model: data.model,
    response,
  });

  return Response.json({ responseId });
}
