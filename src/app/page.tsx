"use client";

import { useEffect, useMemo, useState } from "react";
import { TRIGGER_GROUPS, type TriggerStage } from "@/lib/triggers";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, ChevronRight, ChevronUp, Plus, Pencil, History, Expand, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import Image from "next/image";

type RunResult = {
  runId: string;
  personaId: string;
  queryIds: string[];
};

type ExecuteResult = {
  total: number;
  errors: Array<{ queryId: string; provider: string; model: string; error: string }>;
};

type RunSummary = {
  run: {
    id: string;
    status: string;
    pending_count: number;
    config_json?: Record<string, unknown>;
    created_at?: string;
  };
  queries: Array<{ id: string; query_text: string }>;
  responses: Array<{ query_id: string; provider: string; model: string; count: number }>;
  progress?: {
    completedCalls: number;
    totalCalls: number | null;
  };
};

type RunHistoryItem = {
  id: string;
  status: string;
  pending_count: number;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  config_json: Record<string, unknown> | null;
  query_count: number;
  response_count: number;
  insight_count: number;
};

type ResponseItem = {
  id: string;
  query_id: string;
  provider: string;
  model: string;
  response_text: string | null;
  query_text: string;
  citations: Array<{
    url: string | null;
    domain: string | null;
    title: string | null;
    snippet: string | null;
  }>;
};

type InsightResult = {
  narrative: string;
  citation_summary?: {
    total_citations: number;
    unique_domains: number;
    lakewoodranch_citations: number;
    lakewoodranch_share: number;
    top_domains: Array<{ domain: string; count: number }>;
    citations_by_provider: Array<{ provider: string; count: number; unique_domains: number }>;
  };
  model_breakdown?: Array<{
    provider: string;
    model: string;
    response_count: number;
    citation_count: number;
    unique_domains: number;
    top_domains: Array<{ domain: string; count: number }>;
  }>;
  insight_cards?: Array<{
    title: string;
    type:
      | "authority"
      | "pros_cons"
      | "alternatives"
      | "positioning"
      | "recency"
      | "source_gaps"
      | "message_mismatch"
      | "evidence_quality"
      | "opportunity_targets"
      | "other";
    evidence: string[];
    recommendations: string[];
    supporting_citations?: Array<{ url?: string; domain?: string }>;
  }>;
  charts: Array<{
    title: string;
    type: string;
    data: { labels: string[]; series: Array<{ name: string; values: number[] }> };
    insight: string;
  }>;
  blind_spots: string[];
};

type AnalysisVariant = {
  key: string;
  model: string;
  thinkingLevel: string;
  analysisKind: "consultant" | "hypothesis";
  analysis: InsightResult;
  thought_summaries: string[];
};

type ModelTile = {
  provider: "openai" | "gemini" | "anthropic" | "xai";
  totalResponses: number;
  totalCitations: number;
  lakewoodCitations: number;
  lakewoodMentionResponses: number;
  uniqueDomains: number;
  domainCounts: Array<{ domain: string; count: number }>;
};

type SearchModelConfig = {
  provider: "openai" | "gemini" | "anthropic" | "xai";
  model: string;
};

type ModelConfigResponse = {
  models: SearchModelConfig[];
  concurrency: Record<string, number>;
};

type Task = {
  runId: string;
  queryId: string;
  queryText: string;
  provider: SearchModelConfig["provider"];
  model: string;
};

const defaultQueries = [
  "Is Lakewood Ranch good for families with kids?",
  "Best neighborhoods in Lakewood Ranch for schools",
  "Lakewood Ranch amenities and community vibe",
  "Lakewood Ranch safety and crime rate",
  "Lakewood Ranch vs Sarasota for families",
];

const defaultPersonas = [
  {
    id: "persona-1",
    name: "Move Up",
    text: "Millennial or Gen X, college education, HHI $100-200K, married with children. Seeking a larger home with more amenities for their growing family. Image focused, buying designer clothes. Wants to eat healthy but often grabs takeout for ease. Thrives in social settings.",
  },
  {
    id: "persona-2",
    name: "Empty Nester / Retiree",
    text: "Gen X or Boomer, college education, HHI $100-$200K, married without children at home. Seeking to downsize as they become empty nesters or retire. Purchases high quality brands, particularly if they support a cause. Frequently diets to stay in shape. Likely to use smart home devices.",
  },
  {
    id: "persona-3",
    name: "Luxury",
    text: "Millennial or Gen X, college or grad school education, HHI $200K+, married, potentially with children. Seeking a custom home in an esteemed community. Career-focused and a natural leader. An early adopter of products and services. Intelligent and well-informed.",
  },
  {
    id: "persona-4",
    name: "First-Time",
    text: "Gen Z or Millennial, college or high school education, HHI $100-200K, some married with kids, some single. Seeking their first home in a community where they can grow. Follows trends and celebrities. Eager to get ahead and become successful. A risk taker and thrill seeker.",
  },
  {
    id: "persona-5",
    name: "Relocating Pro",
    text: "Millennial or Gen X, college or grad school education, HHI $150-300K, often married. Relocating for a new job opportunity or remote work flexibility. Researches extensively online before making decisions. Values convenience, schools, and proximity to airports. Tech-savvy and relies on digital tools for the home search.",
  },
  {
    id: "persona-6",
    name: "Investor",
    text: "Gen X or Boomer, college education, HHI $200K+, experienced in real estate or financial investments. Looking for rental properties, vacation homes, or appreciation potential. Analyzes market data, cap rates, and rental yields. Prefers communities with strong HOAs and appreciating property values. May own multiple properties.",
  },
];

export default function Home() {
  const [personas, setPersonas] = useState(defaultPersonas);
  const [activePersonaId, setActivePersonaId] = useState(defaultPersonas[0].id);
  const [newPersonaName, setNewPersonaName] = useState("");
  const [newPersonaText, setNewPersonaText] = useState("");
  const [activeColumn, setActiveColumn] = useState<
    "persona" | "triggers" | "queries" | "outputs" | "analysis"
  >("persona");
  const [personaText, setPersonaText] = useState(
    "Relocating family looking for strong schools and amenities"
  );
  const [stage, setStage] = useState<TriggerStage>("explore");
  const [geoText, setGeoText] = useState("Sarasota, FL");
  const [memoryEnabled, setMemoryEnabled] = useState(false);
  const [memoryDetail, setMemoryDetail] = useState<"compact" | "full">("compact");
  const [queryLength, setQueryLength] = useState<"auto" | "short" | "medium" | "long">("auto");
  const [selectedTriggers, setSelectedTriggers] = useState<string[]>(
    TRIGGER_GROUPS.explore.slice(0, 3)
  );
  const [customTriggersText, setCustomTriggersText] = useState("");
  const [queriesText, setQueriesText] = useState(defaultQueries.join("\n"));
  const [runResult, setRunResult] = useState<RunResult | null>(null);
  const [summary, setSummary] = useState<RunSummary | null>(null);
  const [responses, setResponses] = useState<ResponseItem[]>([]);
  const [runHistory, setRunHistory] = useState<RunHistoryItem[]>([]);
  const [selectedResponseIds, setSelectedResponseIds] = useState<Set<string>>(new Set());
  const [selectionLocked, setSelectionLocked] = useState(false);
  const [analyses, setAnalyses] = useState<AnalysisVariant[]>([]);
  const [expandedKpiProviders, setExpandedKpiProviders] = useState<Set<string>>(new Set());
  const [editingPersonaId, setEditingPersonaId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editText, setEditText] = useState("");
  const [showRunHistory, setShowRunHistory] = useState(false);
  const [selectedAnalysis, setSelectedAnalysis] = useState<AnalysisVariant | null>(null);
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [progressLocal, setProgressLocal] = useState<{ completed: number; total: number } | null>(
    null
  );

  type ColumnKey = "persona" | "triggers" | "queries" | "outputs" | "analysis";
  const columns: ColumnKey[] = [
    "persona",
    "triggers",
    "queries",
    "outputs",
    "analysis",
  ];

  const columnTitles: Record<ColumnKey, string> = {
    persona: "Persona",
    triggers: "Triggers",
    queries: "Queries",
    outputs: "Outputs",
    analysis: "Analysis",
  };

  const providerLogos: Record<string, string> = {
    openai: "/OpenAI-black-monoblossom.svg",
    gemini: "/gemini-color.svg",
    anthropic: "/claude-color.svg",
    xai: "/Grok_Logomark_Dark.svg",
  };

  const nextColumnMap: Record<ColumnKey, ColumnKey | null> = {
    persona: "triggers",
    triggers: "queries",
    queries: "outputs",
    outputs: "analysis",
    analysis: null,
  };

  const nextLabels: Record<ColumnKey, string> = {
    persona: "Configure Triggers →",
    triggers: "Review Queries →",
    queries: "View Outputs →",
    outputs: "Run Analysis →",
    analysis: "",
  };

  const activePersona = useMemo(
    () => personas.find((persona) => persona.id === activePersonaId),
    [personas, activePersonaId]
  );

  const queries = useMemo(
    () =>
      queriesText
        .split("\n")
        .map((q) => q.trim())
        .filter(Boolean),
    [queriesText]
  );

  const activePersonaRuns = useMemo(() => {
    if (!activePersona) return [];
    return runHistory.filter(
      (run) => run.config_json?.personaText === activePersona.text
    );
  }, [runHistory, activePersona]);

  const progressText = progressLocal
    ? `${progressLocal.completed}/${progressLocal.total}`
    : summary?.progress?.totalCalls != null
      ? `${summary.progress.completedCalls}/${summary.progress.totalCalls}`
      : "-";

  const modelTiles = useMemo<ModelTile[]>(() => {
    const providers: ModelTile["provider"][] = ["openai", "gemini", "anthropic", "xai"];
    const tiles = new Map<ModelTile["provider"], ModelTile>();

    for (const provider of providers) {
      tiles.set(provider, {
        provider,
        totalResponses: 0,
        totalCitations: 0,
        lakewoodCitations: 0,
        lakewoodMentionResponses: 0,
        uniqueDomains: 0,
        domainCounts: [],
      });
    }

    const domainSets = new Map<ModelTile["provider"], Set<string>>();
    const domainCountMaps = new Map<ModelTile["provider"], Map<string, number>>();
    providers.forEach((provider) => {
      domainSets.set(provider, new Set());
      domainCountMaps.set(provider, new Map());
    });

    // Detect Lakewood Ranch mentions in text (not tied to citations)
    const lwrRegex = /(lakewood\s*ranch|\blakewood\b|\blwr\b)/i;

    for (const response of responses) {
      const tile = tiles.get(response.provider as ModelTile["provider"]);
      if (!tile) continue;
      tile.totalResponses += 1;
      if (response.response_text && lwrRegex.test(response.response_text)) {
        tile.lakewoodMentionResponses += 1;
      }

      const providerKey = response.provider as ModelTile["provider"];
      const domainSet = domainSets.get(providerKey) ?? new Set<string>();
      const domainCountMap = domainCountMaps.get(providerKey) ?? new Map<string, number>();
      for (const citation of response.citations) {
        tile.totalCitations += 1;
        const url = citation.url ?? "";
        const domain =
          citation.domain ??
          (url.includes("://") ? url.split("://")[1]?.split("/")[0] ?? null : null);
        if (domain) {
          domainSet.add(domain);
          domainCountMap.set(domain, (domainCountMap.get(domain) ?? 0) + 1);
        }
        if (domain && domain.toLowerCase().includes("lakewoodranch")) {
          tile.lakewoodCitations += 1;
        } else if (url.toLowerCase().includes("lakewoodranch")) {
          tile.lakewoodCitations += 1;
        }
      }
      domainSets.set(providerKey, domainSet);
      domainCountMaps.set(providerKey, domainCountMap);
    }

    for (const [provider, set] of domainSets.entries()) {
      const tile = tiles.get(provider);
      if (tile) {
        tile.uniqueDomains = set.size;
        const countMap = domainCountMaps.get(provider);
        if (countMap) {
          tile.domainCounts = Array.from(countMap.entries())
            .map(([domain, count]) => ({ domain, count }))
            .sort((a, b) => b.count - a.count);
        }
      }
    }

    return Array.from(tiles.values());
  }, [responses]);

  const customTriggers = useMemo(
    () =>
      customTriggersText
        .split("\n")
        .map((t) => t.trim())
        .filter(Boolean),
    [customTriggersText]
  );

  const activeTriggers = useMemo(() => {
    const deduped = new Set<string>();
    for (const trigger of selectedTriggers) {
      if (trigger.trim()) deduped.add(trigger.trim());
    }
    for (const trigger of customTriggers) {
      if (trigger.trim()) deduped.add(trigger.trim());
    }
    return Array.from(deduped);
  }, [selectedTriggers, customTriggers]);

  const memoryContext = useMemo(() => {
    if (!memoryEnabled) return "";
    const triggersLine =
      activeTriggers.length > 0 ? activeTriggers.join("; ") : "None selected";
    if (memoryDetail === "compact") {
      return [
        "User memory (compact):",
        `Persona: ${personaText}`,
        `Stage: ${stage}`,
        `Geography: ${geoText || "Not specified"}`,
        `Triggers: ${triggersLine}`,
      ].join("\n");
    }
    return [
      "User memory (full):",
      `Persona details: ${personaText}`,
      `Stage: ${stage}`,
      `Geography: ${geoText || "Not specified"}`,
      `Selected triggers: ${triggersLine}`,
      "Use this context to personalize the answer.",
    ].join("\n");
  }, [memoryEnabled, memoryDetail, personaText, stage, geoText, activeTriggers]);

  useEffect(() => {
    if (activePersona) {
      setPersonaText(activePersona.text);
    }
  }, [activePersona]);

  useEffect(() => {
    setSelectedTriggers(TRIGGER_GROUPS[stage].slice(0, 3));
    setCustomTriggersText("");
  }, [stage]);

  async function handleGenerate() {
    setIsGenerating(true);
    setError(null);
    try {
      const res = await fetch("/api/query/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          personaText,
          triggerStage: stage,
          geo: geoText,
          queryLength,
          triggers: activeTriggers.length > 0 ? activeTriggers : TRIGGER_GROUPS[stage],
          count: 5,
        }),
      });
      if (!res.ok) {
        throw new Error(await res.text());
      }
      const data = (await res.json()) as { queries: string[] };
      setQueriesText(data.queries.join("\n"));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsGenerating(false);
    }
  }

  async function refreshRunData(runId: string) {
    setIsRefreshing(true);
    try {
      const summaryRes = await fetch(`/api/run/${runId}`);
      if (!summaryRes.ok) {
        throw new Error(await summaryRes.text());
      }
      const summaryData = (await summaryRes.json()) as RunSummary;
      setSummary(summaryData);

      const responsesRes = await fetch(`/api/run/${runId}/responses`);
      if (responsesRes.ok) {
        const responseData = (await responsesRes.json()) as { responses: ResponseItem[] };
        setResponses(responseData.responses);
      }

      // Load historical analyses
      const analysesRes = await fetch(`/api/run/${runId}/analyses`);
      if (analysesRes.ok) {
        const analysesData = (await analysesRes.json()) as { analyses: AnalysisVariant[] };
        if (analysesData.analyses && analysesData.analyses.length > 0) {
          setAnalyses(analysesData.analyses);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsRefreshing(false);
    }
  }

  async function refreshRunHistory() {
    try {
      const res = await fetch("/api/runs");
      if (!res.ok) {
        throw new Error(await res.text());
      }
      const data = (await res.json()) as { runs: RunHistoryItem[] };
      setRunHistory(data.runs);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  useEffect(() => {
    refreshRunHistory();
  }, []);

  function handleAddPersona() {
    if (!newPersonaName.trim() || !newPersonaText.trim()) return;
    const id = `persona-${Date.now()}`;
    const next = [
      ...personas,
      { id, name: newPersonaName.trim(), text: newPersonaText.trim() },
    ];
    setPersonas(next);
    setNewPersonaName("");
    setNewPersonaText("");
    setActivePersonaId(id);
  }

  function handleDeletePersona(personaId: string) {
    if (personas.length <= 1) return; // Prevent deleting the last persona
    const next = personas.filter((p) => p.id !== personaId);
    setPersonas(next);
    // If we deleted the active persona, switch to the first remaining one
    if (activePersonaId === personaId && next.length > 0) {
      setActivePersonaId(next[0].id);
    }
    // Clear editing state if we were editing the deleted persona
    if (editingPersonaId === personaId) {
      setEditingPersonaId(null);
    }
  }

  useEffect(() => {
    if (!selectionLocked) {
      setSelectedResponseIds(new Set(responses.map((r) => r.id)));
    }
  }, [responses, selectionLocked]);

  async function loadRun(runId: string) {
    setRunResult({ runId, personaId: "", queryIds: [] });
    setAnalyses([]);
    setSelectionLocked(false);
    setSelectedResponseIds(new Set());
    setStatus("loading");
    await refreshRunData(runId);
    setStatus("complete");
  }

  useEffect(() => {
    if (!activePersona || activePersonaRuns.length === 0) return;
    if (runResult && activePersonaRuns.some((run) => run.id === runResult.runId)) return;
    const latest = activePersonaRuns[0];
    if (latest && latest.id) {
      loadRun(latest.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePersona, activePersonaRuns, runResult]);

  async function handleAnalyze() {
    if (!runResult?.runId) return;
    setIsAnalyzing(true);
    setError(null);
    try {
      const responseIds =
        selectionLocked && selectedResponseIds.size > 0 && selectedResponseIds.size < responses.length
          ? Array.from(selectedResponseIds)
          : undefined;

      if (selectionLocked && selectedResponseIds.size === 0) {
        throw new Error("Select at least one response to analyze.");
      }

      const res = await fetch("/api/run/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ runId: runResult.runId, responseIds }),
      });
      if (!res.ok) {
        throw new Error(await res.text());
      }
      const data = (await res.json()) as { analyses: AnalysisVariant[] };
      setAnalyses(data.analyses ?? []);
      await refreshRunHistory();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsAnalyzing(false);
    }
  }

  async function runTask(task: Task) {
    const res = await fetch("/api/query", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        runId: task.runId,
        queryId: task.queryId,
        provider: task.provider,
        model: task.model,
        query: task.queryText,
        memory: memoryEnabled
          ? {
              enabled: true,
              context: memoryContext,
            }
          : { enabled: false },
      }),
    });

    if (!res.ok) {
      throw new Error(await res.text());
    }
  }

  async function runProviderQueue(provider: Task["provider"], queue: Task[], errors: ExecuteResult["errors"]) {
    for (const task of queue) {
      try {
        await runTask(task);
      } catch (err) {
        errors.push({
          queryId: task.queryId,
          provider: task.provider,
          model: task.model,
          error: err instanceof Error ? err.message : String(err),
        });
      } finally {
        setProgressLocal((prev) => {
          if (!prev) return prev;
          return { completed: prev.completed + 1, total: prev.total };
        });
        await refreshRunData(task.runId);
      }
    }
  }

  async function executeWithProviderConcurrency(
    runId: string,
    queryIds: string[],
    models: SearchModelConfig[],
    concurrency: Record<string, number>
  ) {
    const tasks: Task[] = [];
    queryIds.forEach((queryId, idx) => {
      const queryText = queries[idx] ?? "";
      for (const model of models) {
        tasks.push({
          runId,
          queryId,
          queryText,
          provider: model.provider,
          model: model.model,
        });
      }
    });

    const total = tasks.length;
    setProgressLocal({ completed: 0, total });

    const queues: Record<string, Task[]> = {};
    for (const task of tasks) {
      if (!queues[task.provider]) {
        queues[task.provider] = [];
      }
      queues[task.provider].push(task);
    }

    const errors: ExecuteResult["errors"] = [];

    const providerPromises = Object.entries(queues).map(async ([provider, queue]) => {
      const laneCount = Math.max(1, concurrency[provider] ?? 1);
      const lanes: Task[][] = Array.from({ length: laneCount }, () => []);
      queue.forEach((task, idx) => {
        lanes[idx % laneCount].push(task);
      });

      await Promise.all(lanes.map((lane) => runProviderQueue(provider as Task["provider"], lane, errors)));
    });

    await Promise.all(providerPromises);
  }

  async function handleRun() {
    setStatus("creating");
    setError(null);
    setRunResult(null);
    setSummary(null);
    setResponses([]);
    setAnalyses([]);
    setProgressLocal(null);
    setSelectionLocked(false);
    setSelectedResponseIds(new Set());

    try {
      const runRes = await fetch("/api/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          personaText,
          triggerStage: stage,
          geo: geoText,
          triggers: activeTriggers.length > 0 ? activeTriggers : TRIGGER_GROUPS[stage],
          memory: {
            enabled: memoryEnabled,
            detail: memoryDetail,
          },
          queryLength,
          queries,
        }),
      });
      if (!runRes.ok) {
        throw new Error(await runRes.text());
      }
      const runData = (await runRes.json()) as RunResult;
      setRunResult(runData);

      setStatus("executing");
      const execRes = await fetch("/api/run/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ runId: runData.runId, mode: "client" }),
      });
      if (!execRes.ok) {
        throw new Error(await execRes.text());
      }
      const execInit = (await execRes.json()) as { models: SearchModelConfig[]; total: number };
      const modelConfig = await getSearchModels();

      await executeWithProviderConcurrency(
        runData.runId,
        runData.queryIds,
        execInit.models,
        modelConfig.concurrency
      );

      setStatus("loading");
      await refreshRunData(runData.runId);
      setStatus("complete");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStatus("error");
    }
  }

  async function getSearchModels(): Promise<ModelConfigResponse> {
    const res = await fetch("/api/models/search");
    if (!res.ok) {
      throw new Error(await res.text());
    }
    return (await res.json()) as ModelConfigResponse;
  }

  return (
    <div className="min-h-screen bg-[var(--paper)] text-[var(--ink)]">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-6 py-8">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div className="space-y-2">
            <div className="text-xs uppercase tracking-[0.3em] text-[var(--olive)]">
              AI Visibility Baseline
            </div>
            <h1 className="font-display text-3xl text-[var(--forest)]">
              Market Visibility Dashboard
            </h1>
            <p className="max-w-xl text-sm text-[var(--ink)]/70">
              Track persona-driven search behavior, source dominance, and LLM recommendations across
              major providers.
            </p>
          </div>
          <div className="flex items-center gap-3 rounded-full border border-[var(--panel-border)] bg-[var(--panel)] px-4 py-2 text-xs text-[var(--ink)]/70 shadow-[var(--shadow)]">
            <span>Status: {status}</span>
            <span>Progress: {progressText}</span>
          </div>
        </header>
        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <Card className="border-[var(--panel-border)] bg-[var(--panel)] shadow-[var(--shadow)]">
          <CardHeader className="pb-0">
            <div className="flex items-center justify-between">
              <CardTitle className="font-display text-lg text-[var(--forest)]">KPI v0.1</CardTitle>
              <Badge variant="outline" className="text-[10px] text-[var(--ink)]/60 border-[var(--panel-border)]">
                Live across all providers
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-4">
              {modelTiles.map((tile) => {
                const citationShare = tile.totalCitations > 0 ? tile.lakewoodCitations / tile.totalCitations : 0;
                const mentionShare = tile.totalResponses > 0 ? tile.lakewoodMentionResponses / tile.totalResponses : 0;
                const isExpanded = expandedKpiProviders.has(tile.provider);
                const toggleExpand = () => {
                  setExpandedKpiProviders(prev => {
                    const next = new Set(prev);
                    if (next.has(tile.provider)) next.delete(tile.provider);
                    else next.add(tile.provider);
                    return next;
                  });
                };
                return (
                  <Collapsible
                    key={tile.provider}
                    open={isExpanded}
                    onOpenChange={toggleExpand}
                  >
                    <div
                      className={`rounded-2xl border border-[var(--panel-border)] bg-white/60 p-4 shadow-sm transition-all ${
                        isExpanded ? "ring-2 ring-[var(--copper)]/30" : ""
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <Image
                          src={providerLogos[tile.provider]}
                          alt={tile.provider}
                          width={80}
                          height={20}
                          className="h-5 w-auto"
                        />
                        <Badge variant="secondary" className="text-[10px] bg-[var(--mist)] text-[var(--ink)]/70">
                          {tile.uniqueDomains} domains
                        </Badge>
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
                        <div>
                          <div className="text-[var(--ink)]/60">Total cites</div>
                          <div className="text-base font-semibold text-[var(--forest)]">{tile.totalCitations}</div>
                        </div>
                        <div>
                          <div className="text-[var(--ink)]/60">LWR cites</div>
                          <div className="text-base font-semibold text-[var(--forest)]">{tile.lakewoodCitations}</div>
                        </div>
                        <div>
                          <div className="text-[var(--ink)]/60">Mention rate</div>
                          <div className="text-base font-semibold text-[var(--forest)]">{Math.round(mentionShare * 100)}%</div>
                        </div>
                        <div>
                          <div className="text-[var(--ink)]/60">Citation share</div>
                          <div className="text-base font-semibold text-[var(--forest)]">{Math.round(citationShare * 100)}%</div>
                        </div>
                      </div>
                      <CollapsibleTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="mt-3 h-auto p-0 text-[11px] text-[var(--copper)] hover:text-[var(--copper)]/80 hover:bg-transparent"
                        >
                          {isExpanded ? "Hide domains" : "See domains"}
                          {isExpanded ? (
                            <ChevronUp className="ml-1 h-3 w-3" />
                          ) : (
                            <ChevronDown className="ml-1 h-3 w-3" />
                          )}
                        </Button>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <div className="mt-3 max-h-48 overflow-y-auto border-t border-[var(--panel-border)] pt-3">
                          {tile.domainCounts.length === 0 ? (
                            <div className="text-[11px] text-[var(--ink)]/50">No domains yet</div>
                          ) : (
                            <div className="space-y-1.5">
                              {tile.domainCounts.slice(0, 10).map(({ domain, count }) => (
                                <div key={domain} className="flex items-center justify-between text-[11px]">
                                  <span className="truncate text-[var(--ink)]/70" title={domain}>
                                    {domain}
                                  </span>
                                  <Badge variant="outline" className="ml-2 h-5 text-[10px] border-[var(--panel-border)]">
                                    {count}
                                  </Badge>
                                </div>
                              ))}
                              {tile.domainCounts.length > 10 && (
                                <div className="text-[10px] text-[var(--ink)]/50 pt-1">
                                  +{tile.domainCounts.length - 10} more domains
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </CollapsibleContent>
                    </div>
                  </Collapsible>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <section
          className="grid gap-4"
          style={{
            gridTemplateColumns: columns
              .map((column) => (column === activeColumn ? '3.4fr' : '0.9fr'))
              .join(' '),
          }}
        >
          {columns.map((columnKey) => {
            const isActive = columnKey === activeColumn;

            const summaries: Record<ColumnKey, string> = {
              persona: activePersona?.name ?? "Select persona",
              triggers: `${stage} · ${activeTriggers.length} triggers`,
              queries: `${queries.length} queries`,
              outputs: `${responses.length} responses`,
              analysis: `${analyses.length} analyses`,
            };

            return (
              <Card
                key={columnKey}
                onClick={!isActive ? () => setActiveColumn(columnKey) : undefined}
                className={`relative border-[var(--panel-border)] bg-[var(--panel)] shadow-[var(--shadow)] transition-all ${
                  isActive ? 'min-h-[620px]' : 'min-h-[620px] cursor-pointer hover:bg-[var(--mist)]/50'
                }`}
              >
                <div className="flex w-full items-center justify-between p-4 pb-0">
                  <div className="font-display text-lg text-[var(--forest)]">
                    {columnTitles[columnKey]}
                  </div>
                  <Badge variant={isActive ? "default" : "outline"} className={isActive ? "bg-[var(--forest)]" : "border-[var(--panel-border)]"}>
                    {isActive ? (
                      <ChevronDown className="h-3 w-3 mr-1" />
                    ) : (
                      <ChevronRight className="h-3 w-3 mr-1" />
                    )}
                    {isActive ? 'Active' : 'Expand'}
                  </Badge>
                </div>

                {!isActive && (
                  <div className="px-4 pb-4 mt-4">
                    <div className="text-sm text-[var(--ink)]/70">
                      {summaries[columnKey]}
                    </div>
                  </div>
                )}

                {isActive && columnKey === 'persona' && (
                  <div className="mt-4 space-y-4 px-4 pb-4">
                    <div className="space-y-2">
                      <div className="text-xs uppercase tracking-[0.3em] text-[var(--olive)]">Active persona</div>
                      <div className="rounded-2xl border border-[var(--panel-border)] bg-white/70 p-4">
                        <div className="font-display text-lg text-[var(--forest)]">{activePersona?.name ?? 'Unassigned'}</div>
                        <p className="mt-2 text-sm text-[var(--ink)]/70">{personaText}</p>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="text-xs uppercase tracking-[0.3em] text-[var(--olive)]">Personas</div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => {
                            setNewPersonaName("");
                            setNewPersonaText("");
                            setEditingPersonaId("new");
                          }}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="space-y-2">
                        {personas.map((persona) => (
                          <div key={persona.id}>
                            {editingPersonaId === persona.id ? (
                              <div className="space-y-2 rounded-2xl border border-[var(--forest)] bg-[var(--mist)] p-3">
                                <input
                                  value={editName}
                                  onChange={(e) => setEditName(e.target.value)}
                                  className="w-full rounded-xl border border-[var(--panel-border)] bg-white px-3 py-2 text-sm"
                                  placeholder="Persona name"
                                />
                                <textarea
                                  value={editText}
                                  onChange={(e) => setEditText(e.target.value)}
                                  className="w-full rounded-xl border border-[var(--panel-border)] bg-white px-3 py-2 text-sm"
                                  rows={3}
                                  placeholder="Persona description"
                                />
                                <div className="flex gap-2">
                                  <Button
                                    size="sm"
                                    onClick={() => {
                                      setPersonas(prev => prev.map(p =>
                                        p.id === persona.id
                                          ? { ...p, name: editName.trim() || p.name, text: editText.trim() || p.text }
                                          : p
                                      ));
                                      if (activePersonaId === persona.id) {
                                        setPersonaText(editText.trim() || persona.text);
                                      }
                                      setEditingPersonaId(null);
                                    }}
                                    className="bg-[var(--forest)] text-white hover:bg-[var(--forest)]/90"
                                  >
                                    Save
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setEditingPersonaId(null)}
                                  >
                                    Cancel
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <div
                                className={`flex w-full items-start justify-between rounded-2xl border px-3 py-3 text-left text-sm transition ${
                                  activePersonaId === persona.id
                                    ? 'border-[var(--forest)] bg-[var(--mist)]'
                                    : 'border-[var(--panel-border)] bg-white/60'
                                }`}
                              >
                                <button
                                  onClick={() => setActivePersonaId(persona.id)}
                                  className="flex-1 text-left"
                                >
                                  <div className="font-display text-base text-[var(--forest)]">{persona.name}</div>
                                  <div className="mt-1 text-xs text-[var(--ink)]/60">{persona.text.slice(0, 80)}</div>
                                </button>
                                <div className="flex shrink-0 gap-1">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setEditName(persona.name);
                                      setEditText(persona.text);
                                      setEditingPersonaId(persona.id);
                                    }}
                                  >
                                    <Pencil className="h-3 w-3" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6 text-red-500 hover:text-red-700 hover:bg-red-50"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDeletePersona(persona.id);
                                    }}
                                    disabled={personas.length <= 1}
                                    title={personas.length <= 1 ? "Cannot delete the last persona" : "Delete persona"}
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                        {editingPersonaId === "new" && (
                          <div className="space-y-2 rounded-2xl border border-[var(--forest)] bg-[var(--mist)] p-3">
                            <input
                              value={newPersonaName}
                              onChange={(e) => setNewPersonaName(e.target.value)}
                              className="w-full rounded-xl border border-[var(--panel-border)] bg-white px-3 py-2 text-sm"
                              placeholder="Persona name"
                            />
                            <textarea
                              value={newPersonaText}
                              onChange={(e) => setNewPersonaText(e.target.value)}
                              className="w-full rounded-xl border border-[var(--panel-border)] bg-white px-3 py-2 text-sm"
                              rows={3}
                              placeholder="Persona description"
                            />
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                onClick={() => {
                                  handleAddPersona();
                                  setEditingPersonaId(null);
                                }}
                                className="bg-[var(--forest)] text-white hover:bg-[var(--forest)]/90"
                              >
                                Add
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setEditingPersonaId(null)}
                              >
                                Cancel
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    <Collapsible open={showRunHistory} onOpenChange={setShowRunHistory}>
                      <CollapsibleTrigger asChild>
                        <Button variant="outline" size="sm" className="w-full justify-between">
                          <span className="flex items-center gap-2">
                            <History className="h-4 w-4" />
                            Past Runs ({activePersonaRuns.length})
                          </span>
                          {showRunHistory ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </Button>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <div className="mt-2 space-y-2 max-h-48 overflow-y-auto">
                          {activePersonaRuns.length === 0 ? (
                            <div className="text-xs text-[var(--ink)]/50 p-2">No runs yet.</div>
                          ) : (
                            activePersonaRuns.map((run) => (
                              <div key={run.id} className="rounded-2xl border border-[var(--panel-border)] bg-white/70 p-3">
                                <div className="flex items-center justify-between text-xs">
                                  <span>{run.status}</span>
                                  <button
                                    onClick={() => loadRun(run.id)}
                                    className="text-[10px] uppercase text-[var(--copper)]"
                                  >
                                    Load
                                  </button>
                                </div>
                                <div className="mt-1 text-[10px] text-[var(--ink)]/60">
                                  {run.created_at ? new Date(run.created_at).toLocaleString() : ""}
                                </div>
                                <div className="mt-1 text-[10px] text-[var(--ink)]/60">
                                  {run.response_count} responses · {run.insight_count} insights
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </CollapsibleContent>
                    </Collapsible>

                    {nextColumnMap[columnKey] && (
                      <Button
                        onClick={() => setActiveColumn(nextColumnMap[columnKey]!)}
                        className="mt-4 w-full rounded-full bg-[var(--forest)] text-white hover:bg-[var(--forest)]/90"
                      >
                        {nextLabels[columnKey]}
                      </Button>
                    )}
                  </div>
                )}

                {isActive && columnKey === 'triggers' && (
                  <div className="mt-4 space-y-4 px-4 pb-4">
                    <div className="grid gap-3">
                      <div>
                        <div className="text-xs uppercase tracking-[0.3em] text-[var(--olive)]">Stage</div>
                        <select
                          value={stage}
                          onChange={(e) => setStage(e.target.value as typeof stage)}
                          className="mt-2 w-full rounded-xl border border-[var(--panel-border)] bg-white/70 px-3 py-2 text-sm"
                        >
                          <option value="explore">Explore</option>
                          <option value="consider">Consider</option>
                          <option value="compare">Compare</option>
                        </select>
                      </div>
                      <div>
                        <div className="text-xs uppercase tracking-[0.3em] text-[var(--olive)]">Geography</div>
                        <input
                          value={geoText}
                          onChange={(e) => setGeoText(e.target.value)}
                          className="mt-2 w-full rounded-xl border border-[var(--panel-border)] bg-white/70 px-3 py-2 text-sm"
                          placeholder="Zip, city, county, or state"
                        />
                      </div>
                      <div>
                        <div className="text-xs uppercase tracking-[0.3em] text-[var(--olive)]">Query length</div>
                        <select
                          value={queryLength}
                          onChange={(e) => setQueryLength(e.target.value as typeof queryLength)}
                          className="mt-2 w-full rounded-xl border border-[var(--panel-border)] bg-white/70 px-3 py-2 text-sm"
                        >
                          <option value="auto">Auto (persona style)</option>
                          <option value="short">Short</option>
                          <option value="medium">Medium</option>
                          <option value="long">Long</option>
                        </select>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-[var(--panel-border)] bg-white/60 p-4 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-xs uppercase tracking-[0.2em] text-[var(--olive)]">Memory</span>
                        <input
                          type="checkbox"
                          checked={memoryEnabled}
                          onChange={(e) => setMemoryEnabled(e.target.checked)}
                        />
                      </div>
                      {memoryEnabled && (
                        <select
                          value={memoryDetail}
                          onChange={(e) => setMemoryDetail(e.target.value as typeof memoryDetail)}
                          className="mt-3 w-full rounded-xl border border-[var(--panel-border)] bg-white px-3 py-2 text-sm"
                        >
                          <option value="compact">Compact</option>
                          <option value="full">Full</option>
                        </select>
                      )}
                    </div>

                    <div>
                      <div className="text-xs uppercase tracking-[0.3em] text-[var(--olive)]">Triggers</div>
                      <div className="mt-2 grid gap-2">
                        {TRIGGER_GROUPS[stage].map((trigger) => (
                          <label
                            key={trigger}
                            className="flex items-start gap-2 rounded-xl border border-[var(--panel-border)] bg-white/70 px-3 py-2 text-sm"
                          >
                            <input
                              type="checkbox"
                              checked={selectedTriggers.includes(trigger)}
                              onChange={(e) => {
                                setSelectedTriggers((prev) => {
                                  if (e.target.checked) return [...prev, trigger];
                                  return prev.filter((t) => t !== trigger);
                                });
                              }}
                              className="mt-1"
                            />
                            <span>{trigger}</span>
                          </label>
                        ))}
                      </div>
                    </div>

                    <div>
                      <div className="text-xs uppercase tracking-[0.3em] text-[var(--olive)]">Custom triggers</div>
                      <textarea
                        value={customTriggersText}
                        onChange={(e) => setCustomTriggersText(e.target.value)}
                        className="mt-2 w-full rounded-xl border border-[var(--panel-border)] bg-white/70 px-3 py-2 text-sm"
                        rows={3}
                        placeholder="e.g. hurricane impact, mortgage rate drop"
                      />
                    </div>

                    {nextColumnMap[columnKey] && (
                      <Button
                        onClick={() => setActiveColumn(nextColumnMap[columnKey]!)}
                        className="mt-4 w-full rounded-full bg-[var(--forest)] text-white hover:bg-[var(--forest)]/90"
                      >
                        {nextLabels[columnKey]}
                      </Button>
                    )}
                  </div>
                )}

                {isActive && columnKey === 'queries' && (
                  <div className="mt-4 space-y-4 px-4 pb-4">
                    <div className="flex flex-wrap items-center gap-3">
                      <Button
                        onClick={handleGenerate}
                        disabled={isGenerating}
                        className="rounded-full bg-[var(--forest)] px-4 py-2 text-xs uppercase tracking-[0.2em] text-white hover:bg-[var(--forest)]/90"
                      >
                        {isGenerating ? 'Generating...' : 'Generate queries'}
                      </Button>
                      <Button
                        variant="outline"
                        onClick={handleRun}
                        className="rounded-full border-[var(--forest)] px-4 py-2 text-xs uppercase tracking-[0.2em] text-[var(--forest)] hover:bg-[var(--forest)]/10"
                      >
                        Run baseline
                      </Button>
                    </div>
                    <textarea
                      value={queriesText}
                      onChange={(e) => setQueriesText(e.target.value)}
                      className="min-h-[280px] w-full rounded-2xl border border-[var(--panel-border)] bg-white/70 px-3 py-3 text-sm"
                    />

                    {nextColumnMap[columnKey] && (
                      <Button
                        onClick={() => setActiveColumn(nextColumnMap[columnKey]!)}
                        className="mt-4 w-full rounded-full bg-[var(--forest)] text-white hover:bg-[var(--forest)]/90"
                      >
                        {nextLabels[columnKey]}
                      </Button>
                    )}
                  </div>
                )}

                {isActive && columnKey === 'outputs' && (
                  <div className="mt-4 space-y-4 px-4 pb-4">
                    <div className="flex items-center justify-between rounded-2xl border border-[var(--panel-border)] bg-white/70 p-3 text-xs text-[var(--ink)]/70">
                      <span>Status: {status} · Progress: {progressText}</span>
                      {runResult && (
                        <button
                          onClick={() => refreshRunData(runResult.runId)}
                          disabled={isRefreshing}
                          className="text-[10px] uppercase tracking-[0.2em] text-[var(--copper)] disabled:opacity-50"
                        >
                          {isRefreshing ? "Refreshing" : "Refresh"}
                        </button>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <button
                        onClick={() => {
                          setSelectedResponseIds(new Set(responses.map((r) => r.id)));
                          setSelectionLocked(true);
                        }}
                        className="rounded-full border border-[var(--panel-border)] px-3 py-1 text-[10px] uppercase"
                      >
                        Select all
                      </button>
                      <button
                        onClick={() => {
                          setSelectedResponseIds(new Set());
                          setSelectionLocked(true);
                        }}
                        className="rounded-full border border-[var(--panel-border)] px-3 py-1 text-[10px] uppercase"
                      >
                        Clear
                      </button>
                      <span className="text-[10px] text-[var(--ink)]/60">
                        {selectedResponseIds.size} selected
                      </span>
                    </div>
                    <div className="space-y-3">
                      {responses.map((response) => (
                        <details key={response.id} className="rounded-2xl border border-[var(--panel-border)] bg-white/70 p-3">
                          <summary className="flex items-start justify-between gap-3 text-xs text-[var(--forest)]">
                            <span>
                              {response.provider} / {response.model}
                              <span className="block text-[10px] text-[var(--ink)]/60">{response.query_text}</span>
                            </span>
                            <label className="flex items-center gap-2 text-[10px] text-[var(--ink)]/60">
                              <input
                                type="checkbox"
                                checked={selectedResponseIds.has(response.id)}
                                onChange={(e) => {
                                  setSelectionLocked(true);
                                  setSelectedResponseIds((prev) => {
                                    const next = new Set(prev);
                                    if (e.target.checked) next.add(response.id);
                                    else next.delete(response.id);
                                    return next;
                                  });
                                }}
                              />
                              Include
                            </label>
                          </summary>
                          <p className="mt-2 text-xs text-[var(--ink)]/70 whitespace-pre-line">
                            {response.response_text ?? '(no response text)'}
                          </p>
                          <div className="mt-2 text-[10px] text-[var(--ink)]/50">
                            Citations: {response.citations.length}
                          </div>
                        </details>
                      ))}
                    </div>

                    {nextColumnMap[columnKey] && (
                      <Button
                        onClick={() => setActiveColumn(nextColumnMap[columnKey]!)}
                        className="mt-4 w-full rounded-full bg-[var(--copper)] text-white hover:bg-[var(--copper)]/90"
                      >
                        {nextLabels[columnKey]}
                      </Button>
                    )}
                  </div>
                )}

                {isActive && columnKey === 'analysis' && (
                  <div className="mt-4 space-y-4 px-4 pb-4">
                    <Button
                      onClick={handleAnalyze}
                      disabled={isAnalyzing}
                      className="rounded-full bg-[var(--copper)] px-4 py-2 text-xs uppercase tracking-[0.2em] text-white hover:bg-[var(--copper)]/90"
                    >
                      {isAnalyzing ? 'Analyzing...' : 'Run analysis'}
                    </Button>
                    {analyses.length === 0 ? (
                      <div className="text-xs text-[var(--ink)]/60">No analysis yet.</div>
                    ) : (
                      <div className="space-y-4">
                        {analyses.map((variant) => (
                          <div key={variant.key} className="rounded-2xl border border-[var(--panel-border)] bg-white/70 p-3">
                            <div className="flex items-center justify-between text-xs text-[var(--forest)]">
                              <span>{variant.model}</span>
                              <div className="flex items-center gap-2">
                                <span>{variant.analysisKind}</span>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-auto p-1 text-[10px] text-[var(--copper)]"
                                  onClick={() => setSelectedAnalysis(variant)}
                                >
                                  <Expand className="h-3 w-3 mr-1" />
                                  View Full
                                </Button>
                              </div>
                            </div>
                            <p className="mt-2 text-xs text-[var(--ink)]/70 whitespace-pre-line line-clamp-4">
                              {variant.analysis.narrative}
                            </p>
                            {variant.analysis.insight_cards && variant.analysis.insight_cards.length > 0 && (
                              <div className="mt-3 space-y-2">
                                {variant.analysis.insight_cards.slice(0, 3).map((card, idx) => (
                                  <div key={`${variant.key}-${idx}`} className="rounded-xl border border-[var(--panel-border)] bg-white p-2">
                                    <div className="text-[10px] uppercase tracking-[0.2em] text-[var(--olive)]">
                                      {card.type}
                                    </div>
                                    <div className="text-xs text-[var(--forest)]">{card.title}</div>
                                  </div>
                                ))}
                                {variant.analysis.insight_cards.length > 3 && (
                                  <div className="text-[10px] text-[var(--ink)]/50">
                                    +{variant.analysis.insight_cards.length - 3} more insights
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </section>

        {/* Analysis Modal */}
        <Dialog open={!!selectedAnalysis} onOpenChange={(open) => !open && setSelectedAnalysis(null)}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-[var(--panel)]">
            <DialogHeader>
              <DialogTitle className="font-display text-lg text-[var(--forest)]">
                {selectedAnalysis?.model} - {selectedAnalysis?.analysisKind}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-6">
              <div>
                <div className="text-xs uppercase tracking-[0.3em] text-[var(--olive)] mb-2">Narrative</div>
                <p className="text-sm text-[var(--ink)]/80 whitespace-pre-line">
                  {selectedAnalysis?.analysis.narrative}
                </p>
              </div>

              {selectedAnalysis?.analysis.insight_cards && selectedAnalysis.analysis.insight_cards.length > 0 && (
                <div>
                  <div className="text-xs uppercase tracking-[0.3em] text-[var(--olive)] mb-2">Insight Cards</div>
                  <div className="space-y-3">
                    {selectedAnalysis.analysis.insight_cards.map((card, idx) => (
                      <div key={idx} className="rounded-xl border border-[var(--panel-border)] bg-white/70 p-4">
                        <div className="flex items-center justify-between mb-2">
                          <Badge variant="outline" className="text-[10px] uppercase">
                            {card.type}
                          </Badge>
                        </div>
                        <div className="font-display text-base text-[var(--forest)] mb-2">{card.title}</div>
                        {card.evidence && card.evidence.length > 0 && (
                          <div className="mb-2">
                            <div className="text-[10px] uppercase text-[var(--olive)] mb-1">Evidence</div>
                            <ul className="list-disc list-inside text-xs text-[var(--ink)]/70 space-y-1">
                              {card.evidence.map((e, i) => (
                                <li key={i}>{e}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {card.recommendations && card.recommendations.length > 0 && (
                          <div>
                            <div className="text-[10px] uppercase text-[var(--olive)] mb-1">Recommendations</div>
                            <ul className="list-disc list-inside text-xs text-[var(--ink)]/70 space-y-1">
                              {card.recommendations.map((r, i) => (
                                <li key={i}>{r}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {selectedAnalysis?.analysis.blind_spots && selectedAnalysis.analysis.blind_spots.length > 0 && (
                <div>
                  <div className="text-xs uppercase tracking-[0.3em] text-[var(--olive)] mb-2">Blind Spots</div>
                  <ul className="list-disc list-inside text-sm text-[var(--ink)]/70 space-y-1">
                    {selectedAnalysis.analysis.blind_spots.map((spot, idx) => (
                      <li key={idx}>{spot}</li>
                    ))}
                  </ul>
                </div>
              )}

              {selectedAnalysis?.thought_summaries && selectedAnalysis.thought_summaries.length > 0 && (
                <Collapsible>
                  <CollapsibleTrigger asChild>
                    <Button variant="outline" size="sm" className="w-full justify-between">
                      <span>Model Thinking ({selectedAnalysis.thought_summaries.length})</span>
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="mt-2 space-y-2 text-xs text-[var(--ink)]/60">
                      {selectedAnalysis.thought_summaries.map((thought, idx) => (
                        <p key={idx} className="whitespace-pre-line">{thought}</p>
                      ))}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );

}
