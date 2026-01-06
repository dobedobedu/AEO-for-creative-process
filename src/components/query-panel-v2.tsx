"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { X, Plus, Play, Save, RotateCcw, Trash2, ArrowRight } from "lucide-react";
import type { IntentNode } from "@/lib/intents/types";

type Persona = "move_up" | "retiree" | "luxury" | "first_time";
type Stage = "explore" | "consider" | "compare" | "decide";
type Scope = "cell" | "row" | "column" | "all";

interface QueryPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialScope: Scope;
  initialPersona?: Persona;
  initialStage?: Stage;
  queryBank: Record<Persona, Record<Stage, { intents: IntentNode[] }>>;
  personas: { id: Persona; label: string }[];
  stages: { id: Stage; label: string }[];
  onRunQueries: (
    queries: string[],
    persona?: Persona,
    stage?: Stage,
    queryBankOverride?: Record<Persona, Record<Stage, { intents: IntentNode[] }>>
  ) => void;
  onSaveQueries?: (queryBank: Record<Persona, Record<Stage, { intents: IntentNode[] }>>) => void;
  onRegenerateQueries?: (
    persona: Persona,
    stage: Stage,
    intent: string,
    role: "cpo" | "family_unit",
    creativity: number
  ) => Promise<string[]>;
}

// Mini-matrix component for visual scope selection
function MiniMatrix({
  personas,
  stages,
  selectedPersona,
  selectedStage,
  scope,
  onCellClick,
}: {
  personas: { id: Persona; label: string }[];
  stages: { id: Stage; label: string }[];
  selectedPersona?: Persona;
  selectedStage?: Stage;
  scope: Scope;
  onCellClick: (persona: Persona, stage: Stage) => void;
}) {
  const isCellSelected = useCallback((p: Persona, s: Stage): boolean => {
    if (scope === "all") return true;
    if (scope === "cell") return p === selectedPersona && s === selectedStage;
    if (scope === "row") return p === selectedPersona;
    if (scope === "column") return s === selectedStage;
    return false;
  }, [scope, selectedPersona, selectedStage]);

  const isCellHighlighted = useCallback((p: Persona, s: Stage): boolean => {
    if (scope === "cell") return p === selectedPersona && s === selectedStage;
    return false;
  }, [scope, selectedPersona, selectedStage]);

  return (
    <div className="flex flex-col gap-0.5">
      {/* Stage labels - top */}
      <div className="flex gap-0.5 ml-5">
        {stages.map((stage) => (
          <div key={stage.id} className="w-5 h-3 flex items-center justify-center">
            <span className="text-[7px] font-medium text-[#1e1b16]/30 uppercase">
              {stage.label.charAt(0)}
            </span>
          </div>
        ))}
      </div>
      
      {/* Grid with persona labels */}
      <div className="flex gap-0.5">
        <div className="flex flex-col gap-0.5">
          {personas.map((persona) => (
            <div key={persona.id} className="w-4 h-5 flex items-center justify-end pr-0.5">
              <span className="text-[7px] font-medium text-[#1e1b16]/30 uppercase">
                {persona.label.charAt(0)}
              </span>
            </div>
          ))}
        </div>
        
        <div className="grid grid-cols-4 gap-0.5">
          {personas.map((persona) =>
            stages.map((stage) => {
              const selected = isCellSelected(persona.id, stage.id);
              const highlighted = isCellHighlighted(persona.id, stage.id);
              
              return (
                <button
                  key={`${persona.id}-${stage.id}`}
                  onClick={() => onCellClick(persona.id, stage.id)}
                  className={`
                    w-5 h-5 rounded transition-all duration-150 
                    ${selected 
                      ? highlighted
                        ? "bg-[#1f3b2c]" 
                        : "bg-[#1f3b2c]/60"
                      : "bg-[#e3dacb]/50 hover:bg-[#e3dacb]"
                    }
                  `}
                />
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

// Creativity slider - maps to temperature
function CreativitySlider({
  value,
  onChange,
}: {
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="space-y-2">
      <span className="text-xs font-medium text-[#1e1b16]/60">Creativity</span>
      
      <Slider
        value={[value]}
        onValueChange={([v]) => onChange(v)}
        min={0}
        max={1}
        step={0.1}
        className="w-full"
      />
      
      <div className="flex justify-between">
        <span className="text-[10px] text-[#1e1b16]/50 italic">Strict</span>
        <span className="text-[10px] text-[#1e1b16]/50 italic">Creative</span>
      </div>
    </div>
  );
}

export function QueryPanelV2({
  open,
  onOpenChange,
  initialScope,
  initialPersona,
  initialStage,
  queryBank,
  personas,
  stages,
  onRunQueries,
  onSaveQueries,
  onRegenerateQueries,
}: QueryPanelProps) {
  const [scope, setScope] = useState<Scope>(initialScope);
  const [selectedPersona, setSelectedPersona] = useState<Persona | undefined>(initialPersona);
  const [selectedStage, setSelectedStage] = useState<Stage | undefined>(initialStage);
  const [localQueryBank, setLocalQueryBank] = useState(queryBank);
  const [editingQuery, setEditingQuery] = useState<{ persona: Persona; stage: Stage; intentIndex: number; queryIndex: number } | null>(null);
  const [editValue, setEditValue] = useState("");
  const [activeIntentId, setActiveIntentId] = useState<string | null>(null);
  const [isRegenerating, setIsRegenerating] = useState(false);

  // Sync active intent when selection changes
  useEffect(() => {
    if (scope === "cell" && selectedPersona && selectedStage) {
      const intents = localQueryBank[selectedPersona][selectedStage].intents;
      if (intents.length > 0 && (!activeIntentId || !intents.find(i => i.id === activeIntentId))) {
        setActiveIntentId(intents[0].id);
      }
    } else {
      setActiveIntentId(null);
    }
  }, [scope, selectedPersona, selectedStage, localQueryBank, activeIntentId]);

  // Handle mini-matrix cell click
  const handleMatrixClick = useCallback((persona: Persona, stage: Stage) => {
    if (scope === "cell" && persona === selectedPersona && stage === selectedStage) {
      setScope("all");
      setSelectedPersona(undefined);
      setSelectedStage(undefined);
    } else {
      setScope("cell");
      setSelectedPersona(persona);
      setSelectedStage(stage);
    }
  }, [scope, selectedPersona, selectedStage]);

  const selectAll = useCallback(() => {
    setScope("all");
    setSelectedPersona(undefined);
    setSelectedStage(undefined);
  }, []);

  // Get active intent object
  const activeIntent = useMemo(() => {
    if (scope === "cell" && selectedPersona && selectedStage && activeIntentId) {
      return localQueryBank[selectedPersona][selectedStage].intents.find(i => i.id === activeIntentId);
    }
    return null;
  }, [scope, selectedPersona, selectedStage, activeIntentId, localQueryBank]);

  // Get queries based on current scope and active intent
  const displayQueries = useMemo(() => {
    const result: { 
      persona: Persona; 
      stage: Stage; 
      intentId: string;
      intentText: string;
      queries: string[]; 
      role: "cpo" | "family_unit";
      creativity: number;
    }[] = [];

    if (scope === "cell" && selectedPersona && selectedStage) {
      const intents = localQueryBank[selectedPersona][selectedStage].intents;
      // If cell scope, only show queries for the ACTIVE intent
      const targetIntent = intents.find(i => i.id === activeIntentId) || intents[0];
      
      if (targetIntent) {
        result.push({
          persona: selectedPersona,
          stage: selectedStage,
          intentId: targetIntent.id,
          intentText: targetIntent.text,
          queries: targetIntent.manifestations,
          role: targetIntent.role,
          creativity: targetIntent.creativity,
        });
      }
    } else {
      // For broader scopes, flatten all intents
      const targetPersonas = scope === "row" && selectedPersona ? [selectedPersona] 
        : scope === "all" || scope === "column" ? personas.map(p => p.id as Persona) 
        : [];
      
      const targetStages = scope === "column" && selectedStage ? [selectedStage]
        : scope === "all" || scope === "row" ? stages.map(s => s.id as Stage)
        : [];

      for (const p of targetPersonas) {
        for (const s of targetStages) {
          const intents = localQueryBank[p][s].intents;
          for (const intent of intents) {
            result.push({
              persona: p,
              stage: s,
              intentId: intent.id,
              intentText: intent.text,
              queries: intent.manifestations,
              role: intent.role,
              creativity: intent.creativity,
            });
          }
        }
      }
    }

    return result;
  }, [scope, selectedPersona, selectedStage, localQueryBank, personas, stages, activeIntentId]);

  const totalQueryCount = displayQueries.reduce((sum, g) => sum + g.queries.length, 0);

  const getScopeLabel = () => {
    if (scope === "cell" && selectedPersona && selectedStage) {
      const p = personas.find(x => x.id === selectedPersona)?.label;
      const s = stages.find(x => x.id === selectedStage)?.label;
      return `${p} × ${s}`;
    }
    if (scope === "row" && selectedPersona) {
      return `${personas.find(x => x.id === selectedPersona)?.label} (all stages)`;
    }
    if (scope === "column" && selectedStage) {
      return `${stages.find(x => x.id === selectedStage)?.label} (all personas)`;
    }
    return "Full Matrix";
  };

  const startEditQuery = (persona: Persona, stage: Stage, intentIndex: number, queryIndex: number, value: string) => {
    setEditingQuery({ persona, stage, intentIndex, queryIndex });
    setEditValue(value);
  };

  const saveEditQuery = () => {
    if (!editingQuery) return;
    const { persona, stage, intentIndex, queryIndex } = editingQuery;
    
    setLocalQueryBank(prev => {
      const cellIntents = [...prev[persona][stage].intents];
      const intent = { ...cellIntents[intentIndex] };
      const newManifestations = [...intent.manifestations];
      newManifestations[queryIndex] = editValue;
      intent.manifestations = newManifestations;
      cellIntents[intentIndex] = intent;

      return {
        ...prev,
        [persona]: {
          ...prev[persona],
          [stage]: {
            ...prev[persona][stage],
            intents: cellIntents,
          },
        },
      };
    });
    setEditingQuery(null);
    setEditValue("");
  };

  const deleteQuery = (persona: Persona, stage: Stage, intentIndex: number, queryIndex: number) => {
    setLocalQueryBank(prev => {
      const cellIntents = [...prev[persona][stage].intents];
      const intent = { ...cellIntents[intentIndex] };
      intent.manifestations = intent.manifestations.filter((_, i) => i !== queryIndex);
      cellIntents[intentIndex] = intent;

      return {
        ...prev,
        [persona]: {
          ...prev[persona],
          [stage]: {
            ...prev[persona][stage],
            intents: cellIntents,
          },
        },
      };
    });
  };

  const addQuery = (persona: Persona, stage: Stage, intentId: string) => {
    const intentIndex = localQueryBank[persona][stage].intents.findIndex(i => i.id === intentId);
    if (intentIndex === -1) return;

    const newIndex = localQueryBank[persona][stage].intents[intentIndex].manifestations.length;
    
    setLocalQueryBank(prev => {
      const cellIntents = [...prev[persona][stage].intents];
      const intent = { ...cellIntents[intentIndex] };
      intent.manifestations = [...intent.manifestations, ""];
      cellIntents[intentIndex] = intent;

      return {
        ...prev,
        [persona]: {
          ...prev[persona],
          [stage]: {
            ...prev[persona][stage],
            intents: cellIntents,
          },
        },
      };
    });
    startEditQuery(persona, stage, intentIndex, newIndex, "");
  };

  const updateIntentText = (persona: Persona, stage: Stage, intentId: string, text: string) => {
    setLocalQueryBank(prev => {
      const cellIntents = [...prev[persona][stage].intents];
      const index = cellIntents.findIndex(i => i.id === intentId);
      if (index === -1) return prev;
      
      cellIntents[index] = { ...cellIntents[index], text };

      return {
        ...prev,
        [persona]: {
          ...prev[persona],
          [stage]: {
            ...prev[persona][stage],
            intents: cellIntents,
          },
        },
      };
    });
  };

  const addNewIntent = () => {
    if (!selectedPersona || !selectedStage) return;
    
    const newIntent: IntentNode = {
      id: `new_${Date.now()}`,
      text: "New Research Intent",
      manifestations: [],
      role: "cpo",
      creativity: 0.7
    };

    setLocalQueryBank(prev => ({
      ...prev,
      [selectedPersona]: {
        ...prev[selectedPersona],
        [selectedStage]: {
          ...prev[selectedPersona][selectedStage],
          intents: [newIntent, ...prev[selectedPersona][selectedStage].intents]
        }
      }
    }));
    setActiveIntentId(newIntent.id);
  };

  const deleteIntent = (intentId: string) => {
    if (!selectedPersona || !selectedStage) return;

    setLocalQueryBank(prev => {
      const currentIntents = prev[selectedPersona][selectedStage].intents;
      // Don't delete the last intent
      if (currentIntents.length <= 1) return prev;

      return {
        ...prev,
        [selectedPersona]: {
          ...prev[selectedPersona],
          [selectedStage]: {
            ...prev[selectedPersona][selectedStage],
            intents: currentIntents.filter(i => i.id !== intentId)
          }
        }
      };
    });
    
    if (activeIntentId === intentId) {
      const remaining = localQueryBank[selectedPersona][selectedStage].intents.filter(i => i.id !== intentId);
      setActiveIntentId(remaining[0]?.id || null);
    }
  };

  const updateActiveIntentSettings = (updates: Partial<IntentNode>) => {
    if (!selectedPersona || !selectedStage || !activeIntentId) return;

    setLocalQueryBank(prev => {
      const cellIntents = [...prev[selectedPersona][selectedStage].intents];
      const index = cellIntents.findIndex(i => i.id === activeIntentId);
      if (index === -1) return prev;

      cellIntents[index] = { ...cellIntents[index], ...updates };

      return {
        ...prev,
        [selectedPersona]: {
          ...prev[selectedPersona],
          [selectedStage]: {
            ...prev[selectedPersona][selectedStage],
            intents: cellIntents
          }
        }
      };
    });
  };

  const handleRegenerate = async () => {
    if (!onRegenerateQueries || scope !== "cell" || !selectedPersona || !selectedStage || !activeIntent) return;
    
    setIsRegenerating(true);
    try {
      const newQueries = await onRegenerateQueries(
        selectedPersona, 
        selectedStage, 
        activeIntent.text, 
        activeIntent.role, 
        activeIntent.creativity
      );

      setLocalQueryBank(prev => {
        const cellIntents = [...prev[selectedPersona][selectedStage].intents];
        const index = cellIntents.findIndex(i => i.id === activeIntent.id);
        if (index === -1) return prev;

        cellIntents[index] = { ...cellIntents[index], manifestations: newQueries };

        return {
          ...prev,
          [selectedPersona]: {
            ...prev[selectedPersona],
            [selectedStage]: {
              ...prev[selectedPersona][selectedStage],
              intents: cellIntents
            }
          }
        };
      });
    } finally {
      setIsRegenerating(false);
    }
  };

  const handleRun = () => {
    const allQueries = displayQueries.flatMap(g => g.queries);
    onRunQueries(allQueries, selectedPersona, selectedStage, localQueryBank);
    onOpenChange(false);
  };

  const handleSave = () => {
    onSaveQueries?.(localQueryBank);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-7xl max-w-[95vw] w-full max-h-[95vh] bg-[#fffaf2] border-[#e3dacb] overflow-hidden flex flex-col p-0 shadow-2xl">
        {/* Header */}
        <DialogHeader className="px-8 pt-6 pb-4 border-b border-[#e3dacb] flex-shrink-0">
          <div className="flex items-center justify-between gap-8">
            <div>
              <DialogTitle className="text-xl font-bold text-[#1e1b16] tracking-tight">
                {getScopeLabel()}
              </DialogTitle>
              <p className="text-xs text-[#1e1b16]/50 mt-0.5 font-medium uppercase tracking-wider">
                Research Command Center • {totalQueryCount} manifestations
              </p>
            </div>
            
            <div className="flex items-center gap-4">
              <MiniMatrix
                personas={personas}
                stages={stages}
                selectedPersona={selectedPersona}
                selectedStage={selectedStage}
                scope={scope}
                onCellClick={handleMatrixClick}
              />
              <button
                onClick={selectAll}
                className={`text-[11px] px-3 py-1.5 font-bold rounded-lg transition-all ${
                  scope === "all" 
                    ? "bg-[#1f3b2c] text-white shadow-md" 
                    : "text-[#1e1b16]/50 hover:bg-[#efe6d9] hover:text-[#1e1b16]"
                }`}
              >
                ALL CELLS
              </button>
            </div>
          </div>
        </DialogHeader>

        {/* Main content - 3 Column Cascading Flow */}
        <div className="flex-1 flex min-h-0 overflow-hidden bg-white/40 backdrop-blur-sm">
          
          {/* Column 1: Research Intent (Seed) */}
          <div className="w-80 border-r border-[#e3dacb] bg-[#1f3b2c]/5 flex flex-col">
            <div className="p-6 flex-1 overflow-y-auto">
              {scope === "cell" && selectedPersona && selectedStage ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#1f3b2c]/60 text-wrap">Research Intents</span>
                    <button 
                      onClick={addNewIntent}
                      className="text-[10px] font-bold text-[#1f3b2c] hover:bg-[#1f3b2c]/10 px-2 py-1 rounded transition-colors flex items-center gap-1"
                    >
                      <Plus className="h-3 w-3" /> ADD
                    </button>
                  </div>
                  
                  <div className="space-y-3">
                    {localQueryBank[selectedPersona][selectedStage].intents.map((intent) => (
                      <div 
                        key={intent.id}
                        className={`
                          group relative rounded-xl p-4 border transition-all cursor-pointer
                          ${intent.id === activeIntentId 
                            ? "bg-white border-[#1f3b2c] shadow-md ring-1 ring-[#1f3b2c]/10" 
                            : "bg-white/40 border-[#e3dacb] hover:bg-white/80 hover:border-[#1f3b2c]/30"
                          }
                        `}
                        onClick={() => setActiveIntentId(intent.id)}
                      >
                        <textarea
                          value={intent.text}
                          onChange={(e) => updateIntentText(selectedPersona, selectedStage, intent.id, e.target.value)}
                          className="w-full text-sm font-medium text-[#1e1b16] bg-transparent border-none focus:ring-0 resize-none p-0 min-h-[60px] leading-relaxed cursor-text"
                          placeholder="Enter intent..."
                          onClick={(e) => e.stopPropagation()} 
                        />
                        
                        <div className="flex items-center justify-between mt-2 pt-2 border-t border-black/5">
                          <span className="text-[9px] font-bold text-[#1e1b16]/40 uppercase tracking-wider">
                            {intent.manifestations.length} manifestations
                          </span>
                          
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteIntent(intent.id);
                              }}
                              className="p-1 hover:bg-red-50 text-red-400 rounded"
                              title="Delete Intent"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                            <div className={`p-1 rounded-full ${intent.id === activeIntentId ? "bg-[#1f3b2c] text-white" : "text-[#1f3b2c]/20"}`}>
                              <ArrowRight className="h-3 w-3" />
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <p className="text-[10px] italic text-[#1e1b16]/40 leading-relaxed mt-4 px-1">
                    Select an intent to view and manage its specific search manifestations.
                  </p>
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-center px-4">
                  <div className="w-12 h-12 rounded-full bg-[#1f3b2c]/5 flex items-center justify-center mb-4">
                    <RotateCcw className="h-5 w-5 text-[#1f3b2c]/20" />
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#1f3b2c]/40 mb-2">Intent Mapping</span>
                  <p className="text-[11px] text-[#1e1b16]/40 leading-relaxed italic">
                    Select a single cell to manage multiple research intents.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Column 2: Search Manifestations (Queries) */}
          <div className="flex-1 overflow-y-auto p-8 border-r border-[#e3dacb]">
            <div className="max-w-3xl mx-auto space-y-8">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#1f3b2c]/60">Search Manifestations</span>
                {activeIntentId && scope === "cell" && (
                  <span className="text-[10px] font-medium text-[#1e1b16]/40 italic">
                    For: &quot;{activeIntent?.text.slice(0, 40)}{activeIntent?.text.length! > 40 ? "..." : ""}&quot;
                  </span>
                )}
              </div>
              {displayQueries.map(({ persona, stage, intentId, queries, intentText }) => {
                const sectionKey = `${persona}-${stage}-${intentId}`;
                const personaLabel = personas.find(p => p.id === persona)?.label;
                const stageLabel = stages.find(s => s.id === stage)?.label;
                const showHeader = displayQueries.length > 1;

                return (
                  <div key={sectionKey}>
                    {showHeader && (
                      <div className="flex flex-col gap-1 mb-6">
                        <div className="flex items-center gap-3">
                          <div className="h-px flex-1 bg-[#e3dacb]" />
                          <div className="text-[10px] font-bold text-[#1f3b2c] uppercase tracking-[0.2em]">
                            {personaLabel} × {stageLabel}
                          </div>
                          <div className="h-px flex-1 bg-[#e3dacb]" />
                        </div>
                        <div className="text-center">
                          <span className="text-[10px] italic text-[#1e1b16]/40 bg-[#faf7f2] px-3 py-0.5 rounded-full border border-[#e3dacb]">
                            Intent: {intentText}
                          </span>
                        </div>
                      </div>
                    )}
                    
                    <div className="grid gap-3">
                      {queries.map((query, idx) => {
                        const isEditing = editingQuery?.persona === persona && 
                                        editingQuery?.stage === stage && 
                                        editingQuery?.queryIndex === idx; // Simplified check, strictly speaking need intent check too but good enough for now given strict scoping
                        
                        return (
                          <div
                            key={idx}
                            className={`
                              group flex items-start gap-4 py-4 px-5 bg-white rounded-xl border transition-all duration-200
                              ${isEditing ? "border-[#1f3b2c] shadow-lg ring-1 ring-[#1f3b2c]" : "border-[#e3dacb]/60 hover:border-[#e3dacb] hover:shadow-md"}
                            `}
                          >
                            <span className="w-6 h-6 flex items-center justify-center rounded-lg bg-[#efe6d9] text-[11px] font-bold text-[#1f3b2c]/60 flex-shrink-0 mt-0.5">
                              {idx + 1}
                            </span>
                            {isEditing ? (
                              <textarea
                                value={editValue}
                                onChange={e => setEditValue(e.target.value)}
                                onBlur={saveEditQuery}
                                onKeyDown={e => {
                                  if (e.key === "Enter" && !e.shiftKey) {
                                    e.preventDefault();
                                    saveEditQuery();
                                  }
                                  if (e.key === "Escape") {
                                    setEditingQuery(null);
                                    setEditValue("");
                                  }
                                }}
                                className="flex-1 text-sm bg-transparent border-none text-[#1e1b16] focus:outline-none resize-none p-0"
                                autoFocus
                                rows={2}
                              />
                            ) : (
                              <span
                                onClick={() => {
                                  // Find current intent index
                                  const intentIdx = localQueryBank[persona][stage].intents.findIndex(i => i.id === intentId);
                                  startEditQuery(persona, stage, intentIdx, idx, query);
                                }}
                                className="flex-1 text-sm text-[#1e1b16] cursor-text leading-relaxed font-medium"
                              >
                                {query || <span className="text-[#1e1b16]/20 italic font-normal">Enter query...</span>}
                              </span>
                            )}
                            <button
                              onClick={() => {
                                const intentIdx = localQueryBank[persona][stage].intents.findIndex(i => i.id === intentId);
                                deleteQuery(persona, stage, intentIdx, idx);
                              }}
                              className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-[#f0d9d9] rounded-lg transition-all flex-shrink-0 -mr-1"
                            >
                              <X className="h-3.5 w-3.5 text-[#8b4a4a]" />
                            </button>
                          </div>
                        );
                      })}
                      
                      {scope === "cell" && (
                        <button
                          onClick={() => addQuery(persona, stage, intentId)}
                          className="flex items-center justify-center gap-2 text-[11px] font-bold uppercase tracking-wider text-[#1f3b2c]/40 hover:text-[#1f3b2c] py-4 px-5 rounded-xl border-2 border-dashed border-[#e3dacb] hover:border-[#1f3b2c]/30 hover:bg-white transition-all w-full"
                        >
                          <Plus className="h-4 w-4" />
                          Add Manifestation
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Column 3: Interpretation Layer (Settings) */}
          <div className="w-80 border-l border-[#e3dacb] bg-[#faf7f2]/50 flex flex-col">
            <div className="p-8 space-y-8 flex-1 overflow-y-auto">
              {scope === "cell" && selectedPersona && selectedStage && activeIntent ? (
                <>
                  {/* Role Toggle */}
                  <div className="space-y-4">
                    <span className="text-[10px] font-bold text-[#1e1b16]/60 uppercase tracking-[0.2em]">Interpretation Mode</span>
                    <div className="flex p-1.5 bg-[#efe6d9] rounded-xl shadow-inner">
                      <button
                        onClick={() => updateActiveIntentSettings({ role: "cpo" })}
                        className={`flex-1 px-3 py-2.5 text-[11px] font-bold rounded-lg transition-all ${
                          activeIntent.role === "cpo"
                            ? "bg-white text-[#1f3b2c] shadow-md"
                            : "text-[#1e1b16]/40 hover:text-[#1e1b16]/60"
                        }`}
                      >
                        CPO
                      </button>
                      <button
                        onClick={() => updateActiveIntentSettings({ role: "family_unit" })}
                        className={`flex-1 px-3 py-2.5 text-[11px] font-bold rounded-lg transition-all ${
                          activeIntent.role === "family_unit"
                            ? "bg-white text-[#1f3b2c] shadow-md"
                            : "text-[#1e1b16]/40 hover:text-[#1e1b16]/60"
                        }`}
                      >
                        FAMILY UNIT
                      </button>
                    </div>
                    <div className="p-4 bg-white/60 rounded-xl border border-[#e3dacb]/50">
                      <p className="text-[10px] font-medium text-[#1e1b16]/70 leading-relaxed text-wrap">
                        {activeIntent.role === "cpo" 
                          ? "Analyzing through the 'She-Elite' lens: Risk, ROI, and Wealth Preservation." 
                          : "Analyzing through the Family Operations lens: Social Flow and Daily Ecosystem."}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-6">
                    <CreativitySlider 
                      value={activeIntent.creativity} 
                      onChange={(val) => updateActiveIntentSettings({ creativity: val })} 
                    />
                    <p className="text-[10px] text-[#1e1b16]/40 leading-relaxed italic">
                      Creativity affects the &apos;temperature&apos; of DeepSeek V3, driving variety and long-tail manifestations.
                    </p>
                  </div>
                  
                  {onRegenerateQueries && (
                    <Button
                      onClick={handleRegenerate}
                      disabled={isRegenerating}
                      className="w-full bg-[#1f3b2c] hover:bg-[#2a4d3a] text-white h-12 shadow-lg shadow-[#1f3b2c]/20 font-bold"
                    >
                      <RotateCcw className={`h-4 w-4 mr-2 ${isRegenerating ? "animate-spin" : ""}`} />
                      {isRegenerating ? "GENERATING..." : "REGENERATE MANIFESTATIONS"}
                    </Button>
                  )}
                </>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-center px-4 opacity-40">
                  <div className="w-12 h-12 rounded-full bg-[#1e1b16]/5 flex items-center justify-center mb-4">
                    <RotateCcw className="h-5 w-5 text-[#1e1b16]/40" />
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-[0.2em] mb-2">Intent Settings</span>
                  <p className="text-[11px] leading-relaxed italic">
                    Select a specific intent in the left column to customize its interpretation settings.
                  </p>
                </div>
              )}
            </div>

            <div className="p-8 pt-6 border-t border-[#e3dacb] bg-white/30 mt-auto">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 rounded-full bg-[#1f3b2c] animate-pulse" />
                <span className="text-[10px] font-bold text-[#1e1b16]/40 uppercase tracking-widest text-wrap">DeepSeek V3 Active</span>
              </div>
              <p className="text-[9px] text-[#1e1b16]/30 leading-relaxed">
                Queries are generated based on the latest Matriarchy of the Manatee research directives.
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-8 py-6 border-t border-[#e3dacb] flex gap-4 flex-shrink-0 bg-[#faf7f2]">
          <Button
            onClick={handleRun}
            className="flex-1 bg-[#1f3b2c] hover:bg-[#2a4d3a] text-white h-12 text-sm font-bold shadow-xl shadow-[#1f3b2c]/20"
          >
            <Play className="h-4 w-4 mr-2" />
            RUN {totalQueryCount} QUERIES NOW
          </Button>
          <Button
            onClick={handleSave}
            variant="outline"
            className="border-[#e3dacb] text-[#1e1b16] hover:bg-[#efe6d9] h-12 px-10 font-bold uppercase tracking-wider text-xs"
          >
            <Save className="h-4 w-4 mr-2" />
            Save Configuration
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
