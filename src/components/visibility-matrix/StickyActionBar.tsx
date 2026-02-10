"use client";

import { Button } from "@/components/ui/button";
import { Play, Square, MessageSquare, MousePointer2, Clock } from "lucide-react";

interface StickyActionBarProps {
  isRunning: boolean;
  selectionLabel: string;
  selectionType: "all" | "cell" | "row" | "column";
  allCellsHaveQueries: boolean;
  isSelectingQueries: boolean;
  onRun: () => void;
  onStop: () => void;
  onAskAI: () => void;
  onStartSelection: () => void;
  onCancelSelection: () => void;
  onTimeMachine?: () => void;
  isTimeMachineOpen?: boolean;
}

export function StickyActionBar({
  isRunning,
  selectionLabel,
  selectionType,
  allCellsHaveQueries,
  isSelectingQueries,
  onRun,
  onStop,
  onAskAI,
  onStartSelection,
  onCancelSelection,
  onTimeMachine,
  isTimeMachineOpen,
}: StickyActionBarProps) {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-brand-secondary shadow-[0_-4px_20px_rgba(0,0,0,0.08)]">
      <div className="max-w-6xl mx-auto px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button
            onClick={onAskAI}
            variant="outline"
            size="sm"
            className="border-brand-secondary text-[#1e1b16] hover:bg-[#f6f1e8] hover:text-brand-primary"
          >
            <MessageSquare className="h-4 w-4 mr-2" />
            Ask AI
          </Button>

          {onTimeMachine && (
            <Button
              onClick={onTimeMachine}
              variant="outline"
              size="sm"
              className={`border-brand-secondary text-[#1e1b16] hover:bg-[#f6f1e8] hover:text-brand-primary ${
                isTimeMachineOpen ? "bg-[#f6f1e8] text-brand-primary" : ""
              }`}
            >
              <Clock className="h-4 w-4 mr-2" />
              Time Machine
            </Button>
          )}
        </div>

        <div className="flex items-center gap-3">
          {isRunning ? (
            // Running state - show Stop button
            <>
              <span className="text-xs text-[#1e1b16]/50">Running...</span>
              <Button onClick={onStop} className="bg-[#b86f3a] hover:bg-[#a65f2a] text-white">
                <Square className="h-4 w-4 mr-2" />
                Stop
              </Button>
            </>
          ) : allCellsHaveQueries && !isSelectingQueries ? (
            // All cells have queries - simple Run All
            <>
              <span className="text-xs text-[#1e1b16]/50">All cells selected</span>
              <Button onClick={onRun} className="bg-brand-primary hover:bg-brand-primary-light text-white">
                <Play className="h-4 w-4 mr-2" />
                Run All
              </Button>
            </>
          ) : !isSelectingQueries ? (
            // Not all cells have queries - show selection mode entry
            <Button onClick={onStartSelection} className="bg-brand-primary hover:bg-brand-primary-light text-white">
              <MousePointer2 className="h-4 w-4 mr-2" />
              Select Queries to Run
            </Button>
          ) : (
            // In selection mode - show selected scope + Run/Cancel
            <>
              <span className="text-xs text-[#1e1b16]/50">
                {selectionType === "all" ? "Click a cell, row, or column" : `Selected: ${selectionLabel}`}
              </span>
              <Button
                variant="outline"
                onClick={onCancelSelection}
                className="border-brand-secondary text-[#1e1b16] hover:bg-[#f6f1e8]"
              >
                Cancel
              </Button>
              <Button
                onClick={onRun}
                disabled={selectionType === "all"}
                className="bg-brand-primary hover:bg-brand-primary-light text-white disabled:opacity-50"
              >
                <Play className="h-4 w-4 mr-2" />
                Run {selectionLabel}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
