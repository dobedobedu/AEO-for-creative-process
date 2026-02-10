"use client";

import { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { X, Plus, Play, Save, ChevronDown, ChevronRight } from "lucide-react";

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
}

export function QueryPanel({
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
}: QueryPanelProps) {
  const [scope, setScope] = useState<Scope>(initialScope);
  const [selectedPersona, setSelectedPersona] = useState<Persona | undefined>(initialPersona);
  const [selectedStage, setSelectedStage] = useState<Stage | undefined>(initialStage);
  const [localQueryBank, setLocalQueryBank] = useState(queryBank);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(["all"]));
  const [editingQuery, setEditingQuery] = useState<{ persona: Persona; stage: Stage; index: number } | null>(null);
  const [editValue, setEditValue] = useState("");

  // State is reset by re-mounting the panel when it opens (see parent `key` prop).

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
      // All
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
      return personas.find(x => x.id === selectedPersona)?.label || "";
    }
    if (scope === "column" && selectedStage) {
      return stages.find(x => x.id === selectedStage)?.label || "";
    }
    return "All Queries";
  };

  const toggleSection = (key: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const handleScopeChange = (newScope: Scope) => {
    setScope(newScope);
    // Reset selections if needed
    if (newScope === "all") {
      setSelectedPersona(undefined);
      setSelectedStage(undefined);
    } else if (newScope === "row" && !selectedPersona) {
      setSelectedPersona(personas[0]?.id);
      setSelectedStage(undefined);
    } else if (newScope === "column" && !selectedStage) {
      setSelectedStage(stages[0]?.id);
      setSelectedPersona(undefined);
    } else if (newScope === "cell") {
      if (!selectedPersona) setSelectedPersona(personas[0]?.id);
      if (!selectedStage) setSelectedStage(stages[0]?.id);
    }
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
    setLocalQueryBank(prev => ({
      ...prev,
      [persona]: {
        ...prev[persona],
        [stage]: [...prev[persona][stage], ""],
      },
    }));
    // Start editing the new query
    const newIndex = localQueryBank[persona][stage].length;
    startEditQuery(persona, stage, newIndex, "");
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
      <DialogContent className="max-w-4xl max-h-[85vh] bg-[#fffaf2] border-brand-secondary overflow-hidden flex flex-col">
        <DialogHeader className="pb-4 border-b border-brand-secondary flex-shrink-0">
          <DialogTitle className="text-[#1e1b16]">Query Bank</DialogTitle>
        </DialogHeader>

        {/* Scope Tabs */}
        <div className="flex gap-1 mt-4 p-1 bg-[#efe6d9] rounded-lg flex-shrink-0">
          {(["cell", "row", "column", "all"] as const).map(s => (
            <button
              key={s}
              onClick={() => handleScopeChange(s)}
              className={`flex-1 px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                scope === s
                  ? "bg-white text-brand-primary shadow-sm"
                  : "text-[#1e1b16]/60 hover:text-[#1e1b16]"
              }`}
            >
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>

        {/* Current Selection Info */}
        <div className="mt-4 flex items-center justify-between flex-shrink-0">
          <div>
            <div className="text-sm font-medium text-[#1e1b16]">{getScopeLabel()}</div>
            <div className="text-xs text-[#1e1b16]/50">{totalQueryCount} queries</div>
          </div>
          {(scope === "row" || scope === "cell") && (
            <select
              value={selectedPersona || ""}
              onChange={e => setSelectedPersona(e.target.value as Persona)}
              className="text-sm bg-white border border-brand-secondary rounded-md px-2 py-1 text-[#1e1b16]"
            >
              {personas.map(p => (
                <option key={p.id} value={p.id}>{p.label}</option>
              ))}
            </select>
          )}
          {(scope === "column" || scope === "cell") && (
            <select
              value={selectedStage || ""}
              onChange={e => setSelectedStage(e.target.value as Stage)}
              className="text-sm bg-white border border-brand-secondary rounded-md px-2 py-1 text-[#1e1b16]"
            >
              {stages.map(s => (
                <option key={s.id} value={s.id}>{s.label}</option>
              ))}
            </select>
          )}
        </div>

        {/* Query List - Scrollable */}
        <div className="mt-4 space-y-3 overflow-y-auto flex-1 min-h-0 pr-2">
          {displayQueries.map(({ persona, stage, queries }) => {
            const sectionKey = `${persona}-${stage}`;
            const isCellScope = scope === "cell";
            const isExpanded = expandedSections.has(sectionKey) || expandedSections.has("all") || isCellScope;
            const personaLabel = personas.find(p => p.id === persona)?.label;
            const stageLabel = stages.find(s => s.id === stage)?.label;
            const showHeader = !isCellScope;

            return (
              <div key={sectionKey} className="border border-brand-secondary rounded-xl bg-white overflow-hidden">
                {showHeader && (
                  <button
                    onClick={() => toggleSection(sectionKey)}
                    className="w-full flex items-center justify-between px-3 py-2 hover:bg-[#efe6d9]/50 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4 text-[#1e1b16]/50" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-[#1e1b16]/50" />
                      )}
                      <span className="text-sm font-medium text-[#1e1b16]">
                        {scope === "row" ? stageLabel : scope === "column" ? personaLabel : `${personaLabel} × ${stageLabel}`}
                      </span>
                    </div>
                    <Badge variant="outline" className="bg-[#efe6d9] border-transparent text-[#1e1b16]/60">
                      {queries.length}
                    </Badge>
                  </button>
                )}

                {isExpanded && (
                  <div className={`${showHeader ? "border-t border-brand-secondary" : ""} p-2 space-y-2`}>
                    {queries.map((query, idx) => {
                      const isEditing = editingQuery?.persona === persona && editingQuery?.stage === stage && editingQuery?.index === idx;
                      
                      return (
                        <div
                          key={idx}
                          className="group flex items-start gap-2 p-2 rounded-lg hover:bg-[#efe6d9]/30 transition-colors"
                        >
                          <span className="text-[#1e1b16]/30 text-sm mt-0.5">•</span>
                          {isEditing ? (
                            <input
                              type="text"
                              value={editValue}
                              onChange={e => setEditValue(e.target.value)}
                              onBlur={saveEditQuery}
                              onKeyDown={e => e.key === "Enter" && saveEditQuery()}
                              className="flex-1 text-sm bg-white border border-brand-primary rounded px-2 py-1 text-[#1e1b16] focus:outline-none focus:ring-1 focus:ring-brand-primary"
                              autoFocus
                            />
                          ) : (
                            <span
                              onClick={() => startEditQuery(persona, stage, idx, query)}
                              className="flex-1 text-sm text-[#1e1b16] cursor-text hover:bg-[#efe6d9]/50 rounded px-1 -mx-1"
                            >
                              &quot;{query}&quot;
                            </span>
                          )}
                          <button
                            onClick={() => deleteQuery(persona, stage, idx)}
                            className="opacity-0 group-hover:opacity-100 p-1 hover:bg-[#f0d9d9] rounded transition-opacity"
                          >
                            <X className="h-3 w-3 text-[#8b4a4a]" />
                          </button>
                        </div>
                      );
                    })}
                    <button
                      onClick={() => addQuery(persona, stage)}
                      className="flex items-center gap-1 text-xs text-brand-primary/70 hover:text-brand-primary px-2 py-1"
                    >
                      <Plus className="h-3 w-3" />
                      Add query
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Actions */}
        <div className="mt-6 pt-4 border-t border-brand-secondary flex gap-2 flex-shrink-0">
          <Button
            onClick={handleRun}
            className="flex-1 bg-brand-primary hover:bg-brand-primary-light text-white"
          >
            <Play className="h-4 w-4 mr-2" />
            Run {totalQueryCount} Queries
          </Button>
          <Button
            onClick={handleSave}
            variant="outline"
            className="border-brand-secondary text-[#1e1b16] hover:bg-[#efe6d9]"
          >
            <Save className="h-4 w-4 mr-2" />
            Save
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
