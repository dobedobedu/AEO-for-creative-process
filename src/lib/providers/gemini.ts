import { z } from "zod";
import type { BatchRequest, BatchResult } from "./batch";

const GeminiResponseSchema = z.object({
  responseId: z.string().optional(),
  candidates: z.array(z.record(z.any())).optional(),
  groundingMetadata: z.record(z.any()).optional(),
});

export type GeminiResponse = z.infer<typeof GeminiResponseSchema>;

// Gemini Batch API schemas
export const GeminiBatchJobSchema = z.object({
  name: z.string(), // Format: projects/{project}/locations/{location}/batchPredictionJobs/{jobId}
  displayName: z.string().optional(),
  state: z.enum([
    "JOB_STATE_UNSPECIFIED",
    "JOB_STATE_QUEUED",
    "JOB_STATE_PENDING",
    "JOB_STATE_RUNNING",
    "JOB_STATE_SUCCEEDED",
    "JOB_STATE_FAILED",
    "JOB_STATE_CANCELLING",
    "JOB_STATE_CANCELLED",
    "JOB_STATE_PAUSED",
    "JOB_STATE_EXPIRED",
    "JOB_STATE_UPDATING",
    "JOB_STATE_PARTIALLY_SUCCEEDED",
  ]),
  outputInfo: z.object({
    gcsOutputDirectory: z.string().optional(),
    bigqueryOutputDataset: z.string().optional(),
  }).optional(),
  error: z.object({
    code: z.number().optional(),
    message: z.string().optional(),
  }).optional(),
  createTime: z.string().optional(),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
});

export type GeminiBatchJob = z.infer<typeof GeminiBatchJobSchema>;

// Response from inline batch predict (v1beta)
const GeminiBatchResponseSchema = z.object({
  responses: z.array(z.object({
    // Each response contains the original request ID and generateContent response
    response: GeminiResponseSchema.optional(),
    error: z.object({
      code: z.number().optional(),
      message: z.string().optional(),
    }).optional(),
  })).optional(),
});

export type GeminiBatchResponse = z.infer<typeof GeminiBatchResponseSchema>;

function normalizeModel(model: string): string {
  if (model.startsWith("models/")) return model;
  return `models/${model}`;
}

export async function callGeminiWebSearch(params: {
  model: string;
  query: string;
}): Promise<GeminiResponse> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not set");
  }

  const modelPath = normalizeModel(params.model);
  const url = new URL(`https://generativelanguage.googleapis.com/v1beta/${modelPath}:generateContent`);
  url.searchParams.set("key", apiKey);

  const body = {
    contents: [
      {
        role: "user",
        parts: [{ text: params.query }],
      },
    ],
    tools: [{ google_search: {} }],
  };

  const response = await fetch(url.toString(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini error ${response.status}: ${errorText}`);
  }

  const json = await response.json();
  return GeminiResponseSchema.parse(json);
}

// ============================================================================
// Batch API Functions
// ============================================================================

/**
 * Build a single Gemini batch request for web search
 */
function buildGeminiBatchRequest(query: string): {
  contents: Array<{ role: string; parts: Array<{ text: string }> }>;
  tools: Array<{ google_search: Record<string, unknown> }>;
} {
  return {
    contents: [
      {
        role: "user",
        parts: [{ text: query }],
      },
    ],
    tools: [{ google_search: {} }],
  };
}

/**
 * Submit a batch of queries to Gemini's Batch Prediction API
 *
 * Uses the v1beta batchGenerateContent endpoint for inline batching.
 * This is simpler than the full BatchPredictionJob API and better suited
 * for our use case of moderate batch sizes (~100-500 requests).
 *
 * @see https://ai.google.dev/gemini-api/docs/batch
 * @returns Batch name and request count
 */
export async function submitGeminiBatch(
  requests: BatchRequest[]
): Promise<{ batchName: string; requestCount: number; responses?: BatchResult[] }> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not set");
  }

  if (requests.length === 0) {
    throw new Error("No requests to submit");
  }

  // Use the first request's model (all should be the same)
  const modelPath = normalizeModel(requests[0].model);

  // Build inline batch request
  const customIds = requests.map((req) => req.customId);
  const batchRequests = requests.map((req) => buildGeminiBatchRequest(req.query));

  // Note: Gemini's batchGenerateContent endpoint processes requests synchronously
  // but with parallel execution on their end, which is faster than sequential calls.
  // For true async batching, we'd need to use BatchPredictionJob with GCS.
  const url = new URL(
    `https://generativelanguage.googleapis.com/v1beta/${modelPath}:batchGenerateContent`
  );
  url.searchParams.set("key", apiKey);

  const response = await fetch(url.toString(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      requests: batchRequests,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini batch submit error ${response.status}: ${errorText}`);
  }

  const json = await response.json();
  const batchResponse = GeminiBatchResponseSchema.parse(json);

  // Since batchGenerateContent is synchronous, we get results immediately
  const results: BatchResult[] = [];

  if (batchResponse.responses) {
    for (let i = 0; i < batchResponse.responses.length; i++) {
      const resp = batchResponse.responses[i];
      const customId = customIds[i] ?? `gemini-batch-item-${i}`;

      if (resp.error) {
        results.push({
          customId,
          success: false,
          error: resp.error.message ?? `Error code ${resp.error.code}`,
        });
      } else if (resp.response) {
        const text = extractGeminiText(resp.response);
        const citations = extractGeminiCitations(resp.response);

        results.push({
          customId,
          success: true,
          text,
          citations,
          raw: resp.response,
        });
      } else {
        results.push({
          customId,
          success: false,
          error: "No response in batch result",
        });
      }
    }
  }

  // Generate a synthetic batch name for tracking
  const batchName = `gemini-batch-${Date.now()}-${requests.length}`;

  return {
    batchName,
    requestCount: requests.length,
    responses: results,
  };
}

/**
 * Get Gemini batch results
 *
 * Since Gemini's batchGenerateContent is synchronous, this is mainly
 * for API consistency. Results are returned directly from submitGeminiBatch.
 */
export async function getGeminiBatchResults(
  batchName: string,
  cachedResponses?: BatchResult[]
): Promise<{
  status: "completed" | "failed";
  responses: BatchResult[];
}> {
  // Gemini batch processing is synchronous, so results are already available
  if (cachedResponses) {
    const allErrors = cachedResponses.every((r) => !r.success);

    return {
      status: allErrors ? "failed" : "completed",
      responses: cachedResponses,
    };
  }

  // If no cached responses, batch was never submitted or results were lost
  return {
    status: "failed",
    responses: [],
  };
}

/**
 * Extract text from Gemini response
 */
function extractGeminiText(response: GeminiResponse): string {
  const parts: string[] = [];

  for (const candidate of response.candidates ?? []) {
    const content = candidate.content as { parts?: Array<{ text?: string }> } | undefined;
    for (const part of content?.parts ?? []) {
      if (part.text) {
        parts.push(part.text);
      }
    }
  }

  return parts.join("\n").trim();
}

/**
 * Extract citations from Gemini grounding metadata
 */
function extractGeminiCitations(response: GeminiResponse): string[] {
  const citations: string[] = [];

  // Check groundingMetadata at response level
  const groundingMetadata = response.groundingMetadata as {
    groundingChunks?: Array<{ web?: { uri?: string } }>;
    webSearchQueries?: string[];
  } | undefined;

  if (groundingMetadata?.groundingChunks) {
    for (const chunk of groundingMetadata.groundingChunks) {
      if (chunk.web?.uri) {
        citations.push(chunk.web.uri);
      }
    }
  }

  // Also check candidates for grounding metadata
  for (const candidate of response.candidates ?? []) {
    const candidateGrounding = candidate.groundingMetadata as typeof groundingMetadata;
    if (candidateGrounding?.groundingChunks) {
      for (const chunk of candidateGrounding.groundingChunks) {
        if (chunk.web?.uri && !citations.includes(chunk.web.uri)) {
          citations.push(chunk.web.uri);
        }
      }
    }
  }

  return citations;
}
