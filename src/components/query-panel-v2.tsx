"use client";

import { useState, useMemo, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  onRegenerateQueries?: (persona: Persona, stage: Stage, temperature: number) => Promise<string[]>;
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
    <div className="flex flex-col gap-1">
      {/* Stage labels - top */}
      <div className="flex gap-1 ml-6">
        {stages.map((stage) => (
          <div
            key={stage.id}
            className="w-6 h-4 flex items-center justify-center"
            title={stage.label}
          >
            <span className="text-[8px] font-medium text-[#1e1b16]/40 uppercase tracking-tight">
              {stage.label.charAt(0)}
            </span>
          </div>
        ))}
      </div>
      
      {/* Grid with persona labels */}
      <div className="flex gap-1">
        {/* Persona labels - left */}
        <div className="flex flex-col gap-1">
          {personas.map((persona) => (
            <div
              key={persona.id}
              className="w-5 h-6 flex items-center justify-end pr-1"
              title={persona.label}
            >
              <span className="text-[8px] font-medium text-[#1e1b16]/40 uppercase tracking-tight">
                {persona.label.charAt(0)}
              </span>
            </div>
          ))}
        </div>
        
        {/* The matrix grid */}
        <div className="grid grid-cols-4 gap-1">
          {personas.map((persona) =>
            stages.map((stage) => {
              const selected = isCellSelected(persona.id, stage.id);
              const highlighted = isCellHighlighted(persona.id, stage.id);
              
              return (
                <button
                  key={`${persona.id}-${stage.id}`}
                  onClick={() => onCellClick(persona.id, stage.id)}
                  className={`
                    w-6 h-6 rounded-md transition-all duration-150 
                    border border-[#e3dacb]
                    ${selected 
                      ? highlighted
                        ? "bg-[#1f3b2c] border-[#1f3b2c] shadow-sm" 
                        : "bg-[#1f3b2c]/70 border-[#1f3b2c]/70"
                      : "bg-white hover:bg-[#efe6d9] hover:border-[#1f3b2c]/30"
                    }
                  `}
                  title={`${persona.label} × ${stage.label}`}
                />
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

// Query variation dial component
function VariationDial({
  value,
  onChange,
}: {
  value: number;
  onChange: (value: number) => void;
}) {
  const getLabel = (val: number): string => {
    if (val <= 0.2) return "Verbatim";
    if (val <= 0.4) return "Precise";
    if (val <= 0.6) return "Balanced";
    if (val <= 0.8) return "Exploratory";
    return "Interpretive";
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-[#1e1b16]/70">Query Style</span>
        <span className="text-xs font-semibold text-[#1f3b2c]">{getLabel(value)}</span>
      </div>
      
      <div className="relative">
        <Slider
          value={[value]}
          onValueChange={([v]) => onChange(v)}
          min={0}
          max={1}
          step={0.1}
          className="w-full"
        />
        
        {/* Labels below slider */}
        <div className="flex justify-between mt-2">
          <span className="text-[10px] text-[#1e1b16]/40">Verbatim</span>
          <span className="text-[10px] text-[#1e1b16]/40">Interpretive</span>
        </div>
      </div>
      
      {/* Description */}
      <p className="text-[10px] text-[#1e1b16]/50 leading-relaxed">
        {value <= 0.3 
          ? "Searches exactly as written — best for specific terms"
          : value <= 0.7
            ? "Natural variations — how real people might search"
            : "Explores related angles — creative reinterpretations"
        }
      </p>
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
  const [variation, setVariation] = useState(0.5);
  const [isRegenerating, setIsRegenerating] = useState(false);

  // Handle mini-matrix cell click
  const handleMatrixClick = useCallback((persona: Persona, stage: Stage) => {
    // If clicking the same cell, toggle between cell and all
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

  // Handle row/column selection by clicking labels (future enhancement)
  const selectRow = useCallback((persona: Persona) => {
    setScope("row");
    setSelectedPersona(persona);
    setSelectedStage(undefined);
  }, []);

  const selectColumn = useCallback((stage: Stage) => {
    setScope("column");
    setSelectedStage(stage);
    setSelectedPersona(undefined);
  }, []);

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
      const newQueries = await onRegenerateQueries(selectedPersona, selectedStage, variation);
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] bg-[#fffaf2] border-[#e3dacb] overflow-hidden flex flex-col p-0">
        {/* Header */}
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-[#e3dacb] flex-shrink-0">
          <div className="flex items-start justify-between gap-6">
            <div className="flex-1">
              <DialogTitle className="text-lg font-semibold text-[#1e1b16] mb-1">
                Query Bank
              </DialogTitle>
              <p className="text-sm text-[#1e1b16]/50">
                {getScopeLabel()} · {totalQueryCount} queries
              </p>
            </div>
            
            {/* Mini-matrix scope selector */}
            <div className="flex flex-col items-end gap-2">
              <MiniMatrix
                personas={personas}
                stages={stages}
                selectedPersona={selectedPersona}
                selectedStage={selectedStage}
                scope={scope}
                onCellClick={handleMatrixClick}
              />
              <div className="flex gap-1">
                <button
                  onClick={selectAll}
                  className={`text-[10px] px-2 py-0.5 rounded transition-colors ${
                    scope === "all" 
                      ? "bg-[#1f3b2c] text-white" 
                      : "text-[#1e1b16]/50 hover:text-[#1e1b16] hover:bg-[#efe6d9]"
                  }`}
                >
                  All
                </button>
                {selectedPersona && (
                  <button
                    onClick={() => selectRow(selectedPersona)}
                    className={`text-[10px] px-2 py-0.5 rounded transition-colors ${
                      scope === "row" 
                        ? "bg-[#1f3b2c] text-white" 
                        : "text-[#1e1b16]/50 hover:text-[#1e1b16] hover:bg-[#efe6d9]"
                    }`}
                  >
                    Row
                  </button>
                )}
                {selectedStage && (
                  <button
                    onClick={() => selectColumn(selectedStage)}
                    className={`text-[10px] px-2 py-0.5 rounded transition-colors ${
                      scope === "column" 
                        ? "bg-[#1f3b2c] text-white" 
                        : "text-[#1e1b16]/50 hover:text-[#1e1b16] hover:bg-[#efe6d9]"
                    }`}
                  >
                    Column
                  </button>
                )}
              </div>
            </div>
          </div>
        </DialogHeader>

        {/* Main content area */}
        <div className="flex-1 flex min-h-0">
          {/* Query list */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {displayQueries.map(({ persona, stage, queries }) => {
              const sectionKey = `${persona}-${stage}`;
              const personaLabel = personas.find(p => p.id === persona)?.label;
              const stageLabel = stages.find(s => s.id === stage)?.label;
              const showHeader = displayQueries.length > 1;

              return (
                <div key={sectionKey} className="space-y-2">
                  {showHeader && (
                    <div className="flex items-center gap-2 pb-1">
                      <span className="text-xs font-semibold text-[#1e1b16]/70 uppercase tracking-wide">
                        {personaLabel} × {stageLabel}
                      </span>
                      <Badge variant="outline" className="bg-[#efe6d9]/50 border-transparent text-[#1e1b16]/50 text-[10px]">
                        {queries.length}
                      </Badge>
                    </div>
                  )}
                  
                  <div className="space-y-1">
                    {queries.map((query, idx) => {
                      const isEditing = editingQuery?.persona === persona && editingQuery?.stage === stage && editingQuery?.index === idx;
                      
                      return (
                        <div
                          key={idx}
                          className="group flex items-center gap-2 py-1.5 px-2 -mx-2 rounded-lg hover:bg-[#efe6d9]/40 transition-colors"
                        >
                          <span className="w-5 h-5 flex items-center justify-center rounded-full bg-[#efe6d9] text-[10px] font-medium text-[#1e1b16]/50">
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
                              className="flex-1 text-sm bg-white border border-[#1f3b2c] rounded-lg px-3 py-1.5 text-[#1e1b16] focus:outline-none focus:ring-2 focus:ring-[#1f3b2c]/20"
                              autoFocus
                            />
                          ) : (
                            <span
                              onClick={() => startEditQuery(persona, stage, idx, query)}
                              className="flex-1 text-sm text-[#1e1b16] cursor-text leading-relaxed"
                            >
                              {query || <span className="text-[#1e1b16]/30 italic">Empty query...</span>}
                            </span>
                          )}
                          <button
                            onClick={() => deleteQuery(persona, stage, idx)}
                            className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-[#f0d9d9] rounded-lg transition-all"
                            title="Delete query"
                          >
                            <X className="h-3.5 w-3.5 text-[#8b4a4a]" />
                          </button>
                        </div>
                      );
                    })}
                    
                    <button
                      onClick={() => addQuery(persona, stage)}
                      className="flex items-center gap-2 text-xs text-[#1f3b2c]/60 hover:text-[#1f3b2c] py-1.5 px-2 -mx-2 rounded-lg hover:bg-[#efe6d9]/40 transition-colors w-full"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Add query
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Right sidebar - Variation dial (only for cell scope) */}
          {scope === "cell" && selectedPersona && selectedStage && (
            <div className="w-56 border-l border-[#e3dacb] bg-[#faf7f2] p-4 flex flex-col gap-6">
              <VariationDial value={variation} onChange={setVariation} />
              
              {onRegenerateQueries && (
                <Button
                  onClick={handleRegenerate}
                  disabled={isRegenerating}
                  variant="outline"
                  className="w-full border-[#e3dacb] text-[#1e1b16] hover:bg-[#efe6d9] text-sm"
                >
                  <RotateCcw className={`h-3.5 w-3.5 mr-2 ${isRegenerating ? "animate-spin" : ""}`} />
                  {isRegenerating ? "Generating..." : "Regenerate"}
                </Button>
              )}
              
              <div className="mt-auto pt-4 border-t border-[#e3dacb]">
                <p className="text-[10px] text-[#1e1b16]/40 leading-relaxed">
                  Tip: Click cells in the mini-matrix above to quickly switch between different persona × stage combinations.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer actions */}
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
            className="border-[#e3dacb] text-[#1e1b16] hover:bg-[#efe6d9] h-10"
          >
            <Save className="h-4 w-4 mr-2" />
            Save
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
