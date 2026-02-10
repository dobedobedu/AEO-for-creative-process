"use client";

import { motion } from "framer-motion";
import { Fragment } from "react";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { Zap, Eye, Filter } from "lucide-react";

interface MiniMatrixNavigationProps {
    personas: { id: string; label: string }[];
    stages: { id: string; label: string }[];
    selectedCell: { persona: string; stage: string } | null;
    onSelect: (persona: string, stage: string) => void;
    cellStatus?: Record<string, "empty" | "has-intents" | "has-queries">;
    // New Props for Actions & Filters
    onShowAll?: () => void;
    onGenerateAll?: () => void;
    roleFilter?: string | null;
    onRoleFilterChange?: (role: string | null) => void;
    styleFilter?: number | null;
    onStyleFilterChange?: (style: number | null) => void;
    variant?: "horizontal" | "sidebar";
}

export function MiniMatrixNavigation({
    personas,
    stages,
    selectedCell,
    onSelect,
    cellStatus = {},
    onShowAll,
    onGenerateAll,
    roleFilter,
    onRoleFilterChange,
    styleFilter,
    onStyleFilterChange,
    variant = "horizontal",
}: MiniMatrixNavigationProps) {
    if (variant === "sidebar") {
        return (
            <div className="w-full flex flex-col gap-6">
                <div className="grid gap-x-3 gap-y-3" style={{ gridTemplateColumns: `auto repeat(${stages.length}, 1fr)` }}>
                    {/* Header Row: Stage Initials */}
                    <div /> {/* Corner Spacer */}
                    {stages.map((stage) => (
                        <div key={stage.id} className="flex items-center justify-center">
                            <span className="text-[10px] font-black uppercase text-black/20">
                                {stage.id.charAt(0)}
                            </span>
                        </div>
                    ))}

                    {/* Persona Rows */}
                    {personas.map((persona) => (
                        <Fragment key={persona.id}>
                            {/* Row Header: Persona Initial */}
                            <div className="flex items-center justify-end pr-1">
                                <span className="text-[10px] font-black uppercase text-black/20">
                                    {persona.label.charAt(0)}
                                </span>
                            </div>

                            {/* Cells */}
                            {stages.map((stage) => {
                                const isSelected =
                                    selectedCell?.persona === persona.id &&
                                    selectedCell?.stage === stage.id;

                                const statusKey = `${persona.id}-${stage.id}`;
                                const status = cellStatus[statusKey] || "empty";

                                return (
                                    <button
                                        key={stage.id}
                                        onClick={() => onSelect(persona.id, stage.id)}
                                        className={`
                                            group relative w-6 h-6 rounded-full border transition-all flex items-center justify-center
                                            ${isSelected
                                                ? "bg-black border-black scale-110 z-10"
                                                : "bg-[#faf9f6] border-brand-secondary hover:border-black/40"
                                            }
                                        `}
                                    >
                                        <div
                                            className={`
                                                w-1.5 h-1.5 rounded-full transition-colors
                                                ${isSelected
                                                    ? "bg-white"
                                                    : status === "has-queries"
                                                        ? "bg-brand-primary"
                                                        : status === "has-intents"
                                                            ? "bg-[#b86f3a]"
                                                            : "bg-black/5"
                                                }
                                            `}
                                        />

                                        {/* Minimal Tooltip on Hover */}
                                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-black text-white text-[8px] font-bold uppercase rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 transition-opacity">
                                            {persona.label} · {stage.label}
                                        </div>
                                    </button>
                                );
                            })}
                        </Fragment>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="w-full bg-[#f6f1e8] border-b border-brand-secondary p-4 flex items-center justify-between gap-8">
            {/* Left Panel: Bulk Actions */}
            <div className="flex flex-col gap-2 min-w-[140px]">
                <h3 className="text-[10px] font-bold uppercase text-[#1e1b16]/40 tracking-widest pl-1">Actions</h3>
                <div className="flex flex-col gap-1.5">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={onShowAll}
                        className="h-8 justify-start gap-2 text-[11px] font-medium text-[#1e1b16]/70 hover:bg-white/50 hover:text-[#1e1b16]"
                    >
                        <Eye className="w-3.5 h-3.5" />
                        Show All
                    </Button>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={onGenerateAll}
                        className="h-8 justify-start gap-2 text-[11px] font-medium text-[#1e1b16]/70 hover:bg-white/50 hover:text-[#1e1b16]"
                    >
                        <Zap className="w-3.5 h-3.5" />
                        Generate All
                    </Button>
                </div>
            </div>

            {/* Center: Mini Matrix */}
            <div className="flex-1 flex justify-center overflow-x-auto py-1">
                <div className="grid gap-2" style={{ gridTemplateColumns: `auto repeat(${stages.length}, 1fr)` }}>
                    {/* Header Row */}
                    <div className="h-6" /> {/* Corner Spacer */}
                    {stages.map((stage) => (
                        <div key={stage.id} className="h-6 flex items-center justify-center min-w-[50px]">
                            <span className="text-[10px] font-bold uppercase text-[#1e1b16]/40 tracking-wider">
                                {stage.label}
                            </span>
                        </div>
                    ))}

                    {/* Persona Rows */}
                    {personas.map((persona) => (
                        <div key={persona.id} className="contents group">
                            {/* Row Header */}
                            <div className="flex items-center justify-end pr-3 h-8">
                                <span className="text-[11px] font-medium text-[#1e1b16]/60 whitespace-nowrap">
                                    {persona.label}
                                </span>
                            </div>

                            {/* Cells */}
                            {stages.map((stage) => {
                                const isSelected =
                                    selectedCell?.persona === persona.id &&
                                    selectedCell?.stage === stage.id;

                                const statusKey = `${persona.id}-${stage.id}`;
                                const status = cellStatus[statusKey] || "empty";

                                return (
                                    <TooltipProvider key={stage.id} delayDuration={0}>
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <motion.button
                                                    layoutId={`cell-${persona.id}-${stage.id}`}
                                                    onClick={() => onSelect(persona.id, stage.id)}
                                                    className={`
                                                        w-full h-8 rounded-lg border flex items-center justify-center transition-colors relative
                                                        ${isSelected
                                                            ? "bg-brand-primary border-brand-primary shadow-sm z-10"
                                                            : "bg-white border-brand-secondary hover:border-brand-primary/40 hover:bg-[#fffbf5]"
                                                        }
                                                    `}
                                                    whileHover={{ scale: 1.05 }}
                                                    whileTap={{ scale: 0.95 }}
                                                >
                                                    {/* Status Dot */}
                                                    <div
                                                        className={`
                                                            w-2 h-2 rounded-full transition-colors
                                                            ${isSelected
                                                                ? "bg-white"
                                                                : status === "has-queries"
                                                                    ? "bg-brand-primary"
                                                                    : status === "has-intents"
                                                                        ? "bg-[#b86f3a]"
                                                                        : "bg-brand-secondary"
                                                            }
                                                        `}
                                                    />
                                                </motion.button>
                                            </TooltipTrigger>
                                            <TooltipContent side="bottom" className="text-xs">
                                                <span className="font-semibold">{persona.label} × {stage.label}</span>
                                                <div className="text-white/60 text-[10px] mt-0.5">
                                                    {status === "has-queries" ? "Queries generated" : status === "has-intents" ? "Intents defined" : "Empty"}
                                                </div>
                                            </TooltipContent>
                                        </Tooltip>
                                    </TooltipProvider>
                                );
                            })}
                        </div>
                    ))}
                </div>
            </div>

            {/* Right Panel: Global Filters */}
            <div className="flex flex-col gap-3 min-w-[200px]">
                <h3 className="text-[10px] font-bold uppercase text-[#1e1b16]/40 tracking-widest flex items-center gap-1.5">
                    <Filter className="w-3 h-3" /> Filters
                </h3>

                <div className="space-y-2.5">
                    {/* Role Filter */}
                    <div className="flex flex-col gap-1">
                        <span className="text-[9px] font-bold text-[#1e1b16]/30 uppercase tracking-tight pl-0.5">Role</span>
                        <div className="flex bg-white/40 rounded-md p-0.5 border border-brand-secondary">
                            {["All", "CPO", "Family"].map((r) => (
                                <button
                                    key={r}
                                    onClick={() => onRoleFilterChange?.(r === "All" ? null : r)}
                                    className={`
                                        flex-1 text-[10px] py-1 px-2 rounded-sm transition-all
                                        ${(r === "All" ? !roleFilter : roleFilter === r)
                                            ? "bg-brand-primary text-white shadow-sm"
                                            : "text-[#1e1b16]/60 hover:bg-white/60"
                                        }
                                    `}
                                >
                                    {r}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Style Filter */}
                    <div className="flex flex-col gap-1">
                        <span className="text-[9px] font-bold text-[#1e1b16]/30 uppercase tracking-tight pl-0.5">Style</span>
                        <div className="flex bg-white/40 rounded-md p-0.5 border border-brand-secondary">
                            {["All", "Common", "Niche"].map((s, idx) => (
                                <button
                                    key={s}
                                    onClick={() => onStyleFilterChange?.(s === "All" ? null : idx)}
                                    className={`
                                        flex-1 text-[10px] py-1 px-2 rounded-sm transition-all
                                        ${(s === "All" ? styleFilter === null : styleFilter === idx)
                                            ? "bg-brand-primary text-white shadow-sm"
                                            : "text-[#1e1b16]/60 hover:bg-white/60"
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
    );
}
