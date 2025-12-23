import { insertCitations, insertResponse } from "@/lib/storage/responseStore";
import type { Citation } from "@/lib/parsers/types";
import type { XaiResponse } from "@/lib/providers/xai";
import { extractDomain } from "@/lib/parsers/utils";

function parseXaiResponse(response: XaiResponse): { text: string; citations: Citation[] } {
  const message = response.choices?.[0]?.message as { content?: string } | undefined;
  const text = typeof message?.content === "string" ? message.content : "";

  const citations: Citation[] = [];
  if (Array.isArray(response.citations)) {
    for (const url of response.citations) {
      citations.push({
        url,
        domain: extractDomain(url),
        sourceType: "url_citation",
        raw: url,
      });
    }
  }

  return { text, citations };
}

export async function ingestXaiResponse(params: {
  runId: string;
  queryId: string;
  model: string;
  response: XaiResponse;
}): Promise<string> {
  const { runId, queryId, model, response } = params;
  const parsed = parseXaiResponse(response);

  const responseId = await insertResponse({
    runId,
    queryId,
    provider: "xai",
    model,
    providerResponseId: response.id ?? null,
    responseText: parsed.text,
    outputJson: response,
  });

  if (responseId) {
    await insertCitations(responseId, "xai", parsed.citations);
  }

  return responseId;
}
