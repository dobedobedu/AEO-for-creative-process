"use client";

import { useState, useMemo, useRef, useCallback, Fragment, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";
import {
  Play,
  ArrowLeft,
  Eye,
  EyeOff,
  Square,
  Zap,
  TrendingUp,
  Lightbulb,
  ChevronRight,
  Pencil,
  Check,
  FileText,
  MessageSquare,
} from "lucide-react";
import Link from "next/link";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { QueryPanelV2 } from "@/components/query-panel-v2";
import { StageCell } from "@/components/stage-cell";
import { ChatPanel } from "@/components/chat-panel";
import type { ChatContext } from "@/lib/chat/types";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  LineChart as RechartsLineChart,
  Line,
  XAxis,
  YAxis,
  ReferenceLine,
} from "recharts";

import type { IntentLibrary, IntentNode } from "@/lib/intents/types";
import type { BenchmarkRun as StoredRun } from "@/lib/runs/types";
import type { StageExtraction } from "@/lib/scoring/schemas";

// Types
type Persona = "move_up" | "retiree" | "luxury" | "first_time";
type Stage = "explore" | "consider" | "compare" | "decide";
type Provider = "openai" | "anthropic" | "gemini" | "xai";
type SelectionType =
  | { type: "all" }
  | { type: "cell"; persona: Persona; stage: Stage }
  | { type: "row"; persona: Persona }
  | { type: "column"; stage: Stage };

interface QueryResult {
  query: string;
  responses: {
    provider: Provider;
    model: string;
    text: string;
    visibility: {
      score: number;
      mentioned: boolean;
      sentiment: "positive" | "negative" | "neutral";
      category: string;
      position: string;
      competitorsMentioned: string[];
      comparisonOutcome?: "favorable" | "unfavorable" | "neutral" | "none";
      recommendationStrength?: "strong" | "moderate" | "weak" | "none";
    };
    latencyMs: number;
    error?: string;
  }[];
}

interface CellData {
  persona: Persona;
  stage: Stage;
  intents: IntentNode[];
  results: QueryResult[];
  avgScore: number;
  mentionRate: number;
  status: "idle" | "running" | "complete";
  // Stage-specific metrics from new scoring system
  stageMetrics?: {
    discoveryRate?: number;
    topThreeRate?: number;
    sentimentScore?: number;
    winRate?: number;
    recommendationRate?: number;
  };
}

interface BenchmarkRun {
  timestamp: number;
  label: string;
  providerScores: Record<Provider, { avgScore: number; mentionRate: number }>;
  // Stage-specific historical data
  stageData?: {
    positionCounts: { "1st": number; "2nd": number; "3rd": number; later: number; absent: number };
    sentimentScore: number;
    winRate: number;
    recStrength: number;
  };
  competitorRanking?: string[];
}

type EvidenceType = "position" | "sentiment" | "competitor" | "winrate" | "recommendation";

interface EvidenceModalData {
  type: EvidenceType;
  title: string;
  items: {
    query: string;
    model: string;
    provider: Provider;
    excerpt: string;
    metric: string;
    metricValue: string;
  }[];
}

interface PersonaConfig {
  id: Persona;
  label: string;
  description: string;
}

// Default configuration
const DEFAULT_PERSONAS: PersonaConfig[] = [
  { id: "move_up", label: "Move-Up", description: "Upgrading from starter home" },
  { id: "retiree", label: "Retiree", description: "55+ active lifestyle" },
  { id: "luxury", label: "Luxury", description: "High-end amenities focus" },
  { id: "first_time", label: "First-Time", description: "Entry-level, value-conscious" },
];

const STAGES: { id: Stage; label: string; description: string }[] = [
  { id: "explore", label: "Explore", description: "Starting research" },
  { id: "consider", label: "Consider", description: "Evaluating options" },
  { id: "compare", label: "Compare", description: "Narrowing choices" },
  { id: "decide", label: "Decide", description: "Ready to buy" },
];

const PROVIDERS: { id: Provider; label: string; color: string; bgColor: string; chartColor: string }[] = [
  { id: "openai", label: "GPT 5.2", color: "text-[#1f3b2c]", bgColor: "bg-[#1f3b2c]", chartColor: "#1f3b2c" },
  { id: "anthropic", label: "Haiku 4.5", color: "text-[#b86f3a]", bgColor: "bg-[#b86f3a]", chartColor: "#b86f3a" },
  { id: "gemini", label: "Gemini 3", color: "text-[#6e7c5b]", bgColor: "bg-[#6e7c5b]", chartColor: "#6e7c5b" },
  { id: "xai", label: "Grok 4", color: "text-[#7c6b7c]", bgColor: "bg-[#7c6b7c]", chartColor: "#7c6b7c" },
];

// Updated to support multiple intents
type QueryBank = Record<Persona, Record<Stage, { intents: IntentNode[] }>>;

function createEmptyQueryBank(): QueryBank {
  return {
    move_up: { explore: { intents: [] }, consider: { intents: [] }, compare: { intents: [] }, decide: { intents: [] } },
    retiree: { explore: { intents: [] }, consider: { intents: [] }, compare: { intents: [] }, decide: { intents: [] } },
    luxury: { explore: { intents: [] }, consider: { intents: [] }, compare: { intents: [] }, decide: { intents: [] } },
    first_time: { explore: { intents: [] }, consider: { intents: [] }, compare: { intents: [] }, decide: { intents: [] } },
  };
}

function buildQueryBankFromIntentLibrary(library: IntentLibrary): QueryBank {
  const bank = createEmptyQueryBank();

  // Group all active intents by persona/stage
  for (const intent of library.intents) {
    if (!intent.active) continue;
    
    if (bank[intent.persona] && bank[intent.persona][intent.stage]) {
      const node: IntentNode = {
        id: intent.id,
        text: intent.text,
        manifestations: intent.defaultQueries,
        role: (intent as any).role || "cpo",
        creativity: (intent as any).creativity || 0.7
      };
      
      bank[intent.persona][intent.stage].intents.push(node);
    }
  }

  return bank;
}

const BRAND = "Lakewood Ranch";
const BRAND_ALIASES = ["LWR", "Lakewood"];

// Deterministic mock historical data for time slider demo (13 weeks)
// Using fixed values to avoid hydration errors from Math.random()
const MOCK_HISTORY: BenchmarkRun[] = [
  { timestamp: 1, label: "W1", providerScores: { openai: { avgScore: 0.38, mentionRate: 0.42 }, anthropic: { avgScore: 0.32, mentionRate: 0.37 }, gemini: { avgScore: 0.28, mentionRate: 0.33 }, xai: { avgScore: 0.22, mentionRate: 0.27 } }, stageData: { positionCounts: { "1st": 3, "2nd": 4, "3rd": 5, later: 4, absent: 9 }, sentimentScore: -0.15, winRate: 0.32, recStrength: 0.25 }, competitorRanking: ["The Villages", "Nocatee", "Wellen Park", "Sun City Center", "On Top of the World"] },
  { timestamp: 2, label: "W2", providerScores: { openai: { avgScore: 0.40, mentionRate: 0.45 }, anthropic: { avgScore: 0.34, mentionRate: 0.39 }, gemini: { avgScore: 0.31, mentionRate: 0.36 }, xai: { avgScore: 0.24, mentionRate: 0.29 } }, stageData: { positionCounts: { "1st": 4, "2nd": 4, "3rd": 4, later: 3, absent: 8 }, sentimentScore: -0.08, winRate: 0.36, recStrength: 0.30 }, competitorRanking: ["The Villages", "Nocatee", "Wellen Park", "Sun City Center", "On Top of the World"] },
  { timestamp: 3, label: "W3", providerScores: { openai: { avgScore: 0.42, mentionRate: 0.48 }, anthropic: { avgScore: 0.35, mentionRate: 0.41 }, gemini: { avgScore: 0.34, mentionRate: 0.40 }, xai: { avgScore: 0.25, mentionRate: 0.30 } }, stageData: { positionCounts: { "1st": 4, "2nd": 5, "3rd": 4, later: 3, absent: 7 }, sentimentScore: -0.02, winRate: 0.40, recStrength: 0.34 }, competitorRanking: ["The Villages", "Nocatee", "Wellen Park", "Sun City Center", "On Top of the World"] },
  { timestamp: 4, label: "W4", providerScores: { openai: { avgScore: 0.44, mentionRate: 0.51 }, anthropic: { avgScore: 0.37, mentionRate: 0.43 }, gemini: { avgScore: 0.38, mentionRate: 0.44 }, xai: { avgScore: 0.27, mentionRate: 0.32 } }, stageData: { positionCounts: { "1st": 5, "2nd": 5, "3rd": 4, later: 3, absent: 6 }, sentimentScore: 0.05, winRate: 0.44, recStrength: 0.38 }, competitorRanking: ["The Villages", "Nocatee", "Wellen Park", "Sun City Center", "On Top of the World"] },
  { timestamp: 5, label: "W5", providerScores: { openai: { avgScore: 0.46, mentionRate: 0.54 }, anthropic: { avgScore: 0.38, mentionRate: 0.45 }, gemini: { avgScore: 0.41, mentionRate: 0.48 }, xai: { avgScore: 0.28, mentionRate: 0.34 } }, stageData: { positionCounts: { "1st": 5, "2nd": 5, "3rd": 4, later: 3, absent: 6 }, sentimentScore: 0.10, winRate: 0.48, recStrength: 0.42 }, competitorRanking: ["The Villages", "Nocatee", "Wellen Park", "Sun City Center", "On Top of the World"] },
  { timestamp: 6, label: "W6", providerScores: { openai: { avgScore: 0.48, mentionRate: 0.56 }, anthropic: { avgScore: 0.40, mentionRate: 0.47 }, gemini: { avgScore: 0.44, mentionRate: 0.51 }, xai: { avgScore: 0.29, mentionRate: 0.35 } }, stageData: { positionCounts: { "1st": 6, "2nd": 5, "3rd": 3, later: 3, absent: 5 }, sentimentScore: 0.14, winRate: 0.51, recStrength: 0.45 }, competitorRanking: ["The Villages", "Nocatee", "Wellen Park", "Sun City Center", "On Top of the World"] },
  { timestamp: 7, label: "W7", providerScores: { openai: { avgScore: 0.50, mentionRate: 0.58 }, anthropic: { avgScore: 0.41, mentionRate: 0.49 }, gemini: { avgScore: 0.47, mentionRate: 0.54 }, xai: { avgScore: 0.30, mentionRate: 0.36 } }, stageData: { positionCounts: { "1st": 6, "2nd": 5, "3rd": 3, later: 2, absent: 5 }, sentimentScore: 0.18, winRate: 0.54, recStrength: 0.48 }, competitorRanking: ["Nocatee", "The Villages", "Wellen Park", "Sun City Center", "On Top of the World"] },
  { timestamp: 8, label: "W8", providerScores: { openai: { avgScore: 0.52, mentionRate: 0.60 }, anthropic: { avgScore: 0.43, mentionRate: 0.51 }, gemini: { avgScore: 0.49, mentionRate: 0.56 }, xai: { avgScore: 0.31, mentionRate: 0.37 } }, stageData: { positionCounts: { "1st": 7, "2nd": 5, "3rd": 3, later: 2, absent: 4 }, sentimentScore: 0.22, winRate: 0.57, recStrength: 0.51 }, competitorRanking: ["Nocatee", "The Villages", "Wellen Park", "Sun City Center", "On Top of the World"] },
  { timestamp: 9, label: "W9", providerScores: { openai: { avgScore: 0.54, mentionRate: 0.62 }, anthropic: { avgScore: 0.44, mentionRate: 0.53 }, gemini: { avgScore: 0.51, mentionRate: 0.58 }, xai: { avgScore: 0.32, mentionRate: 0.38 } }, stageData: { positionCounts: { "1st": 7, "2nd": 5, "3rd": 3, later: 2, absent: 4 }, sentimentScore: 0.25, winRate: 0.59, recStrength: 0.54 }, competitorRanking: ["Nocatee", "The Villages", "Wellen Park", "Sun City Center", "On Top of the World"] },
  { timestamp: 10, label: "W10", providerScores: { openai: { avgScore: 0.56, mentionRate: 0.64 }, anthropic: { avgScore: 0.46, mentionRate: 0.55 }, gemini: { avgScore: 0.53, mentionRate: 0.60 }, xai: { avgScore: 0.33, mentionRate: 0.40 } }, stageData: { positionCounts: { "1st": 8, "2nd": 5, "3rd": 3, later: 2, absent: 3 }, sentimentScore: 0.28, winRate: 0.61, recStrength: 0.56 }, competitorRanking: ["Nocatee", "The Villages", "Wellen Park", "Sun City Center", "On Top of the World"] },
  { timestamp: 11, label: "W11", providerScores: { openai: { avgScore: 0.57, mentionRate: 0.66 }, anthropic: { avgScore: 0.47, mentionRate: 0.56 }, gemini: { avgScore: 0.54, mentionRate: 0.62 }, xai: { avgScore: 0.34, mentionRate: 0.41 } }, stageData: { positionCounts: { "1st": 8, "2nd": 5, "3rd": 3, later: 2, absent: 3 }, sentimentScore: 0.30, winRate: 0.63, recStrength: 0.58 }, competitorRanking: ["Nocatee", "The Villages", "Wellen Park", "Sun City Center", "On Top of the World"] },
  { timestamp: 12, label: "W12", providerScores: { openai: { avgScore: 0.58, mentionRate: 0.68 }, anthropic: { avgScore: 0.48, mentionRate: 0.58 }, gemini: { avgScore: 0.55, mentionRate: 0.64 }, xai: { avgScore: 0.35, mentionRate: 0.42 } }, stageData: { positionCounts: { "1st": 8, "2nd": 5, "3rd": 3, later: 2, absent: 3 }, sentimentScore: 0.32, winRate: 0.65, recStrength: 0.60 }, competitorRanking: ["Nocatee", "The Villages", "Wellen Park", "Sun City Center", "On Top of the World"] },
  { timestamp: 13, label: "W13", providerScores: { openai: { avgScore: 0.60, mentionRate: 0.70 }, anthropic: { avgScore: 0.50, mentionRate: 0.60 }, gemini: { avgScore: 0.56, mentionRate: 0.65 }, xai: { avgScore: 0.36, mentionRate: 0.43 } }, stageData: { positionCounts: { "1st": 9, "2nd": 5, "3rd": 2, later: 2, absent: 3 }, sentimentScore: 0.35, winRate: 0.67, recStrength: 0.62 }, competitorRanking: ["Nocatee", "The Villages", "Wellen Park", "Sun City Center", "On Top of the World"] },
];

const PROVIDER_MODELS: Record<Provider, string> = {
  openai: "gpt-5.2",
  anthropic: "claude-haiku-4-5",
  gemini: "gemini-3-flash-preview",
  xai: "grok-4-latest",
};

function recommendationStrengthToScore(strength: string): number {
  switch (strength) {
    case "strongly_recommended":
      return 1;
    case "recommended":
      return 0.8;
    case "suggested":
      return 0.6;
    case "mentioned":
      return 0.4;
    case "not_mentioned":
    default:
      return 0;
  }
}

function extractionToScalarScore(stage: Stage, extraction: StageExtraction): number {
  if (stage === "explore" && "inTopThree" in extraction) {
    return extraction.mentioned ? 1 : 0;
  }
  if (stage === "consider" && "sentimentScore" in extraction) {
    return (extraction.sentimentScore + 1) / 2;
  }
  if (stage === "compare" && "outcome" in extraction) {
    if (extraction.outcome === "win") return 1;
    if (extraction.outcome === "tie" || extraction.outcome === "mixed") return 0.5;
    return 0;
  }
  if (stage === "decide" && "recommendationStrength" in extraction) {
    return recommendationStrengthToScore(extraction.recommendationStrength);
  }
  return 0;
}

function extractionCompetitors(extraction: StageExtraction): string[] {
  if ("competitors" in extraction) return extraction.competitors;
  if ("comparedTo" in extraction) return extraction.comparedTo;
  if ("alternativesOffered" in extraction) return extraction.alternativesOffered;
  return [];
}

function toUiBenchmarkRun(run: StoredRun): BenchmarkRun {
  const totals: Record<Provider, { totalScore: number; totalMentions: number; totalCount: number }> = {
    openai: { totalScore: 0, totalMentions: 0, totalCount: 0 },
    anthropic: { totalScore: 0, totalMentions: 0, totalCount: 0 },
    gemini: { totalScore: 0, totalMentions: 0, totalCount: 0 },
    xai: { totalScore: 0, totalMentions: 0, totalCount: 0 },
  };

  const positionCounts = { "1st": 0, "2nd": 0, "3rd": 0, later: 0, absent: 0 };
  const sentimentScores: number[] = [];
  const compareOutcomes: { win: number; total: number } = { win: 0, total: 0 };
  const recStrengths: number[] = [];
  const competitorCounts: Record<string, number> = {};

  for (const [cellKey, cell] of Object.entries(run.cells)) {
    const parts = cellKey.split("_");
    const stage = parts[parts.length - 1] as Stage;
    for (const qr of cell.results) {
      for (const [provider, resp] of Object.entries(qr.responses) as Array<[
        Provider,
        { score: StageExtraction }
      ]>) {
        const extraction = resp.score;

        totals[provider].totalCount++;
        totals[provider].totalScore += extractionToScalarScore(stage, extraction);
        if (extraction.mentioned) totals[provider].totalMentions++;

        for (const comp of extractionCompetitors(extraction)) {
          competitorCounts[comp] = (competitorCounts[comp] || 0) + 1;
        }

        if (stage === "explore" && "inTopThree" in extraction) {
          if (!extraction.mentioned) positionCounts.absent++;
          else if (extraction.inTopThree) positionCounts["1st"]++;
          else positionCounts.later++;
        }

        if (stage === "consider" && "sentimentScore" in extraction) {
          sentimentScores.push(extraction.sentimentScore);
        }

        if (stage === "compare" && "outcome" in extraction && extraction.outcome !== "not_compared") {
          compareOutcomes.total++;
          if (extraction.outcome === "win") compareOutcomes.win++;
          if (extraction.outcome === "tie" || extraction.outcome === "mixed") compareOutcomes.win += 0.5;
        }

        if (stage === "decide" && "recommendationStrength" in extraction) {
          recStrengths.push(recommendationStrengthToScore(extraction.recommendationStrength));
        }
      }
    }
  }

  const providerScores: BenchmarkRun["providerScores"] = {
    openai: {
      avgScore: totals.openai.totalCount ? totals.openai.totalScore / totals.openai.totalCount : 0,
      mentionRate: totals.openai.totalCount ? totals.openai.totalMentions / totals.openai.totalCount : 0,
    },
    anthropic: {
      avgScore: totals.anthropic.totalCount ? totals.anthropic.totalScore / totals.anthropic.totalCount : 0,
      mentionRate: totals.anthropic.totalCount ? totals.anthropic.totalMentions / totals.anthropic.totalCount : 0,
    },
    gemini: {
      avgScore: totals.gemini.totalCount ? totals.gemini.totalScore / totals.gemini.totalCount : 0,
      mentionRate: totals.gemini.totalCount ? totals.gemini.totalMentions / totals.gemini.totalCount : 0,
    },
    xai: {
      avgScore: totals.xai.totalCount ? totals.xai.totalScore / totals.xai.totalCount : 0,
      mentionRate: totals.xai.totalCount ? totals.xai.totalMentions / totals.xai.totalCount : 0,
    },
  };

  const competitorRanking = Object.entries(competitorCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name]) => name);

  const runLabel = run.timestamp.split("T")[0];

  return {
    timestamp: Date.parse(run.timestamp),
    label: runLabel,
    providerScores,
    stageData: {
      positionCounts,
      sentimentScore:
        sentimentScores.length > 0
          ? sentimentScores.reduce((a, b) => a + b, 0) / sentimentScores.length
          : 0,
      winRate: compareOutcomes.total > 0 ? compareOutcomes.win / compareOutcomes.total : 0,
      recStrength:
        recStrengths.length > 0
          ? recStrengths.reduce((a, b) => a + b, 0) / recStrengths.length
          : 0,
    },
    competitorRanking,
  };
}

// Chart configuration for shadcn/recharts
const chartConfig: ChartConfig = {
  openai: { label: "GPT 5.2", color: "#1f3b2c" },
  anthropic: { label: "Haiku 4.5", color: "#b86f3a" },
  gemini: { label: "Gemini 3", color: "#6e7c5b" },
  xai: { label: "Grok 4", color: "#7c6b7c" },
};

export default function VisibilityMatrixPage() {
  const [matrixData, setMatrixData] = useState<Record<string, CellData>>({});
  const [selection, setSelection] = useState<SelectionType>({ type: "all" });
  const [isRunning, setIsRunning] = useState(false);
  const [enabledProviders, setEnabledProviders] = useState<Set<Provider>>(
    new Set(["openai", "anthropic", "gemini", "xai"])
  );
  const [deepDiveOpen, setDeepDiveOpen] = useState(false);
  const [benchmarkHistory, setBenchmarkHistory] = useState<BenchmarkRun[]>([]);
  const [selectedTimeIndex, setSelectedTimeIndex] = useState<number>(0);
  const [trendMetric, setTrendMetric] = useState<"visibility" | "sentiment" | "winrate" | "recommendation">("visibility");
  const [personas, setPersonas] = useState<PersonaConfig[]>(DEFAULT_PERSONAS);
  const [editingPersona, setEditingPersona] = useState<Persona | null>(null);
  const [editValue, setEditValue] = useState("");
  const [evidenceModal, setEvidenceModal] = useState<EvidenceModalData | null>(null);
  const [queryPanelOpen, setQueryPanelOpen] = useState(false);
  const [queryPanelScope, setQueryPanelScope] = useState<"cell" | "row" | "column" | "all">("cell");
  const [queryPanelPersona, setQueryPanelPersona] = useState<Persona | undefined>();
  const [queryPanelStage, setQueryPanelStage] = useState<Stage | undefined>();
  const [chatOpen, setChatOpen] = useState(false);
  const [chatContext, setChatContext] = useState<ChatContext>({ scope: "global" });
  const [localQueryBank, setLocalQueryBank] = useState<QueryBank>(() => createEmptyQueryBank());
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetch("/api/intents/library")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("Failed to load intents"))))
      .then((library: IntentLibrary) => {
        if (cancelled) return;
        setLocalQueryBank(buildQueryBankFromIntentLibrary(library));
      })
      .catch((err) => {
        console.error("Failed to load intent library:", err);
      });

    fetch("/api/benchmark/runs/history?limit=13")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("Failed to load history"))))
      .then((data: { runs: StoredRun[] }) => {
        if (cancelled) return;
        const runs = data.runs.map(toUiBenchmarkRun);
        const history = runs.length > 0 ? runs.slice().reverse() : MOCK_HISTORY;
        setBenchmarkHistory(history);
        setSelectedTimeIndex(history.length - 1);
      })
      .catch(() => {
        if (cancelled) return;
        setBenchmarkHistory(MOCK_HISTORY);
        setSelectedTimeIndex(MOCK_HISTORY.length - 1);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // Helper to open query panel at different scopes
  const openQueryPanel = (scope: "cell" | "row" | "column" | "all", persona?: Persona, stage?: Stage) => {
    setQueryPanelScope(scope);
    setQueryPanelPersona(persona);
    setQueryPanelStage(stage);
    setQueryPanelOpen(true);
  };

  const persistQueryBank = async (queryBank: QueryBank) => {
    const resp = await fetch("/api/intents/library/queries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ queryBank }),
    });
    if (!resp.ok) {
      throw new Error("Failed to save intent queries");
    }
    setLocalQueryBank(queryBank);
  };

  // Helper to convert QueryResult[] to the format expected by ChatContext
  const convertToQueryResultData = (results: QueryResult[]) => {
    return results.map(qr => ({
      query: qr.query,
      responses: qr.responses.map(r => ({
        provider: r.provider,
        model: r.model,
        text: r.text,
        visibility: {
          score: r.visibility.score,
          mentioned: r.visibility.mentioned,
          position: r.visibility.position as "1st" | "2nd" | "3rd" | "later" | "absent",
          sentiment: r.visibility.sentiment,
          competitorsMentioned: r.visibility.competitorsMentioned,
          recommendationStrength: (r.visibility.recommendationStrength || "none") as "strong" | "moderate" | "weak" | "none",
          comparisonOutcome: (r.visibility.comparisonOutcome || "none") as "favorable" | "unfavorable" | "neutral" | "none",
        },
        error: r.error,
      })),
    }));
  };

  // Helper to open chat at different scopes with data
  const openChat = (context: Omit<ChatContext, "brand" | "queryResults">, results?: QueryResult[]) => {
    const fullContext: ChatContext = {
      ...context,
      brand: BRAND,
      queryResults: results ? convertToQueryResultData(results) : undefined,
    };
    setChatContext(fullContext);
    setChatOpen(true);
  };

  // Initialize matrix data
  const initializeMatrix = useCallback(() => {
    const data: Record<string, CellData> = {};
    for (const persona of personas) {
      for (const stage of STAGES) {
        const key = `${persona.id}-${stage.id}`;
        const entry = localQueryBank[persona.id][stage.id];
        data[key] = {
          persona: persona.id,
          stage: stage.id,
          intents: entry.intents,
          results: [],
          avgScore: 0,
          mentionRate: 0,
          status: "idle",
        };
      }
    }
    return data;
  }, [personas, localQueryBank]);

  useEffect(() => {
    if (Object.keys(matrixData).length === 0) {
      setMatrixData(initializeMatrix());
    }
  }, [initializeMatrix, matrixData]);

  const runCellsBenchmark = async (cellKeys: string[], quickTest: boolean, signal?: AbortSignal) => {
    const matrix = Object.keys(matrixData).length > 0 ? matrixData : initializeMatrix();
    setMatrixData(matrix);

    const targetCells = cellKeys
      .map((key) => {
        const cell = matrix[key];
        if (!cell) return null;
        return { key, persona: cell.persona, stage: cell.stage };
      })
      .filter(Boolean) as Array<{ key: string; persona: Persona; stage: Stage }>;

    if (targetCells.length === 0) return;

    setMatrixData((prev) => {
      const next = { ...prev };
      for (const t of targetCells) {
        next[t.key] = { ...next[t.key], status: "running" };
      }
      return next;
    });

    const providers = Array.from(enabledProviders).map((p) => ({
      provider: p,
      model: PROVIDER_MODELS[p],
    }));

    try {
      const response = await fetch("/api/benchmark/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brand: BRAND,
          brandAliases: BRAND_ALIASES,
          quickTest,
          providers,
          cells: targetCells.map((t) => ({ persona: t.persona, stage: t.stage })),
        }),
        signal,
      });

      if (!response.ok) throw new Error("Benchmark failed");

      const { run, resultsByCell }: { run: StoredRun; resultsByCell: Record<string, { queries: QueryResult[] }> } =
        await response.json();

      setMatrixData((prev) => {
        const next = { ...prev };

        for (const t of targetCells) {
          const result = resultsByCell[t.key];
          if (!result) {
            next[t.key] = { ...next[t.key], status: "idle" };
            continue;
          }

          const allScores: number[] = [];
          let mentionCount = 0;
          let totalResponses = 0;

          for (const qr of result.queries) {
            for (const resp of qr.responses) {
              if (!resp.error) {
                allScores.push(resp.visibility.score);
                totalResponses++;
                if (resp.visibility.mentioned) mentionCount++;
              }
            }
          }

          const avgScore =
            allScores.length > 0 ? allScores.reduce((a, b) => a + b, 0) / allScores.length : 0;
          const mentionRate = totalResponses > 0 ? mentionCount / totalResponses : 0;

          // Extract stage-specific metrics from the run object
          // The run uses underscore separator (e.g., "luxury_explore"), UI uses dash
          const runCellKey = `${t.persona}_${t.stage}`;
          const runCell = run.cells[runCellKey];
          const stageMetrics = runCell?.metrics ?? {};

          next[t.key] = {
            ...next[t.key],
            results: result.queries,
            avgScore,
            mentionRate,
            status: "complete",
            stageMetrics,
          };
        }

        return next;
      });

      const uiRun = toUiBenchmarkRun(run);
      setBenchmarkHistory((prev) => {
        const next = [...prev.slice(-12), uiRun];
        setSelectedTimeIndex(next.length - 1);
        return next;
      });
    } catch (error) {
      if ((error as Error).name === "AbortError") {
        setMatrixData((prev) => {
          const next = { ...prev };
          for (const t of targetCells) {
            next[t.key] = { ...next[t.key], status: "idle" };
          }
          return next;
        });
        return;
      }

      console.error("Benchmark error:", error);
      setMatrixData((prev) => {
        const next = { ...prev };
        for (const t of targetCells) {
          next[t.key] = { ...next[t.key], status: "idle" };
        }
        return next;
      });
    }
  };

  // Run benchmark for selection
  const runBenchmark = async (quickTest = false) => {
    setIsRunning(true);
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    const matrix = Object.keys(matrixData).length > 0 ? matrixData : initializeMatrix();
    setMatrixData(matrix);

    let cellKeys: string[] = [];

    if (selection.type === "all") {
      cellKeys = Object.keys(matrix);
    } else if (selection.type === "cell") {
      cellKeys = [`${selection.persona}-${selection.stage}`];
    } else if (selection.type === "row") {
      cellKeys = STAGES.map((s) => `${selection.persona}-${s.id}`);
    } else if (selection.type === "column") {
      cellKeys = personas.map((p) => `${p.id}-${selection.stage}`);
    }

    await runCellsBenchmark(cellKeys, quickTest, signal);

    setIsRunning(false);
    abortControllerRef.current = null;
  };

  const stopBenchmark = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  };

  const toggleProvider = (provider: Provider) => {
    setEnabledProviders(prev => {
      const next = new Set(prev);
      if (next.has(provider)) {
        if (next.size > 1) next.delete(provider);
      } else {
        next.add(provider);
      }
      return next;
    });
  };

  const startEditingPersona = (persona: PersonaConfig) => {
    setEditingPersona(persona.id);
    setEditValue(persona.description);
  };

  const savePersonaEdit = () => {
    if (editingPersona && editValue.trim()) {
      setPersonas(prev => prev.map(p =>
        p.id === editingPersona ? { ...p, description: editValue.trim() } : p
      ));
    }
    setEditingPersona(null);
    setEditValue("");
  };

  // Background color based on legacy score (kept for hover cards / future use)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const getCellBgColor = (score: number, mentionRate: number): string => {
    if (mentionRate === 0) return "bg-[#f0d9d9]";
    if (score >= 0.6) return "bg-[#d4e5d4]";
    if (score >= 0.4) return "bg-[#efe6d9]";
    if (score >= 0.2) return "bg-[#f5e6d3]";
    return "bg-[#f0d9d9]";
  };

  // Check if a cell/row/column is in the current selection
  const isInSelection = (personaId: Persona, stageId: Stage): boolean => {
    if (selection.type === "all") return false; // Don't highlight all
    if (selection.type === "cell") return selection.persona === personaId && selection.stage === stageId;
    if (selection.type === "row") return selection.persona === personaId;
    if (selection.type === "column") return selection.stage === stageId;
    return false;
  };

  const isRowSelected = (personaId: Persona): boolean => {
    return selection.type === "row" && selection.persona === personaId;
  };

  const isColumnSelected = (stageId: Stage): boolean => {
    return selection.type === "column" && selection.stage === stageId;
  };

  const getFilteredCellStats = useCallback((cell: CellData) => {
    if (cell.status !== "complete" || cell.results.length === 0) {
      return { avgScore: 0, mentionRate: 0, mentionCount: 0, totalResponses: 0 };
    }

    let totalScore = 0;
    let mentionCount = 0;
    let totalResponses = 0;

    for (const qr of cell.results) {
      for (const resp of qr.responses) {
        if (enabledProviders.has(resp.provider as Provider) && !resp.error) {
          totalScore += resp.visibility.score;
          totalResponses++;
          if (resp.visibility.mentioned) mentionCount++;
        }
      }
    }

    return {
      avgScore: totalResponses > 0 ? totalScore / totalResponses : 0,
      mentionRate: totalResponses > 0 ? mentionCount / totalResponses : 0,
      mentionCount,
      totalResponses,
    };
  }, [enabledProviders]);

  const overallStats = useMemo(() => {
    const cells = Object.values(matrixData).filter(c => c.status === "complete");
    if (cells.length === 0) return null;

    let totalScore = 0;
    let totalMentions = 0;
    let totalResponses = 0;
    let blindSpots = 0;

    for (const cell of cells) {
      const stats = getFilteredCellStats(cell);
      totalScore += stats.avgScore * stats.totalResponses;
      totalMentions += stats.mentionCount;
      totalResponses += stats.totalResponses;
      if (stats.mentionRate < 0.5) blindSpots++;
    }

    const avgScore = totalResponses > 0 ? totalScore / totalResponses : 0;
    const avgMentionRate = totalResponses > 0 ? totalMentions / totalResponses : 0;

    return { avgScore, avgMentionRate, blindSpots, totalCells: cells.length };
  }, [matrixData, getFilteredCellStats]);

  const selectedCellsData = useMemo(() => {
    const cells: CellData[] = [];

    if (selection.type === "all") {
      cells.push(...Object.values(matrixData).filter(c => c.status === "complete"));
    } else if (selection.type === "cell") {
      const cell = matrixData[`${selection.persona}-${selection.stage}`];
      if (cell?.status === "complete") cells.push(cell);
    } else if (selection.type === "row") {
      for (const stage of STAGES) {
        const cell = matrixData[`${selection.persona}-${stage.id}`];
        if (cell?.status === "complete") cells.push(cell);
      }
    } else if (selection.type === "column") {
      for (const persona of personas) {
        const cell = matrixData[`${persona.id}-${selection.stage}`];
        if (cell?.status === "complete") cells.push(cell);
      }
    }

    return cells;
  }, [selection, matrixData, personas]);

  const competitorCounts = useMemo(() => {
    const counts: Record<string, number> = {};

    for (const cell of selectedCellsData) {
      for (const qr of cell.results) {
        for (const resp of qr.responses) {
          if (enabledProviders.has(resp.provider as Provider)) {
            for (const comp of resp.visibility.competitorsMentioned) {
              counts[comp] = (counts[comp] || 0) + 1;
            }
          }
        }
      }
    }

    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
  }, [selectedCellsData, enabledProviders]);

  // Computed for future provider comparison view
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _modelStats = useMemo(() => {
    const stats: Record<Provider, { score: number; mentions: number; total: number }> = {
      openai: { score: 0, mentions: 0, total: 0 },
      anthropic: { score: 0, mentions: 0, total: 0 },
      gemini: { score: 0, mentions: 0, total: 0 },
      xai: { score: 0, mentions: 0, total: 0 },
    };

    for (const cell of selectedCellsData) {
      for (const qr of cell.results) {
        for (const resp of qr.responses) {
          const provider = resp.provider as Provider;
          if (!resp.error) {
            stats[provider].score += resp.visibility.score;
            stats[provider].total++;
            if (resp.visibility.mentioned) stats[provider].mentions++;
          }
        }
      }
    }

    return PROVIDERS.map(p => ({
      ...p,
      avgScore: stats[p.id].total > 0 ? stats[p.id].score / stats[p.id].total : 0,
      mentionRate: stats[p.id].total > 0 ? stats[p.id].mentions / stats[p.id].total : 0,
      total: stats[p.id].total,
    }));
  }, [selectedCellsData]);

  // Stage-specific insights
  const stageInsights = useMemo(() => {
    // Determine which stage to show insights for
    let targetStage: Stage | null = null;
    if (selection.type === "column") {
      targetStage = selection.stage;
    } else if (selection.type === "cell") {
      targetStage = selection.stage;
    }

    // Gather all responses for the selected cells
    const responses: {
      position: string;
      sentiment: string;
      comparisonOutcome: string;
      recommendationStrength: string;
    }[] = [];

    for (const cell of selectedCellsData) {
      for (const qr of cell.results) {
        for (const resp of qr.responses) {
          if (enabledProviders.has(resp.provider as Provider) && !resp.error) {
            responses.push({
              position: resp.visibility.position,
              sentiment: resp.visibility.sentiment,
              comparisonOutcome: resp.visibility.comparisonOutcome || "neutral",
              recommendationStrength: resp.visibility.recommendationStrength || "none",
            });
          }
        }
      }
    }

    // Position distribution (Explore)
    const positionCounts = { "1st": 0, "2nd": 0, "3rd": 0, "later": 0, "absent": 0 };
    for (const r of responses) {
      if (r.position in positionCounts) {
        positionCounts[r.position as keyof typeof positionCounts]++;
      }
    }
    const totalPositions = responses.length;
    const firstRate = totalPositions > 0 ? positionCounts["1st"] / totalPositions : 0;

    // Sentiment distribution (Consider)
    const sentimentCounts = { positive: 0, negative: 0, neutral: 0 };
    for (const r of responses) {
      if (r.sentiment in sentimentCounts) {
        sentimentCounts[r.sentiment as keyof typeof sentimentCounts]++;
      }
    }
    const totalSentiments = responses.length;
    const sentimentScore = totalSentiments > 0
      ? (sentimentCounts.positive - sentimentCounts.negative) / totalSentiments
      : 0;

    // Win rate (Compare)
    const comparisonCounts = { favorable: 0, unfavorable: 0, neutral: 0, none: 0 };
    for (const r of responses) {
      if (r.comparisonOutcome in comparisonCounts) {
        comparisonCounts[r.comparisonOutcome as keyof typeof comparisonCounts]++;
      }
    }
    const totalComparisons = comparisonCounts.favorable + comparisonCounts.unfavorable;
    const winRate = totalComparisons > 0 ? comparisonCounts.favorable / totalComparisons : 0;

    // Recommendation strength (Decide)
    const recCounts = { strong: 0, moderate: 0, weak: 0, none: 0 };
    for (const r of responses) {
      if (r.recommendationStrength in recCounts) {
        recCounts[r.recommendationStrength as keyof typeof recCounts]++;
      }
    }
    const totalRecs = responses.length;

    return {
      targetStage,
      totalResponses: responses.length,
      // Explore
      positionCounts,
      firstRate,
      // Consider
      sentimentCounts,
      sentimentScore,
      // Compare
      comparisonCounts,
      winRate,
      // Decide
      recCounts,
      totalRecs,
    };
  }, [selectedCellsData, selection, enabledProviders]);

  // Build evidence data for modals
  const buildPositionEvidence = useCallback((): EvidenceModalData => {
    const items: EvidenceModalData["items"] = [];
    for (const cell of selectedCellsData) {
      for (const qr of cell.results) {
        for (const resp of qr.responses) {
          if (enabledProviders.has(resp.provider as Provider) && !resp.error) {
            const provider = PROVIDERS.find(p => p.id === resp.provider);
            items.push({
              query: qr.query,
              model: provider?.label || resp.model,
              provider: resp.provider as Provider,
              excerpt: resp.text.slice(0, 300) + (resp.text.length > 300 ? "..." : ""),
              metric: "Position",
              metricValue: resp.visibility.position,
            });
          }
        }
      }
    }
    return { type: "position", title: "Position Distribution Evidence", items };
  }, [selectedCellsData, enabledProviders]);

  const buildSentimentEvidence = useCallback((): EvidenceModalData => {
    const items: EvidenceModalData["items"] = [];
    for (const cell of selectedCellsData) {
      for (const qr of cell.results) {
        for (const resp of qr.responses) {
          if (enabledProviders.has(resp.provider as Provider) && !resp.error) {
            const provider = PROVIDERS.find(p => p.id === resp.provider);
            items.push({
              query: qr.query,
              model: provider?.label || resp.model,
              provider: resp.provider as Provider,
              excerpt: resp.text.slice(0, 300) + (resp.text.length > 300 ? "..." : ""),
              metric: "Sentiment",
              metricValue: resp.visibility.sentiment,
            });
          }
        }
      }
    }
    return { type: "sentiment", title: "Sentiment Analysis Evidence", items };
  }, [selectedCellsData, enabledProviders]);

  const buildCompetitorEvidence = useCallback((competitor: string): EvidenceModalData => {
    const items: EvidenceModalData["items"] = [];
    for (const cell of selectedCellsData) {
      for (const qr of cell.results) {
        for (const resp of qr.responses) {
          if (enabledProviders.has(resp.provider as Provider) && !resp.error) {
            if (resp.visibility.competitorsMentioned.includes(competitor)) {
              const provider = PROVIDERS.find(p => p.id === resp.provider);
              items.push({
                query: qr.query,
                model: provider?.label || resp.model,
                provider: resp.provider as Provider,
                excerpt: resp.text.slice(0, 300) + (resp.text.length > 300 ? "..." : ""),
                metric: "Competitor",
                metricValue: competitor,
              });
            }
          }
        }
      }
    }
    return { type: "competitor", title: `${competitor} Mentions`, items };
  }, [selectedCellsData, enabledProviders]);

  const buildWinRateEvidence = useCallback((): EvidenceModalData => {
    const items: EvidenceModalData["items"] = [];
    for (const cell of selectedCellsData) {
      for (const qr of cell.results) {
        for (const resp of qr.responses) {
          if (enabledProviders.has(resp.provider as Provider) && !resp.error) {
            const outcome = resp.visibility.comparisonOutcome || "none";
            if (outcome !== "none") {
              const provider = PROVIDERS.find(p => p.id === resp.provider);
              items.push({
                query: qr.query,
                model: provider?.label || resp.model,
                provider: resp.provider as Provider,
                excerpt: resp.text.slice(0, 300) + (resp.text.length > 300 ? "..." : ""),
                metric: "Comparison",
                metricValue: outcome,
              });
            }
          }
        }
      }
    }
    return { type: "winrate", title: "Comparison Evidence", items };
  }, [selectedCellsData, enabledProviders]);

  const buildRecommendationEvidence = useCallback((): EvidenceModalData => {
    const items: EvidenceModalData["items"] = [];
    for (const cell of selectedCellsData) {
      for (const qr of cell.results) {
        for (const resp of qr.responses) {
          if (enabledProviders.has(resp.provider as Provider) && !resp.error) {
            const strength = resp.visibility.recommendationStrength || "none";
            const provider = PROVIDERS.find(p => p.id === resp.provider);
            items.push({
              query: qr.query,
              model: provider?.label || resp.model,
              provider: resp.provider as Provider,
              excerpt: resp.text.slice(0, 300) + (resp.text.length > 300 ? "..." : ""),
              metric: "Recommendation",
              metricValue: strength,
            });
          }
        }
      }
    }
    return { type: "recommendation", title: "Recommendation Strength Evidence", items };
  }, [selectedCellsData, enabledProviders]);

  // Get selected historical data point for time slider
  const selectedHistoricalData = useMemo(() => {
    if (benchmarkHistory.length === 0) return null;
    const idx = Math.min(selectedTimeIndex, benchmarkHistory.length - 1);
    return benchmarkHistory[idx];
  }, [benchmarkHistory, selectedTimeIndex]);

  const isViewingHistory = selectedTimeIndex < benchmarkHistory.length - 1;

  // Display insights - use historical data when viewing past, live data for "now"
  const displayInsights = useMemo(() => {
    if (isViewingHistory && selectedHistoricalData?.stageData) {
      const hist = selectedHistoricalData.stageData;
      const totalPos = Object.values(hist.positionCounts).reduce((a, b) => a + b, 0);
      return {
        ...stageInsights,
        positionCounts: hist.positionCounts,
        firstRate: totalPos > 0 ? hist.positionCounts["1st"] / totalPos : 0,
        sentimentScore: hist.sentimentScore,
        winRate: hist.winRate,
        totalResponses: totalPos, // So we show something
      };
    }
    return stageInsights;
  }, [isViewingHistory, selectedHistoricalData, stageInsights]);

  // Display competitors - use historical data when viewing past
  const displayCompetitors = useMemo(() => {
    if (isViewingHistory && selectedHistoricalData?.competitorRanking) {
      return selectedHistoricalData.competitorRanking.map((name, idx) => [name, 10 - idx] as [string, number]);
    }
    return competitorCounts;
  }, [isViewingHistory, selectedHistoricalData, competitorCounts]);

  const selectionLabel = useMemo(() => {
    if (selection.type === "all") return "All Cells";
    if (selection.type === "cell") {
      const p = personas.find(x => x.id === selection.persona)?.label;
      const s = STAGES.find(x => x.id === selection.stage)?.label;
      return `${p} × ${s}`;
    }
    if (selection.type === "row") {
      return `${personas.find(x => x.id === selection.persona)?.label}`;
    }
    if (selection.type === "column") {
      return `${STAGES.find(x => x.id === selection.stage)?.label}`;
    }
    return "";
  }, [selection, personas]);

  const queryCount = useMemo(() => {
    let count = 0;
    if (selection.type === "all") {
      for (const p of personas) {
        for (const s of STAGES) {
          count += localQueryBank[p.id][s.id].intents.reduce((acc, i) => acc + i.manifestations.length, 0);
        }
      }
    } else if (selection.type === "cell") {
      count = localQueryBank[selection.persona][selection.stage].intents.reduce((acc, i) => acc + i.manifestations.length, 0);
    } else if (selection.type === "row") {
      for (const s of STAGES) {
        count += localQueryBank[selection.persona][s.id].intents.reduce((acc, i) => acc + i.manifestations.length, 0);
      }
    } else if (selection.type === "column") {
      for (const p of personas) {
        count += localQueryBank[p.id][selection.stage].intents.reduce((acc, i) => acc + i.manifestations.length, 0);
      }
    }
    return count;
  }, [selection, personas, localQueryBank]);

  return (
    <div className="min-h-screen bg-[#f6f1e8]">
      {/* Header */}
      <div className="bg-[#1f3b2c] text-white px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/">
              <Button variant="ghost" size="sm" className="text-white/70 hover:text-white hover:bg-white/10">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
            </Link>
            <div>
              <h1 className="text-xl font-semibold tracking-tight">AI Visibility Matrix</h1>
              <p className="text-sm text-white/60">{BRAND} • Persona × Stage</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={() => openQueryPanel("all")}
              variant="outline"
              size="sm"
              className="bg-transparent border-white/30 text-white hover:bg-white/10"
            >
              <FileText className="h-4 w-4 mr-2" />
              Query Bank
            </Button>
            <Button
              onClick={() => {
                // Collect all results from all cells
                const allResults = Object.values(matrixData)
                  .filter(cell => cell.status === "complete")
                  .flatMap(cell => cell.results);
                openChat({ scope: "global" }, allResults);
              }}
              variant="outline"
              size="sm"
              className="bg-transparent border-white/30 text-white hover:bg-white/10"
            >
              <MessageSquare className="h-4 w-4 mr-2" />
              Ask AI
            </Button>
            {isRunning ? (
              <Button onClick={stopBenchmark} className="bg-[#b86f3a] hover:bg-[#a65f2a] text-white">
                <Square className="h-4 w-4 mr-2" />
                Stop
              </Button>
            ) : (
              <>
                <Button onClick={() => runBenchmark(true)} variant="outline" size="sm" className="bg-transparent border-white/30 text-white hover:bg-white/10">
                  <Zap className="h-4 w-4 mr-2" />
                  Quick Test
                </Button>
                <Button onClick={() => runBenchmark(false)} size="sm" className="bg-[#6e7c5b] hover:bg-[#5e6c4b] text-white">
                  <Play className="h-4 w-4 mr-2" />
                  Run {selection.type === "all" ? "All" : selectionLabel}
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto p-6 space-y-6">
        {/* Model Filter - Pill toggles */}
        <div className="flex items-center gap-3">
          <span className="text-sm text-[#1e1b16]/60">Models:</span>
          {PROVIDERS.map(p => (
            <button
              key={p.id}
              onClick={() => toggleProvider(p.id)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                enabledProviders.has(p.id)
                  ? `${p.bgColor} text-white shadow-sm`
                  : "bg-[#efe6d9] text-[#1e1b16]/50"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* MATRIX - CSS Grid with dotted canvas */}
        <div
          className="rounded-2xl border border-[#e3dacb] bg-[#fffaf2] p-6"
          style={{
            backgroundImage: `radial-gradient(circle, #d4c9b820 1px, transparent 1px)`,
            backgroundSize: '20px 20px',
          }}
        >
          {/* CSS Grid Matrix */}
          <div
            className="grid gap-2"
            style={{
              gridTemplateColumns: `180px repeat(${STAGES.length}, 1fr)`,
            }}
          >
            {/* Row 0: Empty corner + Stage Headers */}
            <div /> {/* Empty corner cell */}
            {STAGES.map(stage => {
              const isSelected = isColumnSelected(stage.id);
              return (
                <div
                  key={stage.id}
                  className={`
                    relative text-center px-3 py-3 cursor-pointer rounded-xl transition-all group
                    ${isSelected ? "bg-[#1f3b2c]/10" : "hover:bg-[#efe6d9]/50"}
                  `}
                  onClick={() => setSelection(
                    isSelected ? { type: "all" } : { type: "column", stage: stage.id }
                  )}
                  onDoubleClick={() => openQueryPanel("column", undefined, stage.id)}
                >
                  {/* Top accent bar for column selection */}
                  {isSelected && (
                    <div 
                      className="absolute left-0 right-0 top-0 h-1.5 bg-[#1f3b2c] rounded-t-xl"
                      style={{ boxShadow: '0 0 8px 2px rgba(31, 59, 44, 0.4)' }}
                    />
                  )}
                  <div className="flex items-center justify-center gap-1">
                    <span className="text-base font-medium text-[#1e1b16]">{stage.label}</span>
                    <button
                      onClick={(e) => { e.stopPropagation(); openQueryPanel("column", undefined, stage.id); }}
                      className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-[#efe6d9] rounded transition-opacity"
                      title="Edit queries for this stage"
                    >
                      <FileText className="h-3.5 w-3.5 text-[#1e1b16]/40" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        // Get all results for this stage across all personas
                        const stageResults = Object.values(matrixData)
                          .filter(cell => cell.stage === stage.id && cell.status === "complete")
                          .flatMap(cell => cell.results);
                        openChat({ scope: "column", stage: stage.id }, stageResults);
                      }}
                      className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-[#efe6d9] rounded transition-opacity"
                      title="Ask about this stage"
                    >
                      <MessageSquare className="h-3.5 w-3.5 text-[#1e1b16]/40" />
                    </button>
                  </div>
                  <div className="text-sm text-[#1e1b16]/40">{stage.description}</div>
                </div>
              );
            })}

            {/* Data Rows: Persona Label + Cells */}
            {personas.map(persona => {
              const rowSelected = isRowSelected(persona.id);
              
              return (
                <Fragment key={persona.id}>
                  {/* Persona Label - Editable */}
                  <div
                    className={`
                      relative px-3 py-3 rounded-xl cursor-pointer transition-all group
                      ${rowSelected ? "bg-[#1f3b2c]/10" : "hover:bg-[#efe6d9]/50"}
                    `}
                    onClick={() => {
                      if (editingPersona !== persona.id) {
                        setSelection(
                          rowSelected ? { type: "all" } : { type: "row", persona: persona.id }
                        );
                      }
                    }}
                    onDoubleClick={() => openQueryPanel("row", persona.id)}
                  >
                    {/* Left accent bar for row selection */}
                    {rowSelected && (
                      <div 
                        className="absolute left-0 top-0 bottom-0 w-1.5 bg-[#1f3b2c] rounded-l-xl"
                        style={{ boxShadow: '0 0 8px 2px rgba(31, 59, 44, 0.4)' }}
                      />
                    )}
                    <div className="flex items-center gap-1">
                      <span className="text-base font-medium text-[#1e1b16]">{persona.label}</span>
                      <button
                        onClick={(e) => { e.stopPropagation(); openQueryPanel("row", persona.id); }}
                        className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-[#efe6d9] rounded transition-opacity"
                        title="Edit queries for this persona"
                      >
                        <FileText className="h-3.5 w-3.5 text-[#1e1b16]/40" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          // Get all results for this persona across all stages
                          const personaResults = Object.values(matrixData)
                            .filter(cell => cell.persona === persona.id && cell.status === "complete")
                            .flatMap(cell => cell.results);
                          openChat({ scope: "row", persona: persona.id }, personaResults);
                        }}
                        className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-[#efe6d9] rounded transition-opacity"
                        title="Ask about this persona"
                      >
                        <MessageSquare className="h-3.5 w-3.5 text-[#1e1b16]/40" />
                      </button>
                    </div>
                    {editingPersona === persona.id ? (
                      <div className="flex items-center gap-1 mt-1">
                        <input
                          type="text"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && savePersonaEdit()}
                          className="flex-1 text-xs bg-white border border-[#e3dacb] rounded px-1.5 py-0.5 text-[#1e1b16] focus:outline-none focus:ring-1 focus:ring-[#1f3b2c]"
                          autoFocus
                          onClick={(e) => e.stopPropagation()}
                        />
                        <button
                          onClick={(e) => { e.stopPropagation(); savePersonaEdit(); }}
                          className="p-0.5 hover:bg-[#d4e5d4] rounded"
                        >
                          <Check className="h-3 w-3 text-[#3b5a3b]" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1">
                        <span className="text-sm text-[#1e1b16]/50">{persona.description}</span>
                        <button
                          onClick={(e) => { e.stopPropagation(); startEditingPersona(persona); }}
                          className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-[#efe6d9] rounded transition-opacity"
                        >
                          <Pencil className="h-3.5 w-3.5 text-[#1e1b16]/40" />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Matrix Cells */}
                  {STAGES.map(stage => {
                    const cellKey = `${persona.id}-${stage.id}`;
                    const cell = matrixData[cellKey];
                    const cellSelected = selection.type === "cell" && selection.persona === persona.id && selection.stage === stage.id;
                    const inSelection = isInSelection(persona.id, stage.id);
                    const cellQueries = localQueryBank[persona.id][stage.id];

                    return (
                      <HoverCard key={stage.id} openDelay={300}>
                        <HoverCardTrigger asChild>
                          <div
                            onClick={() => {
                              if (cell?.status === "idle" && !isRunning) {
                                runCellsBenchmark([cellKey], true);
                              } else {
                                setSelection({ type: "cell", persona: persona.id, stage: stage.id });
                              }
                            }}
                            className={`
                              rounded-xl transition-all cursor-pointer
                              ${inSelection ? "ring-2 ring-[#1f3b2c]/30 ring-inset" : ""}
                              hover:scale-[1.02]
                            `}
                          >
                            <StageCell
                              stage={stage.id}
                              metrics={cell?.stageMetrics ?? {}}
                              queryCount={cellQueries.intents.reduce((acc, i) => acc + i.manifestations.length, 0)}
                              isComplete={cell?.status === "complete"}
                              isRunning={cell?.status === "running"}
                              selected={cellSelected}
                            />
                          </div>
                        </HoverCardTrigger>
                        <HoverCardContent 
                          className="w-72 bg-[#fffaf2] border-[#e3dacb]" 
                          side="bottom" 
                          align="center"
                        >
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-medium text-[#1e1b16]">
                                {persona.label} × {stage.label}
                              </span>
                              <Badge variant="outline" className="bg-[#efe6d9] border-transparent text-[#1e1b16]/60">
                                {cellQueries.queries.length} queries
                              </Badge>
                            </div>
                            <div className="space-y-1 max-h-24 overflow-y-auto">
                              {cellQueries.queries.slice(0, 5).map((q, idx) => (
                                <div key={idx} className="text-xs text-[#1e1b16]/70 flex gap-1">
                                  <span className="text-[#1e1b16]/30">•</span>
                                  <span className="line-clamp-1">&quot;{q}&quot;</span>
                                </div>
                              ))}
                              {cellQueries.queries.length > 5 && (
                                <div className="text-xs text-[#1e1b16]/40">
                                  +{cellQueries.queries.length - 5} more...
                                </div>
                              )}
                            </div>
                            <div className="pt-2 border-t border-[#e3dacb] flex gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                className="flex-1 h-7 text-xs border-[#e3dacb] text-[#1e1b16] hover:bg-[#efe6d9]"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openQueryPanel("cell", persona.id, stage.id);
                                }}
                              >
                                <FileText className="h-3 w-3 mr-1" />
                                Queries
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="flex-1 h-7 text-xs border-[#e3dacb] text-[#1e1b16] hover:bg-[#efe6d9]"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openChat({ scope: "cell", persona: persona.id, stage: stage.id }, cell.results);
                                }}
                              >
                                <MessageSquare className="h-3 w-3 mr-1" />
                                Ask
                              </Button>
                              <Button
                                size="sm"
                                className="h-7 text-xs bg-[#1f3b2c] hover:bg-[#2a4d3a] text-white px-2"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  runCellsBenchmark([cellKey], false);
                                }}
                              >
                                <Play className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        </HoverCardContent>
                      </HoverCard>
                    );
                  })}
                </Fragment>
              );
            })}
          </div>

          {/* Legend */}
          <div className="flex items-center justify-center gap-6 mt-6 pt-4 border-t border-[#e3dacb]/50 text-xs">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-lg bg-[#d4e5d4]" />
              <span className="text-[#1e1b16]/60">Strong (60%+)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-lg bg-[#efe6d9]" />
              <span className="text-[#1e1b16]/60">Moderate</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-lg bg-[#f5e6d3]" />
              <span className="text-[#1e1b16]/60">Weak</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-lg bg-[#f0d9d9]" />
              <span className="text-[#1e1b16]/60">Blind Spot</span>
            </div>
          </div>
        </div>

        {/* DETAIL PANEL - Stats, Insights, Competitors */}
        <div className="grid grid-cols-12 gap-4">
          {/* Stats Card */}
          <div className="col-span-4">
            <Card className="bg-[#fffaf2] border-[#e3dacb] shadow-none h-full">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-medium text-[#1e1b16]">
                    {selectionLabel}
                  </CardTitle>
                  <span className="text-xs text-[#1e1b16]/50">{queryCount} queries</span>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {overallStats ? (
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-[#efe6d9] rounded-xl p-3 text-center">
                      <div className="text-2xl font-semibold text-[#1f3b2c]">
                        {(overallStats.avgScore * 100).toFixed(0)}%
                      </div>
                      <div className="text-xs text-[#1e1b16]/50">Score</div>
                    </div>
                    <div className="bg-[#efe6d9] rounded-xl p-3 text-center">
                      <div className="text-2xl font-semibold text-[#1f3b2c]">
                        {(overallStats.avgMentionRate * 100).toFixed(0)}%
                      </div>
                      <div className="text-xs text-[#1e1b16]/50">Mentioned</div>
                    </div>
                    <div className="bg-[#f0d9d9] rounded-xl p-3 text-center">
                      <div className="text-2xl font-semibold text-[#8b4a4a]">
                        {overallStats.blindSpots}
                      </div>
                      <div className="text-xs text-[#1e1b16]/50">Blind Spots</div>
                    </div>
                    <div className="bg-[#d4e5d4] rounded-xl p-3 text-center">
                      <div className="text-2xl font-semibold text-[#3b5a3b]">
                        {overallStats.totalCells}
                      </div>
                      <div className="text-xs text-[#1e1b16]/50">Complete</div>
                    </div>
                  </div>
                ) : (
                  <div className="text-sm text-[#1e1b16]/40 text-center py-4">
                    Run benchmark to see stats
                  </div>
                )}

                {selectedCellsData.length > 0 && (
                  <Button
                    variant="outline"
                    className="w-full border-[#e3dacb] text-[#1e1b16] hover:bg-[#efe6d9]"
                    onClick={() => setDeepDiveOpen(true)}
                  >
                    Deep Dive
                    <ChevronRight className="h-4 w-4 ml-2" />
                  </Button>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Stage Insights - Adaptive & Clickable */}
          <div className="col-span-4">
            <Card className={`bg-[#fffaf2] border-[#e3dacb] shadow-none h-full ${isViewingHistory ? "ring-2 ring-[#b86f3a]/20" : ""}`}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-[#1e1b16] flex items-center gap-2">
                  <span>
                    {stageInsights.targetStage === "explore" && "Position Distribution"}
                    {stageInsights.targetStage === "consider" && "Sentiment Analysis"}
                    {stageInsights.targetStage === "compare" && "Win Rate"}
                    {stageInsights.targetStage === "decide" && "Recommendation Strength"}
                    {!stageInsights.targetStage && "Stage Insights"}
                  </span>
                  {isViewingHistory && (
                    <Badge variant="outline" className="bg-[#b86f3a]/10 border-[#b86f3a]/30 text-[#b86f3a] text-xs ml-auto">
                      {selectedHistoricalData?.label}
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {displayInsights.totalResponses === 0 && !isViewingHistory ? (
                  <div className="text-sm text-[#1e1b16]/40 text-center py-4">
                    {stageInsights.targetStage 
                      ? "Run benchmark to see insights"
                      : "Select a stage column for insights"}
                  </div>
                ) : stageInsights.targetStage === "explore" || isViewingHistory ? (
                  /* EXPLORE: Position Distribution - Clickable */
                  <button
                    onClick={() => !isViewingHistory && setEvidenceModal(buildPositionEvidence())}
                    className={`w-full text-left rounded-lg p-2 -m-2 transition-colors ${isViewingHistory ? "cursor-default" : "hover:bg-[#efe6d9]/50 cursor-pointer group"}`}
                  >
                    <div className="space-y-2">
                      {(["1st", "2nd", "3rd", "later", "absent"] as const).map(pos => {
                        const count = displayInsights.positionCounts[pos];
                        const pct = displayInsights.totalResponses > 0 ? count / displayInsights.totalResponses : 0;
                        return (
                          <div key={pos} className="flex items-center gap-2">
                            <span className="text-xs text-[#1e1b16]/60 w-12">{pos}</span>
                            <div className="flex-1 h-2 bg-[#efe6d9] rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all duration-300 ${pos === "1st" ? "bg-[#1f3b2c]" : pos === "absent" ? "bg-[#8b4a4a]" : "bg-[#6e7c5b]"}`}
                                style={{ width: `${pct * 100}%` }}
                              />
                            </div>
                            <span className="text-xs text-[#1e1b16]/50 w-6 text-right">{count}</span>
                          </div>
                        );
                      })}
                      <div className="flex items-center justify-between text-xs text-[#1e1b16]/50 mt-3 pt-2 border-t border-[#e3dacb]">
                        <span>First mention in {(displayInsights.firstRate * 100).toFixed(0)}% of responses</span>
                        {!isViewingHistory && <ChevronRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />}
                      </div>
                    </div>
                  </button>
                ) : stageInsights.targetStage === "consider" ? (
                  /* CONSIDER: Sentiment Gauge - Clickable with Slider */
                  <button
                    onClick={() => setEvidenceModal(buildSentimentEvidence())}
                    className="w-full text-left hover:bg-[#efe6d9]/50 rounded-lg p-2 -m-2 transition-colors cursor-pointer group"
                  >
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-[#8b4a4a]">Negative</span>
                        <span className="text-xs text-[#1e1b16]/40">Neutral</span>
                        <span className="text-xs text-[#3b5a3b]">Positive</span>
                      </div>
                      <div className="relative">
                        <div className="absolute inset-0 h-1.5 mt-[7px] bg-gradient-to-r from-[#f0d9d9] via-[#efe6d9] to-[#d4e5d4] rounded-full" />
                        <Slider
                          value={[Math.round((displayInsights.sentimentScore + 1) * 50)]}
                          min={0}
                          max={100}
                          disabled
                          className="relative [&_[data-slot=slider-track]]:bg-transparent [&_[data-slot=slider-range]]:bg-transparent [&_[data-slot=slider-thumb]]:bg-[#1f3b2c] [&_[data-slot=slider-thumb]]:border-2 [&_[data-slot=slider-thumb]]:border-white [&_[data-slot=slider-thumb]]:shadow-md [&_[data-slot=slider-thumb]]:w-4 [&_[data-slot=slider-thumb]]:h-4"
                        />
                      </div>
                      <div className="flex justify-between text-xs text-[#1e1b16]/50">
                        <span>Pos: {stageInsights.sentimentCounts.positive}</span>
                        <span>Neut: {stageInsights.sentimentCounts.neutral}</span>
                        <span>Neg: {stageInsights.sentimentCounts.negative}</span>
                      </div>
                      <div className="flex items-center justify-between text-xs text-[#1e1b16]/50 pt-2 border-t border-[#e3dacb]">
                        <span>
                          {displayInsights.sentimentScore > 0.3 ? "Generally favorable" : 
                           displayInsights.sentimentScore < -0.3 ? "Generally unfavorable" : "Mixed sentiment"}
                        </span>
                        <ChevronRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </div>
                  </button>
                ) : stageInsights.targetStage === "compare" ? (
                  /* COMPARE: Win Rate - Clickable */
                  <button
                    onClick={() => setEvidenceModal(buildWinRateEvidence())}
                    className="w-full text-left hover:bg-[#efe6d9]/50 rounded-lg p-2 -m-2 transition-colors cursor-pointer group"
                  >
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-4 bg-[#efe6d9] rounded-full overflow-hidden flex">
                          <div
                            className="h-full bg-[#3b5a3b] transition-all duration-300"
                            style={{ width: `${displayInsights.winRate * 100}%` }}
                          />
                          <div
                            className="h-full bg-[#8b4a4a] transition-all duration-300"
                            style={{ width: `${(1 - displayInsights.winRate) * 100}%` }}
                          />
                        </div>
                        <span className="text-sm font-semibold text-[#1e1b16]">
                          {(displayInsights.winRate * 100).toFixed(0)}%
                        </span>
                      </div>
                      <div className="flex justify-between text-xs text-[#1e1b16]/50">
                        <span className="text-[#3b5a3b]">Favorable: {stageInsights.comparisonCounts.favorable}</span>
                        <span className="text-[#8b4a4a]">Unfavorable: {stageInsights.comparisonCounts.unfavorable}</span>
                      </div>
                      <div className="flex items-center justify-between text-xs text-[#1e1b16]/50 pt-2 border-t border-[#e3dacb]">
                        <span>
                          {displayInsights.winRate >= 0.6 ? "Favored in comparisons" :
                           displayInsights.winRate <= 0.4 ? "Losing head-to-head" : "Mixed outcomes"}
                        </span>
                        <ChevronRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </div>
                  </button>
                ) : stageInsights.targetStage === "decide" ? (
                  /* DECIDE: Recommendation Strength - Clickable */
                  <button
                    onClick={() => setEvidenceModal(buildRecommendationEvidence())}
                    className="w-full text-left hover:bg-[#efe6d9]/50 rounded-lg p-2 -m-2 transition-colors cursor-pointer group"
                  >
                    <div className="space-y-3">
                      <div className="flex justify-center gap-1">
                        {[1, 2, 3, 4, 5].map(i => {
                          const strongPct = stageInsights.totalRecs > 0 ? stageInsights.recCounts.strong / stageInsights.totalRecs : 0;
                          const modPct = stageInsights.totalRecs > 0 ? stageInsights.recCounts.moderate / stageInsights.totalRecs : 0;
                          const filled = (strongPct + modPct * 0.6) * 5 >= i;
                          return (
                            <div
                              key={i}
                              className={`w-6 h-6 rounded-full ${filled ? "bg-[#1f3b2c]" : "bg-[#efe6d9]"}`}
                            />
                          );
                        })}
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs text-[#1e1b16]/50">
                        <div>Strong: {stageInsights.recCounts.strong}</div>
                        <div>Moderate: {stageInsights.recCounts.moderate}</div>
                        <div>Weak: {stageInsights.recCounts.weak}</div>
                        <div>None: {stageInsights.recCounts.none}</div>
                      </div>
                      <div className="flex items-center justify-between text-xs text-[#1e1b16]/50 pt-2 border-t border-[#e3dacb]">
                        <span>
                          {stageInsights.recCounts.strong > stageInsights.recCounts.weak ? "Actively recommended" :
                           stageInsights.recCounts.none > stageInsights.totalRecs / 2 ? "Rarely recommended" : "Moderately endorsed"}
                        </span>
                        <ChevronRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </div>
                  </button>
                ) : (
                  /* Default: Summary */
                  <div className="text-sm text-[#1e1b16]/40 text-center py-4">
                    Select a stage column for stage-specific insights
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Competitors - Clickable */}
          <div className="col-span-4">
            <Card className={`bg-[#fffaf2] border-[#e3dacb] shadow-none h-full ${isViewingHistory ? "ring-2 ring-[#b86f3a]/20" : ""}`}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-[#1e1b16] flex items-center gap-2">
                  <span>Top Competitors</span>
                  {isViewingHistory && (
                    <Badge variant="outline" className="bg-[#b86f3a]/10 border-[#b86f3a]/30 text-[#b86f3a] text-xs ml-auto">
                      {selectedHistoricalData?.label}
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {displayCompetitors.length > 0 ? (
                  <div className="space-y-2">
                    {displayCompetitors.map(([name, count], idx) => (
                      <button
                        key={name}
                        onClick={() => !isViewingHistory && setEvidenceModal(buildCompetitorEvidence(name))}
                        className={`w-full flex items-center gap-3 rounded-lg p-1.5 -mx-1.5 transition-colors ${isViewingHistory ? "cursor-default" : "hover:bg-[#efe6d9]/50 cursor-pointer group"}`}
                      >
                        <div className="flex-1">
                          <div className="flex justify-between text-sm">
                            <span className="text-[#1e1b16]">
                              {isViewingHistory && <span className="text-[#1e1b16]/40 mr-1">#{idx + 1}</span>}
                              {name}
                            </span>
                            <div className="flex items-center gap-1">
                              {!isViewingHistory && <span className="text-[#1e1b16]/50">{count}</span>}
                              {!isViewingHistory && <ChevronRight className="h-3 w-3 text-[#1e1b16]/30 opacity-0 group-hover:opacity-100 transition-opacity" />}
                            </div>
                          </div>
                          <div className="h-1.5 bg-[#efe6d9] rounded-full mt-1 overflow-hidden">
                            <div
                              className="h-full bg-[#7c6b7c] rounded-full transition-all duration-300"
                              style={{ width: `${(count / displayCompetitors[0][1]) * 100}%` }}
                            />
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-[#1e1b16]/40 text-center py-4">
                    Run benchmark to see competitors
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

        </div>

        {/* Trend Chart + Time Slider - Full Width */}
        <Card className="bg-[#fffaf2] border-[#e3dacb] shadow-none">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-[#1e1b16] flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-[#6e7c5b]" />
                Trend Over Time
                {isViewingHistory && (
                  <Badge variant="outline" className="bg-[#b86f3a]/10 border-[#b86f3a]/30 text-[#b86f3a] text-xs ml-2">
                    Viewing {selectedHistoricalData?.label}
                  </Badge>
                )}
              </CardTitle>
              {/* Metric Selector */}
              {benchmarkHistory.length > 1 && (
                <div className="flex gap-1">
                  {[
                    { id: "visibility", label: "Visibility" },
                    { id: "sentiment", label: "Sentiment" },
                    { id: "winrate", label: "Win Rate" },
                    { id: "recommendation", label: "Recommend" },
                  ].map((metric) => (
                    <button
                      key={metric.id}
                      onClick={() => setTrendMetric(metric.id as typeof trendMetric)}
                      className={`px-2.5 py-1 text-xs rounded-md transition-colors ${
                        trendMetric === metric.id
                          ? "bg-[#1f3b2c] text-white"
                          : "bg-[#efe6d9] text-[#1e1b16]/60 hover:bg-[#e3dacb]"
                      }`}
                    >
                      {metric.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {benchmarkHistory.length > 1 ? (
              <>
                {/* Chart */}
                <ChartContainer config={chartConfig} className="h-[180px] w-full">
                  <RechartsLineChart
                    data={benchmarkHistory.map((run) => {
                      // Data depends on selected metric
                      if (trendMetric === "visibility") {
                        return {
                          label: run.label,
                          openai: enabledProviders.has("openai") ? Math.round((run.providerScores.openai?.avgScore ?? 0) * 100) : null,
                          anthropic: enabledProviders.has("anthropic") ? Math.round((run.providerScores.anthropic?.avgScore ?? 0) * 100) : null,
                          gemini: enabledProviders.has("gemini") ? Math.round((run.providerScores.gemini?.avgScore ?? 0) * 100) : null,
                          xai: enabledProviders.has("xai") ? Math.round((run.providerScores.xai?.avgScore ?? 0) * 100) : null,
                        };
                      }
                      // For stage metrics, show single line (overall)
                      const val = trendMetric === "sentiment"
                        ? Math.round(((run.stageData?.sentimentScore ?? 0) + 1) * 50) // -1 to 1 → 0 to 100
                        : trendMetric === "winrate"
                        ? Math.round((run.stageData?.winRate ?? 0) * 100)
                        : Math.round((run.stageData?.recStrength ?? 0) * 100);
                      return { label: run.label, value: val };
                    })}
                    margin={{ top: 10, right: 10, bottom: 5, left: 0 }}
                  >
                    <XAxis 
                      dataKey="label" 
                      tick={{ fontSize: 10, fill: "#1e1b16", opacity: 0.5 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis 
                      domain={[0, 100]} 
                      tick={{ fontSize: 10, fill: "#1e1b16", opacity: 0.5 }}
                      axisLine={false}
                      tickLine={false}
                      width={30}
                      tickFormatter={(v) => `${v}%`}
                    />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    {selectedTimeIndex < benchmarkHistory.length && (
                      <ReferenceLine 
                        x={benchmarkHistory[selectedTimeIndex]?.label} 
                        stroke="#1f3b2c" 
                        strokeDasharray="4 4"
                        strokeWidth={2}
                      />
                    )}
                    {trendMetric === "visibility" ? (
                      <>
                        {enabledProviders.has("openai") && (
                          <Line type="monotone" dataKey="openai" stroke="var(--color-openai)" strokeWidth={2} dot={false} connectNulls />
                        )}
                        {enabledProviders.has("anthropic") && (
                          <Line type="monotone" dataKey="anthropic" stroke="var(--color-anthropic)" strokeWidth={2} dot={false} connectNulls />
                        )}
                        {enabledProviders.has("gemini") && (
                          <Line type="monotone" dataKey="gemini" stroke="var(--color-gemini)" strokeWidth={2} dot={false} connectNulls />
                        )}
                        {enabledProviders.has("xai") && (
                          <Line type="monotone" dataKey="xai" stroke="var(--color-xai)" strokeWidth={2} dot={false} connectNulls />
                        )}
                      </>
                    ) : (
                      <Line 
                        type="monotone" 
                        dataKey="value" 
                        stroke={
                          trendMetric === "sentiment" ? "#6e7c5b" : 
                          trendMetric === "winrate" ? "#b86f3a" : 
                          "#1f3b2c"
                        } 
                        strokeWidth={2.5} 
                        dot={{ fill: trendMetric === "sentiment" ? "#6e7c5b" : trendMetric === "winrate" ? "#b86f3a" : "#1f3b2c", r: 3 }}
                        connectNulls 
                      />
                    )}
                  </RechartsLineChart>
                </ChartContainer>
                
                {/* Time Slider - below chart like Keynote */}
                <div className="px-[30px] space-y-1">
                  <Slider
                    value={[selectedTimeIndex]}
                    onValueChange={([val]) => setSelectedTimeIndex(val)}
                    min={0}
                    max={benchmarkHistory.length - 1}
                    step={1}
                    className="[&_[data-slot=slider-track]]:bg-[#e3dacb] [&_[data-slot=slider-range]]:bg-[#1f3b2c] [&_[data-slot=slider-thumb]]:bg-[#1f3b2c] [&_[data-slot=slider-thumb]]:border-2 [&_[data-slot=slider-thumb]]:border-white [&_[data-slot=slider-thumb]]:shadow-md [&_[data-slot=slider-thumb]]:w-4 [&_[data-slot=slider-thumb]]:h-4"
                  />
                  <div className="flex justify-between text-[10px] text-[#1e1b16]/40">
                    <span>{benchmarkHistory[0]?.label}</span>
                    <span className="font-medium text-[#1e1b16]/60">
                      {isViewingHistory ? `← ${selectedHistoricalData?.label}` : "Latest"}
                    </span>
                    <span>{benchmarkHistory[benchmarkHistory.length - 1]?.label}</span>
                  </div>
                </div>
              </>
            ) : (
              <div className="text-sm text-[#1e1b16]/40 text-center py-8">
                Run 2+ benchmarks to see trend over time
              </div>
            )}
          </CardContent>
        </Card>

        {/* Query Bank Info */}
        <div className="flex items-center justify-center gap-2 text-xs text-[#1e1b16]/50">
          <Lightbulb className="h-3.5 w-3.5 text-[#b86f3a]" />
          <span>Queries sourced from Reddit, Quora, City-Data (2024-2025)</span>
        </div>
      </div>

      {/* Deep Dive Dialog */}
      <Dialog open={deepDiveOpen} onOpenChange={setDeepDiveOpen}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto bg-[#fffaf2] border-[#e3dacb]">
          <DialogHeader>
            <DialogTitle className="text-[#1e1b16]">Deep Dive: {selectionLabel}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {selectedCellsData.map((cell, cellIdx) => (
              <div key={cellIdx}>
                <h4 className="font-medium text-[#1e1b16] mb-2 text-sm">
                  {personas.find(p => p.id === cell.persona)?.label} × {STAGES.find(s => s.id === cell.stage)?.label}
                </h4>
                {cell.results.map((qr, qIdx) => (
                  <div key={qIdx} className="mb-4 p-4 bg-[#efe6d9] rounded-xl">
                    <div className="font-medium text-sm text-[#1e1b16] mb-3">&quot;{qr.query}&quot;</div>
                    <div className="space-y-3">
                      {qr.responses
                        .filter(r => enabledProviders.has(r.provider as Provider))
                        .map((resp, rIdx) => {
                          const provider = PROVIDERS.find(p => p.id === resp.provider);
                          return (
                            <div key={rIdx} className="border border-[#e3dacb] rounded-xl p-3 bg-[#fffaf2]">
                              <div className="flex items-center justify-between mb-2">
                                <Badge className={`${provider?.bgColor} text-white`}>{provider?.label}</Badge>
                                <div className="flex items-center gap-2 text-xs">
                                  {resp.visibility.mentioned ? (
                                    <Badge variant="outline" className="bg-[#d4e5d4] border-[#9cb89c] text-[#3b5a3b]">
                                      <Eye className="h-3 w-3 mr-1" />
                                      {resp.visibility.position} • {(resp.visibility.score * 100).toFixed(0)}%
                                    </Badge>
                                  ) : (
                                    <Badge variant="outline" className="bg-[#f0d9d9] border-[#d4a5a5] text-[#8b4a4a]">
                                      <EyeOff className="h-3 w-3 mr-1" />
                                      Not Mentioned
                                    </Badge>
                                  )}
                                </div>
                              </div>
                              <div className="text-sm text-[#1e1b16] whitespace-pre-wrap leading-relaxed">
                                {resp.error ? (
                                  <span className="text-[#8b4a4a]">Error: {resp.error}</span>
                                ) : (
                                  highlightBrandMentions(resp.text, resp.visibility.sentiment)
                                )}
                              </div>
                              {resp.visibility.competitorsMentioned.length > 0 && (
                                <div className="mt-2 text-xs text-[#1e1b16]/50">
                                  Competitors: {resp.visibility.competitorsMentioned.join(", ")}
                                </div>
                              )}
                            </div>
                          );
                        })}
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Evidence Modal */}
      <Dialog open={evidenceModal !== null} onOpenChange={(open) => !open && setEvidenceModal(null)}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto bg-[#fffaf2] border-[#e3dacb]">
          <DialogHeader>
            <DialogTitle className="text-[#1e1b16] flex items-center justify-between">
              <span>{evidenceModal?.title}</span>
              <Button
                size="sm"
                variant="outline"
                className="border-[#e3dacb] text-[#1e1b16] hover:bg-[#efe6d9]"
                onClick={() => {
                  // Get all results from currently selected cells
                  const selectedResults = selectedCellsData.flatMap(cell => cell.results);
                  setEvidenceModal(null);
                  openChat({ scope: "evidence", evidenceType: evidenceModal?.type }, selectedResults);
                }}
              >
                <MessageSquare className="h-3.5 w-3.5 mr-1.5" />
                Ask About This
              </Button>
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {evidenceModal?.items.length === 0 ? (
              <div className="text-sm text-[#1e1b16]/40 text-center py-8">
                No evidence found for this selection
              </div>
            ) : (
              evidenceModal?.items.map((item, idx) => {
                const provider = PROVIDERS.find(p => p.id === item.provider);
                const metricColor = 
                  item.metricValue === "positive" || item.metricValue === "favorable" || item.metricValue === "1st" || item.metricValue === "strong"
                    ? "bg-[#d4e5d4] text-[#3b5a3b]"
                    : item.metricValue === "negative" || item.metricValue === "unfavorable" || item.metricValue === "absent" || item.metricValue === "none"
                    ? "bg-[#f0d9d9] text-[#8b4a4a]"
                    : "bg-[#efe6d9] text-[#1e1b16]/70";
                
                return (
                  <div key={idx} className="border border-[#e3dacb] rounded-xl p-4 bg-white">
                    <div className="mb-3">
                      <div className="text-sm font-medium text-[#1e1b16] mb-1">
                        Q: &quot;{item.query}&quot;
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className={`${provider?.bgColor} text-white text-xs`}>{item.model}</Badge>
                        <Badge variant="outline" className={`${metricColor} border-transparent text-xs`}>
                          {item.metric}: {item.metricValue}
                        </Badge>
                      </div>
                    </div>
                    <div className="text-sm text-[#1e1b16]/80 leading-relaxed border-t border-[#e3dacb] pt-3">
                      {highlightBrandMentions(item.excerpt, 
                        item.metricValue === "positive" ? "positive" : 
                        item.metricValue === "negative" ? "negative" : "neutral"
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Query Panel V2 */}
      <QueryPanelV2
        key={`${queryPanelScope}-${queryPanelPersona ?? "all"}-${queryPanelStage ?? "all"}-${queryPanelOpen ? "open" : "closed"}`}
        open={queryPanelOpen}
        onOpenChange={setQueryPanelOpen}
        initialScope={queryPanelScope}
        initialPersona={queryPanelPersona}
        initialStage={queryPanelStage}
        queryBank={localQueryBank}
        personas={personas.map(p => ({ id: p.id, label: p.label }))}
        stages={STAGES.map(s => ({ id: s.id, label: s.label }))}
        onRegenerateQueries={async (persona, stage, intent, role, creativity) => {
          const resp = await fetch("/api/intents/generate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              persona,
              stage,
              intent,
              role,
              creativity,
            }),
          });
          
          if (!resp.ok) throw new Error("Failed to regenerate queries");
          const data = await resp.json();
          return data.queries;
        }}
        onRunQueries={async (_queries, persona, stage, queryBankOverride) => {
          try {
            if (queryBankOverride) {
              await persistQueryBank(queryBankOverride);
            }

            let cellKeys: string[] = [];
            if (persona && stage) {
              cellKeys = [`${persona}-${stage}`];
            } else if (persona) {
              cellKeys = STAGES.map((s) => `${persona}-${s.id}`);
            } else if (stage) {
              cellKeys = personas.map((p) => `${p.id}-${stage}`);
            } else {
              cellKeys = Object.keys(Object.keys(matrixData).length > 0 ? matrixData : initializeMatrix());
            }

            await runCellsBenchmark(cellKeys, false);
          } catch (err) {
            console.error("Query run failed:", err);
          }
        }}
        onSaveQueries={async (newQueryBank) => {
          try {
            await persistQueryBank(newQueryBank);
            setMatrixData((prev) => {
              const updated = { ...prev };
              for (const key of Object.keys(updated)) {
                const [persona, stage] = key.split("-") as [Persona, Stage];
                const entry = newQueryBank[persona][stage];
                updated[key] = {
                  ...updated[key],
                  intents: entry.intents,
                };
              }
              return updated;
            });
          } catch (err) {
            console.error("Failed to save queries:", err);
          }
        }}
      />

      {/* Chat Panel */}
      <ChatPanel
        open={chatOpen}
        onOpenChange={setChatOpen}
        context={chatContext}
      />
    </div>
  );
}

function highlightBrandMentions(text: string, sentiment: string): React.ReactNode {
  const bgColor = sentiment === "positive"
    ? "bg-[#d4e5d4]"
    : sentiment === "negative"
    ? "bg-[#f0d9d9]"
    : "bg-[#cde0f0]";

  // Custom component to highlight brand mentions within markdown
  const components = {
    p: ({ children }: { children?: React.ReactNode }) => (
      <p className="my-1">{highlightInText(children, bgColor)}</p>
    ),
    li: ({ children }: { children?: React.ReactNode }) => (
      <li className="my-0.5">{highlightInText(children, bgColor)}</li>
    ),
    strong: ({ children }: { children?: React.ReactNode }) => (
      <strong>{highlightInText(children, bgColor)}</strong>
    ),
  };

  return (
    <div className="prose prose-sm prose-stone max-w-none prose-p:my-1 prose-ul:my-1 prose-li:my-0 prose-headings:my-2 prose-headings:text-[#1e1b16] prose-headings:text-sm">
      <ReactMarkdown components={components}>{text}</ReactMarkdown>
    </div>
  );
}

function highlightInText(children: React.ReactNode, bgColor: string): React.ReactNode {
  if (typeof children === "string") {
    const brand = BRAND.toLowerCase();
    const parts = children.split(new RegExp(`(${brand}|lakewood|lwr)`, "gi"));
    return parts.map((part, i) => {
      if (part.toLowerCase() === brand || part.toLowerCase() === "lakewood" || part.toLowerCase() === "lwr") {
        return <span key={i} className={`${bgColor} px-1 rounded`}>{part}</span>;
      }
      return part;
    });
  }
  return children;
}
