"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Trash2, Plus, Loader2, RefreshCw } from "lucide-react";
import type { IntentLibrary, Intent, Persona, Stage, IntentNode } from "@/lib/intents/types";

type QueryBank = Record<Persona, Record<Stage, { intents: IntentNode[] }>>;

interface IntentLibraryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  intentLibrary: IntentLibrary;
  queryBank: QueryBank;
  onSave: (library: IntentLibrary) => Promise<void>;
  onRegenerateQueries?: (persona: Persona, stage: Stage, intentId: string) => Promise<string[]>;
}

const PERSONAS: { id: Persona; label: string }[] = [
  { id: "move_up", label: "Move-Up" },
  { id: "retiree", label: "Retiree" },
  { id: "luxury", label: "Luxury" },
  { id: "first_time", label: "First-Time" },
];

const STAGES: { id: Stage; label: string; color: string }[] = [
  { id: "explore", label: "Explore", color: "bg-blue-100 text-blue-700" },
  { id: "consider", label: "Consider", color: "bg-amber-100 text-amber-700" },
  { id: "compare", label: "Compare", color: "bg-purple-100 text-purple-700" },
  { id: "decide", label: "Decide", color: "bg-green-100 text-green-700" },
];

function generateTempId(persona: Persona, stage: Stage): string {
  return `int_${persona}_${stage}_${Date.now().toString(36)}`;
}

// Inline editable cell component
function EditableCell({
  value,
  onSave,
  placeholder = "Click to edit...",
  className = "",
}: {
  value: string;
  onSave: (value: string) => void;
  placeholder?: string;
  className?: string;
}) {
  const [localValue, setLocalValue] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  const handleBlur = () => {
    if (localValue.trim() !== value) {
      onSave(localValue.trim());
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      inputRef.current?.blur();
    }
    if (e.key === "Escape") {
      setLocalValue(value);
      inputRef.current?.blur();
    }
  };

  return (
    <input
      ref={inputRef}
      type="text"
      value={localValue}
      onChange={(e) => setLocalValue(e.target.value)}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      placeholder={placeholder}
      className={`w-full bg-transparent border-0 outline-none focus:bg-white focus:ring-1 focus:ring-[#6e7c5b] rounded px-2 py-1 text-sm ${className}`}
    />
  );
}

export function IntentLibraryModal({
  open,
  onOpenChange,
  intentLibrary,
  queryBank,
  onSave,
  onRegenerateQueries,
}: IntentLibraryModalProps) {
  const [activeTab, setActiveTab] = useState<"intents" | "queries">("intents");
  const [saving, setSaving] = useState(false);
  const [regeneratingIntent, setRegeneratingIntent] = useState<string | null>(null);
  const [localQueries, setLocalQueries] = useState<Record<string, string[]>>({});
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize local queries from queryBank
  useEffect(() => {
    const queries: Record<string, string[]> = {};
    for (const persona of PERSONAS) {
      for (const stage of STAGES) {
        const intents = queryBank[persona.id]?.[stage.id]?.intents || [];
        for (const intent of intents) {
          if (intent.generatedQueries) {
            queries[intent.id] = intent.generatedQueries;
          }
        }
      }
    }
    setLocalQueries(queries);
  }, [queryBank, open]);

  // Auto-save with debounce
  const autoSave = useCallback(
    async (updatedIntents: Intent[]) => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }

      saveTimeoutRef.current = setTimeout(async () => {
        setSaving(true);
        try {
          const updatedLibrary: IntentLibrary = {
            ...intentLibrary,
            version: intentLibrary.version + 1,
            updatedAt: new Date().toISOString(),
            intents: updatedIntents,
          };
          await onSave(updatedLibrary);
        } catch (error) {
          console.error("Auto-save failed:", error);
        } finally {
          setSaving(false);
        }
      }, 500);
    },
    [intentLibrary, onSave]
  );

  const updateIntent = (intentId: string, updates: Partial<Intent>) => {
    const updatedIntents = intentLibrary.intents.map((intent) =>
      intent.id === intentId ? { ...intent, ...updates } : intent
    );
    autoSave(updatedIntents);
  };

  const addIntent = (persona: Persona, stage: Stage) => {
    const newIntent: Intent = {
      id: generateTempId(persona, stage),
      persona,
      stage,
      text: "",
      role: "cpo",
      queryStyle: 0.75,
      createdAt: new Date().toISOString(),
      active: true,
    };
    const updatedIntents = [...intentLibrary.intents, newIntent];
    autoSave(updatedIntents);
  };

  const deleteIntent = (intentId: string) => {
    const updatedIntents = intentLibrary.intents.map((intent) =>
      intent.id === intentId ? { ...intent, active: false } : intent
    );
    autoSave(updatedIntents);
  };

  const handleRegenerateQueries = async (persona: Persona, stage: Stage, intentId: string) => {
    if (!onRegenerateQueries) return;

    setRegeneratingIntent(intentId);
    try {
      const queries = await onRegenerateQueries(persona, stage, intentId);
      setLocalQueries((prev) => ({ ...prev, [intentId]: queries }));
    } catch (error) {
      console.error("Failed to regenerate queries:", error);
    } finally {
      setRegeneratingIntent(null);
    }
  };

  // Get intents for a cell
  const getIntentsForCell = (persona: Persona, stage: Stage) => {
    return intentLibrary.intents.filter(
      (i) => i.persona === persona && i.stage === stage && i.active
    );
  };

  const totalIntents = intentLibrary.intents.filter((i) => i.active).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-[95vw] h-[90vh] max-h-[90vh] overflow-hidden flex flex-col p-0">
        <DialogHeader className="flex-shrink-0 px-6 pt-6 pb-4 border-b">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-lg font-semibold">Library</DialogTitle>
            <div className="flex items-center gap-3">
              {saving && (
                <div className="flex items-center gap-1 text-xs text-[#1e1b16]/50">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Saving...
                </div>
              )}
              <Badge variant="secondary" className="text-xs">
                {totalIntents} intents
              </Badge>
              <Badge variant="outline" className="text-xs">
                v{intentLibrary.version}
              </Badge>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 mt-4">
            <button
              onClick={() => setActiveTab("intents")}
              className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
                activeTab === "intents"
                  ? "bg-white border border-b-0 border-[#e3dacb] text-[#1e1b16]"
                  : "text-[#1e1b16]/60 hover:text-[#1e1b16] hover:bg-[#f6f1e8]"
              }`}
            >
              Intents
            </button>
            <button
              onClick={() => setActiveTab("queries")}
              className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
                activeTab === "queries"
                  ? "bg-white border border-b-0 border-[#e3dacb] text-[#1e1b16]"
                  : "text-[#1e1b16]/60 hover:text-[#1e1b16] hover:bg-[#f6f1e8]"
              }`}
            >
              Queries
            </button>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-auto bg-white">
          {activeTab === "intents" ? (
            /* Intents Tab - Spreadsheet View */
            <div className="min-w-max">
              {/* Header Row */}
              <div className="grid grid-cols-[140px_1fr_100px_80px_40px] gap-0 bg-[#f6f1e8] border-b border-[#e3dacb] sticky top-0 z-10">
                <div className="px-3 py-2 text-xs font-semibold text-[#1e1b16]/70 border-r border-[#e3dacb]">
                  Persona / Stage
                </div>
                <div className="px-3 py-2 text-xs font-semibold text-[#1e1b16]/70 border-r border-[#e3dacb]">
                  Intent Text
                </div>
                <div className="px-3 py-2 text-xs font-semibold text-[#1e1b16]/70 border-r border-[#e3dacb]">
                  Role
                </div>
                <div className="px-3 py-2 text-xs font-semibold text-[#1e1b16]/70 border-r border-[#e3dacb]">
                  Style
                </div>
                <div className="px-3 py-2 text-xs font-semibold text-[#1e1b16]/70"></div>
              </div>

              {/* Data Rows */}
              {PERSONAS.map((persona) =>
                STAGES.map((stage) => {
                  const intents = getIntentsForCell(persona.id, stage.id);
                  const cellKey = `${persona.id}_${stage.id}`;

                  return (
                    <div key={cellKey}>
                      {/* Cell Header */}
                      <div className="grid grid-cols-[140px_1fr_100px_80px_40px] gap-0 bg-[#faf8f5] border-b border-[#e3dacb]">
                        <div className="px-3 py-2 border-r border-[#e3dacb] flex items-center gap-2">
                          <span className="text-xs font-medium text-[#1e1b16]">
                            {persona.label}
                          </span>
                          <Badge className={`text-[10px] ${stage.color}`}>
                            {stage.label}
                          </Badge>
                        </div>
                        <div className="col-span-3 border-r border-[#e3dacb]" />
                        <div className="flex items-center justify-center">
                          <button
                            onClick={() => addIntent(persona.id, stage.id)}
                            className="p-1 rounded hover:bg-[#e3dacb] text-[#1e1b16]/50 hover:text-[#1e1b16]"
                            title="Add intent"
                          >
                            <Plus className="h-4 w-4" />
                          </button>
                        </div>
                      </div>

                      {/* Intent Rows */}
                      {intents.length === 0 ? (
                        <div className="grid grid-cols-[140px_1fr_100px_80px_40px] gap-0 border-b border-[#e3dacb]/50">
                          <div className="border-r border-[#e3dacb]/50" />
                          <div className="px-3 py-2 text-xs text-[#1e1b16]/30 italic border-r border-[#e3dacb]/50">
                            No intents - click + to add
                          </div>
                          <div className="border-r border-[#e3dacb]/50" />
                          <div className="border-r border-[#e3dacb]/50" />
                          <div />
                        </div>
                      ) : (
                        intents.map((intent) => (
                          <div
                            key={intent.id}
                            className="grid grid-cols-[140px_1fr_100px_80px_40px] gap-0 border-b border-[#e3dacb]/50 hover:bg-[#fffaf2]"
                          >
                            <div className="border-r border-[#e3dacb]/50" />
                            <div className="border-r border-[#e3dacb]/50">
                              <EditableCell
                                value={intent.text}
                                onSave={(text) => updateIntent(intent.id, { text })}
                                placeholder="Enter intent..."
                              />
                            </div>
                            <div className="border-r border-[#e3dacb]/50 flex items-center px-1">
                              <select
                                value={intent.role}
                                onChange={(e) =>
                                  updateIntent(intent.id, {
                                    role: e.target.value as "cpo" | "family_unit",
                                  })
                                }
                                className="w-full bg-transparent border-0 outline-none text-xs py-1 px-1 rounded focus:ring-1 focus:ring-[#6e7c5b]"
                              >
                                <option value="cpo">CPO</option>
                                <option value="family_unit">Family</option>
                              </select>
                            </div>
                            <div className="border-r border-[#e3dacb]/50 flex items-center px-1">
                              <input
                                type="number"
                                min="0.5"
                                max="1"
                                step="0.05"
                                value={intent.queryStyle}
                                onChange={(e) =>
                                  updateIntent(intent.id, {
                                    queryStyle: parseFloat(e.target.value),
                                  })
                                }
                                className="w-full bg-transparent border-0 outline-none text-xs py-1 px-1 rounded focus:ring-1 focus:ring-[#6e7c5b]"
                              />
                            </div>
                            <div className="flex items-center justify-center">
                              <button
                                onClick={() => deleteIntent(intent.id)}
                                className="p-1 rounded hover:bg-red-50 text-[#1e1b16]/30 hover:text-red-500"
                                title="Delete intent"
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  );
                })
              )}
            </div>
          ) : (
            /* Queries Tab - Spreadsheet View */
            <div className="min-w-max">
              {/* Header Row */}
              <div className="grid grid-cols-[140px_200px_1fr_40px] gap-0 bg-[#f6f1e8] border-b border-[#e3dacb] sticky top-0 z-10">
                <div className="px-3 py-2 text-xs font-semibold text-[#1e1b16]/70 border-r border-[#e3dacb]">
                  Persona / Stage
                </div>
                <div className="px-3 py-2 text-xs font-semibold text-[#1e1b16]/70 border-r border-[#e3dacb]">
                  Intent
                </div>
                <div className="px-3 py-2 text-xs font-semibold text-[#1e1b16]/70 border-r border-[#e3dacb]">
                  Generated Queries
                </div>
                <div className="px-3 py-2 text-xs font-semibold text-[#1e1b16]/70"></div>
              </div>

              {/* Data Rows */}
              {PERSONAS.map((persona) =>
                STAGES.map((stage) => {
                  const intents = getIntentsForCell(persona.id, stage.id);
                  const cellKey = `${persona.id}_${stage.id}`;

                  if (intents.length === 0) {
                    return (
                      <div
                        key={cellKey}
                        className="grid grid-cols-[140px_200px_1fr_40px] gap-0 border-b border-[#e3dacb]/50"
                      >
                        <div className="px-3 py-2 border-r border-[#e3dacb]/50 flex items-center gap-2">
                          <span className="text-xs font-medium text-[#1e1b16]">
                            {persona.label}
                          </span>
                          <Badge className={`text-[10px] ${stage.color}`}>
                            {stage.label}
                          </Badge>
                        </div>
                        <div className="px-3 py-2 text-xs text-[#1e1b16]/30 italic border-r border-[#e3dacb]/50">
                          No intents
                        </div>
                        <div className="border-r border-[#e3dacb]/50" />
                        <div />
                      </div>
                    );
                  }

                  return intents.map((intent, idx) => {
                    const queries = localQueries[intent.id] || [];
                    const isRegenerating = regeneratingIntent === intent.id;

                    return (
                      <div
                        key={intent.id}
                        className="grid grid-cols-[140px_200px_1fr_40px] gap-0 border-b border-[#e3dacb]/50 hover:bg-[#fffaf2]"
                      >
                        <div className="px-3 py-2 border-r border-[#e3dacb]/50">
                          {idx === 0 && (
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-medium text-[#1e1b16]">
                                {persona.label}
                              </span>
                              <Badge className={`text-[10px] ${stage.color}`}>
                                {stage.label}
                              </Badge>
                            </div>
                          )}
                        </div>
                        <div className="px-3 py-2 border-r border-[#e3dacb]/50">
                          <span className="text-xs text-[#1e1b16] line-clamp-2">
                            {intent.text || <span className="italic text-[#1e1b16]/30">Empty intent</span>}
                          </span>
                        </div>
                        <div className="px-3 py-2 border-r border-[#e3dacb]/50">
                          {isRegenerating ? (
                            <div className="flex items-center gap-2 text-xs text-[#1e1b16]/50">
                              <Loader2 className="h-3 w-3 animate-spin" />
                              Generating...
                            </div>
                          ) : queries.length > 0 ? (
                            <div className="space-y-1">
                              {queries.map((query, qIdx) => (
                                <div
                                  key={qIdx}
                                  className="text-xs text-[#1e1b16]/80 bg-[#f6f1e8] rounded px-2 py-1"
                                >
                                  {query}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <span className="text-xs text-[#1e1b16]/30 italic">
                              No queries generated
                            </span>
                          )}
                        </div>
                        <div className="flex items-start justify-center pt-2">
                          {onRegenerateQueries && intent.text && (
                            <button
                              onClick={() =>
                                handleRegenerateQueries(persona.id, stage.id, intent.id)
                              }
                              disabled={isRegenerating}
                              className="p-1 rounded hover:bg-[#e3dacb] text-[#1e1b16]/50 hover:text-[#1e1b16] disabled:opacity-30"
                              title="Regenerate queries"
                            >
                              <RefreshCw className={`h-3 w-3 ${isRegenerating ? "animate-spin" : ""}`} />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  });
                })
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
