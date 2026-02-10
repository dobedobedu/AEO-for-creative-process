import { insertCitations, insertResponse } from "@/lib/storage/responseStore";
import type { Citation } from "@/lib/parsers/types";
import type { XaiResponse } from "@/lib/providers/xai";
import { extractDomain } from "@/lib/parsers/utils";

export function parseXaiResponse(response: XaiResponse): { text: string; citations: Citation[] } {
  // Responses API format: output[].content[].text where type === "output_text"
  const parts: string[] = [];
  if (Array.isArray(response.output)) {
    for (const block of response.output) {
      if (block.type === "message" && Array.isArray(block.content)) {
        for (const item of block.content) {
          if (typeof item === "object" && item.type === "output_text" && item.text) {
            parts.push(item.text);
          }
        }
      }
      if (block.type === "text" && typeof block.content === "string") {
        parts.push(block.content);
      }
    }
  }
  const text = parts.join("\n").trim();

  // Extract citations: top-level first, then annotation fallback
  const topLevelCitations = response.citations ?? [];
  const annotationUrls: string[] = [];
  for (const block of response.output ?? []) {
    if (block.type === "message" && Array.isArray(block.content)) {
      for (const item of block.content) {
        if (typeof item === "object" && item.annotations) {
          for (const ann of item.annotations) {
            if (ann.type === "url_citation" && ann.url) {
              annotationUrls.push(ann.url);
            }
          }
        }
      }
    }
  }
  const allUrls = topLevelCitations.length > 0 ? topLevelCitations : annotationUrls;

  const citations: Citation[] = allUrls.map((url) => ({
    url,
    domain: extractDomain(url),
    sourceType: "url_citation" as const,
    raw: url,
  }));

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
