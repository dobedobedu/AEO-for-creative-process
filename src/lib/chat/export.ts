import type { BenchmarkResponse, FileSearchDocument } from "./types";

/**
 * Convert a benchmark response to a File Search document format
 */
export function toFileSearchDocument(response: BenchmarkResponse): FileSearchDocument {
  return {
    id: response.id,
    run_id: response.runId,
    run_date: response.runDate,
    persona: response.persona,
    stage: response.stage,
    provider: response.provider,
    model: response.model,
    query: response.query,
    response: response.responseText,
    sentiment: response.sentiment,
    position: response.position,
    brand_mentioned: response.brandMentioned,
    competitors: response.competitors,
    recommendation_strength: response.recommendationStrength,
  };
}

/**
 * Export benchmark responses to JSONL format for File Search indexing
 */
export function exportResponsesToJsonl(responses: BenchmarkResponse[]): string {
  return responses
    .map((r) => JSON.stringify(toFileSearchDocument(r)))
    .join("\n");
}

/**
 * Validate JSONL string - each line should be valid JSON
 */
export function validateJsonl(jsonl: string): { valid: boolean; errors: string[] } {
  const lines = jsonl.split("\n").filter(Boolean);
  const errors: string[] = [];

  lines.forEach((line, index) => {
    try {
      const parsed = JSON.parse(line);
      // Check required fields
      const required = ["persona", "stage", "provider", "query", "response"];
      for (const field of required) {
        if (!(field in parsed)) {
          errors.push(`Line ${index + 1}: missing required field '${field}'`);
        }
      }
    } catch {
      errors.push(`Line ${index + 1}: invalid JSON`);
    }
  });

  return { valid: errors.length === 0, errors };
}
