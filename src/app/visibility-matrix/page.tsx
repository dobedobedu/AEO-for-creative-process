"use client";

import { useState, useMemo, useRef, useCallback, Fragment, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
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
  Eye,
  EyeOff,
  ChevronRight,
  Pencil,
  Check,
  MessageSquare,
} from "lucide-react";
import Image from "next/image";
import { ChatPanel } from "@/components/chat-panel";
import { ViewModeToggle } from "@/components/visibility-matrix/ViewModeToggle";
import { MatrixCell } from "@/components/visibility-matrix/MatrixCell";
import { SplitViewEditor } from "@/components/visibility-matrix/SplitViewEditor";
import { IntentEditorModal } from "@/components/visibility-matrix/IntentEditorModal";
import { InsightModal } from "@/components/visibility-matrix/InsightModal";
import { AnswersPanel } from "@/components/visibility-matrix/AnswersPanel";
import { StickyActionBar } from "@/components/visibility-matrix/StickyActionBar";
import { GlobalProgressBar, useGlobalProgress } from "@/components/global-progress-bar";
import type { ChatContext } from "@/lib/chat/types";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  AreaChart as RechartsAreaChart,
  Area,
  CartesianGrid,
  XAxis,
} from "recharts";

import type { IntentLibrary, IntentNode } from "@/lib/intents/types";
import type { BenchmarkRun as StoredRun } from "@/lib/runs/types";
import type { StageExtraction } from "@/lib/scoring/schemas";
import type { Citation } from "@/lib/parsers/types";

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
    citations?: Citation[];
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

const PROVIDERS: { id: Provider; label: string; color: string; bgColor: string; chartColor: string; logo: string }[] = [
  { id: "openai", label: "GPT 5.2", color: "text-[#1f3b2c]", bgColor: "bg-[#1f3b2c]", chartColor: "#1f3b2c", logo: "/OpenAI-black-monoblossom.svg" },
  { id: "anthropic", label: "Haiku 4.5", color: "text-[#b86f3a]", bgColor: "bg-[#b86f3a]", chartColor: "#b86f3a", logo: "/claude-color.svg" },
  { id: "gemini", label: "Gemini 3", color: "text-[#6e7c5b]", bgColor: "bg-[#6e7c5b]", chartColor: "#6e7c5b", logo: "/gemini-color.svg" },
  { id: "xai", label: "Grok 4", color: "text-[#7c6b7c]", bgColor: "bg-[#7c6b7c]", chartColor: "#7c6b7c", logo: "/Grok_Logomark_Dark.svg" },
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
        role: intent.role || "cpo",
        queryStyle: intent.queryStyle || 0.75,
        generatedQueries: intent.generatedQueries
      };

      bank[intent.persona][intent.stage].intents.push(node);
    }
  }

  return bank;
}

const BRAND = "Lakewood Ranch";
const BRAND_ALIASES = ["LWR", "Lakewood"];
const BRAND_DOMAIN = "lakewoodranch.com";

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
  const [isSelectingQueries, setIsSelectingQueries] = useState(false);
  const [enabledProviders, setEnabledProviders] = useState<Set<Provider>>(
    new Set(["openai", "anthropic", "gemini", "xai"])
  );
  const [deepDiveOpen, setDeepDiveOpen] = useState(false);
  const [benchmarkHistory, setBenchmarkHistory] = useState<BenchmarkRun[]>([]);
  const [kpiMetric, setKpiMetric] = useState<"mention" | "sentiment" | "winrate" | "top3">("mention");
  const [kpiRange, setKpiRange] = useState<"day" | "week" | "month">("week");
  const [selectedTimeIndex, setSelectedTimeIndex] = useState(0);
  const [personas, setPersonas] = useState<PersonaConfig[]>(DEFAULT_PERSONAS);
  const [editingPersona, setEditingPersona] = useState<Persona | null>(null);
  const [editValue, setEditValue] = useState("");
  const [evidenceModal, setEvidenceModal] = useState<EvidenceModalData | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatContext, setChatContext] = useState<ChatContext>({ scope: "global" });
  const [localQueryBank, setLocalQueryBank] = useState<QueryBank>(() => createEmptyQueryBank());
  const [intentLibrary, setIntentLibrary] = useState<IntentLibrary | null>(null);
  const [viewMode, setViewMode] = useState<"summary" | "intents" | "queries" | "answers">("summary");
  // Cell Selection and Focus Mode
  const [selectedCell, setSelectedCell] = useState<{ persona: Persona; stage: Stage } | null>(null);
  const [intentEditorOpen, setIntentEditorOpen] = useState(false);
  const [insightModalOpen, setInsightModalOpen] = useState(false);
  const [answersPanelOpen, setAnswersPanelOpen] = useState(false);

  // Global progress bar state
  const { state: progressState, startProgress, completeProgress: completeProgressBar, failProgress: failProgressBar } = useGlobalProgress();

  // Derived statuses for the matrix and navigation
  const cellStatus = useMemo(() => {
    const status: Record<string, "empty" | "has-intents" | "has-queries"> = {};
    personas.forEach((p) => {
      STAGES.forEach((s) => {
        const intents = localQueryBank[p.id][s.id].intents;
        const hasQueries = intents.some((i) => (i.generatedQueries?.length || 0) > 0);

        if (hasQueries) status[`${p.id}-${s.id}`] = "has-queries";
        else if (intents.length > 0) status[`${p.id}-${s.id}`] = "has-intents";
        else status[`${p.id}-${s.id}`] = "empty";
      });
    });
    return status;
  }, [localQueryBank, personas]);

  // Check if all cells have queries - determines if we show "Run All" or "Select Queries to Run"
  const allCellsHaveQueries = useMemo(() => {
    return Object.values(cellStatus).every(status => status === "has-queries");
  }, [cellStatus]);

  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    let cancelled = false;

    // Fetch intent library with polling for multi-user sync
    const fetchLibrary = async () => {
      try {
        const r = await fetch("/api/intents/library");
        if (!r.ok || cancelled) return;
        const library: IntentLibrary = await r.json();
        if (cancelled) return;
        setIntentLibrary(library);
        setLocalQueryBank(buildQueryBankFromIntentLibrary(library));
      } catch (err) {
        console.error("Failed to load intent library:", err);
      }
    };

    fetchLibrary(); // Initial fetch
    const interval = setInterval(fetchLibrary, 10000); // Poll every 10s for multi-user sync

    fetch("/api/benchmark/runs/history?limit=13")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("Failed to load history"))))
      .then((data: { runs: StoredRun[] }) => {
        if (cancelled) return;
        const runs = data.runs.map(toUiBenchmarkRun);
        // Only use real data - no mock fallback
        const history = runs.slice().reverse();
        setBenchmarkHistory(history);
        setSelectedTimeIndex(Math.max(0, history.length - 1));
      })
      .catch(() => {
        if (cancelled) return;
        // Keep empty - no mock data fallback
        setBenchmarkHistory([]);
        setSelectedTimeIndex(0);
      });

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);


  const persistQueryBank = async (queryBank: QueryBank) => {
    const resp = await fetch("/api/intents/library/queries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ queryBank }),
    });
    if (!resp.ok) {
      throw new Error("Failed to save intent queries");
    }

    // The API returns the canonical intent library (including server-generated IDs for new intents).
    const data = await resp.json().catch(() => null);
    if (data?.library) {
      setIntentLibrary(data.library);
      setLocalQueryBank(buildQueryBankFromIntentLibrary(data.library));
      return;
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

    // Start progress bar
    const tempRunId = `client-${Date.now()}`;
    startProgress(
      tempRunId,
      targetCells.length * enabledProviders.size,
      `Running benchmark on ${targetCells.length} cells...`,
      "cells"
    );

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

      if (!response.ok) {
        failProgressBar("Benchmark request failed");
        throw new Error("Benchmark failed");
      }

      const { run, resultsByCell }: { run: StoredRun; resultsByCell: Record<string, { queries: QueryResult[] }> } =
        await response.json();

      // DEBUG: Log raw API response
      console.log("[DEBUG] API resultsByCell keys:", Object.keys(resultsByCell));
      console.log("[DEBUG] Target cell keys:", targetCells.map(t => t.key));
      console.log("[DEBUG] Sample resultsByCell data:", Object.entries(resultsByCell).map(([k, v]) => ({
        key: k,
        queriesCount: v?.queries?.length,
        firstQueryResponses: v?.queries?.[0]?.responses?.length
      })));

      setMatrixData((prev) => {
        const next = { ...prev };

        for (const t of targetCells) {
          const result = resultsByCell[t.key];
          console.log(`[DEBUG] Cell ${t.key}: result exists=${!!result}, queries=${result?.queries?.length}`);
          if (!result) {
            console.log(`[DEBUG] Cell ${t.key}: NO RESULT - staying idle`);
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

          console.log(`[DEBUG] Cell ${t.key}: Setting results with ${result.queries.length} queries, avgScore=${avgScore}, mentionRate=${mentionRate}`);
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

      // Complete progress bar
      completeProgressBar(`Completed ${targetCells.length} cells`);
    } catch (error) {
      if ((error as Error).name === "AbortError") {
        setMatrixData((prev) => {
          const next = { ...prev };
          for (const t of targetCells) {
            next[t.key] = { ...next[t.key], status: "idle" };
          }
          return next;
        });
        failProgressBar("Benchmark cancelled");
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
      failProgressBar("Benchmark failed");
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

  const selectAllProviders = useCallback(() => {
    setEnabledProviders(new Set(PROVIDERS.map(p => p.id)));
  }, []);

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

  // Provider-level KPIs from current selection
  const modelStats = useMemo(() => {
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

  const modelTrendData = useMemo(() => {
    const baseMockDate = new Date(Date.UTC(2026, 0, 1));

    // Helper to get metric value based on selected kpiMetric
    const getValue = (provider: Provider, run: BenchmarkRun): number => {
      switch (kpiMetric) {
        case "mention":
          return Math.round((run.providerScores[provider]?.mentionRate ?? 0) * 100);
        case "sentiment":
          // Convert [-1, 1] to [0, 100]
          return Math.round(((run.stageData?.sentimentScore ?? 0) + 1) * 50);
        case "winrate":
          return Math.round((run.stageData?.winRate ?? 0) * 100);
        case "top3": {
          const pos = run.stageData?.positionCounts;
          if (!pos) return 0;
          const inTop3 = pos["1st"] + pos["2nd"] + pos["3rd"];
          const total = inTop3 + pos.later + pos.absent;
          return total > 0 ? Math.round((inTop3 / total) * 100) : 0;
        }
        default:
          return 0;
      }
    };

    const full = benchmarkHistory.map(run => {
      const rawTs = run.timestamp;
      let dateISO = run.label;
      if (rawTs > 1_000_000_000_000) {
        dateISO = new Date(rawTs).toISOString().slice(0, 10);
      } else if (rawTs > 0) {
        const offsetDays = (rawTs - 1) * 7;
        const d = new Date(baseMockDate);
        d.setUTCDate(baseMockDate.getUTCDate() + offsetDays);
        dateISO = d.toISOString().slice(0, 10);
      }
      return {
        label: run.label,
        date: dateISO,
        openai: getValue("openai", run),
        anthropic: getValue("anthropic", run),
        gemini: getValue("gemini", run),
        xai: getValue("xai", run),
      };
    });
    const windowSize = kpiRange === "day" ? 30 : kpiRange === "week" ? 13 : 12;
    return full.slice(-windowSize);
  }, [benchmarkHistory, kpiRange, kpiMetric]);

  const kpiTickInterval = useMemo(() => {
    if (kpiRange === "day") return 2; // show every 3rd day
    if (kpiRange === "week") return 0; // show every week
    return 0; // show every month
  }, [kpiRange]);

  const formatKpiTick = useCallback((label: string) => {
    const date = new Date(`${label}T00:00:00Z`);
    if (Number.isNaN(date.getTime())) return label;
    if (kpiRange === "month") {
      return date.toLocaleDateString("en-US", { month: "short", year: "numeric" });
    }
    if (kpiRange === "week") {
      return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    }
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }, [kpiRange]);

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

  const displayInsights = stageInsights;
  const displayCompetitors = competitorCounts;

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
          count += localQueryBank[p.id][s.id].intents.length;
        }
      }
    } else if (selection.type === "cell") {
      count = localQueryBank[selection.persona][selection.stage].intents.length;
    } else if (selection.type === "row") {
      for (const s of STAGES) {
        count += localQueryBank[selection.persona][s.id].intents.length;
      }
    } else if (selection.type === "column") {
      for (const p of personas) {
        count += localQueryBank[p.id][selection.stage].intents.length;
      }
    }
    return count;
  }, [selection, personas, localQueryBank]);

  return (
    <div className="min-h-screen bg-[#f6f1e8] pb-16">
      {/* Header */}
      <div className="bg-white border-b border-[#e3dacb]">
        <div className="max-w-6xl mx-auto">
          {/* Top row: Title */}
          <div className="flex items-center justify-between px-6 py-3 border-b border-[#e3dacb]/50">
            <div>
              <h1 className="text-lg font-semibold text-[#1e1b16]">AI Visibility Matrix</h1>
              <p className="text-xs text-[#1e1b16]/60">{BRAND} • Persona × Stage</p>
            </div>
          </div>


        </div>
      </div>

      <div className="max-w-6xl mx-auto p-6 space-y-6">
        {/* Provider KPI Strip */}
        <div className="rounded-none border border-[#e3dacb] bg-white p-8">
          <div className="flex flex-col gap-6 mb-12">
            {/* Top Row: Title Only */}
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-black uppercase tracking-[0.2em] text-black">AI Performance History</h2>
                <p className="text-[10px] text-black/40 font-medium uppercase tracking-wider mt-1">Cross-model benchmarks over time</p>
              </div>
            </div>

            {/* Middle Row: Centered Metric Selector */}
            <div className="flex justify-center">
              <div className="flex gap-8 border-b border-[#e3dacb] px-12">
                {[
                  { id: "mention", label: "Mention" },
                  { id: "sentiment", label: "Sentiment" },
                  { id: "winrate", label: "Win Rate" },
                  { id: "top3", label: "Top 3 Rec" },
                ].map((metric) => (
                  <button
                    key={metric.id}
                    onClick={() => setKpiMetric(metric.id as typeof kpiMetric)}
                    className={`px-4 py-2 text-[11px] font-black uppercase tracking-[0.15em] transition-all border-b-2 -mb-[2px] ${kpiMetric === metric.id
                      ? "text-[#1f3b2c] border-[#1f3b2c]"
                      : "text-black/30 border-transparent hover:text-black/50"
                      }`}
                  >
                    {metric.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1 h-[220px]">
              {benchmarkHistory.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-black/30 border border-dashed border-[#e3dacb] rounded-lg">
                  <svg className="w-10 h-10 mb-3 stroke-current" fill="none" viewBox="0 0 24 24" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
                  </svg>
                  <p className="text-sm font-medium">No benchmark history</p>
                  <p className="text-xs mt-1">Run a benchmark to see performance trends</p>
                </div>
              ) : (
                <ChartContainer config={chartConfig} className="h-full w-full">
                  <RechartsAreaChart data={modelTrendData} margin={{ left: 8, right: 8, top: 10, bottom: 0 }}>
                    <CartesianGrid vertical={false} strokeDasharray="4 4" stroke="#efe6d9" />
                    <XAxis
                      dataKey="date"
                      tickLine={false}
                      axisLine={false}
                      tickMargin={6}
                      fontSize={10}
                      interval={kpiTickInterval}
                      tickFormatter={formatKpiTick}
                      padding={{ left: 12, right: 12 }}
                    />
                    <ChartTooltip cursor={{ stroke: "#d4c9b8", strokeDasharray: "4 4" }} content={<ChartTooltipContent />} />
                    {enabledProviders.has("openai") && (
                      <Area type="monotone" stackId="mentions" dataKey="openai" stroke="#1f3b2c" fill="#1f3b2c" fillOpacity={0.2} strokeWidth={2} />
                    )}
                    {enabledProviders.has("anthropic") && (
                      <Area type="monotone" stackId="mentions" dataKey="anthropic" stroke="#b86f3a" fill="#b86f3a" fillOpacity={0.2} strokeWidth={2} />
                    )}
                    {enabledProviders.has("gemini") && (
                      <Area type="monotone" stackId="mentions" dataKey="gemini" stroke="#6e7c5b" fill="#6e7c5b" fillOpacity={0.2} strokeWidth={2} />
                    )}
                    {enabledProviders.has("xai") && (
                      <Area type="monotone" stackId="mentions" dataKey="xai" stroke="#7c6b7c" fill="#7c6b7c" fillOpacity={0.2} strokeWidth={2} />
                    )}
                  </RechartsAreaChart>
                </ChartContainer>
              )}
            </div>
            <div className="w-full lg:w-44 flex flex-col gap-2 justify-center">
              <button
                onClick={selectAllProviders}
                className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold border transition-all ${enabledProviders.size === PROVIDERS.length
                  ? "bg-[#2b6cb0] text-white border-[#2b6cb0]"
                  : "bg-white text-[#1e1b16]/70 border-[#e3dacb] hover:border-[#2b6cb0]/40"
                  }`}
              >
                <span>All Models</span>
              </button>
              {PROVIDERS.map(p => {
                const isEnabled = enabledProviders.has(p.id);
                return (
                  <button
                    key={p.id}
                    onClick={() => toggleProvider(p.id)}
                    className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold border transition-all ${isEnabled
                      ? `${p.bgColor} text-white border-transparent`
                      : "bg-white text-[#1e1b16]/70 border-[#e3dacb] hover:border-[#1f3b2c]/40"
                      }`}
                  >
                    <span className="flex items-center gap-2">
                      <Image
                        src={p.logo}
                        alt={p.label}
                        width={16}
                        height={16}
                        className={`h-4 w-auto ${isEnabled ? "brightness-0 invert" : ""}`}
                      />
                      {p.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Bottom Row: Centered Range Selector (Time Scale) */}
          <div className="flex justify-center mt-8 border-t border-[#e3dacb]/50 pt-6">
            <div className="flex gap-4 border-b border-[#e3dacb]">
              {(["day", "week", "month"] as const).map(range => (
                <button
                  key={range}
                  onClick={() => setKpiRange(range)}
                  className={`px-6 py-2 text-[11px] font-bold uppercase tracking-widest transition-all border-b-2 -mb-[2px] ${kpiRange === range
                    ? "text-black border-black"
                    : "text-black/30 border-transparent hover:text-black/50"
                    }`}
                >
                  {range === "day" ? "Daily" : range === "week" ? "Weekly" : "Monthly"}
                </button>
              ))}
            </div>
          </div>

          <p className="text-[10px] text-black/20 font-bold uppercase tracking-widest mt-6 text-center">
            Legend: Select models to filter trend lines • Range: View window size
          </p>
        </div>

        {/* Group Tabs and Workspace for Cohesion */}
        <div className="mt-8">
          <div className="flex justify-center">
            <ViewModeToggle mode={viewMode} onModeChange={setViewMode} />
          </div>

          <div className="flex-1 mt-0">
            {(() => {
              // Transform matrixData into a format SplitViewEditor can use for the 'summary' mode
              const cellResults: Record<string, Record<string, { discoveryRate: number; sentimentScore: number; topCompetitor?: string; winRate?: number; recommendationRate?: number; responses?: { provider: string; model: string; text: string; query: string; visibility: { score: number; mentioned: boolean; sentiment: string } }[]; citations?: Citation[] }>> = {};

              Object.keys(matrixData).forEach(key => {
                const [pId, sId] = key.split("-") as [Persona, Stage];
                const cell = matrixData[key];
                if (!cellResults[pId]) cellResults[pId] = {};

                const results = cell.results || [];
                let totalSentimentScore = 0;
                let totalResponses = 0;
                let winCount = 0;
                let comparisonCount = 0;
                let recommendedCount = 0;
                let decideCount = 0;

                results.forEach(r => {
                  r.responses?.forEach(resp => {
                    totalResponses++;

                    // Sentiment
                    const s = resp.visibility?.sentiment;
                    const score = s === "positive" ? 1 : s === "negative" ? -1 : 0;
                    totalSentimentScore += score;

                    // Win Rate (Compare Stage)
                    if (sId === "compare") {
                      comparisonCount++;
                      if (resp.visibility?.comparisonOutcome === "favorable") {
                        winCount++;
                      }
                    }

                    // Answer Rate (Decide Stage)
                    if (sId === "decide") {
                      decideCount++;
                      if (resp.visibility?.recommendationStrength && resp.visibility.recommendationStrength !== "none") {
                        recommendedCount++;
                      }
                    }
                  });
                });

                const avgSentiment = totalResponses > 0 ? totalSentimentScore / totalResponses : 0;

                // Find top competitor
                const compCounts: Record<string, number> = {};
                results.forEach(r => {
                  r.responses?.forEach(resp => {
                    const comps = resp.visibility?.competitorsMentioned || [];
                    comps.forEach((c: string) => {
                      compCounts[c] = (compCounts[c] || 0) + 1;
                    });
                  });
                });
                const topComp = Object.entries(compCounts).sort((a, b) => b[1] - a[1])[0]?.[0];

                // Build responses array for Answers tab
                const responses: { provider: string; model: string; text: string; query: string; visibility: { score: number; mentioned: boolean; sentiment: string } }[] = [];
                // Aggregate all citations from this cell's responses
                const allCitations: Citation[] = [];
                results.forEach(r => {
                  r.responses?.forEach(resp => {
                    responses.push({
                      provider: resp.provider,
                      model: resp.model,
                      text: resp.text,
                      query: r.query,
                      visibility: {
                        score: resp.visibility?.score || 0,
                        mentioned: resp.visibility?.mentioned || false,
                        sentiment: resp.visibility?.sentiment || "neutral"
                      }
                    });
                    // Collect citations
                    if (resp.citations) {
                      allCitations.push(...resp.citations);
                    }
                  });
                });

                // Use stored stageMetrics if available, fallback to computed values
                const stageMetrics = cell.stageMetrics || {};

                cellResults[pId][sId] = {
                  discoveryRate: stageMetrics.discoveryRate ?? cell.avgScore ?? 0,
                  sentimentScore: stageMetrics.sentimentScore ?? avgSentiment,
                  topCompetitor: topComp,
                  winRate: stageMetrics.winRate ?? (comparisonCount > 0 ? winCount / comparisonCount : 0),
                  recommendationRate: stageMetrics.recommendationRate ?? (decideCount > 0 ? recommendedCount / decideCount : 0),
                  responses,
                  citations: allCitations
                };
              });

              return (
                <SplitViewEditor
                  activeTab={viewMode}
                  personas={personas}
                  stages={STAGES}
                  queryBank={localQueryBank}
                  cellResults={cellResults}
                  brandDomain={BRAND_DOMAIN}
                  onSelectCell={(persona, stage) => {
                    setSelectedCell({ persona, stage });
                    setSelection({ type: "cell", persona, stage });
                    if (viewMode === "summary") {
                      setInsightModalOpen(true);
                    } else if (viewMode === "answers") {
                      setAnswersPanelOpen(true);
                    } else {
                      setIntentEditorOpen(true);
                    }
                  }}
                  onShowAll={() => setViewMode("summary")}
                  onGenerateAll={async (mode) => {
                    if (mode === "intents") {
                      // Generate default Research Objectives for any empty cells
                      const emptyCells: { persona: Persona, stage: Stage }[] = [];
                      Object.entries(localQueryBank).forEach(([pId, stages]) => {
                        Object.entries(stages).forEach(([sId, data]) => {
                          if (data.intents.length === 0) {
                            emptyCells.push({ persona: pId as Persona, stage: sId as Stage });
                          }
                        });
                      });

                      if (emptyCells.length === 0) {
                        alert("All cells already have research objectives.");
                        return;
                      }

                      if (!confirm(`Generate baseline research objectives for ${emptyCells.length} empty cells?`)) return;

                      const newBank = { ...localQueryBank };
                      emptyCells.forEach(cell => {
                        const baselineText = {
                          explore: `Analyze macro-level research and initial curiosity for ${personas.find(p => p.id === cell.persona)?.label} during the broad discovery phase.`,
                          consider: `Evaluate specific lifestyle fit, community amenities, and long-term suitability for ${personas.find(p => p.id === cell.persona)?.label}.`,
                          compare: `Directly compare financial trade-offs, CDD fees, and specific village logistics for ${personas.find(p => p.id === cell.persona)?.label}.`,
                          decide: `Address final transactional hurdles, closing costs, and immediate life integration logistics for ${personas.find(p => p.id === cell.persona)?.label}.`
                        }[cell.stage];

                        newBank[cell.persona][cell.stage].intents.push({
                          id: `intent-${cell.persona}-${cell.stage}-${Date.now()}`,
                          text: baselineText || `Research intent for ${cell.persona} at ${cell.stage} stage.`,
                          role: "cpo",
                          queryStyle: 0.75,
                          generatedQueries: [],
                        });
                      });

                      setLocalQueryBank(newBank);
                      persistQueryBank(newBank);
                      alert("Research objectives seeded!");
                    } else {
                      // Generate Queries mode
                      const cellsToProcess: { persona: Persona, stage: Stage, intent: IntentNode }[] = [];

                      Object.entries(localQueryBank).forEach(([pId, stages]) => {
                        Object.entries(stages).forEach(([sId, data]) => {
                          data.intents.forEach(intent => {
                            if (!intent.generatedQueries || intent.generatedQueries.length === 0) {
                              cellsToProcess.push({
                                persona: pId as Persona,
                                stage: sId as Stage,
                                intent
                              });
                            }
                          });
                        });
                      });

                      if (cellsToProcess.length === 0) {
                        alert("All intents already have queries.");
                        return;
                      }

                      if (!confirm(`Generate queries for ${cellsToProcess.length} intents?`)) return;

                      for (const item of cellsToProcess) {
                        try {
                          const resp = await fetch("/api/intents/generate", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                              persona: item.persona,
                              stage: item.stage,
                              intent: item.intent.text,
                              role: item.intent.role,
                              queryStyle: item.intent.queryStyle,
                            }),
                          });

                          if (resp.ok) {
                            const data = await resp.json();
                            const newBank = { ...localQueryBank };
                            const targetIntent = newBank[item.persona][item.stage].intents.find(i => i.id === item.intent.id);
                            if (targetIntent) {
                              targetIntent.generatedQueries = data.queries;
                              setLocalQueryBank({ ...newBank });
                            }
                          }
                        } catch (err) {
                          console.error("Failed to generate for cell:", err);
                        }
                      }
                      persistQueryBank(localQueryBank);
                      alert("Generation complete!");
                    }
                  }}
                />
              );
            })()}
          </div>
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


      {/* Focus Mode Editor */}

      {
        selectedCell && (
          <IntentEditorModal
            open={intentEditorOpen}
            onClose={() => setIntentEditorOpen(false)}
            defaultTab={viewMode === "queries" ? "queries" : "intents"}
            persona={selectedCell.persona}
            stage={selectedCell.stage}
            personas={personas}
            stages={STAGES}
            cellStatus={cellStatus}
            onSelectCell={(p, s) => setSelectedCell({ persona: p, stage: s })}
            intents={localQueryBank[selectedCell.persona][selectedCell.stage].intents}
            queries={Object.fromEntries(
              localQueryBank[selectedCell.persona][selectedCell.stage].intents.map(i => [i.id, i.generatedQueries || []])
            )}
            onIntentChange={(updatedIntent) => {
              const newBank = { ...localQueryBank };
              newBank[selectedCell.persona][selectedCell.stage].intents = newBank[selectedCell.persona][selectedCell.stage].intents.map(i =>
                i.id === updatedIntent.id ? updatedIntent : i
              );
              setLocalQueryBank(newBank);
              persistQueryBank(newBank);
            }}
            onIntentDelete={(intentId) => {
              const newBank = { ...localQueryBank };
              newBank[selectedCell.persona][selectedCell.stage].intents = newBank[selectedCell.persona][selectedCell.stage].intents.filter(
                i => i.id !== intentId
              );
              setLocalQueryBank(newBank);
              persistQueryBank(newBank);
            }}
            onIntentAdd={(text, role, style) => {
              const newBank = { ...localQueryBank };
              const newIntent: IntentNode = {
                id: `new_${Date.now()}`,
                text,
                role,
                queryStyle: style,
                generatedQueries: [],
              };
              newBank[selectedCell.persona][selectedCell.stage].intents.push(newIntent);
              setLocalQueryBank(newBank);
              persistQueryBank(newBank);
            }}
            onQueryChange={(intentId, queryIndex, text) => {
              const newBank = { ...localQueryBank };
              const intent = newBank[selectedCell.persona][selectedCell.stage].intents.find(i => i.id === intentId);
              if (intent) {
                const newQueries = [...(intent.generatedQueries || [])];
                newQueries[queryIndex] = text;
                intent.generatedQueries = newQueries;
                setLocalQueryBank(newBank);
                persistQueryBank(newBank);
              }
            }}
            onQueryDelete={(intentId, queryIndex) => {
              const newBank = { ...localQueryBank };
              const intent = newBank[selectedCell.persona][selectedCell.stage].intents.find(i => i.id === intentId);
              if (intent) {
                intent.generatedQueries = (intent.generatedQueries || []).filter((_, i) => i !== queryIndex);
                setLocalQueryBank(newBank);
                persistQueryBank(newBank);
              }
            }}
            onQueryAdd={(intentId) => {
              const newBank = { ...localQueryBank };
              const intent = newBank[selectedCell.persona][selectedCell.stage].intents.find(i => i.id === intentId);
              if (intent) {
                intent.generatedQueries = [...(intent.generatedQueries || []), ""];
                setLocalQueryBank(newBank);
                persistQueryBank(newBank);
              }
            }}
            onQueryRegenerate={async (intentId) => {
              const intent = localQueryBank[selectedCell.persona][selectedCell.stage].intents.find(i => i.id === intentId);
              if (!intent) return [];

              const resp = await fetch("/api/intents/generate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  persona: selectedCell.persona,
                  stage: selectedCell.stage,
                  intent: intent.text,
                  role: intent.role,
                  queryStyle: intent.queryStyle,
                }),
              });

              if (!resp.ok) throw new Error("Failed to generate queries");
              const data = await resp.json();

              const newBank = { ...localQueryBank };
              newBank[selectedCell.persona][selectedCell.stage].intents = newBank[selectedCell.persona][selectedCell.stage].intents.map(
                (i) => (i.id === intentId ? { ...i, generatedQueries: data.queries } : i)
              );
              setLocalQueryBank(newBank);
              persistQueryBank(newBank);

              return data.queries;
            }}
            onRun={() => {
              setIntentEditorOpen(false);
              runCellsBenchmark([`${selectedCell.persona}-${selectedCell.stage}`], true);
            }}
            isRunning={isRunning}
          />
        )
      }

      {selectedCell && (() => {
        const cellKey = `${selectedCell.persona}-${selectedCell.stage}`;
        const cellData = matrixData[cellKey];
        console.log(`[DEBUG] InsightModal opening for ${cellKey}:`, {
          cellExists: !!cellData,
          status: cellData?.status,
          resultsLength: cellData?.results?.length,
          firstResultResponses: cellData?.results?.[0]?.responses?.length
        });
        return (
        <InsightModal
          open={insightModalOpen}
          onClose={() => setInsightModalOpen(false)}
          persona={selectedCell.persona}
          stage={selectedCell.stage}
          personaLabel={personas.find(p => p.id === selectedCell.persona)?.label || ""}
          stageLabel={STAGES.find(s => s.id === selectedCell.stage)?.label || ""}
          results={cellData?.results || []}
          brand={BRAND}
          onRunCell={() => {
            setInsightModalOpen(false);
            runCellsBenchmark([`${selectedCell.persona}-${selectedCell.stage}`], true);
          }}
          isRunning={isRunning}
        />
        );
      })()}

      {/* Answers Panel - LLM Response Viewer */}
      {selectedCell && (() => {
        const cellKey = `${selectedCell.persona}-${selectedCell.stage}`;
        const cellData = matrixData[cellKey];
        return (
          <AnswersPanel
            open={answersPanelOpen}
            onClose={() => setAnswersPanelOpen(false)}
            persona={selectedCell.persona}
            stage={selectedCell.stage}
            personaLabel={personas.find(p => p.id === selectedCell.persona)?.label || ""}
            stageLabel={STAGES.find(s => s.id === selectedCell.stage)?.label || ""}
            results={cellData?.results || []}
            brand={BRAND}
            brandAliases={BRAND_ALIASES}
            onRunCell={() => {
              setAnswersPanelOpen(false);
              runCellsBenchmark([`${selectedCell.persona}-${selectedCell.stage}`], true);
            }}
            isRunning={isRunning}
          />
        );
      })()}

      {/* Chat Panel */}
      <ChatPanel
        open={chatOpen}
        onOpenChange={setChatOpen}
        context={chatContext}
      />

      {/* Sticky Action Bar */}
      <StickyActionBar
        isRunning={isRunning}
        selectionLabel={selectionLabel}
        selectionType={selection.type}
        allCellsHaveQueries={allCellsHaveQueries}
        isSelectingQueries={isSelectingQueries}
        onRun={() => {
          runBenchmark(false);
          setIsSelectingQueries(false); // Exit selection mode after run
        }}
        onStop={stopBenchmark}
        onAskAI={() => {
          const allResults = Object.values(matrixData)
            .filter(cell => cell.status === "complete")
            .flatMap(cell => cell.results);
          openChat({ scope: "global" }, allResults);
        }}
        onStartSelection={() => {
          setIsSelectingQueries(true);
          setSelection({ type: "all" }); // Reset selection when entering mode
        }}
        onCancelSelection={() => {
          setIsSelectingQueries(false);
          setSelection({ type: "all" });
        }}
      />

      {/* Global Progress Bar */}
      <GlobalProgressBar externalState={progressState} autoHideDelay={4000} />
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
