import { callOpenAIWebSearch } from "@/lib/providers/openai";
import { callAnthropicWebSearch } from "@/lib/providers/anthropic";
import { callGeminiWebSearch } from "@/lib/providers/gemini";
import { callXaiSearch, type XaiResponse } from "@/lib/providers/xai";
import type { VisibilityScore } from "./scoring";
import { extractStageMetrics, recommendationStrengthToScore } from "@/lib/scoring/extractor";
import type { StageExtraction } from "@/lib/scoring/schemas";
import { getCachedResponse, setCachedResponse } from "@/lib/cache";
import { getSearchMode, type SearchMode } from "@/lib/appSettings";
import { parseOpenAIResponse } from "@/lib/parsers/openaiCitations";
import { parseGeminiResponse } from "@/lib/parsers/geminiCitations";
import type { Citation } from "@/lib/parsers/types";

export type Provider = "openai" | "anthropic" | "gemini" | "xai";

/**
 * Default visibility score for error cases or when scoring is unavailable
 * Extracted as constant to avoid duplication and ensure consistency
 */
export const DEFAULT_VISIBILITY_SCORE: VisibilityScore = {
  score: 0,
  category: "blind_spot",
  sentiment: "neutral",
  mentioned: false,
  mentionCount: 0,
  firstMentionPosition: null,
  position: "absent",
  competitorsMentioned: [],
  comparisonOutcome: "none",
  recommendationStrength: "none",
};

export interface ProviderConfig {
  provider: Provider;
  model: string;
}

/**
 * Trigger mode determines how provider calls are made:
 * - 'ui': Always use synchronous API calls (immediate feedback)
 * - 'cron': Use batch results when available, fallback to sync
 */
export type TriggerMode = "ui" | "cron";

export interface BenchmarkConfig {
  stage: string; // Custom stage ID (supports dynamic config)
  coreStage?: "explore" | "consider" | "compare" | "decide"; // For scoring - defaults to stage if it's a core stage
  // Multiple intent support: each intent has an ID and a list of queries
  intents: Array<{
    id: string;
    queries: string[];
  }>;
  brand: string;
  brandAliases?: string[];
  providers: ProviderConfig[];
  concurrency?: number;
  /**
   * Trigger mode for batch processing optimization
   * - 'ui': Always use synchronous API calls (default, for immediate user feedback)
   * - 'cron': Use batch results when available for Anthropic/Gemini
   */
  triggerMode?: TriggerMode;
  /**
   * Run ID for batch result lookup (required for cron mode)
   */
  runId?: string;
  /**
   * Pre-fetched batch results keyed by customId (for cron mode)
   */
  batchResults?: Map<string, { text: string; citations: string[]; raw: unknown }>;
}

export interface ProviderResponse {
  provider: Provider;
  model: string;
  text: string;
  citations: Citation[];
  visibility: VisibilityScore;
  stageExtraction?: StageExtraction;
  latencyMs: number;
  error?: string;
  raw: unknown;
}

// ... helper functions ...

export interface QueryResult {
  query: string;
  intentId: string; // Associated intent
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
  skipCache?: boolean;
}): Promise<ProviderResponse> {
  const { query, provider, model, skipCache = false } = params;
  let searchMode: SearchMode | undefined;
  const start = Date.now();

  // Check cache first (unless explicitly skipped)
  let cacheContext: string | undefined;
  if (!skipCache) {
    if (provider === "xai") {
      searchMode = await getSearchMode();
      cacheContext = `searchMode:${searchMode}`;
    }
    const cached = getCachedResponse(query, provider, model, cacheContext);
    if (cached) {
      // Reconstruct citations from cached data (they may be stored as strings or full Citation objects)
      const cachedCitations: Citation[] = Array.isArray(cached.citations)
        ? cached.citations.map((c: unknown) =>
            typeof c === "string"
              ? { url: c, domain: extractDomainFromUrl(c), sourceType: "url_citation" as const }
              : (c as Citation)
          )
        : [];
      return {
        provider,
        model,
        text: cached.text,
        citations: cachedCitations,
        visibility: DEFAULT_VISIBILITY_SCORE,
        latencyMs: 0, // Instant from cache
        raw: cached.raw,
      };
    }
  }

  try {
    let raw: unknown;
    let text = "";
    let citations: Citation[] = [];

    switch (provider) {
      case "openai": {
        const response = await callOpenAIWebSearch({ model, query });
        raw = response;
        const parsed = parseOpenAIResponse(response);
        text = parsed.text;
        citations = parsed.citations;
        break;
      }
      case "anthropic": {
        const response = await callAnthropicWebSearch({ model, query });
        raw = response;
        text = extractAnthropicText(response);
        // Anthropic returns citations as string URLs, convert to Citation objects
        const urlCitations = response.citations ?? [];
        citations = urlCitations.map((url: string) => ({
          url,
          domain: extractDomainFromUrl(url),
          sourceType: "url_citation" as const,
        }));
        break;
      }
      case "gemini": {
        const response = await callGeminiWebSearch({ model, query });
        raw = response;
        const parsed = parseGeminiResponse(response);
        text = parsed.text;
        citations = parsed.citations;
        break;
      }
      case "xai": {
        if (!searchMode) {
          searchMode = await getSearchMode();
        }
        const response = await callXaiSearch({ model, query, searchMode });
        raw = response;
        text = extractXaiText(response);

        // Extract citations: try top-level first, then annotations in content
        const topLevelCitations = response.citations ?? [];
        const annotationCitations: string[] = [];
        for (const block of response.output ?? []) {
          if (block.type === "message" && Array.isArray(block.content)) {
            for (const item of block.content) {
              if (typeof item === "object" && item.annotations) {
                for (const ann of item.annotations) {
                  if (ann.type === "url_citation" && ann.url) {
                    annotationCitations.push(ann.url);
                  }
                }
              }
            }
          }
        }
        const allCitationUrls = topLevelCitations.length > 0
          ? topLevelCitations
          : annotationCitations;
        citations = allCitationUrls.map((url: string) => ({
          url,
          domain: extractDomainFromUrl(url),
          sourceType: "url_citation" as const,
        }));
        break;
      }
    }

    // Store in cache for future deduplication
    if (provider === "xai") {
      const finalMode = searchMode ?? (await getSearchMode());
      cacheContext = `searchMode:${finalMode}`;
    }

    setCachedResponse(query, provider, model, { text, citations, raw }, cacheContext);

    return {
      provider,
      model,
      text,
      citations,
      visibility: DEFAULT_VISIBILITY_SCORE,
      latencyMs: Date.now() - start,
      raw,
    };
  } catch (err) {
    // Defensive error message extraction to handle read-only error objects
    let errorMessage = "Unknown error";
    try {
      if (err instanceof Error) {
        errorMessage = err.message;
      } else if (err && typeof err === "object" && "message" in err) {
        errorMessage = String((err as { message: unknown }).message);
      } else {
        errorMessage = String(err);
      }
    } catch {
      errorMessage = "Provider call failed";
    }

    return {
      provider,
      model,
      text: "",
      citations: [],
      visibility: DEFAULT_VISIBILITY_SCORE,
      latencyMs: Date.now() - start,
      error: errorMessage,
      raw: null,
    };
  }
}

// Helper to extract domain from URL
function extractDomainFromUrl(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export async function runBenchmark(config: BenchmarkConfig): Promise<BenchmarkResult> {
  const {
    stage,
    coreStage,
    intents,
    brand,
    brandAliases = [],
    providers,
    concurrency = 2,
    triggerMode = "ui",
    batchResults,
  } = config;
  const startTime = Date.now();

  // Determine scoring stage: use explicit coreStage, or stage if it's a valid core stage
  const CORE_STAGES = ["explore", "consider", "compare", "decide"] as const;
  const scoringStage: typeof CORE_STAGES[number] = coreStage ??
    (CORE_STAGES.includes(stage as typeof CORE_STAGES[number]) ? stage as typeof CORE_STAGES[number] : "explore");

  const results: QueryResult[] = [];
  const mentionCounts: Record<Provider, number> = { openai: 0, anthropic: 0, gemini: 0, xai: 0 };
  const scoreSums: Record<Provider, number> = { openai: 0, anthropic: 0, gemini: 0, xai: 0 };
  const responseCounts: Record<Provider, number> = { openai: 0, anthropic: 0, gemini: 0, xai: 0 };

  // Flatten queries with intent metadata AND per-intent query index
  const flatQueries: { query: string; intentId: string; queryIndex: number }[] = [];
  for (const intent of intents) {
    for (let i = 0; i < intent.queries.length; i++) {
      const q = intent.queries[i];
      if (q.trim()) {
        flatQueries.push({ query: q, intentId: intent.id, queryIndex: i });
      }
    }
  }

  // Process queries with concurrency limit
  const chunks = chunkArray(flatQueries, concurrency);

  for (const chunk of chunks) {
    const chunkResults = await Promise.all(
      chunk.map(async ({ query, intentId, queryIndex }) => {
        // Run all providers in PARALLEL for this query (10s instead of 40s)
        const responses = await Promise.all(
          providers.map(async (providerConfig) => {
            let response: ProviderResponse;

            // Check for batch results in cron mode for Anthropic/Gemini
            const isBatchProvider = providerConfig.provider === "anthropic" || providerConfig.provider === "gemini";
            const batchKey = `${providerConfig.provider}_${intentId}_${queryIndex}`;
            const batchResult = triggerMode === "cron" && isBatchProvider && batchResults?.get(batchKey);

            if (batchResult) {
              // Use pre-fetched batch result
              const citations: Citation[] = (batchResult.citations ?? []).map((url: string) => ({
                url,
                domain: extractDomainFromUrl(url),
                sourceType: "url_citation" as const,
              }));

              response = {
                provider: providerConfig.provider,
                model: providerConfig.model,
                text: batchResult.text,
                citations,
                visibility: DEFAULT_VISIBILITY_SCORE,
                latencyMs: 0, // Instant from batch
                raw: batchResult.raw,
              };
            } else {
              // Use synchronous API call
              response = await runSingleQuery({
                query,
                provider: providerConfig.provider,
                model: providerConfig.model,
              });
            }

            if (!response.error) {
              const extraction = await extractStageMetrics({
                stage: scoringStage,
                query,
                responseText: response.text,
                provider: providerConfig.provider,
                brand,
                brandTerms: brandAliases,
              });

              if (extraction.success && extraction.extraction) {
                response.stageExtraction = extraction.extraction;
                response.visibility = computeVisibilityFromExtraction(scoringStage, extraction.extraction);
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

            return response;
          })
        );

        return { query, intentId, responses };
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
      totalQueries: flatQueries.length,
      providersUsed,
      brandMentionRate,
      avgVisibilityScore,
      executionTimeMs: Date.now() - startTime,
    },
  };
}

function computeVisibilityFromExtraction(stage: string, extraction: StageExtraction): VisibilityScore {
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
      // If mentioned but not "explore" stage (or missing inTopThree), default to "later" 
      // instead of "absent" which contradicts "mentioned=true"
      position = "later";
    }
  }

  // Scoring Correction:
  // If mentioned is TRUE, score should never be 0.
  // For Explore stage, if mentioned but not in top 3, give partial credit (e.g. 0.5)
  // instead of 0 which implies "not mentioned".
  if (mentioned && score === 0 && "inTopThree" in extraction) {
     score = 0.5;
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

function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

// Response text extractors (OpenAI uses parseOpenAIResponse, Gemini uses parseGeminiResponse)
function extractAnthropicText(response: { content?: Array<Record<string, unknown>> }): string {
  const parts: string[] = [];
  for (const block of response.content ?? []) {
    if (block.type === "text" && typeof block.text === "string") {
      parts.push(block.text);
    }
  }
  return parts.join("\n").trim();
}

// Agent Tools API returns output blocks — handles both old and new formats
// Old: type "text" with content as string
// New: type "message" with content as array of { type: "output_text", text: "..." }
function extractXaiText(response: XaiResponse): string {
  if (!response.output) return "";

  const parts: string[] = [];
  for (const block of response.output) {
    // New format: type "message" with content array
    if (block.type === "message" && Array.isArray(block.content)) {
      for (const item of block.content) {
        if (typeof item === "object" && item.type === "output_text" && item.text) {
          parts.push(item.text);
        }
      }
    }
    // Old format: type "text" with content as string
    if (block.type === "text" && typeof block.content === "string") {
      parts.push(block.content);
    }
  }
  return parts.join("\n").trim();
}
