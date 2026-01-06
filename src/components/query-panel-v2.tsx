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
  queryBank: Record<Persona, Record<Stage, string[]>>;
  personas: { id: Persona; label: string }[];
  stages: { id: Stage; label: string }[];
  onRunQueries: (
    queries: string[],
    persona?: Persona,
    stage?: Stage,
    queryBankOverride?: Record<Persona, Record<Stage, string[]>>
  ) => void;
  onSaveQueries?: (queryBank: Record<Persona, Record<Stage, string[]>>) => void;
  onRegenerateQueries?: (
    persona: Persona,
    stage: Stage,
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
    const result: { persona: Persona; stage: Stage; queries: string[] }[] = [];

    if (scope === "cell" && selectedPersona && selectedStage) {
      result.push({
        persona: selectedPersona,
        stage: selectedStage,
        queries: localQueryBank[selectedPersona][selectedStage],
      });
    } else if (scope === "row" && selectedPersona) {
      for (const stage of stages) {
        result.push({
          persona: selectedPersona,
          stage: stage.id,
          queries: localQueryBank[selectedPersona][stage.id],
        });
      }
    } else if (scope === "column" && selectedStage) {
      for (const persona of personas) {
        result.push({
          persona: persona.id,
          stage: selectedStage,
          queries: localQueryBank[persona.id][selectedStage],
        });
      }
    } else {
      for (const persona of personas) {
        for (const stage of stages) {
          result.push({
            persona: persona.id,
            stage: stage.id,
            queries: localQueryBank[persona.id][stage.id],
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
        [stage]: prev[persona][stage].map((q, i) => (i === index ? editValue : q)),
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
        [stage]: prev[persona][stage].filter((_, i) => i !== index),
      },
    }));
  };

  const addQuery = (persona: Persona, stage: Stage) => {
    const newIndex = localQueryBank[persona][stage].length;
    setLocalQueryBank(prev => ({
      ...prev,
      [persona]: {
        ...prev[persona],
        [stage]: [...prev[persona][stage], ""],
      },
    }));
    startEditQuery(persona, stage, newIndex, "");
  };

  const handleRegenerate = async () => {
    if (!onRegenerateQueries || scope !== "cell" || !selectedPersona || !selectedStage) return;
    
    setIsRegenerating(true);
    try {
      const newQueries = await onRegenerateQueries(selectedPersona, selectedStage, role, creativity);
      setLocalQueryBank(prev => ({
        ...prev,
        [selectedPersona]: {
          ...prev[selectedPersona],
          [selectedStage]: newQueries,
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

  const intentText = getIntentText();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] bg-[#fffaf2] border-[#e3dacb] overflow-hidden flex flex-col p-0">
        {/* Header */}
        <DialogHeader className="px-6 pt-5 pb-4 border-b border-[#e3dacb] flex-shrink-0">
          <div className="flex items-center justify-between gap-4">
            <div>
              <DialogTitle className="text-base font-semibold text-[#1e1b16]">
                {getScopeLabel()}
              </DialogTitle>
              <p className="text-xs text-[#1e1b16]/50 mt-0.5">
                {totalQueryCount} queries
              </p>
            </div>
            
            <div className="flex items-center gap-3">
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
                className={`text-[10px] px-2 py-1 rounded transition-colors ${
                  scope === "all" 
                    ? "bg-[#1f3b2c] text-white" 
                    : "text-[#1e1b16]/50 hover:bg-[#efe6d9]"
                }`}
              >
                All
              </button>
            </div>
          </div>
        </DialogHeader>

        {/* Main content */}
        <div className="flex-1 flex min-h-0 overflow-hidden">
          {/* Query list - takes most space */}
          <div className="flex-1 overflow-y-auto p-6">
            {/* Intent box (only for cell scope) */}
            {intentText && (
              <div className="mb-4 p-3 bg-[#efe6d9]/50 rounded-lg border border-[#e3dacb]">
                <span className="text-[10px] uppercase tracking-wide text-[#1e1b16]/40">Intent</span>
                <p className="text-sm text-[#1e1b16] mt-1">{intentText}</p>
              </div>
            )}

            {/* Queries */}
            <div className="space-y-4">
              {displayQueries.map(({ persona, stage, queries }) => {
                const sectionKey = `${persona}-${stage}`;
                const personaLabel = personas.find(p => p.id === persona)?.label;
                const stageLabel = stages.find(s => s.id === stage)?.label;
                const showHeader = displayQueries.length > 1;

                return (
                  <div key={sectionKey}>
                    {showHeader && (
                      <div className="text-xs font-medium text-[#1e1b16]/50 uppercase tracking-wide mb-2">
                        {personaLabel} × {stageLabel}
                      </div>
                    )}
                    
                    <div className="space-y-1.5">
                      {queries.map((query, idx) => {
                        const isEditing = editingQuery?.persona === persona && editingQuery?.stage === stage && editingQuery?.index === idx;
                        
                        return (
                          <div
                            key={idx}
                            className="group flex items-center gap-2 py-2 px-3 bg-white rounded-lg border border-[#e3dacb]/50 hover:border-[#e3dacb]"
                          >
                            <span className="w-5 h-5 flex items-center justify-center rounded-full bg-[#efe6d9] text-[10px] font-medium text-[#1e1b16]/50 flex-shrink-0">
                              {idx + 1}
                            </span>
                            {isEditing ? (
                              <input
                                type="text"
                                value={editValue}
                                onChange={e => setEditValue(e.target.value)}
                                onBlur={saveEditQuery}
                                onKeyDown={e => {
                                  if (e.key === "Enter") saveEditQuery();
                                  if (e.key === "Escape") {
                                    setEditingQuery(null);
                                    setEditValue("");
                                  }
                                }}
                                className="flex-1 text-sm bg-transparent border-none text-[#1e1b16] focus:outline-none"
                                autoFocus
                              />
                            ) : (
                              <span
                                onClick={() => startEditQuery(persona, stage, idx, query)}
                                className="flex-1 text-sm text-[#1e1b16] cursor-text"
                              >
                                {query || <span className="text-[#1e1b16]/30 italic">Empty...</span>}
                              </span>
                            )}
                            <button
                              onClick={() => deleteQuery(persona, stage, idx)}
                              className="opacity-0 group-hover:opacity-100 p-1 hover:bg-[#f0d9d9] rounded transition-all flex-shrink-0"
                            >
                              <X className="h-3 w-3 text-[#8b4a4a]" />
                            </button>
                          </div>
                        );
                      })}
                      
                      <button
                        onClick={() => addQuery(persona, stage)}
                        className="flex items-center gap-2 text-xs text-[#1f3b2c]/60 hover:text-[#1f3b2c] py-2 px-3 rounded-lg hover:bg-[#efe6d9]/30 transition-colors w-full"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Add query
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Sidebar - dial and generate (only for cell scope) */}
          {scope === "cell" && selectedPersona && selectedStage && (
            <div className="w-64 border-l border-[#e3dacb] bg-[#faf7f2] p-5 flex flex-col gap-6">
              {/* Role Toggle */}
              <div className="space-y-2">
                <span className="text-xs font-medium text-[#1e1b16]/60">Perspective</span>
                <div className="flex p-1 bg-[#efe6d9] rounded-lg">
                  <button
                    onClick={() => setRole("cpo")}
                    className={`flex-1 px-2 py-1.5 text-[10px] font-medium rounded-md transition-all ${
                      role === "cpo"
                        ? "bg-white text-[#1e1b16] shadow-sm"
                        : "text-[#1e1b16]/40 hover:text-[#1e1b16]/60"
                    }`}
                  >
                    CPO
                  </button>
                  <button
                    onClick={() => setRole("family_unit")}
                    className={`flex-1 px-2 py-1.5 text-[10px] font-medium rounded-md transition-all ${
                      role === "family_unit"
                        ? "bg-white text-[#1e1b16] shadow-sm"
                        : "text-[#1e1b16]/40 hover:text-[#1e1b16]/60"
                    }`}
                  >
                    Family Unit
                  </button>
                </div>
                <p className="text-[9px] text-[#1e1b16]/40 leading-tight">
                  {role === "cpo" 
                    ? "Focus on Risk, ROI, and Wealth Preservation" 
                    : "Focus on Social Flow, Amenities, and Daily Life"}
                </p>
              </div>

              <CreativitySlider value={creativity} onChange={setCreativity} />
              
              {onRegenerateQueries && (
                <Button
                  onClick={handleRegenerate}
                  disabled={isRegenerating}
                  variant="outline"
                  className="w-full border-[#e3dacb] text-[#1e1b16] hover:bg-[#efe6d9]"
                >
                  <RotateCcw className={`h-3.5 w-3.5 mr-2 ${isRegenerating ? "animate-spin" : ""}`} />
                  {isRegenerating ? "Generating..." : "Generate"}
                </Button>
              )}
              
              <div className="mt-auto">
                <p className="text-[9px] text-[#1e1b16]/30 leading-relaxed italic">
                  Powered by DeepSeek V3
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[#e3dacb] flex gap-3 flex-shrink-0 bg-[#faf7f2]">
          <Button
            onClick={handleRun}
            className="flex-1 bg-[#1f3b2c] hover:bg-[#2a4d3a] text-white h-10"
          >
            <Play className="h-4 w-4 mr-2" />
            Run {totalQueryCount} Queries
          </Button>
          <Button
            onClick={handleSave}
            variant="outline"
            className="border-[#e3dacb] text-[#1e1b16] hover:bg-[#efe6d9] h-10 px-6"
          >
            <Save className="h-4 w-4 mr-2" />
            Save
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
