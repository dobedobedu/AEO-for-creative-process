"use client";

import { useMemo, useState } from "react";

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
  };
  queries: Array<{ id: string; query_text: string }>;
  responses: Array<{ query_id: string; provider: string; model: string; count: number }>;
  progress?: {
    completedCalls: number;
    totalCalls: number | null;
  };
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
  const [stage, setStage] = useState<"explore" | "consider" | "compare">("explore");
  const [queriesText, setQueriesText] = useState(defaultQueries.join("\n"));
  const [runResult, setRunResult] = useState<RunResult | null>(null);
  const [executeResult, setExecuteResult] = useState<ExecuteResult | null>(null);
  const [summary, setSummary] = useState<RunSummary | null>(null);
  const [responses, setResponses] = useState<ResponseItem[]>([]);
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const queries = useMemo(
    () =>
      queriesText
        .split("\n")
        .map((q) => q.trim())
        .filter(Boolean),
    [queriesText]
  );

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

  async function handleRun() {
    setStatus("creating");
    setError(null);
    setRunResult(null);
    setExecuteResult(null);
    setSummary(null);
    setResponses([]);

    try {
      const runRes = await fetch("/api/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          personaText,
          triggerStage: stage,
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
        body: JSON.stringify({ runId: runData.runId }),
      });
      if (!execRes.ok) {
        throw new Error(await execRes.text());
      }
      const execData = (await execRes.json()) as ExecuteResult;
      setExecuteResult(execData);

      setStatus("loading");
      const summaryRes = await fetch(`/api/run/${runData.runId}`);
      if (!summaryRes.ok) {
        throw new Error(await summaryRes.text());
      }
      const summaryData = (await summaryRes.json()) as RunSummary;
      setSummary(summaryData);

      const responsesRes = await fetch(`/api/run/${runData.runId}/responses`);
      if (responsesRes.ok) {
        const responseData = (await responsesRes.json()) as { responses: ResponseItem[] };
        setResponses(responseData.responses);
      }

      setStatus("complete");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStatus("error");
    }
  }

  const progressText =
    summary?.progress?.totalCalls != null
      ? `${summary.progress.completedCalls}/${summary.progress.totalCalls}`
      : "-";

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 px-6 py-10">
      <div className="max-w-5xl mx-auto space-y-8">
        <header className="space-y-2">
          <h1 className="text-3xl font-semibold">AI Visibility Baseline</h1>
          <p className="text-slate-300">
            Generate queries with DeepSeek, execute sequential model calls, and view responses.
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

            <button
              onClick={handleGenerate}
              disabled={isGenerating}
              className="rounded-full border border-emerald-300/60 text-emerald-200 px-4 py-2 text-sm hover:bg-emerald-500/20 disabled:opacity-50"
            >
              {isGenerating ? "Generating..." : "Generate with DeepSeek"}
            </button>
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
          <h2 className="text-lg font-semibold">Run Status</h2>
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
        </section>

        {responses.length > 0 && (
          <section className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
            <h2 className="text-lg font-semibold">Responses</h2>
            <div className="space-y-4">
              {responses.map((response) => (
                <div key={response.id} className="rounded-xl border border-slate-800 p-4">
                  <div className="text-sm text-emerald-200">
                    {response.provider} / {response.model}
                  </div>
                  <div className="text-sm text-slate-300">Query: {response.query_text}</div>
                  <p className="mt-2 text-sm text-slate-200 whitespace-pre-line">
                    {response.response_text}
                  </p>
                  <div className="mt-3 text-xs text-slate-400">
                    Citations: {response.citations.length}
                  </div>
                  {response.citations.length > 0 && (
                    <ul className="mt-2 space-y-1 text-xs text-slate-300">
                      {response.citations.slice(0, 6).map((citation, idx) => (
                        <li key={`${response.id}-${idx}`}>
                          {citation.title ?? citation.domain ?? citation.url}
                        </li>
                      ))}
                    </ul>
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
