import { parseGeminiResponse } from "@/lib/parsers/geminiCitations";
import { insertCitations, insertResponse } from "@/lib/storage/responseStore";

type GeminiResponse = {
  responseId?: string;
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
    groundingMetadata?: unknown;
  }>;
  groundingMetadata?: unknown;
};

function extractGroundingMetadata(response: GeminiResponse): unknown {
  const candidate = response.candidates?.[0];
  return candidate?.groundingMetadata ?? response.groundingMetadata ?? null;
}

export async function ingestGeminiResponse(params: {
  runId: string;
  queryId: string;
  model: string;
  response: GeminiResponse;
}): Promise<string> {
  const { runId, queryId, model, response } = params;

  const parsed = parseGeminiResponse(response);
  const groundingMetadata = extractGroundingMetadata(response);

  const responseId = await insertResponse({
    runId,
    queryId,
    provider: "gemini",
    model,
    providerResponseId: response.responseId ?? null,
    responseText: parsed.text,
    outputJson: response,
    groundingMetadataJson: groundingMetadata,
  });

  if (responseId) {
    await insertCitations(responseId, "gemini", parsed.citations);
  }

  return responseId;
}
