"use client";

import { useState } from "react";
import { Persona, Stage, Role } from "./types";
import { IntentNode } from "@/lib/intents/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, Plus, Trash2, Loader2 } from "lucide-react";

interface QueryEditorPanelProps {
    persona: Persona;
    stage: Stage;
    intents: IntentNode[];
    queries: Record<string, string[]>; // intentId -> queries
    onQueryChange: (intentId: string, queryIndex: number, text: string) => void;
    onQueryDelete: (intentId: string, queryIndex: number) => void;
    onQueryAdd: (intentId: string) => void;
    onQueryRegenerate?: (intentId: string) => Promise<string[]>;
}

const ROLE_LABELS: Record<Role, string> = {
    cpo: "CPO",
    family_unit: "Family Unit",
};

export function QueryEditorPanel({
    intents,
    queries,
    onQueryChange,
    onQueryDelete,
    onQueryAdd,
    onQueryRegenerate,
}: QueryEditorPanelProps) {
    const [editingLoc, setEditingLoc] = useState<{ intentId: string; index: number } | null>(null);
    const [editText, setEditText] = useState("");
    const [regeneratingId, setRegeneratingId] = useState<string | null>(null);

    const startEdit = (intentId: string, index: number, text: string) => {
        setEditingLoc({ intentId, index });
        setEditText(text);
    };

    const saveEdit = () => {
        if (editingLoc) {
            onQueryChange(editingLoc.intentId, editingLoc.index, editText);
            setEditingLoc(null);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            saveEdit();
        }
        if (e.key === "Escape") {
            setEditingLoc(null);
        }
    };

    const handleRegenerate = async (intentId: string) => {
        if (onQueryRegenerate) {
            setRegeneratingId(intentId);
            try {
                await onQueryRegenerate(intentId);
            } finally {
                setRegeneratingId(null);
            }
        }
    };

    return (
        <div className="h-full flex flex-col bg-[#fffaf2]">
            {/* Header */}
            <div className="px-8 py-6 border-b border-brand-secondary bg-white/50 backdrop-blur-sm sticky top-0 z-10">
                <h2 className="text-xl font-semibold text-[#1e1b16] tracking-tight">Buyer Might Ask</h2>
                <p className="text-sm text-[#1e1b16]/60 mt-1">
                    Specific queries the persona uses to find answers.
                </p>
            </div>

            <div className="flex-1 overflow-y-auto p-8 space-y-8">
                {intents.length === 0 ? (
                    <div className="text-center py-20 bg-white/40 rounded-xl border-2 border-dashed border-brand-secondary">
                        <p className="text-[#1e1b16]/60 font-medium text-lg">No intents defined.</p>
                        <p className="text-sm text-[#1e1b16]/40 mt-1">
                            Switch to the Intents tab to define research goals first.
                        </p>
                    </div>
                ) : (
                    intents.map((intent) => {
                        const intentQueries = queries[intent.id] || [];
                        const isRegenerating = regeneratingId === intent.id;

                        return (
                            <div key={intent.id} className="bg-white border border-brand-secondary rounded-xl shadow-sm overflow-hidden">
                                {/* Intent Header */}
                                <div className="px-5 py-4 bg-[#f6f1e8]/50 border-b border-brand-secondary flex items-start justify-between gap-4">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-2">
                                            <Badge
                                                className={`text-[9px] uppercase font-bold tracking-wider px-2 py-0.5 border-none shadow-none ${intent.role === "cpo"
                                                        ? "bg-brand-primary/10 text-brand-primary"
                                                        : "bg-[#6e7c5b]/10 text-[#6e7c5b]"
                                                    }`}
                                            >
                                                {ROLE_LABELS[intent.role as Role]}
                                            </Badge>
                                        </div>
                                        <p className="text-sm font-medium text-[#1e1b16] leading-relaxed">
                                            {intent.text}
                                        </p>
                                    </div>

                                    {onQueryRegenerate && (
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => handleRegenerate(intent.id)}
                                            disabled={isRegenerating}
                                            className="border-[#b86f3a] text-[#b86f3a] hover:bg-[#b86f3a]/10 h-8 text-xs disabled:opacity-50"
                                        >
                                            {isRegenerating ? (
                                                <>
                                                    <Loader2 className="h-3 w-3 mr-2 animate-spin" />
                                                    Generating...
                                                </>
                                            ) : (
                                                <>
                                                    <RefreshCw className="h-3 w-3 mr-2" />
                                                    Auto-Generate
                                                </>
                                            )}
                                        </Button>
                                    )}
                                </div>

                                {/* Queries List */}
                                <div className="p-2 space-y-1">
                                    {intentQueries.length === 0 ? (
                                        <div className="text-center py-8">
                                            <p className="text-xs text-[#1e1b16]/40 italic">No queries yet.</p>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => onQueryAdd(intent.id)}
                                                className="mt-2 text-brand-primary hover:bg-brand-primary/5 h-8 text-xs uppercase tracking-wide font-bold"
                                            >
                                                <Plus className="h-3 w-3 mr-1" /> Add Manually
                                            </Button>
                                        </div>
                                    ) : (
                                        <>
                                            {intentQueries.map((query, idx) => {
                                                const isEditing = editingLoc?.intentId === intent.id && editingLoc?.index === idx;

                                                return (
                                                    <div
                                                        key={idx}
                                                        className={`group flex items-start gap-3 p-3 rounded-lg transition-all ${isEditing ? "bg-white shadow-md ring-1 ring-brand-primary" : "hover:bg-[#f6f1e8]"
                                                            }`}
                                                    >
                                                        <span className="text-[10px] font-bold text-[#1e1b16]/30 mt-1.5 w-4 text-right flex-shrink-0">
                                                            {idx + 1}.
                                                        </span>

                                                        {isEditing ? (
                                                            <div className="flex-1 min-w-0">
                                                                <textarea
                                                                    value={editText}
                                                                    onChange={(e) => setEditText(e.target.value)}
                                                                    className="w-full text-sm text-[#1e1b16] bg-transparent border-none focus:outline-none focus:ring-0 resize-none p-0 leading-relaxed"
                                                                    rows={2}
                                                                    autoFocus
                                                                    onBlur={saveEdit}
                                                                    onKeyDown={handleKeyDown}
                                                                />
                                                                <div className="flex items-center gap-2 mt-2">
                                                                    <span className="text-[10px] text-[#1e1b16]/40">Press Enter to save</span>
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <div
                                                                className="flex-1 min-w-0 text-sm text-[#1e1b16] leading-relaxed cursor-text"
                                                                onClick={() => startEdit(intent.id, idx, query)}
                                                            >
                                                                {query || <span className="text-[#1e1b16]/20 italic">Empty query... tap to edit</span>}
                                                            </div>
                                                        )}

                                                        <Button
                                                            size="sm"
                                                            variant="ghost"
                                                            onClick={() => onQueryDelete(intent.id, idx)}
                                                            className="h-6 w-6 p-0 text-[#1e1b16]/20 hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-opacity"
                                                        >
                                                            <Trash2 className="h-3 w-3" />
                                                        </Button>
                                                    </div>
                                                );
                                            })}
                                        </>
                                    )}
                                </div>

                                {/* Footer Add Button */}
                                {intentQueries.length > 0 && (
                                    <div className="p-2 border-t border-brand-secondary/50">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => onQueryAdd(intent.id)}
                                            className="w-full text-[#1e1b16]/40 hover:text-brand-primary hover:bg-brand-primary/5 h-8 text-xs uppercase tracking-wide font-bold"
                                        >
                                            <Plus className="h-3 w-3 mr-1" /> Add Query
                                        </Button>
                                    </div>
                                )}
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
}
