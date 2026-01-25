"use client";

type Stage = "explore" | "consider" | "compare" | "decide";

interface StageCellProps {
  stage: Stage;
  metrics: {
    discoveryRate?: number;
    topThreeRate?: number;
    sentimentScore?: number;
    winRate?: number;
    recommendationRate?: number;
  };
  mentionRate?: number | null;
  queryCount: number;
  completedCount?: number;
  isComplete: boolean;
  isRunning: boolean;
  selected?: boolean;
}

const STAGE_LABELS: Record<Stage, string> = {
  explore: "Discovery",
  consider: "Sentiment", 
  compare: "Win Rate",
  decide: "Recommend",
};

// Get primary metric value for each stage
function getPrimaryMetric(stage: Stage, metrics: StageCellProps["metrics"]): number | null {
  switch (stage) {
    case "explore":
      return metrics.discoveryRate ?? null;
    case "consider":
      return metrics.sentimentScore ?? null;
    case "compare":
      return metrics.winRate ?? null;
    case "decide":
      return metrics.recommendationRate ?? null;
  }
}

// Format metric for display
function formatMetric(stage: Stage, value: number): string {
  if (stage === "consider") {
    // Sentiment is -1 to +1, show as +0.3 format
    return value >= 0 ? `+${value.toFixed(1)}` : value.toFixed(1);
  }
  // Others are 0-1 percentages
  return `${(value * 100).toFixed(0)}%`;
}

// Get color tone based on mention rate
function getMentionTone(mentionRate?: number | null): { bg: string; border: string } {
  if (mentionRate === undefined || mentionRate === null || Number.isNaN(mentionRate)) {
    return { bg: "bg-white", border: "border-[#e3dacb]/50" };
  }
  if (mentionRate >= 0.6) {
    return { bg: "bg-[#e3f1e6]", border: "border-[#b6d7bf]" };
  }
  if (mentionRate >= 0.4) {
    return { bg: "bg-[#edf1e0]", border: "border-[#cfd8b4]" };
  }
  if (mentionRate >= 0.2) {
    return { bg: "bg-[#f6efe0]", border: "border-[#e3dacb]" };
  }
  return { bg: "bg-[#f7e6e3]", border: "border-[#e6c3bb]" };
}

// Progress dots component
function ProgressDots({ 
  total, 
  completed, 
  isRunning 
}: { 
  total: number; 
  completed: number;
  isRunning: boolean;
}) {
  // Limit display to max 5 dots
  const displayCount = Math.min(total, 5);
  const completedRatio = total > 0 ? completed / total : 0;
  const filledDots = Math.round(completedRatio * displayCount);
  
  return (
    <div className="flex gap-1.5 items-center justify-center">
      {Array.from({ length: displayCount }).map((_, i) => (
        <div
          key={i}
          className={`
            w-2.5 h-2.5 rounded-full transition-all duration-300
            ${i < filledDots 
              ? "bg-[#1f3b2c] scale-110" 
              : "bg-[#e3dacb]"
            }
            ${isRunning && i === filledDots ? "animate-pulse bg-[#6e7c5b]" : ""}
          `}
        />
      ))}
    </div>
  );
}

export function StageCell({
  stage,
  metrics,
  mentionRate,
  queryCount,
  completedCount = 0,
  isComplete,
  isRunning,
  selected = false,
}: StageCellProps) {
  const primaryMetric = getPrimaryMetric(stage, metrics);
  const stageLabel = STAGE_LABELS[stage];
  const mentionTone = getMentionTone(mentionRate);

  // Idle state - empty dots showing query count
  if (!isComplete && !isRunning) {
    return (
      <div className={`
        w-full h-full min-h-[80px] p-3 rounded-xl
        flex flex-col items-center justify-center gap-2
        bg-[#faf7f2] border border-[#e3dacb]/50
        ${selected ? "ring-2 ring-[#1f3b2c]" : ""}
      `}>
        <ProgressDots total={queryCount} completed={0} isRunning={false} />
        <span className="text-[10px] text-[#1e1b16]/40">
          {queryCount} {queryCount === 1 ? "query" : "queries"}
        </span>
      </div>
    );
  }

  // Running state - dots filling up
  if (isRunning) {
    return (
      <div className={`
        w-full h-full min-h-[80px] p-3 rounded-xl
        flex flex-col items-center justify-center gap-2
        bg-white border border-[#e3dacb]/50
        ${selected ? "ring-2 ring-[#1f3b2c]" : ""}
      `}>
        <ProgressDots total={queryCount} completed={completedCount} isRunning={true} />
        <span className="text-[10px] text-[#1e1b16]/50 animate-pulse">
          running...
        </span>
      </div>
    );
  }

  // Complete state - show score
  return (
    <div className={`
      w-full h-full min-h-[80px] p-3 rounded-xl
      flex flex-col items-center justify-center gap-1
      ${mentionTone.bg} border ${mentionTone.border}
      ${selected ? "ring-2 ring-[#1f3b2c]" : ""}
    `}>
      <span className="text-xl font-semibold text-[#1e1b16]">
        {primaryMetric !== null ? formatMetric(stage, primaryMetric) : "—"}
      </span>
      <span className="text-[10px] text-[#1e1b16]/50 uppercase tracking-wide">
        {stageLabel}
      </span>
      <span className="text-[10px] text-[#1e1b16]/45">
        Mention rate {mentionRate === undefined || mentionRate === null ? "—" : `${Math.round(mentionRate * 100)}%`}
      </span>
    </div>
  );
}
