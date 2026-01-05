"use client";

import { useMemo } from "react";
import type { StageExtraction } from "@/lib/scoring/schemas";

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
  extractions?: StageExtraction[];
  isComplete: boolean;
  isRunning: boolean;
  onClick?: () => void;
  selected?: boolean;
}

// Discovery visualization for Explore stage
function ExploreCell({ 
  discoveryRate = 0, 
  topThreeRate = 0 
}: { 
  discoveryRate: number; 
  topThreeRate: number;
}) {
  const dots = [
    { filled: discoveryRate >= 0.2, label: "20%" },
    { filled: discoveryRate >= 0.4, label: "40%" },
    { filled: discoveryRate >= 0.6, label: "60%" },
    { filled: discoveryRate >= 0.8, label: "80%" },
    { filled: discoveryRate >= 1.0, label: "100%" },
  ];

  return (
    <div className="flex flex-col items-center gap-1.5">
      {/* Discovery dots */}
      <div className="flex gap-1">
        {dots.map((dot, i) => (
          <div
            key={i}
            className={`w-2 h-2 rounded-full transition-colors duration-300 ${
              dot.filled ? "bg-[#1f3b2c]" : "bg-[#e3dacb]"
            }`}
            title={dot.label}
          />
        ))}
      </div>
      
      {/* Percentage */}
      <span className="text-sm font-semibold text-[#1e1b16]">
        {(discoveryRate * 100).toFixed(0)}%
      </span>
      
      {/* Secondary metric */}
      <span className="text-[10px] text-[#1e1b16]/50">
        top 3: {(topThreeRate * 100).toFixed(0)}%
      </span>
    </div>
  );
}

// Sentiment visualization for Consider stage
function ConsiderCell({ 
  sentimentScore = 0 
}: { 
  sentimentScore: number;
}) {
  // Normalize sentiment from -1..1 to 0..100 for positioning
  const position = ((sentimentScore + 1) / 2) * 100;
  
  // Color gradient based on sentiment
  const getColor = (score: number): string => {
    if (score > 0.3) return "#6e7c5b"; // Olive/positive
    if (score < -0.3) return "#8b6b5b"; // Muted warm/negative
    return "#a09080"; // Neutral stone
  };

  const getLabel = (score: number): string => {
    if (score > 0.5) return "Very Positive";
    if (score > 0.2) return "Positive";
    if (score > -0.2) return "Neutral";
    if (score > -0.5) return "Negative";
    return "Very Negative";
  };

  return (
    <div className="flex flex-col items-center gap-2 w-full px-2">
      {/* Sentiment bar with dot */}
      <div className="relative w-full h-2 rounded-full overflow-hidden">
        {/* Gradient background */}
        <div 
          className="absolute inset-0 rounded-full"
          style={{
            background: "linear-gradient(to right, #c4b5a0 0%, #e3dacb 50%, #b8c4a8 100%)"
          }}
        />
        
        {/* Position indicator */}
        <div
          className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full border-2 border-white shadow-sm transition-all duration-300"
          style={{
            left: `calc(${position}% - 6px)`,
            backgroundColor: getColor(sentimentScore),
          }}
        />
      </div>
      
      {/* Score */}
      <span 
        className="text-sm font-semibold"
        style={{ color: getColor(sentimentScore) }}
      >
        {sentimentScore >= 0 ? "+" : ""}{sentimentScore.toFixed(2)}
      </span>
      
      {/* Label */}
      <span className="text-[10px] text-[#1e1b16]/50">
        {getLabel(sentimentScore)}
      </span>
    </div>
  );
}

// Win rate visualization for Compare stage
function CompareCell({ 
  winRate = 0,
  competitorCount = 0,
}: { 
  winRate: number;
  competitorCount?: number;
}) {
  // Determine trend direction (would need historical data)
  const trend = winRate >= 0.5 ? "up" : winRate <= 0.3 ? "down" : "stable";
  
  const trendIcon = trend === "up" ? "▲" : trend === "down" ? "▼" : "─";
  const trendColor = trend === "up" ? "text-[#3b5a3b]" : trend === "down" ? "text-[#8b4a4a]" : "text-[#1e1b16]/40";

  return (
    <div className="flex flex-col items-center gap-1.5">
      {/* Win rate with trend */}
      <div className="flex items-center gap-1">
        <span className="text-sm font-semibold text-[#1e1b16]">
          {(winRate * 100).toFixed(0)}%
        </span>
        <span className={`text-xs ${trendColor}`}>{trendIcon}</span>
      </div>
      
      {/* Visual bar */}
      <div className="w-full h-1.5 bg-[#e3dacb] rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${winRate * 100}%`,
            backgroundColor: winRate >= 0.5 ? "#1f3b2c" : winRate >= 0.3 ? "#6e7c5b" : "#b86f3a",
          }}
        />
      </div>
      
      {/* Competitor count */}
      {competitorCount > 0 && (
        <span className="text-[10px] text-[#1e1b16]/50">
          vs {competitorCount} others
        </span>
      )}
    </div>
  );
}

// Recommendation visualization for Decide stage
function DecideCell({ 
  recommendationRate = 0,
}: { 
  recommendationRate: number;
}) {
  // Strength dots (4 levels)
  const strengthLevel = Math.ceil(recommendationRate * 4);
  
  const getStrengthLabel = (rate: number): string => {
    if (rate >= 0.75) return "Strong";
    if (rate >= 0.5) return "Moderate";
    if (rate >= 0.25) return "Weak";
    return "None";
  };

  return (
    <div className="flex flex-col items-center gap-1.5">
      {/* Strength dots */}
      <div className="flex gap-1">
        {[1, 2, 3, 4].map((level) => (
          <div
            key={level}
            className={`w-2.5 h-2.5 rounded-full transition-colors duration-300 ${
              level <= strengthLevel 
                ? "bg-[#1f3b2c]" 
                : "bg-[#e3dacb]"
            }`}
          />
        ))}
      </div>
      
      {/* Percentage */}
      <span className="text-sm font-semibold text-[#1e1b16]">
        {(recommendationRate * 100).toFixed(0)}%
      </span>
      
      {/* Strength label */}
      <span className="text-[10px] text-[#1e1b16]/50">
        {getStrengthLabel(recommendationRate)}
      </span>
    </div>
  );
}

// Idle/Running state
function PlaceholderCell({ 
  isRunning, 
  stage 
}: { 
  isRunning: boolean; 
  stage: Stage;
}) {
  const stageLabels: Record<Stage, string> = {
    explore: "Discovery",
    consider: "Sentiment",
    compare: "Win Rate",
    decide: "Recommend",
  };

  return (
    <div className="flex flex-col items-center justify-center gap-2 py-2">
      {isRunning ? (
        <>
          <div className="w-5 h-5 border-2 border-[#1f3b2c]/30 border-t-[#1f3b2c] rounded-full animate-spin" />
          <span className="text-[10px] text-[#1e1b16]/40">Running...</span>
        </>
      ) : (
        <>
          <div className="flex gap-1">
            {[1, 2, 3].map((i) => (
              <div key={i} className="w-2 h-2 rounded-full bg-[#e3dacb]" />
            ))}
          </div>
          <span className="text-[10px] text-[#1e1b16]/40">{stageLabels[stage]}</span>
        </>
      )}
    </div>
  );
}

export function StageCell({
  stage,
  metrics,
  extractions,
  isComplete,
  isRunning,
  onClick,
  selected = false,
}: StageCellProps) {
  // Calculate competitor count from extractions if available
  const competitorCount = useMemo(() => {
    if (!extractions) return 0;
    const competitors = new Set<string>();
    for (const ext of extractions) {
      if ("competitors" in ext) {
        ext.competitors.forEach(c => competitors.add(c));
      } else if ("comparedTo" in ext) {
        ext.comparedTo.forEach(c => competitors.add(c));
      }
    }
    return competitors.size;
  }, [extractions]);

  return (
    <button
      onClick={onClick}
      className={`
        w-full h-full min-h-[80px] p-2 rounded-xl transition-all duration-200
        border-2
        ${selected 
          ? "border-[#1f3b2c] bg-white shadow-md" 
          : "border-transparent bg-white/50 hover:bg-white hover:border-[#e3dacb]"
        }
        ${onClick ? "cursor-pointer" : "cursor-default"}
      `}
    >
      {!isComplete ? (
        <PlaceholderCell isRunning={isRunning} stage={stage} />
      ) : stage === "explore" ? (
        <ExploreCell 
          discoveryRate={metrics.discoveryRate ?? 0} 
          topThreeRate={metrics.topThreeRate ?? 0} 
        />
      ) : stage === "consider" ? (
        <ConsiderCell 
          sentimentScore={metrics.sentimentScore ?? 0} 
        />
      ) : stage === "compare" ? (
        <CompareCell 
          winRate={metrics.winRate ?? 0} 
          competitorCount={competitorCount}
        />
      ) : (
        <DecideCell 
          recommendationRate={metrics.recommendationRate ?? 0} 
        />
      )}
    </button>
  );
}
