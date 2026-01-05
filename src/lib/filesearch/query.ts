/**
 * Query FileSearchStore for RAG-based chat
 */

import { getGenAIClient } from "./client";
import { getStoreName } from "./store";
import type { ChatContext } from "@/lib/chat/types";

export interface FileSearchResponse {
  text: string;
  citations?: Citation[];
}

export interface Citation {
  title?: string;
  uri?: string;
  chunk?: string;
}

/**
 * Build metadata filter from chat context
 */
function buildMetadataFilter(context: ChatContext): string | undefined {
  const filters: string[] = [];

  if (context.persona) {
    filters.push(`persona="${context.persona}"`);
  }

  if (context.stage) {
    filters.push(`stage="${context.stage}"`);
  }

  if (context.brand) {
    filters.push(`brand="${context.brand}"`);
  }

  // Could add date range filtering here in the future
  // filters.push(`run_date>="2026-01-01"`);

  return filters.length > 0 ? filters.join(" AND ") : undefined;
}

/**
 * Query the FileSearchStore with File Search tool
 */
export async function queryWithFileSearch(
  userMessage: string,
  context: ChatContext,
  systemPrompt?: string
): Promise<FileSearchResponse> {
  const client = getGenAIClient();
  const storeName = await getStoreName();
  const metadataFilter = buildMetadataFilter(context);

  console.log(`[FileSearch] Querying with filter: ${metadataFilter ?? "none"}`);

  const response = await client.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: userMessage,
    config: {
      systemInstruction: systemPrompt,
      tools: [
        {
          fileSearch: {
            fileSearchStoreNames: [storeName],
            metadataFilter,
          },
        },
      ],
    },
  });

  // Extract citations from grounding metadata
  const groundingMetadata = response.candidates?.[0]?.groundingMetadata;
  const citations: Citation[] = [];

  if (groundingMetadata?.groundingChunks) {
    for (const chunk of groundingMetadata.groundingChunks) {
      if (chunk.retrievedContext) {
        citations.push({
          title: chunk.retrievedContext.title,
          uri: chunk.retrievedContext.uri,
        });
      }
    }
  }

  return {
    text: response.text ?? "",
    citations: citations.length > 0 ? citations : undefined,
  };
}

/**
 * Stream query with File Search (for chat interface)
 */
export async function* streamQueryWithFileSearch(
  userMessage: string,
  context: ChatContext,
  systemPrompt?: string
): AsyncGenerator<string> {
  const client = getGenAIClient();
  const storeName = await getStoreName();
  const metadataFilter = buildMetadataFilter(context);

  console.log(`[FileSearch] Streaming query with filter: ${metadataFilter ?? "none"}`);

  const response = await client.models.generateContentStream({
    model: "gemini-3-flash-preview",
    contents: userMessage,
    config: {
      systemInstruction: systemPrompt,
      tools: [
        {
          fileSearch: {
            fileSearchStoreNames: [storeName],
            metadataFilter,
          },
        },
      ],
    },
  });

  for await (const chunk of response) {
    if (chunk.text) {
      yield chunk.text;
    }
  }
}

/**
 * Check if FileSearchStore has any documents
 */
export async function hasDocuments(): Promise<boolean> {
  const client = getGenAIClient();
  const storeName = await getStoreName();

  try {
    const docs = await client.fileSearchStores.documents.list({
      parent: storeName,
    });

    for await (const doc of docs) {
      return true; // At least one document exists
    }

    return false;
  } catch {
    return false;
  }
}
