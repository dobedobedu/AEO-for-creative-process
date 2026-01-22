"use client";

import { useState, useMemo } from "react";
import { GalleryTile } from "./GalleryTile";
import { Role } from "./types";
import { IntentNode } from "@/lib/intents/types";

// Types - using string to support dynamic config
type Persona = string;
type Stage = string;
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Zap, SlidersHorizontal } from "lucide-react";
import type { Citation } from "@/lib/parsers/types";

interface ResponseData {
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

interface SplitViewEditorProps {
    activeTab: "summary" | "intents" | "queries" | "answers";
    personas: { id: string; label: string }[];
    stages: { id: string; label: string }[];
    queryBank: Record<string, Record<string, { intents: IntentNode[] }>>;
    cellResults?: Record<string, Record<string, {
        discoveryRate: number;      // was: visibilityScore
        sentimentScore: number;
        topCompetitor?: string;
        winRate?: number;
        recommendationRate?: number; // was: answerRate
        responses?: ResponseData[];
        citations?: Citation[];
    }>>;
    brandDomain?: string;
    onSelectCell: (persona: string, stage: string) => void;
    // Bulk Actions
    onShowAll?: () => void;
    onGenerateAll?: (mode: "summary" | "intents" | "queries" | "answers") => void;
}

const STAGE_COLORS: Record<string, string> = {
    explore: "#FF3366", // Vivid Pink
    consider: "#0066FF", // Bright Blue
    compare: "#00CC99", // Teal
    decide: "#FF9900", // Orange
};

export function SplitViewEditor({
    activeTab,
    personas,
    stages,
    queryBank,
    cellResults,
    brandDomain,
    onSelectCell,
    onGenerateAll,
}: SplitViewEditorProps) {
    // Filter State
    const [roleFilter, setRoleFilter] = useState<string | null>(null);
    const [styleFilter, setStyleFilter] = useState<number | null>(null);
    const [personaFilter, setPersonaFilter] = useState<Persona | null>(null);

    // Flatten all cells for the gallery
    const allCells = useMemo(() => {
        const cells: { persona: Persona, personaLabel: string, stage: Stage, stageLabel: string, intents: IntentNode[] }[] = [];
        personas.forEach(p => {
            stages.forEach(s => {
                cells.push({
                    persona: p.id,
                    personaLabel: p.label,
                    stage: s.id,
                    stageLabel: s.label,
                    intents: queryBank[p.id][s.id].intents,
                });
            });
        });
        return cells;
    }, [personas, stages, queryBank]);

    // Apply Filter Logic
    const filteredCells = useMemo(() => {
        return allCells.filter(cell => {
            const matchesPersona = !personaFilter || cell.persona === personaFilter;
            const matchesRole = !roleFilter || cell.intents.some(i => i.role === roleFilter);
            const matchesStyle = styleFilter === null || cell.intents.some(i => i.queryStyle === styleFilter);

            // If filters are active, and cell is empty, it shouldn't show up usually, 
            // but for a gallery we might want to show empty ones if they match persona/stage
            return matchesPersona && (cell.intents.length === 0 ? (!roleFilter && styleFilter === null) : (matchesRole && matchesStyle));
        });
    }, [allCells, personaFilter, roleFilter, styleFilter]);

    return (
        <div className="flex flex-col min-h-screen bg-[#faf9f6]">
            {/* Top Tier: Action Bar / Filters */}
            <div className="sticky top-0 z-30 bg-[#faf9f6]/80 backdrop-blur-xl border-b border-[#e3dacb] px-8 py-4">
                <div className="max-w-[1600px] mx-auto flex flex-col gap-6">
                    {/* Level 1: Tabs & High-level Actions */}
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-8">
                            <h2 className="text-sm font-bold uppercase tracking-widest text-black/40">
                                {activeTab === "summary" ? "Research Summary" : activeTab === "intents" ? "Research Intents" : activeTab === "queries" ? "Query Bank" : "LLM Answers"}
                            </h2>
                            <div className="h-4 w-[1px] bg-[#e3dacb]" />
                            {activeTab !== "answers" && activeTab !== "summary" && (
                                <div className="flex gap-4">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => onGenerateAll?.(activeTab)}
                                        className="h-8 gap-2 text-[11px] font-bold uppercase tracking-wider text-black/60 hover:text-black"
                                    >
                                        <Zap className="w-3.5 h-3.5" />
                                        {activeTab === "intents" ? "Generate Intents" : "Generate Queries"}
                                    </Button>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Level 2: Dimensional Filters */}
                    <div className="flex flex-wrap items-center gap-x-12 gap-y-4">
                        {/* Persona Filter */}
                        <div className="flex items-center gap-3">
                            <span className="text-[10px] font-bold uppercase text-black/30 tracking-tight">Persona</span>
                            <div className="flex gap-1">
                                {[{ id: null, label: "All" }, ...personas].map((p) => (
                                    <button
                                        key={p.id || 'all'}
                                        onClick={() => setPersonaFilter(p.id as Persona | null)}
                                        className={`
                                            px-3 py-1 text-[11px] font-medium transition-all
                                            ${personaFilter === p.id
                                                ? "text-black border-b-2 border-black"
                                                : "text-black/40 hover:text-black/60 border-b-2 border-transparent"
                                            }
                                        `}
                                    >
                                        {p.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="h-4 w-[1px] bg-[#e3dacb]" />

                        {/* Role Filter */}
                        <div className="flex items-center gap-3">
                            <span className="text-[10px] font-bold uppercase text-black/30 tracking-tight">Role</span>
                            <div className="flex gap-1">
                                {["All", "CPO", "Family"].map((r) => (
                                    <button
                                        key={r}
                                        onClick={() => setRoleFilter(r === "All" ? null : r)}
                                        className={`
                                            px-3 py-1 text-[11px] font-medium transition-all
                                            ${(r === "All" ? !roleFilter : roleFilter === r)
                                                ? "text-black border-b-2 border-black"
                                                : "text-black/40 hover:text-black/60 border-b-2 border-transparent"
                                            }
                                        `}
                                    >
                                        {r}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="h-4 w-[1px] bg-[#e3dacb]" />

                        {/* Style Filter */}
                        <div className="flex items-center gap-3">
                            <span className="text-[10px] font-bold uppercase text-black/30 tracking-tight">Style</span>
                            <div className="flex gap-1">
                                {["All", "Common", "Niche"].map((s, idx) => (
                                    <button
                                        key={s}
                                        onClick={() => setStyleFilter(s === "All" ? null : idx - 1)}
                                        className={`
                                            px-3 py-1 text-[11px] font-medium transition-all
                                            ${(s === "All" ? styleFilter === null : styleFilter === idx - 1)
                                                ? "text-black border-b-2 border-black"
                                                : "text-black/40 hover:text-black/60 border-b-2 border-transparent"
                                            }
                                        `}
                                    >
                                        {s}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Bottom Tier: Fluid Gallery Grid */}
            <div className="flex-1 px-8 py-12">
                <div className="max-w-[1600px] mx-auto">
                    <AnimatePresence mode="popLayout">
                        <motion.div
                            layout
                            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-px bg-[#e3dacb] border border-[#e3dacb]"
                        >
                            {filteredCells.map((cell) => {
                                const cellResult = cellResults?.[cell.persona]?.[cell.stage];
                                const isMissing = !cellResult;
                                return (
                                    <GalleryTile
                                        key={`${cell.persona}-${cell.stage}`}
                                        persona={cell.persona}
                                        personaLabel={cell.personaLabel}
                                        stage={cell.stage}
                                        stageLabel={cell.stageLabel}
                                        intents={cell.intents}
                                        activeTab={activeTab}
                                        results={cellResult}
                                        responses={cellResult?.responses}
                                        citations={cellResult?.citations}
                                        brandDomain={brandDomain}
                                        onClick={() => onSelectCell(cell.persona, cell.stage)}
                                        accentColor={STAGE_COLORS[cell.stage] || "#1f3b2c"}
                                        isMissing={isMissing}
                                    />
                                );
                            })}
                        </motion.div>
                    </AnimatePresence>

                    {filteredCells.length === 0 && (
                        <div className="h-[400px] flex flex-col items-center justify-center text-black/20 gap-4">
                            <SlidersHorizontal className="w-12 h-12 stroke-[1px]" />
                            <p className="text-xl font-light">No tiles match your current research filters.</p>
                            <Button variant="link" onClick={() => { setPersonaFilter(null); setRoleFilter(null); setStyleFilter(null); }}>
                                Clear all filters
                            </Button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
