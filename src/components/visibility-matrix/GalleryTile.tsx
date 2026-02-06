"use client";

import { motion } from "framer-motion";
import { IntentNode } from "@/lib/intents/types";
import { Card } from "@/components/ui/card";
import { Link2 } from "lucide-react";
import type { Citation } from "@/lib/parsers/types";
import { getGalleryTileBgClass, getGalleryTileCardBaseClass, shouldShowGalleryTileFooter } from "@/lib/matrix/galleryTileStyle";
import { Skeleton } from "@/components/ui/skeleton";

interface ResponsePreview {
    provider: string;
    model: string;
    text: string;
    query: string;
    visibility: {
        score: number;
        mentioned: boolean;
        sentiment: string;
    };
}

interface GalleryTileProps {
    persona: string;
    personaLabel: string;
    stage: string;
    stageLabel: string;
    intents: IntentNode[];
    activeTab: "summary" | "intents" | "queries" | "answers";
    results?: {
        discoveryRate: number;      // was: visibilityScore
        sentimentScore: number;
        topCompetitor?: string;
        winRate?: number;
        recommendationRate?: number; // was: answerRate
    };
    responses?: ResponsePreview[];
    citations?: Citation[];
    brandDomain?: string;
    onClick: () => void;
    accentColor?: string;
    isMissing?: boolean; // NEW: indicates no data for this cell (partial run)
    loading?: boolean;   // Show skeleton placeholders while data loads
}

export function GalleryTile({
    persona,
    personaLabel,
    stage,
    stageLabel,
    intents,
    activeTab,
    results,
    citations = [],
    brandDomain,
    onClick,
    accentColor = "#1f3b2c",
    isMissing = false,
    loading = false,
}: GalleryTileProps) {
    const hasContent = intents.length > 0;
    const queryCount = intents.reduce((acc, i) => acc + (i.generatedQueries?.length || 0), 0);

    const getStageMetric = () => {
        if (!results) return null;
        switch (stage) {
            case "explore":
                return { label: "Discovery", value: `${Math.round((results.discoveryRate || 0) * 100)}%` };
            case "consider":
                return { label: "Sentiment", value: results.sentimentScore.toFixed(1) };
            case "compare":
                return { label: "Win Rate", value: `${Math.round((results.winRate || 0) * 100)}%` };
            case "decide":
                return { label: "Rec Rate", value: `${Math.round((results.recommendationRate || 0) * 100)}%` };
            default:
                return null;
        }
    };

    const metric = getStageMetric();

    // Heatmap color logic - standardized thresholds (0.7/0.4)
    const getHeatmapBg = (score: number) => {
        if (score >= 0.7) return "bg-[#dcf3dc] hover:bg-[#d2ebd2]"; // Green - strong
        if (score >= 0.4) return "bg-[#faf5ef] hover:bg-[#f3eadf]"; // Tan - moderate
        return "bg-[#fce9e9] hover:bg-[#f9dada]"; // Red - weak
    };

    // Get the appropriate metric for this stage (0-1 scale)
    const getStageScore = () => {
        if (!results) return 0;
        switch (stage) {
            case "explore": return results.discoveryRate || 0;
            case "consider": return (results.sentimentScore + 1) / 2; // Normalize -1 to +1 → 0 to 1
            case "compare": return results.winRate || 0;
            case "decide": return results.recommendationRate || 0;
            default: return 0;
        }
    };

    const baseBgClass = getGalleryTileBgClass(activeTab);
    const heatmapClass = activeTab === "summary" && results ? getHeatmapBg(getStageScore()) : baseBgClass;
    const cardBaseClass = getGalleryTileCardBaseClass();

    return (
        <motion.div
            layoutId={`cell-${persona}-${stage}`}
            whileHover={{ y: -4, transition: { duration: 0.2 } }}
            className="group cursor-pointer"
            style={{ height: "320px" }}  // Fixed height for consistent rows
            onClick={onClick}
        >
            <Card className={`${cardBaseClass} ${isMissing ? "bg-black/5" : loading ? "bg-[#faf9f6]" : heatmapClass}`}>
                {/* Missing Cell State */}
                {isMissing ? (
                    <div className="h-full flex items-center justify-center">
                        <div className="text-center">
                            <p className="text-xs text-black/30 italic">No data captured</p>
                            <p className="text-[9px] text-black/20 mt-1">for this cell</p>
                        </div>
                    </div>
                ) : loading ? (
                    <>
                        {/* Header: Always visible during loading */}
                        <div className="flex items-start justify-between min-h-[56px]">
                            <div className="flex flex-col gap-1">
                                <span
                                    className="text-[10px] font-bold uppercase tracking-[0.2em]"
                                    style={{ color: accentColor }}
                                >
                                    {stageLabel}
                                </span>
                                <h3 className="text-xl font-light tracking-tight text-black/60">
                                    {personaLabel}
                                </h3>
                            </div>
                        </div>
                        {/* Skeleton content area */}
                        <div className="flex-1 flex flex-col items-center justify-center py-4">
                            <Skeleton className="h-3 w-20 mb-3 bg-[#e3dacb]/50" />
                            <Skeleton className="h-10 w-24 bg-[#e3dacb]/50" />
                        </div>
                    </>
                ) : (
                    <>
                {/* Header: Stage Identifier - Fixed height */}
                <motion.div
                    layout="position"
                    className="flex items-start justify-between min-h-[56px]"
                >
                    <div className="flex flex-col gap-1">
                        <span
                            className="text-[10px] font-bold uppercase tracking-[0.2em]"
                            style={{ color: accentColor }}
                        >
                            {stageLabel}
                        </span>
                        <h3 className="text-xl font-light tracking-tight text-black group-hover:text-black/80 transition-colors">
                            {personaLabel}
                        </h3>
                    </div>

                    {activeTab === "intents" && (
                        <motion.div
                            initial={{ scale: 0.8, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.8, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="w-9 h-9 flex items-center justify-center border-2 font-black text-base select-none"
                            style={{ borderColor: accentColor, color: accentColor }}
                        >
                            {stageLabel.charAt(0)}
                        </motion.div>
                    )}
                </motion.div>

                {/* Content: Preview - Fixed height with consistent spacing */}
                <motion.div 
                    layout="position"
                    className="flex-1 overflow-hidden flex flex-col"
                    style={{ minHeight: "180px" }}
                >
                    {activeTab === "answers" ? (
                        (() => {
                            // Aggregate citations by domain
                            const domainCounts = new Map<string, number>();
                            for (const citation of citations) {
                                const domain = citation.domain || new URL(citation.url).hostname.replace(/^www\./, "");
                                domainCounts.set(domain, (domainCounts.get(domain) || 0) + 1);
                            }
                            const sortedDomains = Array.from(domainCounts.entries())
                                .sort((a, b) => b[1] - a[1]);
                            const top5 = sortedDomains.slice(0, 5);
                            const totalCitations = citations.length;
                            const remainingCount = sortedDomains.length - 5;

                            if (totalCitations === 0) {
                                return (
                                    <div className="h-full flex flex-col justify-center items-center py-4">
                                        <Link2 className="w-8 h-8 text-black/10 mb-2" />
                                        <p className="text-sm italic text-black/20">No citations yet</p>
                                    </div>
                                );
                            }

                            return (
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <span className="text-[9px] font-black uppercase tracking-[0.15em] text-black/40">
                                            Most Cited Sources
                                        </span>
                                        <span className="text-[9px] font-medium text-black/30">
                                            {totalCitations} total
                                        </span>
                                    </div>
                                    <div className="space-y-2">
                                        {top5.map(([domain, count], idx) => {
                                            const isBrand = brandDomain && domain.toLowerCase().includes(brandDomain.toLowerCase());
                                            return (
                                                <div
                                                    key={idx}
                                                    className={`flex items-center justify-between py-1 px-2 rounded-sm ${
                                                        isBrand ? "bg-[#dcf3dc]" : "bg-black/[0.02]"
                                                    }`}
                                                >
                                                    <span className={`text-[10px] truncate max-w-[140px] ${
                                                        isBrand ? "font-bold text-[#1f3b2c]" : "text-black/60"
                                                    }`}>
                                                        {domain}
                                                    </span>
                                                    <span className={`text-[10px] font-bold ${
                                                        isBrand ? "text-[#1f3b2c]" : "text-black/40"
                                                    }`}>
                                                        {count}×
                                                    </span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                    {remainingCount > 0 && (
                                        <p className="text-[10px] text-black/30 text-center">
                                            +{remainingCount} more sources
                                        </p>
                                    )}
                                </div>
                            );
                        })()
                    ) : hasContent ? (
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
                </motion.div>

                {/* Footer: Stats - Fixed height for consistency */}
                {shouldShowGalleryTileFooter(activeTab) && (
                    <motion.div
                        layout="position"
                        className="pt-3 flex items-center justify-between min-h-[40px] border-t border-black/5"
                    >
                        <div />
                        {results?.topCompetitor && (
                            <div className="flex items-center gap-1.5">
                                <span className="text-[9px] font-bold uppercase text-black/20">Rival</span>
                                <span className="text-[10px] font-bold text-black/40 truncate max-w-[80px]">{results.topCompetitor}</span>
                            </div>
                        )}
                    </motion.div>
                )}
                    </>
                )}
            </Card>
        </motion.div>
    );
}
