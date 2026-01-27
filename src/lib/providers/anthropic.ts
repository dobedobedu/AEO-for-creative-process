import { z } from "zod";
import type { BatchRequest, BatchResult } from "./batch";

const AnthropicResponseSchema = z.object({
  id: z.string().optional(),
  model: z.string().optional(),
  content: z.array(z.record(z.any())).optional(),
  citations: z.array(z.string()).optional(),
});

export type AnthropicResponse = z.infer<typeof AnthropicResponseSchema>;

// Anthropic Batch API schemas
const AnthropicBatchSchema = z.object({
  id: z.string(),
  type: z.literal("message_batch"),
  processing_status: z.enum(["in_progress", "ended"]),
  request_counts: z.object({
    processing: z.number(),
    succeeded: z.number(),
    errored: z.number(),
    canceled: z.number(),
    expired: z.number(),
  }),
  ended_at: z.string().nullable(),
  created_at: z.string(),
  expires_at: z.string(),
  cancel_initiated_at: z.string().nullable().optional(),
  results_url: z.string().nullable(),
});

export type AnthropicBatch = z.infer<typeof AnthropicBatchSchema>;

const AnthropicBatchResultSchema = z.object({
  custom_id: z.string(),
  result: z.object({
    type: z.enum(["succeeded", "errored", "canceled", "expired"]),
    message: AnthropicResponseSchema.optional(),
    error: z.object({
      type: z.string(),
      message: z.string(),
    }).optional(),
  }),
});

export type AnthropicBatchResult = z.infer<typeof AnthropicBatchResultSchema>;

/**
 * System prompt for Anthropic web search - cached for cost efficiency.
 * Caching this ~2KB prompt saves up to 90% on input tokens for repeated calls.
 */
const ANTHROPIC_SYSTEM_PROMPT = `You are an AI assistant helping analyze brand visibility in AI-generated responses.

When searching the web:
1. Use web search to find current, accurate information
2. Always cite your sources with URLs
3. Focus on factual, up-to-date content
4. Include relevant comparisons when available
5. Provide balanced perspectives

Search thoroughly and cite all sources used in your response.`;

export async function callAnthropicWebSearch(params: {
  model: string;
  query: string;
}): Promise<AnthropicResponse> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is not set");
  }

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-beta": "prompt-caching-2024-07-31",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: params.model,
      max_tokens: 512,
      // System prompt with cache_control for 90% input token savings
      system: [
        {
          type: "text",
          text: ANTHROPIC_SYSTEM_PROMPT,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [
        {
          role: "user",
          // Dynamic query at the end (not cached)
          content: params.query,
        },
      ],
      tools: [
        {
          type: "web_search_20250305",
          name: "web_search",
          max_uses: 5,
        },
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Anthropic error ${response.status}: ${errorText}`);
  }

  const json = await response.json();
  return AnthropicResponseSchema.parse(json);
}

// ============================================================================
// Batch API Functions
// ============================================================================

/**
 * Build an Anthropic batch request body for a single query
 */
function buildAnthropicBatchRequest(
  customId: string,
  model: string,
  query: string
): { custom_id: string; params: Record<string, unknown> } {
  return {
    custom_id: customId,
    params: {
      model,
      max_tokens: 512,
      system: [
        {
          type: "text",
          text: ANTHROPIC_SYSTEM_PROMPT,
        },
      ],
      messages: [
        {
          role: "user",
          content: query,
        },
      ],
      tools: [
        {
          type: "web_search_20250305",
          name: "web_search",
          max_uses: 5,
        },
      ],
    },
  };
}

/**
 * Submit a batch of queries to Anthropic's Messages Batch API
 *
 * @see https://docs.anthropic.com/en/docs/build-with-claude/batch-processing
 * @returns Batch ID and request count
 */
export async function submitAnthropicBatch(
  requests: BatchRequest[]
): Promise<{ batchId: string; requestCount: number }> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is not set");
  }

  if (requests.length === 0) {
    throw new Error("No requests to submit");
  }

  // Build JSONL request bodies
  const batchRequests = requests.map((req) =>
    buildAnthropicBatchRequest(req.customId, req.model, req.query)
  );

  // Submit batch
  const response = await fetch("https://api.anthropic.com/v1/messages/batches", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      requests: batchRequests,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Anthropic batch submit error ${response.status}: ${errorText}`);
  }

  const json = await response.json();
  const batch = AnthropicBatchSchema.parse(json);

  return {
    batchId: batch.id,
    requestCount: requests.length,
  };
}

/**
 * Get the status of an Anthropic batch
 */
export async function getAnthropicBatchStatus(batchId: string): Promise<{
  status: "in_progress" | "completed" | "failed" | "expired";
  resultsUrl: string | null;
  counts: {
    processing: number;
    succeeded: number;
    errored: number;
    canceled: number;
    expired: number;
  };
}> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is not set");
  }

  const response = await fetch(
    `https://api.anthropic.com/v1/messages/batches/${batchId}`,
    {
      method: "GET",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Anthropic batch status error ${response.status}: ${errorText}`);
  }

  const json = await response.json();
  const batch = AnthropicBatchSchema.parse(json);

  // Map Anthropic status to our status
  let status: "in_progress" | "completed" | "failed" | "expired";
  if (batch.processing_status === "in_progress") {
    status = "in_progress";
  } else if (batch.request_counts.expired > 0 && batch.request_counts.succeeded === 0) {
    status = "expired";
  } else if (batch.request_counts.errored > batch.request_counts.succeeded) {
    status = "failed";
  } else {
    status = "completed";
  }

  return {
    status,
    resultsUrl: batch.results_url,
    counts: batch.request_counts,
  };
}

/**
 * Download and parse Anthropic batch results
 */
export async function getAnthropicBatchResults(
  batchId: string
): Promise<BatchResult[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is not set");
  }

  // First get batch status to get results URL
  const status = await getAnthropicBatchStatus(batchId);
  if (!status.resultsUrl) {
    throw new Error(`Batch ${batchId} has no results URL`);
  }

  // Download results (JSONL format)
  const response = await fetch(status.resultsUrl, {
    method: "GET",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Anthropic batch results error ${response.status}: ${errorText}`);
  }

  const text = await response.text();
  const lines = text.trim().split("\n");

  const results: BatchResult[] = [];

  for (const line of lines) {
    if (!line.trim()) continue;

    try {
      const parsed = JSON.parse(line);
      const batchResult = AnthropicBatchResultSchema.parse(parsed);

      if (batchResult.result.type === "succeeded" && batchResult.result.message) {
        const message = batchResult.result.message;
        const text = extractAnthropicTextFromContent(message.content);
        const citations = message.citations ?? [];

        results.push({
          customId: batchResult.custom_id,
          success: true,
          text,
          citations,
          raw: message,
        });
      } else {
        results.push({
          customId: batchResult.custom_id,
          success: false,
          error: batchResult.result.error?.message ?? batchResult.result.type,
        });
      }
    } catch (err) {
      console.error("[Anthropic batch] Failed to parse result line:", err);
    }
  }

  return results;
}

/**
 * Extract text content from Anthropic response content array
 */
function extractAnthropicTextFromContent(
  content?: Array<Record<string, unknown>>
): string {
  const parts: string[] = [];
  for (const block of content ?? []) {
    if (block.type === "text" && typeof block.text === "string") {
      parts.push(block.text);
    }
  }
  return parts.join("\n").trim();
}
