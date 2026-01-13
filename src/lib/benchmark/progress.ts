export type ProgressStatus = "running" | "complete" | "error";

export type ProgressEvent = {
  ts?: string;
  message: string;
  persona?: string;
  stage?: string;
  status?: ProgressStatus;
};

export type RunProgress = {
  runId: string;
  totalSteps: number;
  completedSteps: number;
  unit: "queries" | "cells";
  status: ProgressStatus;
  updatedAt: string;
  events: ProgressEvent[];
};

const MAX_EVENTS = 80;
const PROGRESS_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const store = new Map<string, RunProgress>();

function nowIso() {
  return new Date().toISOString();
}

/**
 * Clean up old progress entries to prevent memory leaks.
 * Removes entries older than PROGRESS_TTL_MS.
 */
function cleanupOldProgress(): void {
  const now = Date.now();
  for (const [runId, progress] of store.entries()) {
    const updatedAt = new Date(progress.updatedAt).getTime();
    if (now - updatedAt > PROGRESS_TTL_MS) {
      store.delete(runId);
    }
  }
}

export function initProgress(runId: string, totalSteps: number, unit: "queries" | "cells" = "queries"): RunProgress {
  const progress: RunProgress = {
    runId,
    totalSteps,
    completedSteps: 0,
    unit,
    status: "running",
    updatedAt: nowIso(),
    events: [{ ts: nowIso(), message: "Benchmark started", status: "running" }],
  };

  store.set(runId, progress);
  return progress;
}

export function logProgress(runId: string, event: ProgressEvent): void {
  const current = store.get(runId);
  if (!current) return;

  const nextEvents = [...current.events, { ...event, ts: event.ts ?? nowIso() }];
  current.events = nextEvents.slice(-MAX_EVENTS);
  current.updatedAt = nowIso();
  store.set(runId, current);
}

export function incrementProgress(runId: string, increment = 1): void {
  const current = store.get(runId);
  if (!current) return;
  current.completedSteps = Math.min(current.totalSteps, current.completedSteps + increment);
  current.updatedAt = nowIso();
  store.set(runId, current);
}

export function completeProgress(runId: string): void {
  const current = store.get(runId);
  if (!current) return;
  current.status = "complete";
  current.completedSteps = current.totalSteps;
  current.updatedAt = nowIso();
  const event: ProgressEvent = { ts: nowIso(), message: "Benchmark completed", status: "complete" };
  current.events = [...current.events, event].slice(-MAX_EVENTS);
  store.set(runId, current);
}

export function failProgress(runId: string, message: string): void {
  const current = store.get(runId);
  if (!current) return;
  current.status = "error";
  current.updatedAt = nowIso();
  const event: ProgressEvent = { ts: nowIso(), message, status: "error" };
  current.events = [...current.events, event].slice(-MAX_EVENTS);
  store.set(runId, current);
}

export function getProgress(runId: string): RunProgress | null {
  // Clean up old entries on each read
  cleanupOldProgress();
  return store.get(runId) ?? null;
}

// For testing purposes - clears the store
export function clearProgressStore(): void {
  store.clear();
}
