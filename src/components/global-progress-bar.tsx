"use client";

import { useEffect, useState, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";

export type ProgressStatus = "running" | "complete" | "error" | "idle";

export interface GlobalProgressState {
  runId: string | null;
  status: ProgressStatus;
  message: string;
  completedSteps: number;
  totalSteps: number;
  unit: "queries" | "cells" | "items";
}

const POLL_INTERVAL_MS = 1000;

interface GlobalProgressBarProps {
  /** Optional external control of progress state */
  externalState?: GlobalProgressState | null;
  /** Auto-hide delay in ms after completion (0 = never auto-hide) */
  autoHideDelay?: number;
}

export function GlobalProgressBar({
  externalState,
  autoHideDelay = 3000,
}: GlobalProgressBarProps) {
  const [state, setState] = useState<GlobalProgressState>({
    runId: null,
    status: "idle",
    message: "",
    completedSteps: 0,
    totalSteps: 0,
    unit: "cells",
  });
  const [visible, setVisible] = useState(false);

  // Merge external state if provided
  const displayState = externalState ?? state;

  // Poll progress API when we have a server-generated runId and status is running
  // Skip polling for client-generated runIds (they don't exist on the server)
  useEffect(() => {
    if (!displayState.runId || displayState.status !== "running") return;

    // Don't poll for client-generated runIds - they're only tracked locally
    if (displayState.runId.startsWith("client-")) return;

    const pollProgress = async () => {
      try {
        const resp = await fetch(`/api/benchmark/progress/${displayState.runId}`);
        if (!resp.ok) return;

        const data = await resp.json();
        setState((prev) => ({
          ...prev,
          status: data.status,
          completedSteps: data.completedSteps,
          totalSteps: data.totalSteps,
          unit: data.unit || "cells",
          // Events are sorted DESC (newest first), so [0] is the most recent
          message: data.events?.[0]?.message || prev.message,
        }));
      } catch {
        // Silently ignore polling errors
      }
    };

    const interval = setInterval(pollProgress, POLL_INTERVAL_MS);
    pollProgress(); // Initial poll

    return () => clearInterval(interval);
  }, [displayState.runId, displayState.status]);

  // Show/hide logic
  useEffect(() => {
    if (displayState.status === "running") {
      setVisible(true);
    } else if (displayState.status === "complete" || displayState.status === "error") {
      setVisible(true);
      if (autoHideDelay > 0) {
        const timeout = setTimeout(() => setVisible(false), autoHideDelay);
        return () => clearTimeout(timeout);
      }
    } else {
      setVisible(false);
    }
  }, [displayState.status, autoHideDelay]);

  const progressPercent =
    displayState.totalSteps > 0
      ? Math.round((displayState.completedSteps / displayState.totalSteps) * 100)
      : 0;

  const statusIcon = {
    running: <Loader2 className="h-3.5 w-3.5 animate-spin" />,
    complete: <CheckCircle2 className="h-3.5 w-3.5 text-[#6e7c5b]" />,
    error: <XCircle className="h-3.5 w-3.5 text-[#b86f3a]" />,
    idle: null,
  }[displayState.status];

  const statusColor = {
    running: "bg-[#1f3b2c]",
    complete: "bg-[#6e7c5b]",
    error: "bg-[#b86f3a]",
    idle: "bg-[#e3dacb]",
  }[displayState.status];

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          className="fixed bottom-[52px] left-0 right-0 z-50"
        >
          {/* Progress bar track */}
          <div className="h-1 bg-[#e3dacb]">
            <motion.div
              className={`h-full ${statusColor}`}
              initial={{ width: 0 }}
              animate={{ width: `${progressPercent}%` }}
              transition={{ ease: "easeOut", duration: 0.3 }}
            />
          </div>

          {/* Status strip */}
          <div className="bg-white border-t border-[#e3dacb] px-6 py-2">
            <div className="max-w-6xl mx-auto flex items-center justify-between">
              <div className="flex items-center gap-3">
                {statusIcon}
                <span className="text-xs font-medium text-[#1e1b16]">
                  {displayState.message || "Processing..."}
                </span>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-[10px] font-bold uppercase tracking-widest text-[#1e1b16]/50">
                  {displayState.completedSteps}/{displayState.totalSteps}{" "}
                  {displayState.unit}
                </span>
                <span className="text-xs font-semibold text-[#1e1b16]">
                  {progressPercent}%
                </span>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// Hook for managing progress state
export function useGlobalProgress() {
  const [state, setState] = useState<GlobalProgressState>({
    runId: null,
    status: "idle",
    message: "",
    completedSteps: 0,
    totalSteps: 0,
    unit: "cells",
  });

  const startProgress = useCallback(
    (runId: string, totalSteps: number, message: string, unit: "queries" | "cells" | "items" = "cells") => {
      setState({
        runId,
        status: "running",
        message,
        completedSteps: 0,
        totalSteps,
        unit,
      });
    },
    []
  );

  const updateProgress = useCallback(
    (completedSteps: number, message?: string) => {
      setState((prev) => ({
        ...prev,
        completedSteps,
        message: message ?? prev.message,
      }));
    },
    []
  );

  const completeProgress = useCallback((message?: string) => {
    setState((prev) => ({
      ...prev,
      status: "complete",
      completedSteps: prev.totalSteps,
      message: message ?? "Complete",
    }));
  }, []);

  const failProgress = useCallback((message: string) => {
    setState((prev) => ({
      ...prev,
      status: "error",
      message,
    }));
  }, []);

  const resetProgress = useCallback(() => {
    setState({
      runId: null,
      status: "idle",
      message: "",
      completedSteps: 0,
      totalSteps: 0,
      unit: "cells",
    });
  }, []);

  return {
    state,
    startProgress,
    updateProgress,
    completeProgress,
    failProgress,
    resetProgress,
  };
}
