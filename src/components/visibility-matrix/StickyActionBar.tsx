"use client";

import { Button } from "@/components/ui/button";
import { Play, Square, MessageSquare } from "lucide-react";

interface StickyActionBarProps {
  isRunning: boolean;
  selectionLabel: string;
  selectionType: "all" | "cell" | "row" | "column";
  onRun: () => void;
  onStop: () => void;
  onAskAI: () => void;
}

export function StickyActionBar({
  isRunning,
  selectionLabel,
  selectionType,
  onRun,
  onStop,
  onAskAI,
}: StickyActionBarProps) {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-[#e3dacb] shadow-[0_-4px_20px_rgba(0,0,0,0.08)]">
      <div className="max-w-6xl mx-auto px-6 py-3 flex items-center justify-between">
        <Button
          onClick={onAskAI}
          variant="outline"
          size="sm"
          className="border-[#e3dacb] text-[#1e1b16] hover:bg-[#f6f1e8] hover:text-[#1f3b2c]"
        >
          <MessageSquare className="h-4 w-4 mr-2" />
          Ask AI
        </Button>

        <div className="flex items-center gap-3">
          <span className="text-xs text-[#1e1b16]/50">
            {selectionType === "all" ? "All cells selected" : `Selected: ${selectionLabel}`}
          </span>
          {isRunning ? (
            <Button onClick={onStop} className="bg-[#b86f3a] hover:bg-[#a65f2a] text-white">
              <Square className="h-4 w-4 mr-2" />
              Stop
            </Button>
          ) : (
            <Button onClick={onRun} className="bg-[#1f3b2c] hover:bg-[#2a4d3a] text-white">
              <Play className="h-4 w-4 mr-2" />
              Run {selectionType === "all" ? "All" : selectionLabel}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
