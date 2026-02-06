"use client";

import { Persona, Stage } from "./types";
import { IntentNode } from "@/lib/intents/types";
import { QueriesCell } from "./QueriesCell";

type ViewMode = "summary" | "intents" | "queries";

interface MatrixCellProps {
  persona: Persona;
  stage: Stage;
  viewMode: ViewMode;
  intents: IntentNode[];
  queries: Record<string, string[]>; // intentId -> queries
  score: number;
  mentionRate: number | null;
  status: "idle" | "running" | "complete";
  lastRun?: Date;
  onCellClick: () => void;
  onIntentChange: (intent: IntentNode) => void;
  onIntentDelete: (intentId: string) => void;
  onIntentAdd: (text: string, role: "cpo" | "family_unit", style: number) => void;
  onQueryChange: (intentId: string, queryIndex: number, text: string) => void;
  onQueryDelete: (intentId: string, queryIndex: number) => void;
  onQueryAdd: (intentId: string) => void;
  onQueryRegenerate: (intentId: string, queryIndex: number) => void;
}

export function MatrixCell({
  persona,
  stage,
  viewMode,
  intents,
  queries,
  score,
  status,
  onCellClick,
  onQueryChange,
  onQueryDelete,
  onQueryAdd,
  onQueryRegenerate,
}: MatrixCellProps) {
  // Prepare intents with queries for QueriesCell
  const intentsWithQueries = intents.map((intent) => ({
    intent,
    queries: queries[intent.id] || [],
  }));

  // Summary view - shows just intent count, clean and minimal
  if (viewMode === "summary") {
    return (
      <div
        data-testid={`cell-${persona}-${stage}`}
        className={`
          relative h-16 rounded-lg border transition-all cursor-pointer
          flex items-center justify-center
          ${
            status === "running"
              ? "bg-[#efe6d9] border-[#b86f3a] animate-pulse"
              : status === "complete"
                ? score >= 0.7
                  ? "bg-[#dcf3dc] border-[#1f3b2c]/40"  // Green - strong (standardized 0.7 threshold)
                  : score >= 0.4
                    ? "bg-[#faf5ef] border-[#1f3b2c]/40"  // Tan - moderate (standardized 0.4 threshold)
                    : "bg-[#fce9e9] border-[#b86f3a]/40"  // Red - weak
                : "bg-white border-[#e3dacb] hover:border-[#1f3b2c]/50 hover:shadow-sm"
          }
        `}
        onClick={onCellClick}
      >
        {status === "running" ? (
          <div className="text-center">
            <div className="w-4 h-4 border-2 border-[#b86f3a] border-t-transparent rounded-full animate-spin mx-auto mb-1" />
            <span className="text-[10px] text-[#1e1b16]/50">Running...</span>
          </div>
        ) : status === "complete" ? (
          <div className="text-center">
            <div className="text-lg font-semibold text-[#1e1b16]">
              {Math.round(score * 100)}%
            </div>
            <div className="text-[10px] text-[#1e1b16]/60">
              {intents.length} intent{intents.length !== 1 ? "s" : ""}
            </div>
          </div>
        ) : (
          <div className="text-center">
            <div className="text-[10px] text-[#1e1b16]/40">
              {intents.length} intent{intents.length !== 1 ? "s" : ""}
            </div>
          </div>
        )}
      </div>
    );
  }

  // Intents view - shows all intents in a simple list
  if (viewMode === "intents") {
    return (
      <div
        data-testid={`cell-${persona}-${stage}`}
        className={`
          relative min-h-[80px] rounded-lg border-2 transition-all cursor-pointer
          ${status === "running" ? "border-[#b86f3a] bg-[#efe6d9]" : "border-[#e3dacb] bg-white"}
        `}
        onClick={onCellClick}
      >
        <div className="p-2 space-y-1">
          {intents.length === 0 ? (
            <div className="text-[10px] text-[#1e1b16]/40 text-center py-4">
              No intents
            </div>
          ) : (
            intents.slice(0, 4).map((intent) => (
              <div
                key={intent.id}
                className="text-[10px] text-[#1e1b16] truncate px-2 py-1 bg-[#f6f1e8] rounded"
              >
                {intent.text}
              </div>
            ))
          )}
          {intents.length > 4 && (
            <div className="text-[10px] text-[#1e1b16]/40 text-center">
              +{intents.length - 4} more
            </div>
          )}
        </div>
      </div>
    );
  }

  // Queries view - shows all queries grouped by intent
  if (viewMode === "queries") {
    return (
      <div
        data-testid={`cell-${persona}-${stage}`}
        className={`
          relative min-h-[120px] rounded-xl border-2 transition-all
          ${status === "running" ? "border-[#b86f3a] bg-[#efe6d9]" : "border-[#e3dacb] bg-white"}
        `}
      >
        <QueriesCell
          persona={persona}
          stage={stage}
          intentsWithQueries={intentsWithQueries}
          onQueryChange={onQueryChange}
          onQueryDelete={onQueryDelete}
          onQueryAdd={onQueryAdd}
          onQueryRegenerate={onQueryRegenerate}
        />
      </div>
    );
  }

  return null;
}
