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
    web?: {
      uri?: string;
      url?: string;
      sourceUrl?: string;
      displayUrl?: string;
      title?: string;
    };
  }>;
  groundingSupports?: Array<{
    segment?: { startIndex?: number; endIndex?: number; text?: string };
    groundingChunkIndices?: number[];
  }>;
};

type WebChunk = {
  uri?: string;
  url?: string;
  sourceUrl?: string;
  displayUrl?: string;
  title?: string;
};

/**
 * Extract the actual source URL from Gemini grounding data.
 * Gemini sometimes returns vertexaisearch proxy URLs instead of actual source URLs.
 * This function tries to extract the real URL from the proxy URL or falls back to available fields.
 */
function extractSourceUrl(web: WebChunk | undefined): string | undefined {
  // Try direct URL fields first (in order of preference)
  const directUrl = web?.url || web?.sourceUrl || web?.displayUrl;
  if (directUrl && !directUrl.includes("vertexaisearch")) {
    return directUrl;
  }

  const uri = web?.uri;
  if (!uri) return undefined;

  // Check if it's a vertexaisearch proxy URL and try to extract actual URL
  if (uri.includes("vertexaisearch")) {
    // Try to extract encoded URL from proxy URL params
    try {
      const urlObj = new URL(uri);
      // Check common parameters that might contain the actual URL
      const actualUrl = urlObj.searchParams.get("url") ||
                       urlObj.searchParams.get("source") ||
                       urlObj.searchParams.get("u");
      if (actualUrl) {
        return decodeURIComponent(actualUrl);
      }
    } catch {
      // If parsing fails, fall through to return the original uri
    }
    // If we couldn't extract, still return the uri but the domain extraction will handle it
    return uri;
  }

  return uri;
}

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
      const web = chunk?.web;
      if (!web) continue;

      // Gemini API puts the actual source domain in the "title" field (e.g., "aljazeera.com")
      // The "uri" field contains vertexaisearch proxy URLs, not actual source URLs
      const title = web.title;
      const uri = web.uri;

      // Use title as domain since it contains the actual source (e.g., "aljazeera.com")
      // Fall back to extracting from uri only if title is missing
      const domain = title || (uri ? extractDomain(uri) : "unknown");

      // Need a url (even if it's vertexaisearch proxy) - use title as fallback for display
      const url = uri || title || "unknown";

      citations.push({
        url,
        domain,
        title,
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
