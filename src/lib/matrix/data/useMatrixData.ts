import { useEffect, useMemo, useState, useRef } from "react";
import { parseMatrixConfig, parseHistoryRuns, parseIntentLibrary } from "./parse";
import type { BenchmarkRun as StoredRun } from "../../runs/types";
import type { IntentLibrary } from "../../intents/types";

export type MatrixDataStatus = "idle" | "loading" | "ready" | "error";

export interface MatrixDataState {
  status: MatrixDataStatus;
  config: {
    personas: Array<{ id: string; label: string; description?: string }>;
    stages: Array<{ id: string; label: string; description?: string }>;
  } | null;
  history: StoredRun[];
  intentLibrary: IntentLibrary | null;
  error: string | null;
  refreshToken: number;
}

export function useMatrixData({ active }: { active: boolean }): MatrixDataState {
  const [status, setStatus] = useState<MatrixDataStatus>("idle");
  const [config, setConfig] = useState<MatrixDataState["config"]>(null);
  const [history, setHistory] = useState<StoredRun[]>([]);
  const [intentLibrary, setIntentLibrary] = useState<IntentLibrary | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Track previous active state to detect re-activation
  const prevActiveRef = useRef<boolean>(active);
  const [refreshToken, setRefreshToken] = useState(0);

  useEffect(() => {
    // Detect false -> true transition (re-activation)
    if (active && !prevActiveRef.current) {
      setRefreshToken(prev => prev + 1);
    }
    prevActiveRef.current = active;
  }, [active]);

  useEffect(() => {
    if (!active) {
      setStatus("idle");
      return;
    }

    let cancelled = false;
    setStatus("loading");
    setError(null);

    Promise.all([
      fetch("/api/matrix/active")
        .then((r) => r.json())
        .then(parseMatrixConfig)
        .then((cfg) => {
          if (cancelled) return;
          setConfig(cfg);
        }),
      fetch("/api/benchmark/runs/history?limit=45")
        .then((r) => r.json())
        .then(parseHistoryRuns)
        .then((hist) => {
          if (cancelled) return;
          setHistory(hist.runs as unknown as StoredRun[]);
        }),
      fetch("/api/intents/library")
        .then((r) => r.json())
        .then(parseIntentLibrary)
        .then((lib) => {
          if (cancelled) return;
          setIntentLibrary(lib as unknown as IntentLibrary);
        }),
    ])
      .then(() => {
        if (cancelled) return;
        setStatus("ready");
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Unknown error");
        setStatus("error");
      });

    return () => {
      cancelled = true;
    };
  }, [active, refreshToken]);

  // Poll intent library every 10s when active
  useEffect(() => {
    if (!active || status !== "ready") return;

    const interval = setInterval(async () => {
      try {
        const r = await fetch("/api/intents/library");
        if (!r.ok) return;
        const lib = parseIntentLibrary(await r.json());
        setIntentLibrary(lib as unknown as IntentLibrary);
      } catch (err) {
        // Silently fail polling errors to avoid disrupting UI
        console.error("[useMatrixData] Polling error:", err);
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [active, status]);

  return useMemo(
    () => ({
      status,
      config,
      history,
      intentLibrary,
      error,
      refreshToken,
    }),
    [status, config, history, intentLibrary, error, refreshToken]
  );
}
