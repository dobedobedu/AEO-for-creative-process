import { parseOpenAIResponse } from "@/lib/parsers/openaiCitations";
import { insertCitations, insertResponse, insertWebSearchCall } from "@/lib/storage/responseStore";

type OpenAIResponse = {
  id?: string;
  output?: Array<{ type?: string; [key: string]: unknown }>;
};

function extractAnnotations(response: OpenAIResponse): unknown[] {
  const annotations: unknown[] = [];
  const output = response.output ?? [];

  for (const item of output) {
    if (item?.type !== "message") continue;
    const content = (item as { content?: Array<{ annotations?: unknown[] }> }).content ?? [];
    for (const part of content) {
      if (Array.isArray(part?.annotations)) {
        annotations.push(...part.annotations);
      }
    }
  }

  return annotations;
}

function extractWebSearchCall(response: OpenAIResponse): {
  action?: string;
  query?: string;
  domains?: unknown;
  status?: string;
  rawCallJson: unknown;
} | null {
  const output = response.output ?? [];
  const call = output.find((item) => item?.type === "web_search_call") as
    | { action?: string; query?: string; domains?: unknown; status?: string }
    | undefined;

  if (!call) return null;

  return {
    action: call.action,
    query: call.query,
    domains: call.domains,
    status: call.status,
    rawCallJson: call,
  };
}

export async function ingestOpenAIResponse(params: {
  runId: string;
  queryId: string;
  model: string;
  response: OpenAIResponse;
}): Promise<string> {
  const { runId, queryId, model, response } = params;

  const parsed = parseOpenAIResponse(response);
  const annotations = extractAnnotations(response);
  const responseId = await insertResponse({
    runId,
    queryId,
    provider: "openai",
    model,
    providerResponseId: response.id ?? null,
    responseText: parsed.text,
    outputJson: response,
    annotationsJson: annotations,
  });

  const webSearchCall = extractWebSearchCall(response);
  if (webSearchCall && responseId) {
    await insertWebSearchCall({
      responseId,
      action: webSearchCall.action,
      query: webSearchCall.query,
      domains: webSearchCall.domains,
      status: webSearchCall.status,
      rawCallJson: webSearchCall.rawCallJson,
    });
  }

  if (responseId) {
    await insertCitations(responseId, "openai", parsed.citations);
  }

  return responseId;
}
