"use client";

import { motion, AnimatePresence } from "framer-motion";
import { X, Clock, ChevronDown } from "lucide-react";
import type { BenchmarkRun as StoredRun } from "@/lib/runs/types";
import { useMemo, useState, useRef, useCallback, useEffect } from "react";

interface TimeMachinePanelProps {
  runs: StoredRun[];
  selectedRunId: string | null;
  onSelectRun: (runId: string) => void;
  onClose: () => void;
  onBackToNow: () => void;
  totalCells: number; // personas.length * stages.length
}

function getCompletionWidth(cellCount: number, totalCells: number): number {
  if (totalCells === 0) return 24;
  const ratio = cellCount / totalCells;
  // Scale from 24px to 80px based on completion
  return Math.round(24 + ratio * 56);
}

function formatDateLabel(dateStr: string): string {
  const date = new Date(dateStr + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.toDateString() === today.toDateString()) {
    return "Today";
  }
  if (date.toDateString() === yesterday.toDateString()) {
    return "Yesterday";
  }

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: date.getFullYear() !== today.getFullYear() ? "numeric" : undefined
  });
}

function formatTimeLabel(timestamp: string): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true
  });
}

interface FlatRun extends StoredRun {
  groupDate: string;
  groupLabel: string;
  isFirstInGroup: boolean;
}

export function TimeMachinePanel({
  runs,
  selectedRunId,
  onSelectRun,
  onClose,
  onBackToNow,
  totalCells,
}: TimeMachinePanelProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [canScrollMore, setCanScrollMore] = useState(false);
  const timelineRef = useRef<HTMLDivElement>(null);

  // Create flat list of runs with group info for smoother index-based scaling
  const flatRuns = useMemo(() => {
    const groups: Map<string, StoredRun[]> = new Map();

    // Sort runs oldest first (so newest appears at bottom)
    const sortedRuns = [...runs]
      .filter(run => run.id && run.id.trim() !== '')
      .sort((a, b) => a.timestamp.localeCompare(b.timestamp));

    for (const run of sortedRuns) {
      const date = run.timestamp.split("T")[0];
      if (!groups.has(date)) {
        groups.set(date, []);
      }
      groups.get(date)!.push(run);
    }

    const result: FlatRun[] = [];
    for (const [date, dateRuns] of groups.entries()) {
      const label = formatDateLabel(date);
      dateRuns.forEach((run, idx) => {
        result.push({
          ...run,
          groupDate: date,
          groupLabel: label,
          isFirstInGroup: idx === 0,
        });
      });
    }

    return result;
  }, [runs]);

  // Check if we can scroll more
  const updateScrollIndicator = useCallback(() => {
    if (timelineRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = timelineRef.current;
      const atBottom = scrollTop + clientHeight >= scrollHeight - 10;
      setCanScrollMore(scrollHeight > clientHeight && !atBottom);
    }
  }, []);

  useEffect(() => {
    updateScrollIndicator();
    const el = timelineRef.current;
    if (el) {
      el.addEventListener("scroll", updateScrollIndicator);
      window.addEventListener("resize", updateScrollIndicator);
      return () => {
        el.removeEventListener("scroll", updateScrollIndicator);
        window.removeEventListener("resize", updateScrollIndicator);
      };
    }
  }, [updateScrollIndicator, flatRuns.length]);

  // Calculate scale based on index distance from hovered item
  const getScale = useCallback((index: number) => {
    if (hoveredIndex === null) return 1;
    const distance = Math.abs(index - hoveredIndex);
    if (distance > 3) return 1;
    // Max scale 1.4x at distance 0, tapering to 1x at distance 3
    return 1 + (0.4 * (1 - distance / 3));
  }, [hoveredIndex]);

  return (
    <AnimatePresence>
      {/* Panel - no backdrop overlay */}
      <motion.div
        key="panel"
        initial={{ x: "100%", opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: "100%", opacity: 0 }}
        transition={{ type: "spring", damping: 30, stiffness: 300 }}
        className="fixed right-0 top-0 h-full w-72 bg-[#1e1b16]/80 backdrop-blur-xl border-l border-white/10 shadow-2xl z-50 flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-white/70" />
            <span className="font-medium text-white/90 text-sm">Time Machine</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-white/10 transition-colors"
          >
            <X className="h-4 w-4 text-white/60" />
          </button>
        </div>

        {/* Timeline */}
        <div
          ref={timelineRef}
          className="flex-1 overflow-y-auto py-4 relative"
          onMouseLeave={() => setHoveredIndex(null)}
        >
          {flatRuns.length === 0 ? (
            <div className="px-4 py-8 text-center text-white/40">
              <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No historical runs yet</p>
              <p className="text-xs mt-1">Run a benchmark to see history</p>
            </div>
          ) : (
            <div className="space-y-0">
              {flatRuns.map((run, index) => {
                const cellCount = run.cells ? Object.keys(run.cells).length : 0;
                const baseWidth = getCompletionWidth(cellCount, totalCells);
                const isSelected = run.id === selectedRunId;
                const scale = getScale(index);
                // Show timestamp only for hovered item and 1 neighbor on each side (max 3)
                const showTimestamp = hoveredIndex !== null && Math.abs(index - hoveredIndex) <= 1;

                return (
                  <div key={run.id}>
                    {/* Date Header - only for first run in group */}
                    {run.isFirstInGroup && (
                      <div className={`px-4 text-[10px] font-medium text-white/40 uppercase tracking-wider ${index === 0 ? 'mb-1' : 'mt-3 mb-1'}`}>
                        {run.groupLabel}
                      </div>
                    )}

                    {/* Run item */}
                    <button
                      onMouseEnter={() => setHoveredIndex(index)}
                      onClick={() => onSelectRun(run.id)}
                      className="w-full flex items-center justify-end gap-2 px-4 py-0.5 transition-colors hover:bg-white/5"
                      style={{ willChange: 'transform' }}
                    >
                      {/* Time Label - fixed width, fades based on proximity */}
                      <span
                        className={`w-16 text-right text-xs font-medium transition-opacity duration-150 ${
                          isSelected ? "text-white" : "text-white/60"
                        }`}
                        style={{ opacity: showTimestamp ? 1 : 0 }}
                      >
                        {formatTimeLabel(run.timestamp)}
                      </span>

                      {/* Completion Bar - scales smoothly */}
                      <div
                        className={`h-2 rounded-sm transition-all duration-150 ease-out ${
                          isSelected
                            ? "bg-gradient-to-r from-[#1f3b2c] to-[#2d5a40] shadow-[0_0_8px_rgba(45,90,64,0.5)]"
                            : "bg-gradient-to-r from-white/20 to-white/40"
                        }`}
                        style={{
                          width: `${baseWidth * scale}px`,
                        }}
                      />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Scroll indicator */}
          {canScrollMore && (
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 pointer-events-none">
              <ChevronDown className="h-4 w-4 text-white/30 animate-bounce" />
            </div>
          )}
        </div>

        {/* Footer - Coral/Red "Now" Button */}
        <div className="px-4 py-3 border-t border-white/10">
          <button
            onClick={onBackToNow}
            disabled={!selectedRunId}
            className={`w-full py-2.5 px-4 rounded-lg font-medium text-sm transition-all ${
              selectedRunId
                ? "bg-gradient-to-r from-[#f97066] to-[#e85a4f] text-white hover:from-[#e85a4f] hover:to-[#d94a3f] shadow-lg shadow-[#f97066]/20"
                : "bg-white/5 text-white/30 cursor-not-allowed"
            }`}
          >
            Now
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
