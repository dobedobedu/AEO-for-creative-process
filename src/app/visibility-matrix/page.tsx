"use client";

import { useState, useMemo, useRef, useCallback, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import { usePathname } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Eye,
  EyeOff,
  MessageSquare,
  X,
  Clock,
} from "lucide-react";
import Image from "next/image";
import { SplitViewEditor } from "@/components/visibility-matrix/SplitViewEditor";
import { IntentEditorModal } from "@/components/visibility-matrix/IntentEditorModal";
import { InlineErrorBanner } from "@/components/visibility-matrix/InlineErrorBanner";
import { Skeleton } from "@/components/ui/skeleton";
import { StickyActionBar } from "@/components/visibility-matrix/StickyActionBar";
import dynamic from "next/dynamic";
import { ViewToggle } from "@/components/ui/view-toggle";
import { GlobalProgressBar, useGlobalProgress } from "@/components/global-progress-bar";
import type { ChatContext } from "@/lib/chat/types";
import { useMatrixData } from "@/lib/matrix/data/useMatrixData";
import { type ChartConfig } from "@/components/ui/chart";

const InsightModal = dynamic(
  () => import("@/components/visibility-matrix/InsightModal").then((mod) => mod.InsightModal),
  { ssr: false }
);
const AnswersPanel = dynamic(
  () => import("@/components/visibility-matrix/AnswersPanel").then((mod) => mod.AnswersPanel),
  { ssr: false }
);
const TimeMachinePanel = dynamic(
  () => import("@/components/visibility-matrix/TimeMachinePanel").then((mod) => mod.TimeMachinePanel),
  { ssr: false }
);
const ChatPanel = dynamic(
  () => import("@/components/chat-panel").then((mod) => mod.ChatPanel),
  { ssr: false }
);
const MatrixTrendChart = dynamic(
  () => import("@/components/visibility-matrix/MatrixTrendChart").then((mod) => mod.MatrixTrendChart),
  { ssr: false }
);

import {
  DEFAULT_PROVIDER_WEIGHTS,
  normalizeWeights,
  type WeightMode,
} from "@/lib/matrix/weights";
import { getExploreMentionStats } from "@/lib/matrix/mention";
import type { IntentLibrary, IntentNode } from "@/lib/intents/types";
import type { BenchmarkRun as StoredRun } from "@/lib/runs/types";
import type { StageExtraction } from "@/lib/scoring/schemas";
import type { Citation } from "@/lib/parsers/types";
import { toUiBenchmarkRun, getRunCacheKey } from "@/lib/matrix/history";
import {
  DEFAULT_PROVIDER_MODELS,
  buildProviderModelMap,
  type SearchModelConfig,
} from "@/lib/models/providerModels";
import {
  useTenantConfig,
  DEFAULT_BRAND,
  DEFAULT_PERSONAS as CONFIG_DEFAULT_PERSONAS,
  DEFAULT_STAGES as CONFIG_DEFAULT_STAGES,
} from "@/lib/config/client";

// Types - using string type to support dynamic config
type Persona = string;
type Stage = string;
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
      recommended?: boolean;
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
  mentionRate: number | null;
  status: "idle" | "running" | "complete" | "partial";
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
  id: string;
  timestamp: number;
  label: string;
  providerScores: Record<Provider, { avgScore: number; mentionRate: number | null }>;
  // Stage-specific historical data
  stageData?: {
    positionCounts: { "1st": number; "2nd": number; "3rd": number; later: number; absent: number } | null;
    sentimentScore: number | null;
    winRate: number | null;
    recStrength: number | null;
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

// White-label fallback configuration used before tenant config loads.
const DEFAULT_PERSONAS: PersonaConfig[] = CONFIG_DEFAULT_PERSONAS.map((persona) => ({
  id: persona.id,
  label: persona.label,
  description: persona.description || "",
}));

const DEFAULT_STAGES: { id: Stage; label: string; description: string }[] = CONFIG_DEFAULT_STAGES.map((stage) => ({
  id: stage.id,
  label: stage.label,
  description: stage.description || "",
}));

const PROVIDERS: { id: Provider; label: string; color: string; bgColor: string; chartColor: string; logo: string }[] = [
  { id: "openai", label: "GPT 5.2", color: "text-brand-primary", bgColor: "bg-brand-primary", chartColor: "#1f3b2c", logo: "/OpenAI-black-monoblossom.svg" },
  { id: "anthropic", label: "Haiku 4.5", color: "text-[#b86f3a]", bgColor: "bg-[#b86f3a]", chartColor: "#b86f3a", logo: "/claude-color.svg" },
  { id: "gemini", label: "Gemini 3", color: "text-[#6e7c5b]", bgColor: "bg-[#6e7c5b]", chartColor: "#6e7c5b", logo: "/gemini-color.svg" },
  { id: "xai", label: "Grok 4", color: "text-[#7c6b7c]", bgColor: "bg-[#7c6b7c]", chartColor: "#7c6b7c", logo: "/Grok_Logomark_Dark.svg" },
];

// Updated to support multiple intents
type QueryBank = Record<Persona, Record<Stage, { intents: IntentNode[] }>>;

function createEmptyQueryBank(personaIds: Persona[], stageIds: Stage[]): QueryBank {
  const bank: QueryBank = {};
  for (const personaId of personaIds) {
    bank[personaId] = {};
    for (const stageId of stageIds) {
      bank[personaId][stageId] = { intents: [] };
    }
  }
  return bank;
}

function cloneQueryBank(source: QueryBank): QueryBank {
  const cloned: QueryBank = {};
  for (const [persona, stages] of Object.entries(source)) {
    cloned[persona] = {};
    for (const [stage, entry] of Object.entries(stages)) {
      cloned[persona][stage] = {
        intents: entry.intents.map((intent) => ({
          ...intent,
          generatedQueries: intent.generatedQueries ? [...intent.generatedQueries] : undefined,
        })),
      };
    }
  }
  return cloned;
}

function normalizeQueryBank(source: QueryBank, personaIds: Persona[], stageIds: Stage[]): QueryBank {
  const normalized = createEmptyQueryBank(personaIds, stageIds);

  for (const [persona, stages] of Object.entries(source)) {
    if (!normalized[persona]) normalized[persona] = {};
    for (const [stage, entry] of Object.entries(stages)) {
      if (!normalized[persona][stage]) normalized[persona][stage] = { intents: [] };
      normalized[persona][stage] = {
        intents: entry.intents.map((intent) => ({
          ...intent,
          generatedQueries: intent.generatedQueries ? [...intent.generatedQueries] : undefined,
        })),
      };
    }
  }

  return normalized;
}

function buildQueryBankFromIntentLibrary(
  library: IntentLibrary,
  personaIds: Persona[],
  stageIds: Stage[]
): QueryBank {
  const bank = createEmptyQueryBank(personaIds, stageIds);

  // Group all active intents by persona/stage
  for (const intent of library.intents) {
    if (!intent.active) continue;

    if (!bank[intent.persona]) bank[intent.persona] = {};
    if (!bank[intent.persona][intent.stage]) bank[intent.persona][intent.stage] = { intents: [] };

    const node: IntentNode = {
      id: intent.id,
      text: intent.text,
      role: intent.role || "cpo",
      queryStyle: intent.queryStyle || 0.75,
      generatedQueries: intent.generatedQueries
    };

    bank[intent.persona][intent.stage].intents.push(node);
  }

  return bank;
}

// Convert a StoredRun to a QueryBank for displaying historical intent/query data
function storedRunToQueryBank(run: StoredRun): QueryBank {
  const bank: QueryBank = {};

  if (!run.cells) return bank;

  for (const [cellKey, cellResult] of Object.entries(run.cells)) {
    // cellKey is "persona_stage" format (e.g., "luxury_explore")
    const parts = cellKey.split("_");
    const stage = parts.pop() as Stage;
    const persona = parts.join("_") as Persona;

    if (!bank[persona]) bank[persona] = {};
    if (!bank[persona][stage]) bank[persona][stage] = { intents: [] };

    // Create an intent node from the stored cell data
    const intentNode: IntentNode = {
      id: cellResult.intentId,
      text: cellResult.intentText,
      role: "cpo",           // Default role (not stored in historical runs)
      queryStyle: 0.75,      // Default style (not stored in historical runs)
      generatedQueries: cellResult.queriesUsed,
    };

    bank[persona][stage].intents.push(intentNode);
  }

  return bank;
}

// Brand configuration is now loaded from config/tenant.json via useTenantConfig hook
// See the component body for how BRAND, BRAND_ALIASES, BRAND_DOMAIN are derived

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

// Convert a StoredRun to the matrixData format used by the grid
// Handles ALL cells, marking missing ones as "partial"
function storedRunToMatrixData(run: StoredRun, personas: PersonaConfig[], stages: { id: Stage; label: string; description: string }[]): Record<string, CellData> {
  const data: Record<string, CellData> = {};

  // Known stage IDs for proper cell key parsing
  const knownStageIds = new Set(stages.map(s => s.id));

  // Helper to parse cell key (handles persona IDs with underscores like "first_time")
  const parseCellKey = (key: string): { persona: string; stage: string } | null => {
    // Try each known stage from the end
    for (const stageId of knownStageIds) {
      const suffix = `_${stageId}`;
      if (key.endsWith(suffix)) {
        return {
          persona: key.slice(0, key.length - suffix.length),
          stage: stageId,
        };
      }
    }
    // Fallback: last segment is stage (may be wrong for unknown stages, but better than nothing)
    const parts = key.split("_");
    const stage = parts.pop() || "";
    const persona = parts.join("_");
    return { persona, stage };
  };

  // Get unique personas and stages from the run (for historical compatibility)
  const runPersonas = new Set<string>();
  const runStages = new Set<string>();
  if (run.cells) {
    for (const key of Object.keys(run.cells)) {
      const parsed = parseCellKey(key);
      if (parsed) {
        runPersonas.add(parsed.persona);
        runStages.add(parsed.stage);
      }
    }
  }

  // Process all cells from:
  // 1. Active config (personas x stages)
  // 2. Run data (for historical compatibility with personas/stages not in config)
  const allPersonas = new Set([...personas.map(p => p.id), ...runPersonas]);
  const allStages = new Set([...stages.map(s => s.id), ...runStages]);

  // For cells that exist in run but not in current config, still include them (historical compatibility)
  for (const persona of allPersonas) {
    for (const stage of allStages) {
      const cellKey = `${persona}_${stage}`;
      const uiKey = `${persona}-${stage}`;
      const cellResult = run.cells[cellKey];

      if (!cellResult) {
        // Missing cell - mark as partial
        data[uiKey] = {
          persona,
          stage,
          intents: [],
          results: [],
          avgScore: 0,
          mentionRate: 0,
          status: "partial",
          stageMetrics: undefined,
        };
        continue;
      }

      // Convert stored QueryResults to UI QueryResults
      const uiResults: QueryResult[] = cellResult.results.map((qr) => {
        const responses: QueryResult["responses"] = [];

        if (!qr.responses) return { query: qr.query, responses };

        for (const [provider, resp] of Object.entries(qr.responses)) {
          const extraction = resp.score;

          // Extract visibility info from extraction
          const mentioned = extraction.mentioned ?? false;
          const score = extractionToScalarScore(stage, extraction);

          // Determine sentiment from extraction
          let sentiment: "positive" | "negative" | "neutral" = "neutral";
          if ("sentimentScore" in extraction) {
            sentiment = extraction.sentimentScore > 0.3 ? "positive"
              : extraction.sentimentScore < -0.3 ? "negative" : "neutral";
          }

          // Determine position
          let position = "absent";
          if ("inTopThree" in extraction) {
            position = extraction.mentioned ? (extraction.inTopThree ? "1st" : "later") : "absent";
          }

          // Determine comparison outcome
          let comparisonOutcome: "favorable" | "unfavorable" | "neutral" | "none" = "none";
          if ("outcome" in extraction) {
            comparisonOutcome = extraction.outcome === "win" ? "favorable"
              : extraction.outcome === "lose" ? "unfavorable"
              : extraction.outcome === "tie" || extraction.outcome === "mixed" ? "neutral" : "none";
          }

          // Determine recommendation strength
          let recommendationStrength: "strong" | "moderate" | "weak" | "none" = "none";
          if ("recommendationStrength" in extraction) {
            const rs = extraction.recommendationStrength;
            recommendationStrength = rs === "strongly_recommended" || rs === "recommended" ? "strong"
              : rs === "suggested" ? "moderate"
              : rs === "mentioned" ? "weak" : "none";
          }

          // Convert stored citations to UI format (or empty array for older runs)
          const storedCitations = (resp as { citations?: { url: string; domain: string; title?: string; snippet?: string; sourceType: "url_citation" | "grounding_chunk" }[] }).citations;
          const uiCitations: Citation[] = storedCitations?.map(c => ({
            url: c.url,
            domain: c.domain,
            title: c.title,
            snippet: c.snippet,
            sourceType: c.sourceType,
          })) ?? [];

          // Determine recommended (for Decide stage)
          const recommended = "recommended" in extraction ? extraction.recommended === true : false;

          responses.push({
            provider: provider as Provider,
            model: resp.model,
            text: resp.responseText,
            citations: uiCitations,
            visibility: {
              score,
              mentioned,
              sentiment,
              category: stage,
              position,
              competitorsMentioned: extractionCompetitors(extraction),
              comparisonOutcome,
              recommendationStrength,
              recommended,
            },
            latencyMs: 0,
          });
        }

        return { query: qr.query, responses };
      });

      // Calculate aggregate metrics
      let totalScore = 0;
      let totalResponses = 0;

      for (const qr of uiResults) {
        for (const resp of qr.responses) {
          totalScore += resp.visibility.score;
          totalResponses++;
        }
      }

      const mentionStats = getExploreMentionStats({ stage, results: uiResults });

      data[uiKey] = {
        persona,
        stage,
        intents: [], // Historical runs don't include intent info
        results: uiResults,
        avgScore: totalResponses > 0 ? totalScore / totalResponses : 0,
        mentionRate: mentionStats.mentionRate,
        status: "complete",
        stageMetrics: cellResult.metrics,
      };
    }
  }

  return data;
}

// Chart configuration for shadcn/recharts
const chartConfig: ChartConfig = {
  openai: { label: "GPT 5.2", color: "#1f3b2c" },
  anthropic: { label: "Haiku 4.5", color: "#b86f3a" },
  gemini: { label: "Gemini 3", color: "#6e7c5b" },
  xai: { label: "Grok 4", color: "#7c6b7c" },
};

export default function VisibilityMatrixPage() {
  const pathname = usePathname();
  const isMatrixActive = pathname ? pathname.startsWith("/visibility-matrix") : false;

  // Load tenant configuration
  const { config: tenantConfig, loading: configLoading } = useTenantConfig();

  // Derive brand values from config (with fallbacks)
  const BRAND = tenantConfig?.brand.name ?? DEFAULT_BRAND.name;
  const BRAND_ALIASES = tenantConfig?.brand.aliases ?? DEFAULT_BRAND.aliases;
  const BRAND_DOMAIN = tenantConfig?.brand.domain ?? "";

  const [matrixData, setMatrixData] = useState<Record<string, CellData>>({});
  const [selection, setSelection] = useState<SelectionType>({ type: "all" });
  const [isRunning, setIsRunning] = useState(false);
  const [isSelectingQueries, setIsSelectingQueries] = useState(false);
  const [enabledProviders, setEnabledProviders] = useState<Set<Provider>>(
    new Set(["openai", "anthropic", "gemini", "xai"])
  );
  const [providerModels, setProviderModels] = useState<Record<Provider, string>>(
    DEFAULT_PROVIDER_MODELS
  );
  const [deepDiveOpen, setDeepDiveOpen] = useState(false);
  const [benchmarkHistory, setBenchmarkHistory] = useState<BenchmarkRun[]>([]);
  const [kpiMetric, setKpiMetric] = useState<"mention" | "sentiment" | "winrate" | "top3">("mention");
  const [kpiRange, setKpiRange] = useState<"day" | "week" | "month">("week");
  const [weightMode, setWeightMode] = useState<WeightMode>("equal");
  const [, setSelectedTimeIndex] = useState(0);
  const [personas, setPersonas] = useState<PersonaConfig[]>(DEFAULT_PERSONAS);
  const [stages, setStages] = useState<{ id: Stage; label: string; description: string }[]>(DEFAULT_STAGES);
  const [matrixConfigLoading, setMatrixConfigLoading] = useState(true);
  const [evidenceModal, setEvidenceModal] = useState<EvidenceModalData | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatContext, setChatContext] = useState<ChatContext>({ scope: "global" });
  const [localQueryBank, setLocalQueryBank] = useState<QueryBank>(() =>
    createEmptyQueryBank(
      DEFAULT_PERSONAS.map((p) => p.id),
      DEFAULT_STAGES.map((s) => s.id)
    )
  );
  const [, setIntentLibrary] = useState<IntentLibrary | null>(null);
  const [viewMode, setViewMode] = useState<"summary" | "intents" | "queries" | "answers">("summary");
  // Cell Selection and Focus Mode
  const [selectedCell, setSelectedCell] = useState<{ persona: Persona; stage: Stage } | null>(null);
  const [intentEditorOpen, setIntentEditorOpen] = useState(false);
  const [insightModalOpen, setInsightModalOpen] = useState(false);
  const [answersPanelOpen, setAnswersPanelOpen] = useState(false);
  const [timeMachineOpen, setTimeMachineOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const loadProviderModels = async () => {
      try {
        const response = await fetch("/api/models/search");
        if (!response.ok) return;
        const data = (await response.json()) as { models?: SearchModelConfig[] };
        if (!data?.models || cancelled) return;
        const modelMap = buildProviderModelMap(data.models, DEFAULT_PROVIDER_MODELS);
        if (!cancelled) setProviderModels(modelMap);
      } catch {
        // Keep defaults if the model config fetch fails.
      }
    };

    void loadProviderModels();

    return () => {
      cancelled = true;
    };
  }, []);

  // Historical run linking state
  const [historicalRuns, setHistoricalRuns] = useState<StoredRun[]>([]);
  const [selectedHistoricalRunId, setSelectedHistoricalRunId] = useState<string | null>(null);
  const [selectedHistoricalRun, setSelectedHistoricalRun] = useState<StoredRun | null>(null);

  // Global progress bar state
  const { state: progressState, startProgress, completeProgress: completeProgressBar, failProgress: failProgressBar } = useGlobalProgress();

  // Derived statuses for the matrix and navigation
  const cellStatus = useMemo(() => {
    const status: Record<string, "empty" | "has-intents" | "has-queries"> = {};
    personas.forEach((p) => {
      stages.forEach((s) => {
        const intents = localQueryBank[p.id]?.[s.id]?.intents || [];
        const hasQueries = intents.some((i) => (i.generatedQueries?.length || 0) > 0);

        if (hasQueries) status[`${p.id}-${s.id}`] = "has-queries";
        else if (intents.length > 0) status[`${p.id}-${s.id}`] = "has-intents";
        else status[`${p.id}-${s.id}`] = "empty";
      });
    });
    return status;
  }, [localQueryBank, personas, stages]);

  // Check if all cells have queries - determines if we show "Run All" or "Select Queries to Run"
  const allCellsHaveQueries = useMemo(() => {
    return Object.values(cellStatus).every(status => status === "has-queries");
  }, [cellStatus]);

  // Effective matrix data: use historical run data when selected, otherwise current data
  const effectiveMatrixData = useMemo(() => {
    if (selectedHistoricalRun) {
      return storedRunToMatrixData(selectedHistoricalRun, personas, stages);
    }
    return matrixData;
  }, [selectedHistoricalRun, matrixData, personas, stages]);

  // Effective query bank: use historical run's intents/queries when selected, otherwise current
  const effectiveQueryBank = useMemo(() => {
    if (selectedHistoricalRun) {
      return storedRunToQueryBank(selectedHistoricalRun);
    }
    return localQueryBank;
  }, [selectedHistoricalRun, localQueryBank]);

  // Chart click handler to select a historical run
  // Uses runId from payload instead of array index to handle grouped/filtered data correctly
  const handleChartClick = useCallback(async (data: { activePayload?: Array<{ payload?: { runId?: string } }> }) => {
    const runId = data?.activePayload?.[0]?.payload?.runId;
    if (!runId) return;

    const run = historicalRuns.find(r => r.id === runId);
    if (!run) return;

    setSelectedHistoricalRunId(run.id);

    // Fetch full run data from API
    try {
      const response = await fetch(`/api/benchmark/runs/${run.id}`);
      if (response.ok) {
        const fullRun = await response.json();
        setSelectedHistoricalRun(fullRun);
      } else {
        console.error(`Failed to fetch run ${run.id}`);
        setSelectedHistoricalRun(null);
      }
    } catch (err) {
      console.error(`Error fetching run ${run.id}:`, err);
      setSelectedHistoricalRun(null);
    }
  }, [historicalRuns]);

  // Clear historical selection to return to current data
  const clearHistoricalSelection = useCallback(() => {
    setSelectedHistoricalRunId(null);
    setSelectedHistoricalRun(null);
  }, []);

  // Select a historical run by ID (used by Time Machine panel)
  const handleSelectHistoricalRun = useCallback(async (runId: string) => {
    const run = historicalRuns.find(r => r.id === runId);
    if (!run) return;

    setSelectedHistoricalRunId(run.id);

    // Fetch full run data from API
    try {
      const response = await fetch(`/api/benchmark/runs/${run.id}`);
      if (response.ok) {
        const fullRun = await response.json();
        setSelectedHistoricalRun(fullRun);
      } else {
        console.error(`Failed to fetch run ${run.id}`);
        setSelectedHistoricalRun(null);
      }
    } catch (err) {
      console.error(`Error fetching run ${run.id}:`, err);
      setSelectedHistoricalRun(null);
    }
  }, [historicalRuns]);

  // Get the date label for the selected historical run
  const selectedRunDateLabel = useMemo(() => {
    if (!selectedHistoricalRun) return null;
    const date = new Date(selectedHistoricalRun.timestamp);
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  }, [selectedHistoricalRun]);

  // Find the index of selected run in modelTrendData for ReferenceLine
  const selectedRunChartIndex = useMemo(() => {
    if (!selectedHistoricalRunId || !historicalRuns.length) return null;
    const idx = historicalRuns.findIndex((r) => r.id === selectedHistoricalRunId);
    if (idx === -1) return null;
    // Get the date string that matches modelTrendData's date key
    const run = historicalRuns[idx];
    return run.timestamp.split("T")[0];
  }, [selectedHistoricalRunId, historicalRuns]);

  // Compute all available run dates for WeekNavigator in AnswersPanel
  const availableRunDates = useMemo(() => {
    const dates = historicalRuns.map(r => r.timestamp.split("T")[0]);
    // Deduplicate and sort
    return [...new Set(dates)].sort();
  }, [historicalRuns]);

  // Handle date change from AnswersPanel WeekNavigator
  const handleAnswersPanelDateChange = useCallback(async (date: string) => {
    // Find runs for this date (may have multiple runs on same day)
    const runsForDate = historicalRuns
      .filter(r => r.timestamp.startsWith(date))
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp)); // Latest first

    if (runsForDate.length === 0) return;

    const targetRun = runsForDate[0]; // Use most recent run for that date
    setSelectedHistoricalRunId(targetRun.id);

    // Fetch full run data from API (same pattern as handleChartClick)
    try {
      const response = await fetch(`/api/benchmark/runs/${targetRun.id}`);
      if (response.ok) {
        const fullRun = await response.json();
        setSelectedHistoricalRun(fullRun);
      } else {
        console.error(`Failed to fetch run ${targetRun.id}`);
      }
    } catch (err) {
      console.error(`Error fetching run ${targetRun.id}:`, err);
    }
  }, [historicalRuns]);

  const abortControllerRef = useRef<AbortController | null>(null);

  // Cache for transformed history runs to avoid re-processing
  const historyCacheRef = useRef(new Map<string, BenchmarkRun>());

  // Centralized data loading hook - replaces multiple useEffect calls
  const matrixDataHook = useMatrixData({ active: isMatrixActive });

  // Sync hook data to component state
  useEffect(() => {
    if (matrixDataHook.config) {
      setPersonas(matrixDataHook.config.personas.map(p => ({
        ...p,
        description: p.description || "",
      })));
      setStages(matrixDataHook.config.stages.map(s => ({
        ...s,
        description: s.description || "",
      })));
      setMatrixConfigLoading(false);
    } else if (matrixDataHook.status === "error") {
      // Unblock config loading on error - let error banner show
      setMatrixConfigLoading(false);
    }
  }, [matrixDataHook.config, matrixDataHook.status]);

  useEffect(() => {
    if (matrixDataHook.history.length > 0) {
      const sortedRawRuns = matrixDataHook.history.slice().sort((a, b) => a.timestamp.localeCompare(b.timestamp));
      setHistoricalRuns(sortedRawRuns);

      // Use cache to avoid re-transforming runs we've already processed
      const cache = historyCacheRef.current;
      const runs = sortedRawRuns.map((run) => {
        const key = getRunCacheKey(run);
        const cached = cache.get(key);
        if (cached) return cached;
        const transformed = toUiBenchmarkRun(run);
        cache.set(key, transformed);
        return transformed;
      });

      setBenchmarkHistory(runs);
      setSelectedTimeIndex(Math.max(0, runs.length - 1));
    } else if (matrixDataHook.status === "ready") {
      // Clear stale data when history is empty (handles date changes, fresh state)
      setHistoricalRuns([]);
      setBenchmarkHistory([]);
      setSelectedTimeIndex(0);
    }
  }, [matrixDataHook.history, matrixDataHook.status]);

  // Track active mutations to prevent sync from overwriting optimistic updates
  const isMutatingRef = useRef(false);

  useEffect(() => {
    // Don't overwrite during active mutations (optimistic updates in progress)
    if (isMutatingRef.current) return;

    if (matrixDataHook.intentLibrary) {
      setIntentLibrary(matrixDataHook.intentLibrary);
      setLocalQueryBank(
        buildQueryBankFromIntentLibrary(
          matrixDataHook.intentLibrary,
          personas.map((p) => p.id),
          stages.map((s) => s.id)
        )
      );
    }
  }, [matrixDataHook.intentLibrary, personas, stages]);

  // Keep query-bank shape aligned with current dynamic personas/stages.
  useEffect(() => {
    setLocalQueryBank((prev) =>
      normalizeQueryBank(
        prev,
        personas.map((p) => p.id),
        stages.map((s) => s.id)
      )
    );
  }, [personas, stages]);

  // Track whether user has run their own benchmark this session (don't override with historical)
  const userRanBenchmarkRef = useRef(false);

  // Load most recent run into matrix after personas/stages AND historical runs are available
  // This properly handles remounts when navigating back to the page
  useEffect(() => {
    // Only proceed if config is loaded
    if (matrixConfigLoading || personas.length === 0 || stages.length === 0) {
      return;
    }

    // Don't override if user has run their own benchmark this session
    if (userRanBenchmarkRef.current) {
      return;
    }

    // If matrixData has no actual results and we have historical runs, load the latest
    // This handles both initial load AND navigation back to the page
    // Note: Check for results, not just keys, because empty cells may have been initialized
    const hasResults = Object.values(matrixData).some(cell => cell.results.length > 0);
    if (!hasResults && historicalRuns.length > 0) {
      const latestRun = historicalRuns[historicalRuns.length - 1];
      setMatrixData(storedRunToMatrixData(latestRun, personas, stages));
    }
  }, [matrixConfigLoading, personas, stages, historicalRuns, matrixData]);


  const persistQueryBank = async (queryBank: QueryBank) => {
    // Set mutation lock to prevent sync effect from overwriting optimistic updates
    isMutatingRef.current = true;

    try {
      const resp = await fetch("/api/intents/library/queries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ queryBank }),
      });
      if (!resp.ok) {
        console.error(`/api/intents/library/queries failed: ${resp.status}`);
        return;
      }

      // The API returns the canonical intent library (including server-generated IDs for new intents).
      // We update intentLibrary for reference, but DON'T rebuild localQueryBank -
      // the optimistic update is already correct and rebuilding would overwrite user's changes.
      const data = await resp.json().catch(() => null);
      if (data?.library) {
        setIntentLibrary(data.library);
      }
    } catch (err) {
      console.error("/api/intents/library/queries network error:", err);
    } finally {
      // Keep lock for a bit longer to account for polling race conditions
      // (polling may have already fetched old data before our save completed)
      setTimeout(() => {
        isMutatingRef.current = false;
      }, 2000);
    }
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
          recommended: r.visibility.recommended,
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
      for (const stage of stages) {
        const key = `${persona.id}-${stage.id}`;
        const entry = localQueryBank[persona.id]?.[stage.id] || { intents: [] };
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
  }, [personas, stages, localQueryBank]);

  useEffect(() => {
    // Only initialize empty matrix if:
    // 1. No matrixData exists yet
    // 2. No historical runs are available (otherwise, the historical loading effect will handle it)
    // 3. Config has loaded (personas/stages available)
    if (Object.keys(matrixData).length === 0 && historicalRuns.length === 0 && !matrixConfigLoading) {
      setMatrixData(initializeMatrix());
    }
  }, [initializeMatrix, matrixData, historicalRuns.length, matrixConfigLoading]);

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

    const cellsWithoutIntents = targetCells.filter(
      (cell) => (localQueryBank[cell.persona]?.[cell.stage]?.intents?.length ?? 0) === 0
    );
    if (cellsWithoutIntents.length > 0) {
      const preview = cellsWithoutIntents
        .slice(0, 3)
        .map((cell) => {
          const personaLabel = personas.find((p) => p.id === cell.persona)?.label ?? cell.persona;
          const stageLabel = stages.find((s) => s.id === cell.stage)?.label ?? cell.stage;
          return `${personaLabel} × ${stageLabel}`;
        })
        .join(", ");
      alert(
        `Cannot run benchmark yet. Missing intents for ${cellsWithoutIntents.length} selected cell(s): ${preview}.`
      );
      return;
    }

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
      model: providerModels[p],
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

      setMatrixData((prev) => {
        const next = { ...prev };

        for (const t of targetCells) {
          const result = resultsByCell[t.key];
          if (!result) {
            next[t.key] = { ...next[t.key], status: "idle" };
            continue;
          }

          const allScores: number[] = [];

          for (const qr of result.queries) {
            for (const resp of qr.responses) {
              if (!resp.error) {
                allScores.push(resp.visibility.score);
              }
            }
          }

          const avgScore =
            allScores.length > 0 ? allScores.reduce((a, b) => a + b, 0) / allScores.length : 0;
          const mentionRate = getExploreMentionStats({
            stage: t.stage,
            results: result.queries,
          }).mentionRate;

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
    userRanBenchmarkRef.current = true; // Prevent historical data from overwriting user's benchmark
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
      cellKeys = stages.map((s) => `${selection.persona}-${s.id}`);
    } else if (selection.type === "column") {
      cellKeys = personas.map((p) => `${p.id}-${selection.stage}`);
    }

    try {
      await runCellsBenchmark(cellKeys, quickTest, signal);
    } finally {
      setIsRunning(false);
      abortControllerRef.current = null;
    }
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

  // Background color based on legacy score (kept for hover cards / future use)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const getCellBgColor = (score: number, mentionRate: number | null): string => {
    if (mentionRate === null || mentionRate === 0) return "bg-[#f0d9d9]";
    if (score >= 0.6) return "bg-[#d4e5d4]";
    if (score >= 0.4) return "bg-[#efe6d9]";
    if (score >= 0.2) return "bg-[#f5e6d3]";
    return "bg-[#f0d9d9]";
  };

  const selectedCellsData = useMemo(() => {
    const cells: CellData[] = [];

    if (selection.type === "all") {
      cells.push(...Object.values(effectiveMatrixData).filter(c => c.status === "complete"));
    } else if (selection.type === "cell") {
      const cell = effectiveMatrixData[`${selection.persona}-${selection.stage}`];
      if (cell?.status === "complete") cells.push(cell);
    } else if (selection.type === "row") {
      for (const stage of stages) {
        const cell = effectiveMatrixData[`${selection.persona}-${stage.id}`];
        if (cell?.status === "complete") cells.push(cell);
      }
    } else if (selection.type === "column") {
      for (const persona of personas) {
        const cell = effectiveMatrixData[`${persona.id}-${selection.stage}`];
        if (cell?.status === "complete") cells.push(cell);
      }
    }

    return cells;
  }, [selection, effectiveMatrixData, personas, stages]);

  const normalizedProviderWeights = useMemo(
    () => normalizeWeights(DEFAULT_PROVIDER_WEIGHTS),
    []
  );

  const modelTrendData = useMemo(() => {
    const baseMockDate = new Date(Date.UTC(2026, 0, 1));

    // Helper to get metric value based on selected kpiMetric
    const getValue = (provider: Provider, run: BenchmarkRun): number | null => {
      let value: number | null = null;
      switch (kpiMetric) {
        case "mention": {
          const mentionRate = run.providerScores[provider]?.mentionRate;
          if (mentionRate !== null && mentionRate !== undefined) {
            value = Math.round(mentionRate * 100);
          }
          break;
        }
        case "sentiment":
          // Convert [-1, 1] to [0, 100]
          if (run.stageData?.sentimentScore !== null && run.stageData?.sentimentScore !== undefined) {
            value = Math.round((run.stageData.sentimentScore + 1) * 50);
          }
          break;
        case "winrate":
          if (run.stageData?.winRate !== null && run.stageData?.winRate !== undefined) {
            value = Math.round(run.stageData.winRate * 100);
          }
          break;
        case "top3": {
          const pos = run.stageData?.positionCounts;
          if (pos) {
            const inTop3 = pos["1st"] + pos["2nd"] + pos["3rd"];
            const total = inTop3 + pos.later + pos.absent;
            value = total > 0 ? Math.round((inTop3 / total) * 100) : 0;
          }
          break;
        }
        default:
          value = 0;
      }
      if (value === null) return null;
      if (weightMode === "weighted") {
        const weighted = value * (normalizedProviderWeights[provider] ?? 0);
        return Math.round(weighted * 10) / 10;
      }
      return value;
    };

    // Group runs by date and select the latest run per day
    const latestRunsByDate = new Map<string, BenchmarkRun>();
    for (const run of benchmarkHistory) {
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

      const existing = latestRunsByDate.get(dateISO);
      if (!existing || run.timestamp > existing.timestamp) {
        latestRunsByDate.set(dateISO, run);
      }
    }

    // Convert to chart data points with runId for click handling
    const full = Array.from(latestRunsByDate.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([dateISO, run]) => ({
        label: run.label,
        date: dateISO,
        runId: run.id, // For click handler
        openai: getValue("openai", run),
        anthropic: getValue("anthropic", run),
        gemini: getValue("gemini", run),
        xai: getValue("xai", run),
      }));

    const windowSize = kpiRange === "day" ? 30 : kpiRange === "week" ? 13 : 12;
    return full.slice(-windowSize);
  }, [benchmarkHistory, kpiRange, kpiMetric, weightMode, normalizedProviderWeights]);

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

  const selectionLabel = useMemo(() => {
    if (selection.type === "all") return "All Cells";
    if (selection.type === "cell") {
      const p = personas.find(x => x.id === selection.persona)?.label;
      const s = stages.find(x => x.id === selection.stage)?.label;
      return `${p} × ${s}`;
    }
    if (selection.type === "row") {
      return `${personas.find(x => x.id === selection.persona)?.label}`;
    }
    if (selection.type === "column") {
      return `${stages.find(x => x.id === selection.stage)?.label}`;
    }
    return "";
  }, [selection, personas, stages]);

  const showWeightedArea = weightMode === "weighted";

  // Handle retry from error banner - force re-fetch by reloading page
  const handleRetryData = () => {
    window.location.reload();
  };

  return (
    <>
      {/* Inline error banner - doesn't unmount the page */}
      <InlineErrorBanner
        error={matrixDataHook.error}
        onRetry={handleRetryData}
      />

      <div className={`min-h-screen pb-16 ${selectedHistoricalRun ? "bg-[#f6f1e8]/70" : "bg-[#f6f1e8]"}`}>
      {/* Header */}
      <div className="border-b border-brand-secondary bg-[var(--panel)]">
        <div className="max-w-6xl mx-auto px-6 py-5 space-y-4">
          {/* Top row: Toggle + Stats */}
          <div className="flex items-center justify-between">
            <ViewToggle />
            <div className="flex items-center gap-4 text-sm text-[var(--ink)]/60">
              <span>
                <span className="font-semibold text-[var(--ink)]">{personas.length * stages.length}</span> cells
              </span>
              <span className="text-[var(--ink)]/30">·</span>
              <span>
                Last run{" "}
                {matrixDataHook.status === "loading" && historicalRuns.length === 0 ? (
                  <Skeleton className="h-4 w-16 inline-block align-middle bg-brand-secondary/50" />
                ) : (
                  <span className="font-medium text-[var(--ink)]">
                    {historicalRuns.length > 0 ? new Date(historicalRuns[historicalRuns.length - 1].timestamp).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "—"}
                  </span>
                )}
              </span>
            </div>
          </div>

          {/* Title */}
          <h1 className="text-2xl font-semibold text-[var(--forest)] font-display">
            {BRAND} Visibility Matrix
          </h1>
        </div>
      </div>

      {/* Historical Run Banner */}
      {selectedHistoricalRun && selectedRunDateLabel && (
        <div className="bg-brand-primary/5 border-b border-brand-primary/10">
          <div className="max-w-6xl mx-auto px-6 py-2 flex items-center justify-between">
            <span className="text-xs text-brand-primary/80">
              Viewing run from {selectedRunDateLabel}
            </span>
            <Button
              size="sm"
              variant="ghost"
              onClick={clearHistoricalSelection}
              className="text-brand-primary hover:bg-brand-primary/10 h-7 px-3 text-[10px] font-bold uppercase tracking-wider"
            >
              Clear
            </Button>
          </div>
        </div>
      )}

      <div className="max-w-6xl mx-auto p-6 space-y-6">
        {/* Provider KPI Strip */}
        <div className="rounded-none border border-brand-secondary bg-white p-8">
          <div className="flex flex-col gap-6 mb-12">
            {/* Top Row: Title Only */}
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-black uppercase tracking-[0.2em] text-black">AI Performance History</h2>
                <p className="text-[10px] text-black/40 font-medium uppercase tracking-wider mt-1">Cross-model benchmarks over time</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-black/40">Weighting</span>
                <div className="flex rounded-full border border-brand-secondary overflow-hidden bg-white">
                  <button
                    onClick={() => setWeightMode("equal")}
                    className={`px-4 py-1 text-[10px] font-black uppercase tracking-[0.2em] transition-colors ${
                      weightMode === "equal"
                        ? "bg-brand-primary text-white"
                        : "text-black/40 hover:text-black/60"
                    }`}
                  >
                    Equal
                  </button>
                  <button
                    onClick={() => setWeightMode("weighted")}
                    className={`px-4 py-1 text-[10px] font-black uppercase tracking-[0.2em] transition-colors ${
                      weightMode === "weighted"
                        ? "bg-brand-primary text-white"
                        : "text-black/40 hover:text-black/60"
                    }`}
                  >
                    Weighted
                  </button>
                </div>
              </div>
            </div>

            {/* Middle Row: Centered Metric Selector */}
            <div className="flex justify-center">
              <div className="flex gap-8 border-b border-brand-secondary px-12">
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
                      ? "text-brand-primary border-brand-primary"
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
            <div className="flex-1 h-[160px]">
              {matrixDataHook.status === "loading" && benchmarkHistory.length === 0 ? (
                <Skeleton className="h-full w-full bg-brand-secondary/30" />
              ) : benchmarkHistory.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-black/30 border border-dashed border-brand-secondary rounded-lg">
                  <svg className="w-10 h-10 mb-3 stroke-current" fill="none" viewBox="0 0 24 24" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
                  </svg>
                  <p className="text-sm font-medium">No benchmark history</p>
                  <p className="text-xs mt-1">Run a benchmark to see performance trends</p>
                </div>
              ) : (
                <MatrixTrendChart
                  config={chartConfig}
                  data={modelTrendData}
                  selectedRunChartIndex={selectedRunChartIndex}
                  onChartClick={handleChartClick}
                  kpiTickInterval={kpiTickInterval}
                  formatKpiTick={formatKpiTick}
                  enabledProviders={enabledProviders}
                  showWeightedArea={showWeightedArea}
                />
              )}
            </div>
            <div className="w-full lg:w-44 flex flex-col gap-2 justify-center">
              <button
                onClick={selectAllProviders}
                className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold border transition-all ${enabledProviders.size === PROVIDERS.length
                  ? "bg-[#2b6cb0] text-white border-[#2b6cb0]"
                  : "bg-white text-[#1e1b16]/70 border-brand-secondary hover:border-[#2b6cb0]/40"
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
                      : "bg-white text-[#1e1b16]/70 border-brand-secondary hover:border-brand-primary/40"
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
          <div className="flex justify-center mt-8 border-t border-brand-secondary/50 pt-6">
            <div className="flex gap-4 border-b border-brand-secondary">
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
            Legend: Select models to filter trend lines • Click chart to view historical run • Range: View window size
          </p>
        </div>

        {/* Historical Run Banner */}
        {selectedHistoricalRun && (
          <div className="mt-6 flex items-center justify-between bg-brand-primary/10 border border-brand-primary/20 rounded-lg px-4 py-3">
            <div className="flex items-center gap-3">
              <Clock className="h-4 w-4 text-brand-primary" />
              <span className="text-sm font-medium text-brand-primary">
                Viewing historical run from {selectedRunDateLabel}
              </span>
            </div>
            <button
              onClick={clearHistoricalSelection}
              className="flex items-center gap-1.5 text-xs font-semibold text-brand-primary hover:text-brand-primary/70 transition-colors"
            >
              <X className="h-3.5 w-3.5" />
              Return to current
            </button>
          </div>
        )}

        {/* Matrix Workspace */}
        <div className="mt-8 -mx-6">
          <div className="flex-1">
            {matrixDataHook.status === "ready" && historicalRuns.length === 0 && Object.values(matrixData).every(cell => cell.results.length === 0) && (
              <div className="mx-6 mb-4 border border-dashed border-brand-secondary bg-white px-6 py-4 text-center">
                <p className="text-sm text-black/60">
                  No benchmark data yet. Click <span className="font-semibold">&quot;Select Queries to Run&quot;</span> to choose cells and start your first benchmark.
                </p>
              </div>
            )}
            {(() => {
              // Transform effectiveMatrixData into a format SplitViewEditor can use for the 'summary' mode
              // effectiveMatrixData is either the current run or a selected historical run
              const cellResults: Record<string, Record<string, { discoveryRate: number; sentimentScore: number; topCompetitor?: string; winRate?: number; recommendationRate?: number; responses?: { provider: string; model: string; text: string; query: string; visibility: { score: number; mentioned: boolean; sentiment: string } }[]; citations?: Citation[] }>> = {};

              Object.keys(effectiveMatrixData).forEach(key => {
                const [pId, sId] = key.split("-") as [Persona, Stage];
                const cell = effectiveMatrixData[key];
                if (!cellResults[pId]) cellResults[pId] = {};

                // Skip partial cells - leave them undefined so SplitViewEditor shows grey "No data"
                if (cell.status === "partial") return;

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
                  onTabChange={setViewMode}
                  personas={personas}
                  stages={stages}
                  queryBank={effectiveQueryBank}
                  cellResults={cellResults}
                  brandDomain={BRAND_DOMAIN}
                  showMissing={Boolean(selectedHistoricalRun)}
                  loading={matrixDataHook.status === "loading" && Object.keys(effectiveMatrixData).length === 0}
                  onSelectCell={(persona, stage) => {
                    setSelectedCell((prev) =>
                      prev?.persona === persona && prev?.stage === stage
                        ? prev
                        : { persona, stage }
                    );
                    setSelection((prev) =>
                      prev.type === "cell" && prev.persona === persona && prev.stage === stage
                        ? prev
                        : { type: "cell", persona, stage }
                    );
                    if (viewMode === "intents" || viewMode === "queries") {
                      setIntentEditorOpen(true);
                      setInsightModalOpen(false);
                      setAnswersPanelOpen(false);
                    } else if (viewMode === "summary") {
                      setInsightModalOpen(true);
                      setIntentEditorOpen(false);
                      setAnswersPanelOpen(false);
                    } else {
                      setAnswersPanelOpen(true);
                      setIntentEditorOpen(false);
                      setInsightModalOpen(false);
                    }
                  }}
                  onShowAll={() => setViewMode("summary")}
                  onGenerateAll={async (mode) => {
                    if (mode === "intents") {
                      // Generate (or regenerate) Research Objectives.
                      const allCells: { persona: Persona; stage: Stage }[] = [];
                      const emptyCells: { persona: Persona, stage: Stage }[] = [];
                      Object.entries(localQueryBank).forEach(([pId, stages]) => {
                        Object.entries(stages).forEach(([sId, data]) => {
                          allCells.push({ persona: pId as Persona, stage: sId as Stage });
                          if (data.intents.length === 0) {
                            emptyCells.push({ persona: pId as Persona, stage: sId as Stage });
                          }
                        });
                      });

                      let targetCells = emptyCells;
                      let overwriteExisting = false;

                      if (emptyCells.length > 0) {
                        if (!confirm(`Generate AI research objectives for ${emptyCells.length} empty cells?`)) return;
                      } else {
                        overwriteExisting = true;
                        targetCells = allCells;
                        if (
                          !confirm(
                            `All cells already have research objectives. Regenerate and replace intents for all ${allCells.length} cells?`
                          )
                        ) {
                          return;
                        }
                      }

                      const buildFallbackIntentText = (personaId: Persona, stageId: Stage): string => {
                        const personaConfig = personas.find((p) => p.id === personaId);
                        const stageConfig = stages.find((s) => s.id === stageId);
                        const personaLabel = personaConfig?.label || personaId;
                        const stageLabel = stageConfig?.label || stageId;
                        const personaContext = personaConfig?.description?.trim()
                          ? ` Context: ${personaConfig.description.trim()}`
                          : "";
                        const stageText = `${stageId} ${stageLabel}`.toLowerCase();

                        if (
                          stageText.includes("discover") ||
                          stageText.includes("explore") ||
                          stageText.includes("awareness")
                        ) {
                          return `Identify the top early-stage questions ${personaLabel} should ask to frame the problem, key criteria, and viable options.${personaContext}`;
                        }
                        if (
                          stageText.includes("research") ||
                          stageText.includes("consider") ||
                          stageText.includes("evaluate")
                        ) {
                          return `Evaluate fit, constraints, pricing, outcomes, and trust signals for ${personaLabel} so they can narrow to realistic options.${personaContext}`;
                        }
                        if (stageText.includes("compare") || stageText.includes("shortlist")) {
                          return `Compare leading options side-by-side for ${personaLabel} across trade-offs, total cost, risk, and expected results.${personaContext}`;
                        }
                        if (
                          stageText.includes("apply") ||
                          stageText.includes("decide") ||
                          stageText.includes("select") ||
                          stageText.includes("purchase") ||
                          stageText.includes("enroll")
                        ) {
                          return `Resolve final decision blockers for ${personaLabel} and define the confidence checks needed before committing.${personaContext}`;
                        }
                        return `Define the key decision questions ${personaLabel} must answer during the ${stageLabel} stage.${personaContext}`;
                      };

                      const newBank = cloneQueryBank(localQueryBank);
                      const queue = [...targetCells];
                      const workerCount = Math.min(4, queue.length);
                      let generatedCount = 0;
                      let fallbackCount = 0;

                      const workers = Array.from({ length: workerCount }, async () => {
                        while (queue.length > 0) {
                          const cell = queue.shift();
                          if (!cell) break;

                          const fallbackText = buildFallbackIntentText(cell.persona, cell.stage);
                          let intentText = fallbackText;
                          let intentRole: "cpo" | "family_unit" = "cpo";
                          let intentStyle = 0.75;
                          let usedFallback = true;

                          try {
                            const resp = await fetch("/api/intents/generate-objective", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({
                                persona: cell.persona,
                                stage: cell.stage,
                              }),
                            });

                            if (resp.ok) {
                              const data = await resp.json();
                              const modelIntent = data?.intent;
                              if (modelIntent?.text && typeof modelIntent.text === "string") {
                                intentText = modelIntent.text.trim();
                                if (modelIntent.role === "cpo" || modelIntent.role === "family_unit") {
                                  intentRole = modelIntent.role;
                                }
                                if (
                                  typeof modelIntent.queryStyle === "number" &&
                                  modelIntent.queryStyle >= 0.5 &&
                                  modelIntent.queryStyle <= 1
                                ) {
                                  intentStyle = modelIntent.queryStyle;
                                }
                                usedFallback = Boolean(data?.fallback);
                              }
                            }
                          } catch {
                            // Keep fallback for this cell and continue.
                          }

                          const uniqueId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
                          if (!newBank[cell.persona]) newBank[cell.persona] = {};
                          if (!newBank[cell.persona][cell.stage]) newBank[cell.persona][cell.stage] = { intents: [] };
                          const generatedIntent: IntentNode = {
                            id: `intent-${cell.persona}-${cell.stage}-${uniqueId}`,
                            text: intentText,
                            role: intentRole,
                            queryStyle: intentStyle,
                            generatedQueries: [],
                          };

                          if (overwriteExisting) {
                            newBank[cell.persona][cell.stage].intents = [generatedIntent];
                          } else {
                            newBank[cell.persona][cell.stage].intents.push(generatedIntent);
                          }

                          if (usedFallback) fallbackCount += 1;
                          else generatedCount += 1;
                        }
                      });

                      await Promise.all(workers);

                      setLocalQueryBank(newBank);
                      persistQueryBank(newBank);
                      alert(
                        fallbackCount > 0
                          ? `Generated ${generatedCount} AI objectives. ${fallbackCount} used safe fallback objectives.${overwriteExisting ? " Existing objectives were replaced." : ""}`
                          : `Generated ${generatedCount} AI objectives.${overwriteExisting ? " Existing objectives were replaced." : ""}`
                      );
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

                      const newBank = cloneQueryBank(localQueryBank);

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
                              count: 3, // Match cron job behavior
                            }),
                          });

                          if (resp.ok) {
                            const data = await resp.json();
                            const targetIntent = newBank[item.persona]?.[item.stage]?.intents.find(i => i.id === item.intent.id);
                            if (targetIntent) {
                              targetIntent.generatedQueries = data.queries;
                            }
                          }
                        } catch (err) {
                          console.error("Failed to generate for cell:", err);
                        }
                      }
                      setLocalQueryBank(newBank);
                      persistQueryBank(newBank);
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
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto bg-[#fffaf2] border-brand-secondary">
          <DialogHeader>
            <DialogTitle className="text-[#1e1b16]">Deep Dive: {selectionLabel}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {selectedCellsData.map((cell, cellIdx) => (
              <div key={cellIdx}>
                <h4 className="font-medium text-[#1e1b16] mb-2 text-sm">
                  {personas.find(p => p.id === cell.persona)?.label} × {stages.find(s => s.id === cell.stage)?.label}
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
                            <div key={rIdx} className="border border-brand-secondary rounded-xl p-3 bg-[#fffaf2]">
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
                                  highlightBrandMentions(resp.text, resp.visibility.sentiment, [BRAND, ...BRAND_ALIASES])
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
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto bg-[#fffaf2] border-brand-secondary">
          <DialogHeader>
            <DialogTitle className="text-[#1e1b16] flex items-center justify-between">
              <span>{evidenceModal?.title}</span>
              <Button
                size="sm"
                variant="outline"
                className="border-brand-secondary text-[#1e1b16] hover:bg-[#efe6d9]"
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
                  <div key={idx} className="border border-brand-secondary rounded-xl p-4 bg-white">
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
                    <div className="text-sm text-[#1e1b16]/80 leading-relaxed border-t border-brand-secondary pt-3">
                      {highlightBrandMentions(
                        item.excerpt,
                        item.metricValue === "positive" ? "positive" :
                          item.metricValue === "negative" ? "negative" : "neutral",
                        [BRAND, ...BRAND_ALIASES]
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
        selectedCell && intentEditorOpen && (
          <IntentEditorModal
            open={intentEditorOpen}
            onClose={() => setIntentEditorOpen(false)}
            defaultTab={viewMode === "queries" ? "queries" : "intents"}
            persona={selectedCell.persona}
            stage={selectedCell.stage}
            personas={personas}
            stages={stages}
            cellStatus={cellStatus}
            onSelectCell={(p, s) =>
              setSelectedCell((prev) =>
                prev?.persona === p && prev?.stage === s ? prev : { persona: p, stage: s }
              )
            }
            intents={localQueryBank[selectedCell.persona]?.[selectedCell.stage]?.intents || []}
            queries={Object.fromEntries(
              (localQueryBank[selectedCell.persona]?.[selectedCell.stage]?.intents || []).map(i => [i.id, i.generatedQueries || []])
            )}
            onIntentChange={(updatedIntent) => {
              const newBank = { ...localQueryBank };
              if (!newBank[selectedCell.persona]) newBank[selectedCell.persona] = {};
              if (!newBank[selectedCell.persona][selectedCell.stage]) newBank[selectedCell.persona][selectedCell.stage] = { intents: [] };
              newBank[selectedCell.persona][selectedCell.stage].intents = newBank[selectedCell.persona][selectedCell.stage].intents.map(i =>
                i.id === updatedIntent.id ? updatedIntent : i
              );
              setLocalQueryBank(newBank);
              persistQueryBank(newBank);
            }}
            onIntentDelete={(intentId) => {
              const newBank = { ...localQueryBank };
              if (!newBank[selectedCell.persona]) newBank[selectedCell.persona] = {};
              if (!newBank[selectedCell.persona][selectedCell.stage]) newBank[selectedCell.persona][selectedCell.stage] = { intents: [] };
              newBank[selectedCell.persona][selectedCell.stage].intents = newBank[selectedCell.persona][selectedCell.stage].intents.filter(
                i => i.id !== intentId
              );
              setLocalQueryBank(newBank);
              persistQueryBank(newBank);
            }}
            onIntentAdd={(text, role, style) => {
              const newBank = { ...localQueryBank };
              if (!newBank[selectedCell.persona]) newBank[selectedCell.persona] = {};
              if (!newBank[selectedCell.persona][selectedCell.stage]) newBank[selectedCell.persona][selectedCell.stage] = { intents: [] };
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
              const intent = newBank[selectedCell.persona]?.[selectedCell.stage]?.intents.find(i => i.id === intentId);
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
              const intent = newBank[selectedCell.persona]?.[selectedCell.stage]?.intents.find(i => i.id === intentId);
              if (intent) {
                intent.generatedQueries = (intent.generatedQueries || []).filter((_, i) => i !== queryIndex);
                setLocalQueryBank(newBank);
                persistQueryBank(newBank);
              }
            }}
            onQueryAdd={async (intentId) => {
              const intent = localQueryBank[selectedCell.persona]?.[selectedCell.stage]?.intents.find(i => i.id === intentId);
              if (!intent) return;

              const existingQueries = intent.generatedQueries || [];

              // Generate a single new query, avoiding existing ones
              const resp = await fetch("/api/intents/generate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  persona: selectedCell.persona,
                  stage: selectedCell.stage,
                  intent: intent.text,
                  role: intent.role,
                  queryStyle: intent.queryStyle,
                  count: 1,
                  existingQueries,
                }),
              });

              if (!resp.ok) return;
              const data = await resp.json();
              if (!data.queries?.length) return;

              // Add the new query to existing ones
              const newBank = { ...localQueryBank };
              const targetIntent = newBank[selectedCell.persona]?.[selectedCell.stage]?.intents.find(i => i.id === intentId);
              if (targetIntent) {
                targetIntent.generatedQueries = [...existingQueries, ...data.queries];
                setLocalQueryBank(newBank);
                persistQueryBank(newBank);
              }
            }}
            onQueryRegenerate={async (intentId) => {
              const intent = localQueryBank[selectedCell.persona]?.[selectedCell.stage]?.intents.find(i => i.id === intentId);
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
                  count: 3, // Match cron job behavior
                }),
              });

              if (!resp.ok) throw new Error("Failed to generate queries");
              const data = await resp.json();

              const newBank = { ...localQueryBank };
              if (!newBank[selectedCell.persona]) newBank[selectedCell.persona] = {};
              if (!newBank[selectedCell.persona][selectedCell.stage]) newBank[selectedCell.persona][selectedCell.stage] = { intents: [] };
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

      {selectedCell && insightModalOpen && (() => {
        const cellKey = `${selectedCell.persona}-${selectedCell.stage}`;
        const cellData = effectiveMatrixData[cellKey];
        return (
        <InsightModal
          open={insightModalOpen}
          onClose={() => setInsightModalOpen(false)}
          persona={selectedCell.persona}
          stage={selectedCell.stage}
          personaLabel={personas.find(p => p.id === selectedCell.persona)?.label || ""}
          stageLabel={stages.find(s => s.id === selectedCell.stage)?.label || ""}
          results={cellData?.results || []}
          brand={BRAND}
          onRunCell={() => {
            setInsightModalOpen(false);
            runCellsBenchmark([`${selectedCell.persona}-${selectedCell.stage}`], true);
          }}
          isRunning={isRunning}
          personas={personas.map(p => p.label)}
        />
        );
      })()}

      {/* Answers Panel - LLM Response Viewer */}
      {selectedCell && answersPanelOpen && (() => {
        const cellKey = `${selectedCell.persona}-${selectedCell.stage}`;
        const cellData = effectiveMatrixData[cellKey];
        return (
          <AnswersPanel
            open={answersPanelOpen}
            onClose={() => setAnswersPanelOpen(false)}
            persona={selectedCell.persona}
            stage={selectedCell.stage}
            personaLabel={personas.find(p => p.id === selectedCell.persona)?.label || ""}
            stageLabel={stages.find(s => s.id === selectedCell.stage)?.label || ""}
            results={cellData?.results || []}
            brand={BRAND}
            brandAliases={BRAND_ALIASES}
            isHistorical={!!selectedHistoricalRun}
            runTimestamp={selectedHistoricalRun?.timestamp}
            availableRunDates={availableRunDates}
            onDateChange={handleAnswersPanelDateChange}
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
        personas={personas.map(p => p.label)}
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
        onTimeMachine={() => setTimeMachineOpen(true)}
        isTimeMachineOpen={timeMachineOpen}
      />

      {/* Time Machine Panel */}
      {timeMachineOpen && (
        <TimeMachinePanel
          runs={historicalRuns}
          selectedRunId={selectedHistoricalRunId}
          onSelectRun={handleSelectHistoricalRun}
          onClose={() => setTimeMachineOpen(false)}
          onBackToNow={() => {
            clearHistoricalSelection();
            setTimeMachineOpen(false);
          }}
          totalCells={personas.length * stages.length}
        />
      )}

      {/* Global Progress Bar */}
      <GlobalProgressBar externalState={progressState} autoHideDelay={4000} />
    </div>
    </>
  );
}

function highlightBrandMentions(
  text: string,
  sentiment: string,
  brandTerms: string[]
): React.ReactNode {
  const bgColor = sentiment === "positive"
    ? "bg-[#d4e5d4]"
    : sentiment === "negative"
      ? "bg-[#f0d9d9]"
      : "bg-[#cde0f0]";

  // Custom component to highlight brand mentions within markdown
  const components = {
    p: ({ children }: { children?: React.ReactNode }) => (
      <p className="my-1">{highlightInText(children, bgColor, brandTerms)}</p>
    ),
    li: ({ children }: { children?: React.ReactNode }) => (
      <li className="my-0.5">{highlightInText(children, bgColor, brandTerms)}</li>
    ),
    strong: ({ children }: { children?: React.ReactNode }) => (
      <strong>{highlightInText(children, bgColor, brandTerms)}</strong>
    ),
  };

  return (
    <div className="prose prose-sm prose-stone max-w-none prose-p:my-1 prose-ul:my-1 prose-li:my-0 prose-headings:my-2 prose-headings:text-[#1e1b16] prose-headings:text-sm">
      <ReactMarkdown components={components}>{text}</ReactMarkdown>
    </div>
  );
}

function highlightInText(
  children: React.ReactNode,
  bgColor: string,
  brandTerms: string[]
): React.ReactNode {
  if (typeof children === "string") {
    // Build regex pattern from brand terms
    const escapedTerms = brandTerms.map(term =>
      term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    );
    if (escapedTerms.length === 0) return children;

    const pattern = new RegExp(`(${escapedTerms.join("|")})`, "gi");
    const parts = children.split(pattern);
    const lowerTerms = new Set(brandTerms.map(t => t.toLowerCase()));

    return parts.map((part, i) => {
      if (lowerTerms.has(part.toLowerCase())) {
        return <span key={i} className={`${bgColor} px-1 rounded`}>{part}</span>;
      }
      return part;
    });
  }
  return children;
}
