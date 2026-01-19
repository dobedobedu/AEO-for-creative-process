"use client";

import { motion } from "framer-motion";
import { Persona, Stage, Role } from "./types";
import { IntentNode } from "@/lib/intents/types";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { MessageSquare, Target } from "lucide-react";

interface GalleryTileProps {
    persona: Persona;
    personaLabel: string;
    stage: Stage;
    stageLabel: string;
    intents: IntentNode[];
    activeTab: "summary" | "intents" | "queries";
    results?: {
        visibilityScore: number;
        sentimentScore: number;
        topCompetitor?: string;
        winRate?: number;
        answerRate?: number;
    };
    onClick: () => void;
    accentColor?: string;
}

export function GalleryTile({
    persona,
    personaLabel,
    stage,
    stageLabel,
    intents,
    activeTab,
    results,
    onClick,
    accentColor = "#1f3b2c",
}: GalleryTileProps) {
    const hasContent = intents.length > 0;
    const queryCount = intents.reduce((acc, i) => acc + (i.generatedQueries?.length || 0), 0);

    const getStageMetric = () => {
        if (!results) return null;
        switch (stage) {
            case "explore":
                return { label: "Reach", value: `${Math.round(results.visibilityScore * 100)}%` };
            case "consider":
                const s = results.sentimentScore;
                const sentimentLabel = s > 0.3 ? "Positive" : s < -0.3 ? "Negative" : "Neutral";
                return { label: "Sentiment", value: sentimentLabel };
            case "compare":
                return { label: "Win Rate", value: `${Math.round((results.winRate || 0) * 100)}%` };
            case "decide":
                return { label: "Answers", value: `${Math.round((results.answerRate || 0) * 100)}%` };
            default:
                return null;
        }
    };

    const metric = getStageMetric();

    // Heatmap color logic
    const getHeatmapBg = (score: number) => {
        if (score > 0.8) return "bg-[#dcf3dc] hover:bg-[#d2ebd2]"; // Vivid soft green
        if (score > 0.4) return "bg-[#faf5ef] hover:bg-[#f3eadf]"; // Vivid soft tan/cream
        return "bg-[#fce9e9] hover:bg-[#f9dada]"; // Vivid soft red/pink
    };

    const heatmapClass = activeTab === "summary" && results ? getHeatmapBg(results.visibilityScore) : "bg-transparent hover:bg-white/40";

    return (
        <motion.div
            layoutId={`cell-${persona}-${stage}`}
            whileHover={{ y: -4, transition: { duration: 0.2 } }}
            className="group cursor-pointer h-full"
            onClick={onClick}
        >
            <Card className={`h-full border-[#e3dacb] hover:border-black/20 transition-all duration-300 rounded-none border-t-0 border-l-0 border-r-0 shadow-none p-6 flex flex-col gap-6 ${heatmapClass}`}>
                {/* Header: Stage Identifier */}
                <div className="flex items-start justify-between">
                    <div className="flex flex-col gap-1">
                        <span
                            className="text-[10px] font-bold uppercase tracking-[0.2em]"
                            style={{ color: accentColor }}
                        >
                            {stageLabel}
                        </span>
                        <h3 className="text-2xl font-light tracking-tight text-black group-hover:text-black/80 transition-colors">
                            {personaLabel}
                        </h3>
                    </div>

                    {activeTab === "intents" && (
                        <div
                            className="w-10 h-10 flex items-center justify-center border-2 font-black text-lg select-none transition-transform group-hover:rotate-3"
                            style={{ borderColor: accentColor, color: accentColor }}
                        >
                            {stageLabel.charAt(0)}
                        </div>
                    )}
                </div>

                {/* Content: Preview */}
                <div className="flex-1 space-y-4 overflow-hidden">
                    {hasContent ? (
                        <>
                            {activeTab === "summary" ? (
                                <div className="h-full flex flex-col justify-center items-center py-4">
                                    {metric ? (
                                        <div className="text-center space-y-1">
                                            <span className="text-[9px] font-black uppercase tracking-[0.15em] text-black/40">{metric.label}</span>
                                            <p className="text-5xl font-light tracking-tighter text-black">
                                                {metric.value}
                                            </p>
                                        </div>
                                    ) : (
                                        <p className="text-sm italic text-black/20">Awaiting Analysis</p>
                                    )}
                                </div>
                            ) : (
                                <div className="space-y-3.5">
                                    {(activeTab === "intents" ? intents : intents.flatMap(i => i.generatedQueries || [])).slice(0, 4).map((item, idx) => (
                                        <div key={idx} className="flex gap-3 items-start group/item">
                                            <span className="text-[8px] font-black text-black/25 mt-1.5 w-4 shrink-0 transition-colors group-hover/item:text-black/50">
                                                {String(idx + 1).padStart(2, '0')}
                                            </span>
                                            <p className="text-[11px] leading-[1.5] text-[#1e1b16]/75 line-clamp-2 font-serif group-hover/item:text-black transition-colors">
                                                {typeof item === 'string' ? item : item.text}
                                            </p>
                                        </div>
                                    ))}
                                    {activeTab === "queries" && queryCount === 0 && (
                                        <p className="text-[11px] italic text-[#1e1b16]/40 font-light">
                                            No queries generated yet.
                                        </p>
                                    )}
                                </div>
                            )}
                        </>
                    ) : (
                        <p className="text-sm italic text-[#1e1b16]/30 font-light">
                            No research goals for this stage.
                        </p>
                    )}
                </div>

                {/* Footer: Stats - Hidden for Summary mode to maintain minimalist focus */}
                <div className={`pt-4 flex items-center justify-between min-h-[44px] ${activeTab === "summary" ? "" : "border-t border-black/5"}`}>
                    {activeTab !== "summary" && (
                        <>
                            <div />
                            {results?.topCompetitor && (
                                <div className="flex items-center gap-1.5">
                                    <span className="text-[9px] font-bold uppercase text-black/20">Rival</span>
                                    <span className="text-[10px] font-bold text-black/40 truncate max-w-[80px]">{results.topCompetitor}</span>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </Card>
        </motion.div>
    );
}
