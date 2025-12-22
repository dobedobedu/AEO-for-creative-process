import { dedupeByKey, extractDomain } from "./utils";
import type { Citation, ParsedResponse } from "./types";

type GeminiResponse = {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
    groundingMetadata?: GeminiGroundingMetadata;
  }>;
  groundingMetadata?: GeminiGroundingMetadata;
};

type GeminiGroundingMetadata = {
  webSearchQueries?: string[];
  groundingChunks?: Array<{
    web?: { uri?: string; title?: string };
  }>;
  groundingSupports?: Array<{
    segment?: { startIndex?: number; endIndex?: number; text?: string };
    groundingChunkIndices?: number[];
  }>;
};

export function parseGeminiResponse(response: unknown): ParsedResponse {
  const gemini = response as GeminiResponse;
  const candidate = gemini.candidates?.[0];
  const parts = candidate?.content?.parts ?? [];
  const text = parts
    .map((part) => part.text)
    .filter((part): part is string => typeof part === "string")
    .join("\n")
    .trim();

  const grounding = candidate?.groundingMetadata ?? gemini.groundingMetadata;
  const searchQueries = grounding?.webSearchQueries ?? [];
  const chunks = grounding?.groundingChunks ?? [];
  const supports = grounding?.groundingSupports ?? [];

  const citations: Citation[] = [];

  for (const support of supports) {
    const segment = support.segment;
    const indices = support.groundingChunkIndices ?? [];
    for (const idx of indices) {
      const chunk = chunks[idx];
      const url = chunk?.web?.uri;
      if (!url) continue;
      citations.push({
        url,
        domain: extractDomain(url),
        title: chunk?.web?.title,
        snippet: segment?.text,
        startIndex: segment?.startIndex,
        endIndex: segment?.endIndex,
        sourceType: "grounding_chunk",
        query: searchQueries[0],
        raw: { support, chunk },
      });
    }
  }

  const deduped = dedupeByKey(citations, (c) => `${c.url}:${c.startIndex ?? ""}:${c.endIndex ?? ""}`);

  return {
    text,
    citations: deduped,
    searchQueries,
  };
}
