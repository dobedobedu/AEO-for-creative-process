// Types - using string to support dynamic config
export type Persona = string;
export type Stage = string;
export type Provider = "openai" | "anthropic" | "gemini" | "xai";
export type EvidenceType = "position" | "sentiment" | "competitor" | "winrate" | "recommendation";

// Matches the actual benchmark response structure
export interface VisibilityData {
  score: number;
  mentioned: boolean;
  position: "1st" | "2nd" | "3rd" | "later" | "absent";
  sentiment: "positive" | "neutral" | "negative";
  competitorsMentioned: string[];
  recommendationStrength: "strong" | "moderate" | "weak" | "none";
  comparisonOutcome: "favorable" | "unfavorable" | "neutral" | "none";
}

export interface CitationData {
  url: string;
  domain: string;
  title?: string;
  sourceType: "url_citation" | "grounding_chunk";
}

export interface ResponseData {
  provider: Provider;
  model: string;
  text: string;
  visibility: VisibilityData;
  citations?: CitationData[];
  error?: string;
}

export interface QueryResultData {
  query: string;
  responses: ResponseData[];
}

export interface ChatContext {
  scope: "global" | "cell" | "row" | "column" | "evidence";
  persona?: Persona;
  stage?: Stage;
  evidenceType?: EvidenceType;
  // Actual benchmark data for grounding
  brand?: string;
  queryResults?: QueryResultData[];
  metrics?: {
    score: number;
    sentiment: number;
    topCompetitors: string[];
  };
}

export interface BenchmarkResponse {
  id: string;
  runId: string;
  runDate: string;
  persona: Persona;
  stage: Stage;
  provider: Provider;
  model: string;
  query: string;
  responseText: string;
  sentiment: "positive" | "neutral" | "negative";
  position: "1st" | "2nd" | "3rd" | "later" | "absent";
  brandMentioned: boolean;
  competitors: string[];
  recommendationStrength: "strong" | "moderate" | "weak" | "none";
}

export interface FileSearchDocument {
  id: string;
  run_id: string;
  run_date: string;
  persona: string;
  stage: string;
  provider: string;
  model: string;
  query: string;
  response: string;
  sentiment: string;
  position: string;
  brand_mentioned: boolean;
  competitors: string[];
  recommendation_strength: string;
}
