import { dedupeByKey, extractDomain } from "./utils";
import type { Citation, ParsedResponse } from "./types";

type OpenAIOutputItem = {
  type?: string;
  [key: string]: unknown;
};

type OpenAIOutputText = {
  type?: string;
  text?: string;
  annotations?: Array<{ [key: string]: unknown }>;
};

export function parseOpenAIResponse(response: unknown): ParsedResponse {
  const output = (response as { output?: OpenAIOutputItem[] })?.output ?? [];
  const searchQueries: string[] = [];
  const citations: Citation[] = [];
  const textParts: string[] = [];

  for (const item of output) {
    if (!item || typeof item !== "object") continue;
    const type = (item as OpenAIOutputItem).type;

    if (type === "web_search_call") {
      const query = (item as { query?: unknown }).query;
      if (typeof query === "string" && query.trim()) searchQueries.push(query.trim());
      if (Array.isArray(query)) {
        for (const q of query) {
          if (typeof q === "string" && q.trim()) searchQueries.push(q.trim());
        }
      }
      continue;
    }

    if (type === "message") {
      const content = (item as { content?: OpenAIOutputText[] }).content ?? [];
      for (const part of content) {
        if (!part || typeof part !== "object") continue;
        const partType = part.type;
        if (partType === "output_text" || partType === "text") {
          if (typeof part.text === "string") textParts.push(part.text);
          const annotations = part.annotations ?? [];
          for (const annotation of annotations) {
            if (!annotation || typeof annotation !== "object") continue;
            const annType = (annotation as { type?: string }).type;
            if (annType !== "url_citation") continue;
            const url = (annotation as { url?: string }).url;
            if (!url) continue;
            citations.push({
              url,
              domain: extractDomain(url),
              title: (annotation as { title?: string }).title,
              snippet: (annotation as { text?: string }).text,
              startIndex: (annotation as { start_index?: number }).start_index,
              endIndex: (annotation as { end_index?: number }).end_index,
              sourceType: "url_citation",
              query: searchQueries[0],
              raw: annotation,
            });
          }
        }
      }
    }
  }

  const deduped = dedupeByKey(citations, (c) => `${c.url}:${c.startIndex ?? ""}:${c.endIndex ?? ""}`);

  return {
    text: textParts.join("\n").trim(),
    citations: deduped,
    searchQueries,
  };
}
