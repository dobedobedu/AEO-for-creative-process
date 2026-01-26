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
  intentLibraryLoading: boolean;
  error: string | null;
  refreshToken: number;
}

/**
 * Compare two arrays of runs by id and timestamp to determine if they're equivalent.
 * This avoids unnecessary state updates and downstream transforms.
 */
function getRunSignature(run: StoredRun): string {
  const overall = run.summary?.overall;
  const cellCount = run.cells ? Object.keys(run.cells).length : 0;
  return [
    run.id,
    run.timestamp,
    overall?.discoveryRate,
    overall?.avgSentiment,
    overall?.avgWinRate,
    overall?.recommendationRate,
    cellCount,
  ].join("|");
}

export function areRunsEquivalent(prev: StoredRun[], next: StoredRun[]): boolean {
  if (prev.length !== next.length) return false;
  for (let i = 0; i < prev.length; i++) {
    if (getRunSignature(prev[i]) !== getRunSignature(next[i])) return false;
  }
  return true;
}

export function useMatrixData({ active }: { active: boolean }): MatrixDataState {
  const [status, setStatus] = useState<MatrixDataStatus>("idle");
  const [config, setConfig] = useState<MatrixDataState["config"]>(null);
  const [history, setHistory] = useState<StoredRun[]>([]);
  const [intentLibrary, setIntentLibrary] = useState<IntentLibrary | null>(null);
  const [intentLibraryLoading, setIntentLibraryLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Cache previous history to avoid redundant state updates
  const historyRef = useRef<StoredRun[]>([]);

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

  // Load critical data first (config + history), then intent library in background
  useEffect(() => {
    if (!active) {
      setStatus("idle");
      return;
    }

    let cancelled = false;
    setStatus("loading");
    setError(null);

    // Load config and history first (critical path)
    Promise.all([
      fetch("/api/matrix/active")
        .then(async (r) => {
          if (!r.ok) {
            throw new Error(`Matrix config API failed: ${r.status}`);
          }
          return r.json();
        })
        .then(parseMatrixConfig)
        .then((cfg) => {
          if (cancelled) return;
          setConfig(cfg);
        }),
      fetch("/api/benchmark/runs/history?limit=45")
        .then(async (r) => {
          if (!r.ok) {
            throw new Error(`History API failed: ${r.status}`);
          }
          return r.json();
        })
        .then(parseHistoryRuns)
        .then((hist) => {
          if (cancelled) return;
          // Only update history if data actually changed
          const next = hist.runs as StoredRun[];
          if (!areRunsEquivalent(historyRef.current, next)) {
            historyRef.current = next;
            setHistory(next);
          }
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

    // Load intent library in parallel but don't block ready state
    const loadIntentLibrary = async () => {
      if (cancelled) return;
      try {
        setIntentLibraryLoading(true);
        const r = await fetch("/api/intents/library");
        if (!r.ok) {
          // Soft fail on intent library errors - don't break the whole page
          console.warn("[useMatrixData] Intent library fetch failed:", r.status);
          return;
        }
        const lib = parseIntentLibrary(await r.json());
        if (cancelled) return;
        setIntentLibrary(lib as IntentLibrary);
      } catch (err) {
        // Silently fail intent library errors - it's non-critical
        console.error("[useMatrixData] Intent library loading error:", err);
      } finally {
        if (!cancelled) {
          setIntentLibraryLoading(false);
        }
      }
    };

    loadIntentLibrary();

    return () => {
      cancelled = true;
    };
  }, [active, refreshToken]);

  // Poll intent library every 10s when active AND visible
  useEffect(() => {
    if (!active || status !== "ready") return;

    const interval = setInterval(async () => {
      // Skip polling if tab is hidden
      if (document.visibilityState !== "visible") {
        return;
      }

      try {
        const r = await fetch("/api/intents/library");
        if (!r.ok) return;
        const lib = parseIntentLibrary(await r.json());
        setIntentLibrary(lib as IntentLibrary);
      } catch (err) {
        // Silently fail polling errors to avoid disrupting UI
        console.error("[useMatrixData] Polling error:", err);
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [active, status]);

  // Pause/resume polling when visibility changes
  useEffect(() => {
    if (!active || status !== "ready") return;

    const handleVisibilityChange = () => {
      // When tab becomes visible after being hidden, trigger an immediate refresh
      if (document.visibilityState === "visible") {
        fetch("/api/intents/library")
          .then(async (r) => {
            if (!r.ok) return;
            const lib = parseIntentLibrary(await r.json());
            setIntentLibrary(lib as IntentLibrary);
          })
          .catch((err) => {
            console.error("[useMatrixData] Visibility refresh error:", err);
          });
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [active, status]);

  return useMemo(
    () => ({
      status,
      config,
      history,
      intentLibrary,
      intentLibraryLoading,
      error,
      refreshToken,
    }),
    [status, config, history, intentLibrary, intentLibraryLoading, error, refreshToken]
  );
}
