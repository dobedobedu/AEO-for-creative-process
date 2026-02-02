import { insertCitations, insertResponse } from "@/lib/storage/responseStore";
import type { Citation } from "@/lib/parsers/types";
import type { XaiResponse } from "@/lib/providers/xai";
import { extractDomain } from "@/lib/parsers/utils";

export function parseXaiResponse(response: XaiResponse): { text: string; citations: Citation[] } {
  // Agent Tools API returns output blocks with type and content
  const textBlocks = response.output?.filter(b => b.type === "text") ?? [];
  const text = textBlocks.map(b => b.content ?? "").join("\n").trim();

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
