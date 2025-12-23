"use client";

import { useEffect, useMemo, useState } from "react";
import { TRIGGER_GROUPS, type TriggerStage } from "@/lib/triggers";

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

export default function Home() {
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
  const [executeResult, setExecuteResult] = useState<ExecuteResult | null>(null);
  const [summary, setSummary] = useState<RunSummary | null>(null);
  const [responses, setResponses] = useState<ResponseItem[]>([]);
  const [runHistory, setRunHistory] = useState<RunHistoryItem[]>([]);
  const [selectedRunIds, setSelectedRunIds] = useState<Set<string>>(new Set());
  const [selectedResponseIds, setSelectedResponseIds] = useState<Set<string>>(new Set());
  const [selectionLocked, setSelectionLocked] = useState(false);
  const [analyses, setAnalyses] = useState<AnalysisVariant[]>([]);
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [progressLocal, setProgressLocal] = useState<{ completed: number; total: number } | null>(
    null
  );

  const queries = useMemo(
    () =>
      queriesText
        .split("\n")
        .map((q) => q.trim())
        .filter(Boolean),
    [queriesText]
  );

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
      });
    }

    const domainSets = new Map<ModelTile["provider"], Set<string>>();
    providers.forEach((provider) => domainSets.set(provider, new Set()));

    const lwrRegex = /lakewood\\s*ranch/i;

    for (const response of responses) {
      const tile = tiles.get(response.provider);
      if (!tile) continue;
      tile.totalResponses += 1;
      if (response.response_text && lwrRegex.test(response.response_text)) {
        tile.lakewoodMentionResponses += 1;
      }

      const domainSet = domainSets.get(response.provider) ?? new Set<string>();
      for (const citation of response.citations) {
        tile.totalCitations += 1;
        const url = citation.url ?? "";
        const domain =
          citation.domain ??
          (url.includes("://") ? url.split("://")[1]?.split("/")[0] ?? null : null);
        if (domain) domainSet.add(domain);
        if (domain && domain.toLowerCase().includes("lakewoodranch")) {
          tile.lakewoodCitations += 1;
        } else if (url.toLowerCase().includes("lakewoodranch")) {
          tile.lakewoodCitations += 1;
        }
      }
      domainSets.set(response.provider, domainSet);
    }

    for (const [provider, set] of domainSets.entries()) {
      const tile = tiles.get(provider);
      if (tile) tile.uniqueDomains = set.size;
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

  async function handleAnalyzeSelectedRuns() {
    if (selectedRunIds.size === 0) return;
    setIsAnalyzing(true);
    setError(null);
    try {
      for (const runId of Array.from(selectedRunIds)) {
        const res = await fetch("/api/run/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ runId }),
        });
        if (!res.ok) {
          throw new Error(await res.text());
        }
      }
      await refreshRunHistory();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsAnalyzing(false);
    }
  }

  async function getSearchModels(): Promise<ModelConfigResponse> {
    const res = await fetch("/api/models/search");
    if (!res.ok) {
      throw new Error(await res.text());
    }
    return (await res.json()) as ModelConfigResponse;
  }

  function createTasks(runId: string, queryIds: string[], models: SearchModelConfig[]): Task[] {
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
    return tasks;
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
    const tasks = createTasks(runId, queryIds, models);
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

    setExecuteResult({ total, errors });
  }

  async function handleRun() {
    setStatus("creating");
    setError(null);
    setRunResult(null);
    setExecuteResult(null);
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

  const progressText = progressLocal
    ? `${progressLocal.completed}/${progressLocal.total}`
    : summary?.progress?.totalCalls != null
      ? `${summary.progress.completedCalls}/${summary.progress.totalCalls}`
      : "-";

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 px-6 py-10">
      <div className="max-w-5xl mx-auto space-y-8">
        <header className="space-y-2">
          <h1 className="text-3xl font-semibold">AI Visibility Baseline</h1>
          <p className="text-slate-300">
            Generate queries with DeepSeek, execute model calls by provider, and view responses.
          </p>
        </header>

        <section className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
          <div className="space-y-2">
            <label className="block text-sm uppercase tracking-wide text-slate-400">Persona</label>
            <textarea
              value={personaText}
              onChange={(e) => setPersonaText(e.target.value)}
              className="w-full rounded-lg bg-slate-950 border border-slate-800 p-3 text-sm"
              rows={2}
            />
          </div>

          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="space-y-2">
              <label className="block text-sm uppercase tracking-wide text-slate-400">Stage</label>
              <select
                value={stage}
                onChange={(e) => setStage(e.target.value as typeof stage)}
                className="rounded-lg bg-slate-950 border border-slate-800 px-3 py-2 text-sm"
              >
                <option value="explore">Explore</option>
                <option value="consider">Consider</option>
                <option value="compare">Compare</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="block text-sm uppercase tracking-wide text-slate-400">Geography</label>
              <input
                value={geoText}
                onChange={(e) => setGeoText(e.target.value)}
                className="rounded-lg bg-slate-950 border border-slate-800 px-3 py-2 text-sm"
                placeholder="Zip, city, county, or state"
              />
            </div>

            <div className="space-y-2">
              <label className="block text-sm uppercase tracking-wide text-slate-400">
                Query length
              </label>
              <select
                value={queryLength}
                onChange={(e) => setQueryLength(e.target.value as typeof queryLength)}
                className="rounded-lg bg-slate-950 border border-slate-800 px-3 py-2 text-sm"
              >
                <option value="auto">Auto (persona style)</option>
                <option value="short">Short</option>
                <option value="medium">Medium</option>
                <option value="long">Long</option>
              </select>
            </div>

            <button
              onClick={handleGenerate}
              disabled={isGenerating}
              className="rounded-full border border-emerald-300/60 text-emerald-200 px-4 py-2 text-sm hover:bg-emerald-500/20 disabled:opacity-50"
            >
              {isGenerating ? "Generating..." : "Generate with DeepSeek"}
            </button>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <label className="flex items-center gap-2 text-sm text-slate-200">
              <input
                type="checkbox"
                checked={memoryEnabled}
                onChange={(e) => setMemoryEnabled(e.target.checked)}
              />
              Use memory (persona context) during search calls
            </label>
            {memoryEnabled && (
              <select
                value={memoryDetail}
                onChange={(e) => setMemoryDetail(e.target.value as typeof memoryDetail)}
                className="rounded-lg bg-slate-950 border border-slate-800 px-3 py-2 text-sm"
              >
                <option value="compact">Compact</option>
                <option value="full">Full</option>
              </select>
            )}
          </div>

          <div className="space-y-2">
            <label className="block text-sm uppercase tracking-wide text-slate-400">
              Triggers (select all that apply)
            </label>
            <div className="grid gap-2 sm:grid-cols-2">
              {TRIGGER_GROUPS[stage].map((trigger) => (
                <label key={trigger} className="flex items-start gap-2 text-sm text-slate-200">
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
            <div className="text-xs text-slate-400">
              Selected: {activeTriggers.length} triggers
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-sm uppercase tracking-wide text-slate-400">
              Custom triggers (one per line)
            </label>
            <textarea
              value={customTriggersText}
              onChange={(e) => setCustomTriggersText(e.target.value)}
              className="w-full rounded-lg bg-slate-950 border border-slate-800 p-3 text-sm"
              rows={3}
              placeholder="e.g. Hurricane impact, Mortgage rate drop, Builder incentive"
            />
          </div>

          <div className="space-y-2">
            <label className="block text-sm uppercase tracking-wide text-slate-400">
              Queries (one per line)
            </label>
            <textarea
              value={queriesText}
              onChange={(e) => setQueriesText(e.target.value)}
              className="w-full rounded-lg bg-slate-950 border border-slate-800 p-3 text-sm"
              rows={6}
            />
          </div>

          <button
            onClick={handleRun}
            className="rounded-full bg-emerald-400 text-slate-950 px-5 py-2 text-sm font-semibold hover:bg-emerald-300"
          >
            Run baseline
          </button>
        </section>

        <section className="space-y-3 rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">Run History</h2>
            <div className="flex items-center gap-2">
              <button
                onClick={refreshRunHistory}
                className="rounded-full border border-slate-600 px-3 py-1 text-xs text-slate-200 hover:bg-slate-800"
              >
                Refresh
              </button>
              <button
                onClick={handleAnalyzeSelectedRuns}
                disabled={isAnalyzing || selectedRunIds.size === 0}
                className="rounded-full border border-emerald-300/60 px-3 py-1 text-xs text-emerald-200 hover:bg-emerald-500/20 disabled:opacity-50"
              >
                {isAnalyzing ? "Analyzing..." : `Analyze selected (${selectedRunIds.size})`}
              </button>
            </div>
          </div>
          {runHistory.length === 0 ? (
            <div className="text-sm text-slate-400">No runs yet.</div>
          ) : (
            <div className="space-y-2 text-sm text-slate-200">
              {runHistory.map((run) => {
                const config = run.config_json ?? {};
                const persona = typeof config.personaText === "string" ? config.personaText : "";
                const stageValue = typeof config.triggerStage === "string" ? config.triggerStage : "";
                const geoValue = typeof config.geo === "string" ? config.geo : "";
                const label = persona ? persona.slice(0, 60) : "Untitled persona";
                const created = run.created_at ? new Date(run.created_at).toLocaleString() : "";
                return (
                  <div key={run.id} className="rounded-xl border border-slate-800 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={selectedRunIds.has(run.id)}
                          onChange={(e) => {
                            setSelectedRunIds((prev) => {
                              const next = new Set(prev);
                              if (e.target.checked) next.add(run.id);
                              else next.delete(run.id);
                              return next;
                            });
                          }}
                        />
                        <div className="text-sm text-slate-200">
                          {label}
                          {stageValue ? ` · ${stageValue}` : ""}
                          {geoValue ? ` · ${geoValue}` : ""}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-slate-400">
                        <span>{run.query_count} queries</span>
                        <span>{run.response_count} responses</span>
                        <span>{run.insight_count > 0 ? "Insight ✓" : "No insight"}</span>
                        <button
                          onClick={() => loadRun(run.id)}
                          className="rounded-full border border-slate-600 px-2 py-0.5 text-xs text-slate-200 hover:bg-slate-800"
                        >
                          Load
                        </button>
                      </div>
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      {created} · {run.status}
                    </div>
                    <div className="mt-1 text-[10px] text-slate-600">Run ID: {run.id}</div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="space-y-3 rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Run Status</h2>
            {runResult && (
              <button
                onClick={() => refreshRunData(runResult.runId)}
                disabled={isRefreshing}
                className="rounded-full border border-slate-600 px-3 py-1 text-xs text-slate-200 hover:bg-slate-800 disabled:opacity-50"
              >
                {isRefreshing ? "Refreshing..." : "Refresh"}
              </button>
            )}
          </div>
          <div className="text-sm text-slate-300">Status: {status}</div>
          <div className="text-sm text-slate-300">Progress: {progressText}</div>
          {error && <div className="text-sm text-red-300">Error: {error}</div>}
          {runResult && (
            <div className="text-sm text-slate-300">Run ID: {runResult.runId}</div>
          )}
          {executeResult && (
            <div className="text-sm text-slate-300">
              Executed: {executeResult.total} calls, errors: {executeResult.errors.length}
            </div>
          )}
          {executeResult && executeResult.errors.length > 0 && (
            <div className="mt-3 space-y-2 text-xs text-amber-200">
              {executeResult.errors.map((err, idx) => (
                <div key={`${err.queryId}-${idx}`}>
                  {err.provider}/{err.model}: {err.error}
                </div>
              ))}
            </div>
          )}
          {runResult && (
            <button
              onClick={handleAnalyze}
              disabled={isAnalyzing}
              className="mt-3 rounded-full border border-emerald-400/60 px-4 py-2 text-xs text-emerald-200 hover:bg-emerald-500/20 disabled:opacity-50"
            >
              {isAnalyzing ? "Analyzing..." : "Analyze with Gemini 3 Pro"}
            </button>
          )}
        </section>

        <section className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Model Tiles</h2>
            <div className="text-xs text-slate-400">Citations + mentions summary</div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {modelTiles.map((tile) => {
              const citationShare =
                tile.totalCitations > 0 ? tile.lakewoodCitations / tile.totalCitations : 0;
              const mentionShare =
                tile.totalResponses > 0 ? tile.lakewoodMentionResponses / tile.totalResponses : 0;
              return (
                <div key={tile.provider} className="rounded-xl border border-slate-800 p-4">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-semibold text-emerald-200">
                      {tile.provider.toUpperCase()}
                    </div>
                    <div className="text-xs text-slate-400">{tile.uniqueDomains} domains</div>
                  </div>
                  <div className="mt-2 text-xs text-slate-300">
                    Total citations: {tile.totalCitations}
                  </div>
                  <div className="mt-1 text-xs text-slate-300">
                    Lakewood Ranch citations: {tile.lakewoodCitations}
                  </div>
                  <div className="mt-2">
                    <div className="flex items-center justify-between text-[11px] text-slate-400">
                      <span>LWR citation share</span>
                      <span>{Math.round(citationShare * 100)}%</span>
                    </div>
                    <div className="mt-1 h-2 w-full rounded-full bg-slate-800">
                      <div
                        className="h-2 rounded-full bg-emerald-400"
                        style={{ width: `${Math.round(citationShare * 100)}%` }}
                      />
                    </div>
                  </div>
                  <div className="mt-3">
                    <div className="flex items-center justify-between text-[11px] text-slate-400">
                      <span>LWR mention rate</span>
                      <span>{Math.round(mentionShare * 100)}%</span>
                    </div>
                    <div className="mt-1 h-2 w-full rounded-full bg-slate-800">
                      <div
                        className="h-2 rounded-full bg-sky-400"
                        style={{ width: `${Math.round(mentionShare * 100)}%` }}
                      />
                    </div>
                  </div>
                  <div className="mt-3 text-[11px] text-slate-500">
                    Recommendation rank + sentiment: pending classifier
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {responses.length > 0 ? (
          <section className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Responses</h2>
              <div className="text-xs text-slate-400">{responses.length} total</div>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-300">
              <button
                onClick={() => {
                  setSelectedResponseIds(new Set(responses.map((r) => r.id)));
                  setSelectionLocked(true);
                }}
                className="rounded-full border border-slate-700 px-2 py-1 hover:bg-slate-800"
              >
                Select all
              </button>
              <button
                onClick={() => {
                  setSelectedResponseIds(new Set());
                  setSelectionLocked(true);
                }}
                className="rounded-full border border-slate-700 px-2 py-1 hover:bg-slate-800"
              >
                Clear
              </button>
              <div className="text-slate-400">Selected for analysis: {selectedResponseIds.size}</div>
              {!selectionLocked && <div className="text-slate-500">Auto-selecting all responses</div>}
            </div>
            <div className="space-y-4">
              {responses.map((response) => (
                <details key={response.id} className="rounded-xl border border-slate-800 p-4">
                  <summary className="flex items-start justify-between gap-3 cursor-pointer text-sm text-emerald-200">
                    <span>
                      {response.provider} / {response.model} · {response.query_text}
                    </span>
                    <label
                      className="flex items-center gap-2 text-xs text-slate-300"
                      onClick={(e) => e.stopPropagation()}
                    >
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
                  <p className="mt-3 text-sm text-slate-200 whitespace-pre-line">
                    {response.response_text ?? "(no response text)"}
                  </p>
                  <div className="mt-3 text-xs text-slate-400">
                    Citations: {response.citations.length}
                  </div>
                  {response.citations.length > 0 && (
                    <ul className="mt-2 space-y-1 text-xs text-slate-300">
                      {response.citations.slice(0, 8).map((citation, idx) => (
                        <li key={`${response.id}-${idx}`}>
                          {citation.title ?? citation.domain ?? citation.url}
                        </li>
                      ))}
                    </ul>
                  )}
                </details>
              ))}
            </div>
          </section>
        ) : (
          <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6 text-sm text-slate-400">
            No responses loaded yet. Run a baseline or click Refresh.
          </section>
        )}

        {analyses.length > 0 && (
          <section className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
            <h2 className="text-lg font-semibold">Insights</h2>
            <div className="space-y-6">
              {analyses.map((variant) => (
                <div key={variant.key} className="rounded-2xl border border-slate-800 p-5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-sm text-emerald-200">
                      {variant.model} · {variant.analysisKind}
                    </div>
                    <div className="text-xs text-slate-400">
                      thinking: {variant.thinkingLevel}
                    </div>
                  </div>
                  <p className="mt-3 text-sm text-slate-200 whitespace-pre-line">
                    {variant.analysis.narrative}
                  </p>
                  {variant.analysis.charts.length > 0 && (
                    <div className="mt-3 space-y-3">
                      {variant.analysis.charts.map((chart, idx) => (
                        <div key={`${chart.title}-${idx}`} className="rounded-xl border border-slate-800 p-4">
                          <div className="text-sm text-emerald-200">{chart.title}</div>
                          <div className="text-xs text-slate-400">{chart.type}</div>
                          <div className="mt-2 text-xs text-slate-300">{chart.insight}</div>
                          <div className="mt-2 text-xs text-slate-400">
                            Labels: {chart.data.labels.join(", ")}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {variant.analysis.insight_cards && variant.analysis.insight_cards.length > 0 && (
                    <div className="mt-4 space-y-3">
                      <div className="text-sm text-emerald-200">Insight cards</div>
                      {variant.analysis.insight_cards.map((card, idx) => (
                        <div key={`${variant.key}-${card.title}-${idx}`} className="rounded-xl border border-slate-800 p-4">
                          <div className="flex items-center justify-between">
                            <div className="text-sm text-emerald-200">{card.title}</div>
                            <div className="text-[10px] uppercase tracking-wide text-slate-400">
                              {card.type.replace("_", " ")}
                            </div>
                          </div>
                          {card.evidence.length > 0 && (
                            <ul className="mt-2 list-disc pl-4 text-xs text-slate-300">
                              {card.evidence.map((item, itemIdx) => (
                                <li key={`${card.title}-evidence-${itemIdx}`}>{item}</li>
                              ))}
                            </ul>
                          )}
                          {card.recommendations.length > 0 && (
                            <ul className="mt-2 list-disc pl-4 text-xs text-slate-300">
                              {card.recommendations.map((item, itemIdx) => (
                                <li key={`${card.title}-rec-${itemIdx}`}>{item}</li>
                              ))}
                            </ul>
                          )}
                          {card.supporting_citations && card.supporting_citations.length > 0 && (
                            <div className="mt-2 text-[10px] text-slate-400">
                              Sources:{" "}
                              {card.supporting_citations
                                .map((c) => c.domain ?? c.url ?? "source")
                                .filter(Boolean)
                                .slice(0, 6)
                                .join(", ")}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  {variant.analysis.blind_spots.length > 0 && (
                    <div className="mt-3 text-xs text-slate-300">
                      Blind spots: {variant.analysis.blind_spots.join("; ")}
                    </div>
                  )}
                  {variant.thought_summaries.length > 0 && (
                    <details className="mt-3 text-xs text-slate-400">
                      <summary className="cursor-pointer text-slate-300">
                        Thought summaries
                      </summary>
                      <ul className="mt-2 list-disc pl-4">
                        {variant.thought_summaries.map((summary, idx) => (
                          <li key={`${variant.key}-thought-${idx}`}>{summary}</li>
                        ))}
                      </ul>
                    </details>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
