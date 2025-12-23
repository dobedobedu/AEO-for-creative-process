import { insertCitations, insertResponse } from "@/lib/storage/responseStore";
import type { Citation } from "@/lib/parsers/types";
import type { AnthropicResponse } from "@/lib/providers/anthropic";
import { extractDomain } from "@/lib/parsers/utils";

function parseAnthropicResponse(response: AnthropicResponse): { text: string; citations: Citation[] } {
  const content = response.content ?? [];
  const textParts: string[] = [];
  const citations: Citation[] = [];

  for (const block of content) {
    const type = (block as { type?: string }).type;
    if (type === "text") {
      const text = (block as { text?: string }).text;
      if (typeof text === "string") {
        textParts.push(text);
      }
      const blockCitations = (block as { citations?: Array<{ url?: string; title?: string }> }).citations ?? [];
      for (const c of blockCitations) {
        if (!c?.url) continue;
        citations.push({
          url: c.url,
          domain: extractDomain(c.url),
          title: c.title,
          sourceType: "url_citation",
          raw: c,
        });
      }
    }
  }

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

  return { text: textParts.join("\n").trim(), citations };
}

export async function ingestAnthropicResponse(params: {
  runId: string;
  queryId: string;
  model: string;
  response: AnthropicResponse;
}): Promise<string> {
  const { runId, queryId, model, response } = params;
  const parsed = parseAnthropicResponse(response);

  const responseId = await insertResponse({
    runId,
    queryId,
    provider: "anthropic",
    model,
    providerResponseId: response.id ?? null,
    responseText: parsed.text,
    outputJson: response,
  });

  if (responseId) {
    await insertCitations(responseId, "anthropic", parsed.citations);
  }

  return responseId;
}
