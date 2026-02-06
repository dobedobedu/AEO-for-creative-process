"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef } from "react";

type View = "matrix" | "kanban";

interface ViewToggleProps {
  className?: string;
}

// Prefetch data for the target view on hover (fires once per session)
const prefetchedViews = new Set<string>();

export function ViewToggle({ className = "" }: ViewToggleProps) {
  const pathname = usePathname();
  const activeView: View = pathname?.includes("visibility-board") ? "kanban" : "matrix";
  const prefetchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const prefetchMatrix = useCallback(() => {
    if (prefetchedViews.has("matrix")) return;
    prefetchedViews.add("matrix");

    // Fire off the slow requests in parallel - results get cached by browser
    fetch("/api/matrix/active").catch(() => {});
    fetch("/api/intents/library").catch(() => {});
    fetch("/api/benchmark/runs/history?limit=45").catch(() => {});
  }, []);

  const prefetchKanban = useCallback(() => {
    if (prefetchedViews.has("kanban")) return;
    prefetchedViews.add("kanban");

    fetch("/api/kanban").catch(() => {});
  }, []);

  const prefetchView = useCallback(
    (view: View) => {
      if (view === "matrix") prefetchMatrix();
      else prefetchKanban();
    },
    [prefetchMatrix, prefetchKanban]
  );

  const handleMouseEnter = useCallback((view: View) => {
    if (prefetchTimeoutRef.current) {
      clearTimeout(prefetchTimeoutRef.current);
    }

    // Small delay to avoid prefetching on accidental hover
    prefetchTimeoutRef.current = setTimeout(() => {
      prefetchView(view);
    }, 100);
  }, [prefetchView]);

  const handleMouseLeave = useCallback(() => {
    if (prefetchTimeoutRef.current) {
      clearTimeout(prefetchTimeoutRef.current);
      prefetchTimeoutRef.current = null;
    }
  }, []);

  useEffect(() => {
    const target: View = activeView === "matrix" ? "kanban" : "matrix";
    if (typeof window === "undefined") return;
    const requestIdle =
      typeof window.requestIdleCallback === "function"
        ? window.requestIdleCallback.bind(window)
        : undefined;
    const cancelIdle =
      typeof window.cancelIdleCallback === "function"
        ? window.cancelIdleCallback.bind(window)
        : undefined;

    let idleId: number | null = null;
    if (requestIdle) {
      idleId = requestIdle(() => prefetchView(target));
    } else {
      idleId = window.setTimeout(() => prefetchView(target), 1200);
    }

    return () => {
      if (idleId === null) return;
      if (cancelIdle) cancelIdle(idleId);
      else window.clearTimeout(idleId);
    };
  }, [activeView, prefetchView]);

  useEffect(() => {
    return () => {
      if (!prefetchTimeoutRef.current) return;
      clearTimeout(prefetchTimeoutRef.current);
    };
  }, []);

  return (
    <div
      className={`inline-flex rounded-full border border-[var(--panel-border)] bg-white p-1 shadow-sm ${className}`}
    >
      <Link
        href="/visibility-matrix"
        prefetch={true}
        onMouseEnter={() => handleMouseEnter("matrix")}
        onMouseLeave={handleMouseLeave}
        onPointerDown={() => prefetchView("matrix")}
        onFocus={() => prefetchView("matrix")}
        className={`flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium transition-all ${
          activeView === "matrix"
            ? "bg-[var(--forest)] text-white shadow-sm"
            : "text-[var(--ink)]/60 hover:text-[var(--ink)] hover:bg-[var(--mist)]"
        }`}
      >
        <span
          className={`h-2 w-2 rounded-full ${
            activeView === "matrix" ? "bg-white" : "bg-[var(--ink)]/30"
          }`}
        />
        Matrix
      </Link>
      <Link
        href="/visibility-board"
        prefetch={true}
        onMouseEnter={() => handleMouseEnter("kanban")}
        onMouseLeave={handleMouseLeave}
        onPointerDown={() => prefetchView("kanban")}
        onFocus={() => prefetchView("kanban")}
        className={`flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium transition-all ${
          activeView === "kanban"
            ? "bg-[var(--forest)] text-white shadow-sm"
            : "text-[var(--ink)]/60 hover:text-[var(--ink)] hover:bg-[var(--mist)]"
        }`}
      >
        <span
          className={`h-2 w-2 rounded-full ${
            activeView === "kanban" ? "bg-white" : "bg-[var(--ink)]/30"
          }`}
        />
        Kanban
      </Link>
    </div>
  );
}
