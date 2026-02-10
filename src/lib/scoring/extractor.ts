/**
 * Stage-Aware Scoring Extractor
 * 
 * Uses Gemini 3 Flash with structured output to extract stage-specific
 * metrics from AI responses. Replaces all local heuristic scoring.
 */

import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateObject } from "ai";
import {
  getExtractionSchemaForStage,
  type StageExtraction,
  type ExploreExtraction,
  type ConsiderExtraction,
  type CompareExtraction,
  type DecideExtraction,
} from "./schemas";
import { getExtractionPrompt } from "@/lib/config/prompts";
import type { Stage } from "../intents/types";
import { safeAsync } from "../utils";

interface ExtractionInput {
  stage: Stage;
  query: string;
  responseText: string;
  provider: string;
  brand: string;
  brandTerms?: string[];
}

interface ExtractionResult {
  success: boolean;
  extraction: StageExtraction | null;
  error?: string;
}

const google = createGoogleGenerativeAI({
  apiKey: process.env.GEMINI_API_KEY,
});

export async function extractStageMetrics(input: ExtractionInput): Promise<ExtractionResult> {
  const { stage, query, responseText, provider, brand, brandTerms = [] } = input;

  if (!responseText || responseText.trim().length === 0) {
    return {
      success: false,
      extraction: null,
      error: "Empty response text",
    };
  }

  const schema = getExtractionSchemaForStage(stage);
  const stagePrompt = getExtractionPrompt(stage);

  if (!stagePrompt) {
    return {
      success: false,
      extraction: null,
      error: `No extraction prompt found for stage: ${stage}`,
    };
  }

  // Brand name MUST come first so Gemini knows what to look for
  const brandInfo = brandTerms.length > 0 
    ? `"${brand}" (also known as: ${brandTerms.join(", ")})`
    : `"${brand}"`;

  const prompt = `Brand to analyze: ${brandInfo}

${stagePrompt}

Original query: "${query}"

AI Response (from ${provider}):
"""
${responseText}
"""

Extract the metrics. Remember: the brand is ${brandInfo}.`;

  // Use safeAsync to isolate SDK errors with read-only properties
  const result = await safeAsync(
    () => generateObject({
      model: google("gemini-3-flash-preview"),
      schema,
      prompt,
    }),
    `Extraction/${stage}/${provider}`
  );

  if (result.success) {
    return {
      success: true,
      extraction: result.data.object as StageExtraction,
    };
  } else {
    return {
      success: false,
      extraction: null,
      error: result.error,
    };
  }
}

// Batch extraction for multiple responses
export async function extractBatch(
  inputs: ExtractionInput[]
): Promise<Map<string, ExtractionResult>> {
  const results = new Map<string, ExtractionResult>();
  
  // Process in parallel with concurrency limit
  const CONCURRENCY = 5;
  const batches: ExtractionInput[][] = [];
  
  for (let i = 0; i < inputs.length; i += CONCURRENCY) {
    batches.push(inputs.slice(i, i + CONCURRENCY));
  }

  for (const batch of batches) {
    const batchResults = await Promise.all(
      batch.map(async (input) => {
        const key = `${input.query}_${input.provider}`;
        const result = await extractStageMetrics(input);
        return { key, result };
      })
    );

    for (const { key, result } of batchResults) {
      results.set(key, result);
    }
  }

  return results;
}

// Calculate aggregated metrics from extractions

export function calculateExploreMetrics(
  extractions: ExploreExtraction[]
): { discoveryRate: number; topThreeRate: number } {
  if (extractions.length === 0) {
    return { discoveryRate: 0, topThreeRate: 0 };
  }

  const mentioned = extractions.filter((e) => e.mentioned).length;
  const inTopThree = extractions.filter((e) => e.inTopThree).length;

  return {
    discoveryRate: mentioned / extractions.length,
    topThreeRate: inTopThree / extractions.length,
  };
}

export function calculateConsiderMetrics(
  extractions: ConsiderExtraction[]
): { avgSentiment: number } {
  if (extractions.length === 0) {
    return { avgSentiment: 0 };
  }

  const totalSentiment = extractions.reduce((sum, e) => sum + e.sentimentScore, 0);
  return {
    avgSentiment: totalSentiment / extractions.length,
  };
}

export function calculateCompareMetrics(
  extractions: CompareExtraction[]
): { winRate: number } {
  if (extractions.length === 0) {
    return { winRate: 0 };
  }

  const compared = extractions.filter((e) => e.outcome !== "not_compared");
  if (compared.length === 0) {
    return { winRate: 0 };
  }

  const wins = compared.filter((e) => e.outcome === "win").length;
  const ties = compared.filter((e) => e.outcome === "tie").length;
  
  // Count ties as half wins
  return {
    winRate: (wins + ties * 0.5) / compared.length,
  };
}

export function calculateDecideMetrics(
  extractions: DecideExtraction[]
): { recommendationRate: number } {
  if (extractions.length === 0) {
    return { recommendationRate: 0 };
  }

  const recommended = extractions.filter((e) => e.recommended).length;
  return {
    recommendationRate: recommended / extractions.length,
  };
}

// Map recommendation strength to numeric value
export function recommendationStrengthToScore(
  strength: DecideExtraction["recommendationStrength"]
): number {
  switch (strength) {
    case "not_mentioned":
      return 0;
    case "mentioned":
      return 0.25;
    case "suggested":
      return 0.5;
    case "recommended":
      return 0.75;
    case "strongly_recommended":
      return 1;
    default:
      return 0;
  }
}

// Get all competitors mentioned across extractions
export function aggregateCompetitors(
  extractions: (ExploreExtraction | CompareExtraction)[]
): Map<string, number> {
  const counts = new Map<string, number>();
  
  for (const extraction of extractions) {
    const competitors = "competitors" in extraction 
      ? extraction.competitors 
      : extraction.comparedTo;
    
    for (const competitor of competitors) {
      const normalized = competitor.toLowerCase().trim();
      counts.set(normalized, (counts.get(normalized) || 0) + 1);
    }
  }

  return counts;
}

// Get top N competitors by mention count
export function getTopCompetitors(
  extractions: (ExploreExtraction | CompareExtraction)[],
  limit: number = 5
): string[] {
  const counts = aggregateCompetitors(extractions);
  
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([name]) => name);
}
