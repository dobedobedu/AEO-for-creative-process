"use client";

import { useState, useMemo, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { X, Plus, Play, Save, RotateCcw } from "lucide-react";

type Persona = "move_up" | "retiree" | "luxury" | "first_time";
type Stage = "explore" | "consider" | "compare" | "decide";
type Scope = "cell" | "row" | "column" | "all";

interface QueryPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialScope: Scope;
  initialPersona?: Persona;
  initialStage?: Stage;
  queryBank: Record<Persona, Record<Stage, { queries: string[]; intentText: string }>>;
  personas: { id: Persona; label: string }[];
  stages: { id: Stage; label: string }[];
  onRunQueries: (
    queries: string[],
    persona?: Persona,
    stage?: Stage,
    queryBankOverride?: Record<Persona, Record<Stage, { queries: string[]; intentText: string }>>
  ) => void;
  onSaveQueries?: (queryBank: Record<Persona, Record<Stage, { queries: string[]; intentText: string }>>) => void;
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
  const [editingQuery, setEditingQuery] = useState<{ persona: Persona; stage: Stage; index: number } | null>(null);
  const [editValue, setEditValue] = useState("");
  const [role, setRole] = useState<"cpo" | "family_unit">("cpo");
  const [creativity, setCreativity] = useState(0.5);
  const [isRegenerating, setIsRegenerating] = useState(false);

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

  // Get queries based on current scope
  const displayQueries = useMemo(() => {
    const result: { persona: Persona; stage: Stage; queries: string[]; intentText: string }[] = [];

    if (scope === "cell" && selectedPersona && selectedStage) {
      result.push({
        persona: selectedPersona,
        stage: selectedStage,
        queries: localQueryBank[selectedPersona][selectedStage].queries,
        intentText: localQueryBank[selectedPersona][selectedStage].intentText,
      });
    } else if (scope === "row" && selectedPersona) {
      for (const stage of stages) {
        result.push({
          persona: selectedPersona,
          stage: stage.id,
          queries: localQueryBank[selectedPersona][stage.id].queries,
          intentText: localQueryBank[selectedPersona][stage.id].intentText,
        });
      }
    } else if (scope === "column" && selectedStage) {
      for (const persona of personas) {
        result.push({
          persona: persona.id,
          stage: selectedStage,
          queries: localQueryBank[persona.id][selectedStage].queries,
          intentText: localQueryBank[persona.id][selectedStage].intentText,
        });
      }
    } else {
      for (const persona of personas) {
        for (const stage of stages) {
          result.push({
            persona: persona.id,
            stage: stage.id,
            queries: localQueryBank[persona.id][stage.id].queries,
            intentText: localQueryBank[persona.id][stage.id].intentText,
          });
        }
      }
    }

    return result;
  }, [scope, selectedPersona, selectedStage, localQueryBank, personas, stages]);

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

  // Get intent text for current cell
  const getIntentText = () => {
    if (scope === "cell" && selectedPersona && selectedStage) {
      const personaLabel = personas.find(p => p.id === selectedPersona)?.label;
      const stageLabel = stages.find(s => s.id === selectedStage)?.label;
      return `${personaLabel} buyer in ${stageLabel?.toLowerCase()} stage`;
    }
    return null;
  };

  const startEditQuery = (persona: Persona, stage: Stage, index: number, value: string) => {
    setEditingQuery({ persona, stage, index });
    setEditValue(value);
  };

  const saveEditQuery = () => {
    if (!editingQuery) return;
    const { persona, stage, index } = editingQuery;
    setLocalQueryBank(prev => ({
      ...prev,
      [persona]: {
        ...prev[persona],
        [stage]: {
          ...prev[persona][stage],
          queries: prev[persona][stage].queries.map((q, i) => (i === index ? editValue : q)),
        },
      },
    }));
    setEditingQuery(null);
    setEditValue("");
  };

  const deleteQuery = (persona: Persona, stage: Stage, index: number) => {
    setLocalQueryBank(prev => ({
      ...prev,
      [persona]: {
        ...prev[persona],
        [stage]: {
          ...prev[persona][stage],
          queries: prev[persona][stage].queries.filter((_, i) => i !== index),
        },
      },
    }));
  };

  const addQuery = (persona: Persona, stage: Stage) => {
    const newIndex = localQueryBank[persona][stage].queries.length;
    setLocalQueryBank(prev => ({
      ...prev,
      [persona]: {
        ...prev[persona],
        [stage]: {
          ...prev[persona][stage],
          queries: [...prev[persona][stage].queries, ""],
        },
      },
    }));
    startEditQuery(persona, stage, newIndex, "");
  };

  const updateIntentText = (persona: Persona, stage: Stage, text: string) => {
    setLocalQueryBank(prev => ({
      ...prev,
      [persona]: {
        ...prev[persona],
        [stage]: {
          ...prev[persona][stage],
          intentText: text,
        },
      },
    }));
  };

  const handleRegenerate = async () => {
    if (!onRegenerateQueries || scope !== "cell" || !selectedPersona || !selectedStage) return;
    
    setIsRegenerating(true);
    try {
      const intentToUse = localQueryBank[selectedPersona][selectedStage].intentText;
      const newQueries = await onRegenerateQueries(selectedPersona, selectedStage, intentToUse, role, creativity);
      setLocalQueryBank(prev => ({
        ...prev,
        [selectedPersona]: {
          ...prev[selectedPersona],
          [selectedStage]: {
            ...prev[selectedPersona][selectedStage],
            queries: newQueries,
          },
        },
      }));
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
      <DialogContent className="max-w-7xl max-h-[95vh] bg-[#fffaf2] border-[#e3dacb] overflow-hidden flex flex-col p-0 shadow-2xl">
        {/* Header */}
        <DialogHeader className="px-8 pt-6 pb-4 border-b border-[#e3dacb] flex-shrink-0">
          <div className="flex items-center justify-between gap-8">
            <div>
              <DialogTitle className="text-xl font-bold text-[#1e1b16] tracking-tight">
                {getScopeLabel()}
              </DialogTitle>
              <p className="text-xs text-[#1e1b16]/50 mt-0.5 font-medium uppercase tracking-wider">
                Research Command Center • {totalQueryCount} queries
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

        {/* Seed Intent Zone (Only for cell scope) */}
        {scope === "cell" && selectedPersona && selectedStage && (
          <div className="px-8 py-5 bg-[#1f3b2c]/5 border-b border-[#e3dacb]">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#1f3b2c]/60">Research Intent (Seed)</span>
              <span className="text-[10px] italic text-[#1e1b16]/40">Edits here will drive the AI generator</span>
            </div>
            <textarea
              value={localQueryBank[selectedPersona][selectedStage].intentText}
              onChange={(e) => updateIntentText(selectedPersona, selectedStage, e.target.value)}
              className="w-full text-lg font-medium text-[#1e1b16] bg-transparent border-none focus:ring-0 resize-none p-0 min-h-[40px] leading-tight"
              placeholder="Enter the core intent derived from research..."
              rows={1}
            />
          </div>
        )}

        {/* Main content */}
        <div className="flex-1 flex min-h-0 overflow-hidden bg-white/40 backdrop-blur-sm">
          {/* Query list - takes most space */}
          <div className="flex-1 overflow-y-auto p-8">
            <div className="max-w-4xl mx-auto space-y-8">
              {displayQueries.map(({ persona, stage, queries }) => {
                const sectionKey = `${persona}-${stage}`;
                const personaLabel = personas.find(p => p.id === persona)?.label;
                const stageLabel = stages.find(s => s.id === stage)?.label;
                const showHeader = displayQueries.length > 1;

                return (
                  <div key={sectionKey}>
                    {showHeader && (
                      <div className="flex items-center gap-3 mb-4">
                        <div className="h-px flex-1 bg-[#e3dacb]" />
                        <div className="text-[10px] font-bold text-[#1f3b2c] uppercase tracking-[0.2em]">
                          {personaLabel} buyer × {stageLabel} stage
                        </div>
                        <div className="h-px flex-1 bg-[#e3dacb]" />
                      </div>
                    )}
                    
                    <div className="grid gap-3">
                      {queries.map((query, idx) => {
                        const isEditing = editingQuery?.persona === persona && editingQuery?.stage === stage && editingQuery?.index === idx;
                        
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
                                onClick={() => startEditQuery(persona, stage, idx, query)}
                                className="flex-1 text-sm text-[#1e1b16] cursor-text leading-relaxed font-medium"
                              >
                                {query || <span className="text-[#1e1b16]/20 italic font-normal">Enter query...</span>}
                              </span>
                            )}
                            <button
                              onClick={() => deleteQuery(persona, stage, idx)}
                              className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-[#f0d9d9] rounded-lg transition-all flex-shrink-0 -mr-1"
                            >
                              <X className="h-3.5 w-3.5 text-[#8b4a4a]" />
                            </button>
                          </div>
                        );
                      })}
                      
                      <button
                        onClick={() => addQuery(persona, stage)}
                        className="flex items-center justify-center gap-2 text-[11px] font-bold uppercase tracking-wider text-[#1f3b2c]/40 hover:text-[#1f3b2c] py-4 px-5 rounded-xl border-2 border-dashed border-[#e3dacb] hover:border-[#1f3b2c]/30 hover:bg-white transition-all w-full"
                      >
                        <Plus className="h-4 w-4" />
                        Add New Query
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Sidebar - interpretation settings (only for cell scope) */}
          {scope === "cell" && selectedPersona && selectedStage && (
            <div className="w-80 border-l border-[#e3dacb] bg-[#faf7f2]/50 p-8 flex flex-col gap-8">
              {/* Role Toggle */}
              <div className="space-y-4">
                <span className="text-[10px] font-bold text-[#1e1b16]/60 uppercase tracking-[0.2em]">Interpretation Mode</span>
                <div className="flex p-1.5 bg-[#efe6d9] rounded-xl shadow-inner">
                  <button
                    onClick={() => setRole("cpo")}
                    className={`flex-1 px-3 py-2.5 text-[11px] font-bold rounded-lg transition-all ${
                      role === "cpo"
                        ? "bg-white text-[#1f3b2c] shadow-md"
                        : "text-[#1e1b16]/40 hover:text-[#1e1b16]/60"
                    }`}
                  >
                    CPO
                  </button>
                  <button
                    onClick={() => setRole("family_unit")}
                    className={`flex-1 px-3 py-2.5 text-[11px] font-bold rounded-lg transition-all ${
                      role === "family_unit"
                        ? "bg-white text-[#1f3b2c] shadow-md"
                        : "text-[#1e1b16]/40 hover:text-[#1e1b16]/60"
                    }`}
                  >
                    FAMILY UNIT
                  </button>
                </div>
                <div className="p-4 bg-white/60 rounded-xl border border-[#e3dacb]/50">
                  <p className="text-[10px] font-medium text-[#1e1b16]/70 leading-relaxed">
                    {role === "cpo" 
                      ? "Analyzing through the 'She-Elite' lens: Risk, ROI, and Wealth Preservation." 
                      : "Analyzing through the Family Operations lens: Social Flow and Daily Ecosystem."}
                  </p>
                </div>
              </div>

              <div className="space-y-6">
                <CreativitySlider value={creativity} onChange={setCreativity} />
                <p className="text-[10px] text-[#1e1b16]/40 leading-relaxed italic">
                  Creativity affects the &apos;temperature&apos; of DeepSeek V3, driving variety and long-tail query generation.
                </p>
              </div>
              
              {onRegenerateQueries && (
                <Button
                  onClick={handleRegenerate}
                  disabled={isRegenerating}
                  className="w-full bg-[#1f3b2c] hover:bg-[#2a4d3a] text-white h-12 shadow-lg shadow-[#1f3b2c]/20 font-bold"
                >
                  <RotateCcw className={`h-4 w-4 mr-2 ${isRegenerating ? "animate-spin" : ""}`} />
                  {isRegenerating ? "GENERATING..." : "REGENERATE QUERIES"}
                </Button>
              )}
              
              <div className="mt-auto pt-6 border-t border-[#e3dacb]">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2 h-2 rounded-full bg-[#1f3b2c] animate-pulse" />
                  <span className="text-[10px] font-bold text-[#1e1b16]/40 uppercase tracking-widest">DeepSeek V3 Active</span>
                </div>
                <p className="text-[9px] text-[#1e1b16]/30 leading-relaxed">
                  Queries are generated based on the latest Matriarchy of the Manatee research directives.
                </p>
              </div>
            </div>
          )}
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
