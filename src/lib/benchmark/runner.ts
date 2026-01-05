import { callOpenAIWebSearch } from "@/lib/providers/openai";
import { callAnthropicWebSearch } from "@/lib/providers/anthropic";
import { callGeminiWebSearch } from "@/lib/providers/gemini";
import { callXaiSearch } from "@/lib/providers/xai";
import type { VisibilityScore } from "./scoring";
import type { Stage } from "@/lib/intents/types";
import { extractStageMetrics, recommendationStrengthToScore } from "@/lib/scoring/extractor";
import type { StageExtraction } from "@/lib/scoring/schemas";

export type Provider = "openai" | "anthropic" | "gemini" | "xai";

export interface ProviderConfig {
  provider: Provider;
  model: string;
}

export interface BenchmarkConfig {
  stage: Stage;
  queries: string[];
  brand: string;
  brandAliases?: string[];
  providers: ProviderConfig[];
  concurrency?: number;
}

export interface ProviderResponse {
  provider: Provider;
  model: string;
  text: string;
  citations: string[];
  visibility: VisibilityScore;
  stageExtraction?: StageExtraction;
  latencyMs: number;
  error?: string;
  raw: unknown;
}

function computeVisibilityFromExtraction(stage: Stage, extraction: StageExtraction): VisibilityScore {
  const mentioned = extraction.mentioned;

  // Stage-normalized score (0..1) for UI
  let score = 0;
  if ("inTopThree" in extraction) {
    score = extraction.mentioned ? 1 : 0;
  } else if ("sentimentScore" in extraction) {
    score = (extraction.sentimentScore + 1) / 2;
  } else if ("outcome" in extraction) {
    if (extraction.outcome === "win") score = 1;
    else if (extraction.outcome === "tie" || extraction.outcome === "mixed") score = 0.5;
    else if (extraction.outcome === "lose") score = 0;
    else score = 0;
  } else if ("recommendationStrength" in extraction) {
    score = recommendationStrengthToScore(extraction.recommendationStrength);
  }

  // Competitors
  const competitorsMentioned =
    "competitors" in extraction
      ? extraction.competitors
      : "comparedTo" in extraction
        ? extraction.comparedTo
        : "alternativesOffered" in extraction
          ? extraction.alternativesOffered
          : [];

  // Position (rough approximation for legacy UI)
  let position: VisibilityScore["position"] = "absent";
  if (mentioned) {
    if ("inTopThree" in extraction) {
      position = extraction.inTopThree ? "1st" : "later";
    } else {
      position = "later";
    }
  }

  // Sentiment
  const sentiment: VisibilityScore["sentiment"] =
    "sentiment" in extraction ? extraction.sentiment : "neutral";

  // Compare outcome
  const comparisonOutcome: VisibilityScore["comparisonOutcome"] =
    "outcome" in extraction
      ? extraction.outcome === "win"
        ? "favorable"
        : extraction.outcome === "lose"
          ? "unfavorable"
          : extraction.outcome === "not_compared"
            ? "none"
            : "neutral"
      : "none";

  // Recommendation strength
  const recommendationStrength: VisibilityScore["recommendationStrength"] =
    "recommendationStrength" in extraction
      ? extraction.recommendationStrength === "strongly_recommended" || extraction.recommendationStrength === "recommended"
        ? "strong"
        : extraction.recommendationStrength === "suggested"
          ? "moderate"
          : extraction.recommendationStrength === "mentioned"
            ? "weak"
            : "none"
      : "none";

  const category: VisibilityScore["category"] =
    !mentioned
      ? "blind_spot"
      : recommendationStrength === "strong"
        ? "preferred"
        : stage === "compare" && comparisonOutcome === "favorable"
          ? "preferred"
          : stage === "decide" && recommendationStrength !== "none"
            ? "recommended"
            : "mentioned";

  return {
    score,
    category,
    sentiment,
    mentioned,
    mentionCount: mentioned ? 1 : 0,
    firstMentionPosition: null,
    position,
    competitorsMentioned,
    comparisonOutcome,
    recommendationStrength,
  };
}

export interface QueryResult {
  query: string;
  responses: ProviderResponse[];
}

export interface BenchmarkResult {
  queries: QueryResult[];
  summary: {
    totalQueries: number;
    providersUsed: Provider[];
    brandMentionRate: Record<Provider, number>;
    avgVisibilityScore: Record<Provider, number>;
    executionTimeMs: number;
  };
}

export async function runSingleQuery(params: {
  query: string;
  provider: Provider;
  model: string;
}): Promise<ProviderResponse> {
  const { query, provider, model } = params;
  const start = Date.now();

  try {
    let raw: unknown;
    let text = "";
    let citations: string[] = [];

    switch (provider) {
      case "openai": {
        const response = await callOpenAIWebSearch({ model, query });
        raw = response;
        text = extractOpenAIText(response);
        break;
      }
      case "anthropic": {
        const response = await callAnthropicWebSearch({ model, query });
        raw = response;
        text = extractAnthropicText(response);
        citations = response.citations ?? [];
        break;
      }
      case "gemini": {
        const response = await callGeminiWebSearch({ model, query });
        raw = response;
        text = extractGeminiText(response);
        break;
      }
      case "xai": {
        const response = await callXaiSearch({ model, query });
        raw = response;
        text = extractXaiText(response);
        citations = response.citations ?? [];
        break;
      }
    }

    return {
      provider,
      model,
      text,
      citations,
      visibility: { score: 0, category: "blind_spot", sentiment: "neutral", mentioned: false, mentionCount: 0, firstMentionPosition: null, position: "absent", competitorsMentioned: [], comparisonOutcome: "none", recommendationStrength: "none" },
      latencyMs: Date.now() - start,
      raw,
    };
  } catch (err) {
    return {
      provider,
      model,
      text: "",
      citations: [],
      visibility: { score: 0, category: "blind_spot", sentiment: "neutral", mentioned: false, mentionCount: 0, firstMentionPosition: null, position: "absent", competitorsMentioned: [], comparisonOutcome: "none", recommendationStrength: "none" },
      latencyMs: Date.now() - start,
      error: err instanceof Error ? err.message : String(err),
      raw: null,
    };
  }
}

export async function runBenchmark(config: BenchmarkConfig): Promise<BenchmarkResult> {
  const { stage, queries, brand, brandAliases = [], providers, concurrency = 2 } = config;
  const startTime = Date.now();

  const results: QueryResult[] = [];
  const mentionCounts: Record<Provider, number> = { openai: 0, anthropic: 0, gemini: 0, xai: 0 };
  const scoreSums: Record<Provider, number> = { openai: 0, anthropic: 0, gemini: 0, xai: 0 };
  const responseCounts: Record<Provider, number> = { openai: 0, anthropic: 0, gemini: 0, xai: 0 };

  // Process queries with concurrency limit
  const chunks = chunkArray(queries, concurrency);

  for (const chunk of chunks) {
    const chunkResults = await Promise.all(
      chunk.map(async (query) => {
        const responses: ProviderResponse[] = [];

        for (const providerConfig of providers) {
          const response = await runSingleQuery({
            query,
            provider: providerConfig.provider,
            model: providerConfig.model,
          });

          if (!response.error) {
            const extraction = await extractStageMetrics({
              stage,
              query,
              responseText: response.text,
              provider: providerConfig.provider,
              brand,
              brandTerms: brandAliases,
            });

            if (extraction.success && extraction.extraction) {
              response.stageExtraction = extraction.extraction;
              response.visibility = computeVisibilityFromExtraction(stage, extraction.extraction);
            }
          }

          // Track stats
          if (!response.error) {
            responseCounts[providerConfig.provider]++;
            scoreSums[providerConfig.provider] += response.visibility.score;
            if (response.visibility.mentioned) {
              mentionCounts[providerConfig.provider]++;
            }
          }

          responses.push(response);
        }

        return { query, responses };
      })
    );

    results.push(...chunkResults);
  }

  // Calculate summary stats
  const providersUsed = providers.map(p => p.provider);
  const brandMentionRate: Record<Provider, number> = {} as Record<Provider, number>;
  const avgVisibilityScore: Record<Provider, number> = {} as Record<Provider, number>;

  for (const provider of providersUsed) {
    const count = responseCounts[provider];
    brandMentionRate[provider] = count > 0 ? mentionCounts[provider] / count : 0;
    avgVisibilityScore[provider] = count > 0 ? scoreSums[provider] / count : 0;
  }

  return {
    queries: results,
    summary: {
      totalQueries: queries.length,
      providersUsed,
      brandMentionRate,
      avgVisibilityScore,
      executionTimeMs: Date.now() - startTime,
    },
  };
}

function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

// Response text extractors
function extractOpenAIText(response: { output?: Array<Record<string, unknown>> }): string {
  const parts: string[] = [];
  for (const item of response.output ?? []) {
    if (item.type === "message") {
      const content = item.content as Array<{ type?: string; text?: string }> | undefined;
      for (const block of content ?? []) {
        if (block.type === "output_text" && block.text) {
          parts.push(block.text);
        }
      }
    }
  }
  return parts.join("\n").trim();
}

function extractAnthropicText(response: { content?: Array<Record<string, unknown>> }): string {
  const parts: string[] = [];
  for (const block of response.content ?? []) {
    if (block.type === "text" && typeof block.text === "string") {
      parts.push(block.text);
    }
  }
  return parts.join("\n").trim();
}

function extractGeminiText(response: { candidates?: Array<Record<string, unknown>> }): string {
  const candidate = response.candidates?.[0] as { content?: { parts?: Array<{ text?: string }> } } | undefined;
  const parts = candidate?.content?.parts ?? [];
  return parts.map(p => p.text ?? "").join("\n").trim();
}

function extractXaiText(response: { choices?: Array<Record<string, unknown>> }): string {
  const message = response.choices?.[0]?.message as { content?: string } | undefined;
  return typeof message?.content === "string" ? message.content : "";
}
