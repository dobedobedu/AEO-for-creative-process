"use client";

import { useState, useMemo, useRef, useCallback, Fragment } from "react";
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
  Loader2,
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
  X,
} from "lucide-react";
import Link from "next/link";
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
  queries: string[];
  results: QueryResult[];
  avgScore: number;
  mentionRate: number;
  status: "idle" | "running" | "complete";
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

// Real queries from research
const QUERY_BANK: Record<Persona, Record<Stage, string[]>> = {
  move_up: {
    explore: [
      "best places in florida for growing families",
      "whats the best place in florida to raise a family",
      "is tampa a good place to raise a family",
    ],
    consider: [
      "master planned communities florida families",
      "best family neighborhoods and schools in orlando area",
      "florida communities with good schools not too expensive",
    ],
    compare: [
      "lakewood ranch vs nocatee for families",
      "wellen park vs lakewood ranch schools",
      "tampa vs orlando for young families",
    ],
    decide: [
      "best neighborhoods in lakewood ranch for families",
      "nocatee schools vs lakewood ranch schools",
    ],
  },
  retiree: {
    explore: [
      "best places to retire in florida 2025",
      "best places to retire in florida that arent too hot",
      "how much do i really need to retire in florida",
    ],
    consider: [
      "55 plus communities florida amenities",
      "what 55+ communities in florida have lots of clubs and activities",
      "active adult communities southwest florida",
    ],
    compare: [
      "lakewood ranch vs the villages for retirees",
      "the villages vs sun city center",
      "the villages vs on top of the world retirement",
    ],
    decide: [
      "is it hard to find doctors accepting medicare in the villages",
      "cresswind lakewood ranch reviews",
    ],
  },
  luxury: {
    explore: [
      "luxury communities florida gulf coast",
      "upscale master planned communities florida",
      "best florida retirement cities culture theater museums restaurants",
    ],
    consider: [
      "florida communities with golf courses",
      "waterfront homes master planned florida",
      "sarasota vs naples for retirement",
    ],
    compare: [
      "lakewood ranch country club vs tpc prestancia",
      "lakewood ranch waterside vs regular lwr",
      "sarasota vs lakewood ranch traffic and beach access",
    ],
    decide: [
      "luxury homes lakewood ranch waterside",
      "why is lakewood ranch so expensive",
    ],
  },
  first_time: {
    explore: [
      "affordable places to live in florida 2025",
      "best florida cities for young professionals",
      "cheapest places to live in florida with good schools",
    ],
    consider: [
      "florida communities low hoa fees",
      "whats the deal with cdd fees in florida communities",
      "hidden costs of living in florida besides rent and food",
    ],
    compare: [
      "hoa community vs no hoa in florida",
      "buying new construction vs older home in florida",
      "living in tampa vs suburbs like wesley chapel",
    ],
    decide: [
      "new construction under 400k florida",
      "is it better to rent first before buying in florida 2025",
    ],
  },
};

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
  const [benchmarkHistory, setBenchmarkHistory] = useState<BenchmarkRun[]>(MOCK_HISTORY);
  const [selectedTimeIndex, setSelectedTimeIndex] = useState<number>(MOCK_HISTORY.length - 1); // Default to "now"
  const [personas, setPersonas] = useState<PersonaConfig[]>(DEFAULT_PERSONAS);
  const [editingPersona, setEditingPersona] = useState<Persona | null>(null);
  const [editValue, setEditValue] = useState("");
  const [evidenceModal, setEvidenceModal] = useState<EvidenceModalData | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Initialize matrix data
  const initializeMatrix = useCallback(() => {
    const data: Record<string, CellData> = {};
    for (const persona of personas) {
      for (const stage of STAGES) {
        const key = `${persona.id}-${stage.id}`;
        data[key] = {
          persona: persona.id,
          stage: stage.id,
          queries: QUERY_BANK[persona.id][stage.id],
          results: [],
          avgScore: 0,
          mentionRate: 0,
          status: "idle",
        };
      }
    }
    return data;
  }, [personas]);

  // Run benchmark for a single cell
  const runCellBenchmark = async (cellKey: string, quickTest = false, signal?: AbortSignal) => {
    const matrix = Object.keys(matrixData).length > 0 ? matrixData : initializeMatrix();
    const cell = matrix[cellKey];
    if (!cell) return;

    const queriesToRun = quickTest ? [cell.queries[0]] : cell.queries;

    setMatrixData(prev => ({
      ...prev,
      [cellKey]: { ...cell, status: "running" },
    }));

    try {
      const response = await fetch("/api/benchmark/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          queries: queriesToRun,
          brand: BRAND,
          brandAliases: BRAND_ALIASES,
        }),
        signal,
      });

      if (!response.ok) throw new Error("Benchmark failed");

      const result = await response.json();

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

      const avgScore = allScores.length > 0
        ? allScores.reduce((a, b) => a + b, 0) / allScores.length
        : 0;
      const mentionRate = totalResponses > 0 ? mentionCount / totalResponses : 0;

      setMatrixData(prev => ({
        ...prev,
        [cellKey]: {
          ...cell,
          results: result.queries,
          avgScore,
          mentionRate,
          status: "complete",
        },
      }));
    } catch (error) {
      if ((error as Error).name === "AbortError") {
        setMatrixData(prev => ({
          ...prev,
          [cellKey]: { ...cell, status: "idle" },
        }));
        return;
      }
      console.error("Benchmark error:", error);
      setMatrixData(prev => ({
        ...prev,
        [cellKey]: { ...cell, status: "idle" },
      }));
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
      cellKeys = STAGES.map(s => `${selection.persona}-${s.id}`);
    } else if (selection.type === "column") {
      cellKeys = personas.map(p => `${p.id}-${selection.stage}`);
    }

    for (const cellKey of cellKeys) {
      if (signal.aborted) break;
      await runCellBenchmark(cellKey, quickTest, signal);
    }

    // Save to history
    const providerScores: Record<Provider, { total: number; mentions: number; count: number }> = {
      openai: { total: 0, mentions: 0, count: 0 },
      anthropic: { total: 0, mentions: 0, count: 0 },
      gemini: { total: 0, mentions: 0, count: 0 },
      xai: { total: 0, mentions: 0, count: 0 },
    };

    for (const cell of Object.values(matrixData)) {
      if (cell.status === "complete") {
        for (const qr of cell.results) {
          for (const resp of qr.responses) {
            const p = resp.provider as Provider;
            if (!resp.error) {
              providerScores[p].total += resp.visibility.score;
              providerScores[p].count++;
              if (resp.visibility.mentioned) providerScores[p].mentions++;
            }
          }
        }
      }
    }

    const hasData = Object.values(providerScores).some(p => p.count > 0);
    if (hasData) {
      const runData: BenchmarkRun = {
        timestamp: Date.now(),
        label: `W${benchmarkHistory.length + 1}`,
        providerScores: {
          openai: { avgScore: providerScores.openai.count > 0 ? providerScores.openai.total / providerScores.openai.count : 0, mentionRate: providerScores.openai.count > 0 ? providerScores.openai.mentions / providerScores.openai.count : 0 },
          anthropic: { avgScore: providerScores.anthropic.count > 0 ? providerScores.anthropic.total / providerScores.anthropic.count : 0, mentionRate: providerScores.anthropic.count > 0 ? providerScores.anthropic.mentions / providerScores.anthropic.count : 0 },
          gemini: { avgScore: providerScores.gemini.count > 0 ? providerScores.gemini.total / providerScores.gemini.count : 0, mentionRate: providerScores.gemini.count > 0 ? providerScores.gemini.mentions / providerScores.gemini.count : 0 },
          xai: { avgScore: providerScores.xai.count > 0 ? providerScores.xai.total / providerScores.xai.count : 0, mentionRate: providerScores.xai.count > 0 ? providerScores.xai.mentions / providerScores.xai.count : 0 },
        },
      };
      setBenchmarkHistory(prev => [...prev.slice(-12), runData]);
      setSelectedTimeIndex(prev => prev + 1); // Move to newest
    }

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

  if (Object.keys(matrixData).length === 0) {
    setMatrixData(initializeMatrix());
  }

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
          count += QUERY_BANK[p.id][s.id].length;
        }
      }
    } else if (selection.type === "cell") {
      count = QUERY_BANK[selection.persona][selection.stage].length;
    } else if (selection.type === "row") {
      for (const s of STAGES) {
        count += QUERY_BANK[selection.persona][s.id].length;
      }
    } else if (selection.type === "column") {
      for (const p of personas) {
        count += QUERY_BANK[p.id][selection.stage].length;
      }
    }
    return count;
  }, [selection, personas]);

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
                    relative text-center px-3 py-3 cursor-pointer rounded-xl transition-all
                    ${isSelected ? "bg-[#1f3b2c]/10" : "hover:bg-[#efe6d9]/50"}
                  `}
                  onClick={() => setSelection(
                    isSelected ? { type: "all" } : { type: "column", stage: stage.id }
                  )}
                >
                  {/* Top accent bar for column selection */}
                  {isSelected && (
                    <div 
                      className="absolute left-0 right-0 top-0 h-1.5 bg-[#1f3b2c] rounded-t-xl"
                      style={{ boxShadow: '0 0 8px 2px rgba(31, 59, 44, 0.4)' }}
                    />
                  )}
                  <div className="text-base font-medium text-[#1e1b16]">{stage.label}</div>
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
                  >
                    {/* Left accent bar for row selection */}
                    {rowSelected && (
                      <div 
                        className="absolute left-0 top-0 bottom-0 w-1.5 bg-[#1f3b2c] rounded-l-xl"
                        style={{ boxShadow: '0 0 8px 2px rgba(31, 59, 44, 0.4)' }}
                      />
                    )}
                    <div className="text-base font-medium text-[#1e1b16]">{persona.label}</div>
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
                    const stats = cell ? getFilteredCellStats(cell) : { avgScore: 0, mentionRate: 0 };
                    const cellSelected = selection.type === "cell" && selection.persona === persona.id && selection.stage === stage.id;
                    const inSelection = isInSelection(persona.id, stage.id);

                    return (
                      <button
                        key={stage.id}
                        onClick={() => {
                          if (cell?.status === "idle" && !isRunning) {
                            runCellBenchmark(cellKey, true);
                          } else {
                            setSelection({ type: "cell", persona: persona.id, stage: stage.id });
                          }
                        }}
                        className={`
                          h-20 rounded-xl transition-all
                          flex flex-col items-center justify-center gap-0.5
                          ${cell?.status === "complete"
                            ? getCellBgColor(stats.avgScore, stats.mentionRate)
                            : "bg-[#efe6d9]/60"
                          }
                          ${inSelection ? "ring-2 ring-[#1f3b2c]/30 ring-inset" : ""}
                          ${cellSelected ? "ring-2 ring-[#1f3b2c] ring-offset-2 ring-offset-[#fffaf2]" : ""}
                          hover:scale-[1.02] cursor-pointer
                          border border-[#e3dacb]/50
                        `}
                      >
                        {cell?.status === "running" ? (
                          <Loader2 className="h-5 w-5 animate-spin text-[#1e1b16]/40" />
                        ) : cell?.status === "complete" ? (
                          <>
                            <div className="text-xl font-semibold text-[#1e1b16]">
                              {(stats.avgScore * 100).toFixed(0)}%
                            </div>
                            <div className="text-xs text-[#1e1b16]/50">
                              {(stats.mentionRate * 100).toFixed(0)}% hit
                            </div>
                          </>
                        ) : (
                          <div className="text-center">
                            <div className="text-xs text-[#1e1b16]/30">{cell?.queries.length || 0} queries</div>
                            <div className="text-xs text-[#6e7c5b]/60">Click to test</div>
                          </div>
                        )}
                      </button>
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

        {/* DETAIL PANEL - Bottom section */}
        <div className="grid grid-cols-12 gap-4">
          {/* Stats Card */}
          <div className="col-span-3">
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
          <div className="col-span-3">
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
          <div className="col-span-3">
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

          {/* Trend Chart + Time Slider */}
          <div className="col-span-3">
            <Card className="bg-[#fffaf2] border-[#e3dacb] shadow-none h-full">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-[#1e1b16] flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-[#6e7c5b]" />
                  Trend
                  {isViewingHistory && (
                    <Badge variant="outline" className="bg-[#b86f3a]/10 border-[#b86f3a]/30 text-[#b86f3a] text-xs ml-auto">
                      Viewing {selectedHistoricalData?.label}
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {benchmarkHistory.length > 1 ? (
                  <>
                    <ChartContainer config={chartConfig} className="h-[120px] w-full">
                      <RechartsLineChart
                        data={benchmarkHistory.map((run) => ({
                          label: run.label,
                          openai: enabledProviders.has("openai") ? Math.round((run.providerScores.openai?.avgScore ?? 0) * 100) : null,
                          anthropic: enabledProviders.has("anthropic") ? Math.round((run.providerScores.anthropic?.avgScore ?? 0) * 100) : null,
                          gemini: enabledProviders.has("gemini") ? Math.round((run.providerScores.gemini?.avgScore ?? 0) * 100) : null,
                          xai: enabledProviders.has("xai") ? Math.round((run.providerScores.xai?.avgScore ?? 0) * 100) : null,
                        }))}
                        margin={{ top: 10, right: 10, bottom: 0, left: 0 }}
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
                          width={25}
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
                      </RechartsLineChart>
                    </ChartContainer>
                    {/* Time Slider */}
                    <div className="space-y-1">
                      <Slider
                        value={[selectedTimeIndex]}
                        onValueChange={([val]) => setSelectedTimeIndex(val)}
                        min={0}
                        max={benchmarkHistory.length - 1}
                        step={1}
                        className="[&_[data-slot=slider-track]]:bg-[#e3dacb] [&_[data-slot=slider-range]]:bg-[#1f3b2c] [&_[data-slot=slider-thumb]]:bg-[#1f3b2c] [&_[data-slot=slider-thumb]]:border-2 [&_[data-slot=slider-thumb]]:border-white [&_[data-slot=slider-thumb]]:shadow-md"
                      />
                      <div className="flex justify-between text-xs text-[#1e1b16]/40">
                        <span>{benchmarkHistory[0]?.label}</span>
                        <span className="font-medium text-[#1e1b16]/60">
                          {isViewingHistory ? selectedHistoricalData?.label : "Now"}
                        </span>
                        <span>Now</span>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="text-sm text-[#1e1b16]/40 text-center py-4">
                    Run 2+ benchmarks to see trend
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

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
                    <div className="font-medium text-sm text-[#1e1b16] mb-3">"{qr.query}"</div>
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
              {evidenceModal?.title}
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
                        Q: "{item.query}"
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
    </div>
  );
}

function highlightBrandMentions(text: string, sentiment: string): React.ReactNode {
  const brand = BRAND.toLowerCase();
  const parts = text.split(new RegExp(`(${brand}|lakewood|lwr)`, "gi"));

  const bgColor = sentiment === "positive"
    ? "bg-[#d4e5d4]"
    : sentiment === "negative"
    ? "bg-[#f0d9d9]"
    : "bg-[#cde0f0]";

  return parts.map((part, i) => {
    if (part.toLowerCase() === brand || part.toLowerCase() === "lakewood" || part.toLowerCase() === "lwr") {
      return <span key={i} className={`${bgColor} px-1 rounded`}>{part}</span>;
    }
    return part;
  });
}
