"use client";

import { useState, useEffect } from "react";
import { Persona, Stage, Role } from "./types";
import { IntentNode } from "@/lib/intents/types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { motion, AnimatePresence } from "framer-motion";
import { MiniMatrixNavigation } from "./MiniMatrixNavigation";
import { Plus, Pencil, Trash2, X, Check, RefreshCw, Loader2, ArrowRight, Play } from "lucide-react";

interface IntentEditorModalProps {
  open: boolean;
  onClose: () => void;
  defaultTab?: "intents" | "queries";
  // Context
  persona: Persona;
  stage: Stage;
  personas: { id: Persona; label: string }[];
  stages: { id: Stage; label: string }[];
  cellStatus: Record<string, "empty" | "has-intents" | "has-queries">;
  onSelectCell: (persona: Persona, stage: Stage) => void;
  // Data
  intents: IntentNode[];
  queries: Record<string, string[]>; // intentId -> queries
  // Handlers
  onIntentChange: (intent: IntentNode) => void;
  onIntentDelete: (intentId: string) => void;
  onIntentAdd: (text: string, role: Role, style: number) => void;
  onQueryChange: (intentId: string, queryIndex: number, text: string) => void;
  onQueryDelete: (intentId: string, queryIndex: number) => void;
  onQueryAdd: (intentId: string) => void;
  onQueryRegenerate: (intentId: string) => Promise<string[]>;
  // Run benchmark
  onRun?: () => void;
  isRunning?: boolean;
}

const PERSONA_LABELS: Record<Persona, string> = {
  move_up: "Move-Up",
  retiree: "Retiree",
  luxury: "Luxury",
  first_time: "First-Time",
};

const STAGE_LABELS: Record<Stage, string> = {
  explore: "Explore",
  consider: "Consider",
  compare: "Compare",
  decide: "Decide",
};

const ROLE_LABELS: Record<Role, string> = {
  cpo: "CPO",
  family_unit: "Family Unit",
};

export function IntentEditorModal({
  open,
  onClose,
  defaultTab = "intents",
  persona,
  stage,
  personas,
  stages,
  cellStatus,
  onSelectCell,
  intents,
  queries,
  onIntentChange,
  onIntentDelete,
  onIntentAdd,
  onQueryChange,
  onQueryDelete,
  onQueryAdd,
  onQueryRegenerate,
  onRun,
  isRunning = false,
}: IntentEditorModalProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [editRole, setEditRole] = useState<Role>("cpo");
  const [editStyle, setEditStyle] = useState(0.75);
  const [isAddingNew, setIsAddingNew] = useState(true);
  const [activeTab, setActiveTab] = useState<"intents" | "queries">(defaultTab);
  const [regeneratingIntent, setRegeneratingIntent] = useState<string | null>(null);

  // Reset states when modal opens/closes or when active persona/stage changes
  useEffect(() => {
    setIsAddingNew(true);
    setEditingId(null);
    setEditText("");
    if (open) {
      setActiveTab(defaultTab);
    }
  }, [persona, stage, open, defaultTab]);

  const startEdit = (intent: IntentNode) => {
    setEditingId(intent.id);
    setEditText(intent.text);
    setEditRole(intent.role as Role);
    setEditStyle(intent.queryStyle || 0.75);
  };

  const saveEdit = () => {
    if (editingId) {
      const intent = intents.find((i) => i.id === editingId);
      if (intent) {
        onIntentChange({
          ...intent,
          text: editText,
          role: editRole,
          queryStyle: editStyle,
        });
      }
    }
    setEditingId(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setIsAddingNew(false);
  };

  const addNew = () => {
    setIsAddingNew(true);
    setEditText("");
    setEditRole("cpo");
    setEditStyle(0.75);
  };

  const saveNew = () => {
    if (editText.trim()) {
      onIntentAdd(editText.trim(), editRole, editStyle);
      setIsAddingNew(false);
      setEditText("");
    }
  };

  const handleRegenerate = async (intentId: string) => {
    if (!onQueryRegenerate) return;
    setRegeneratingIntent(intentId);
    try {
      await onQueryRegenerate(intentId);
    } finally {
      setRegeneratingIntent(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl h-[90vh] overflow-hidden flex flex-col p-0 border-none bg-white">
        <DialogHeader className="sr-only">
          <DialogTitle>Focus Mode Editor</DialogTitle>
          <DialogDescription className="sr-only">
            Edit research objectives and queries for the visibility matrix
          </DialogDescription>
        </DialogHeader>

        {/* Left Focus Sidebar: Context Navigation */}
        <div className="flex h-full">
          <div className="w-[300px] border-r border-[#e3dacb] bg-[#faf9f6] flex flex-col">
            <div className="p-6 border-b border-[#e3dacb] bg-white">
              <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-black/20 mb-1">Focus Mode</h2>
              <h3 className="text-xl font-light tracking-tight text-black">
                {PERSONA_LABELS[persona]}
              </h3>
              <div className="flex items-center gap-2 mt-2">
                <span className="text-[11px] font-bold text-black px-2 py-0.5 bg-[#e3dacb]/30">
                  {STAGE_LABELS[stage]}
                </span>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-8">
              <div className="flex justify-center">
                <MiniMatrixNavigation
                  variant="sidebar"
                  personas={personas}
                  stages={stages}
                  selectedCell={{ persona, stage }}
                  onSelect={onSelectCell}
                  cellStatus={cellStatus}
                />
              </div>
            </div>

          </div>

          {/* Right Main Content: Editor */}
          <div className="flex-1 flex flex-col bg-white">
            <DialogHeader className="p-6 pb-0 border-b border-white space-y-0">
              <div className="flex items-center justify-between">
                {/* Tabs */}
                <div className="flex items-center gap-8">
                  <button
                    onClick={() => setActiveTab("intents")}
                    className={`
                                    pb-4 text-xs font-bold uppercase tracking-widest transition-all relative
                                    ${activeTab === "intents"
                        ? "text-black"
                        : "text-black/30 hover:text-black/50"
                      }
                                `}
                  >
                    Intents
                    {activeTab === "intents" && (
                      <motion.div layoutId="tab-underline" className="absolute bottom-0 left-0 right-0 h-[2px] bg-black" />
                    )}
                  </button>
                  <button
                    onClick={() => setActiveTab("queries")}
                    className={`
                                    pb-4 text-xs font-bold uppercase tracking-widest transition-all relative
                                    ${activeTab === "queries"
                        ? "text-black"
                        : "text-black/30 hover:text-black/50"
                      }
                                `}
                  >
                    Queries
                    {activeTab === "queries" && (
                      <motion.div layoutId="tab-underline" className="absolute bottom-0 left-0 right-0 h-[2px] bg-black" />
                    )}
                  </button>
                </div>

                <div className="flex gap-2 mb-4">
                  {onRun && (
                    <Button
                      size="sm"
                      onClick={onRun}
                      disabled={isRunning}
                      className="bg-[#6e7c5b] hover:bg-[#5e6c4b] text-white text-[10px] font-bold uppercase tracking-wider h-8 rounded-none px-4"
                    >
                      {isRunning ? (
                        <Loader2 className="h-3 w-3 animate-spin mr-2" />
                      ) : (
                        <Play className="h-3 w-3 mr-2" />
                      )}
                      {isRunning ? "Running..." : "Run"}
                    </Button>
                  )}
                  {activeTab === "intents" && (
                    <Button
                      size="sm"
                      onClick={addNew}
                      className="bg-black hover:bg-black/80 text-white text-[10px] font-bold uppercase tracking-wider h-8 rounded-none px-4"
                    >
                      <Plus className="h-3 w-3 mr-2" />
                      New Intent
                    </Button>
                  )}
                </div>
              </div>
            </DialogHeader>

            <div className="flex-1 overflow-y-auto p-8 pt-6">
              {activeTab === "intents" ? (
                <div className="max-w-2xl mx-auto space-y-8">

                  {intents.length === 0 && !isAddingNew ? (
                    <div className="text-center py-24 border border-dashed border-[#e3dacb]">
                      <p className="font-serif text-lg text-black/30 italic mb-6">No research objectives have been defined yet.</p>
                      <Button
                        variant="outline"
                        onClick={addNew}
                        className="border-black text-black hover:bg-black/5 rounded-none font-bold uppercase tracking-widest text-xs px-8 h-12"
                      >
                        Add First Intent
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-12">
                      {intents.map((intent, idx) => {
                        const isEditing = editingId === intent.id;

                        return (
                          <div key={intent.id} className={`group ${isEditing ? 'bg-[#faf9f6] p-8 -mx-8 border-y border-black/5' : ''}`}>
                            {isEditing ? (
                              <div className="space-y-6">
                                <textarea
                                  value={editText}
                                  onChange={(e) => setEditText(e.target.value)}
                                  className="w-full text-base font-serif text-black bg-transparent border-b border-black/20 focus:border-black py-2 focus:outline-none resize-none"
                                  rows={3}
                                />
                                <div className="flex items-center gap-8">
                                  <div className="space-y-1">
                                    <label className="text-[9px] font-bold uppercase text-black/30 tracking-widest">Role</label>
                                    <div className="flex bg-white border border-black/5 p-0.5">
                                      {(['cpo', 'family_unit'] as const).map(r => (
                                        <button
                                          key={r}
                                          onClick={() => setEditRole(r)}
                                          className={`px-3 py-1 text-[9px] font-bold uppercase tracking-wider transition-all ${editRole === r ? 'bg-black text-white' : 'text-black/30 hover:text-black/50'}`}
                                        >
                                          {ROLE_LABELS[r]}
                                        </button>
                                      ))}
                                    </div>
                                  </div>
                                  <div className="flex-1 space-y-1">
                                    <label className="text-[9px] font-bold uppercase text-black/30 tracking-widest">Style</label>
                                    <Slider value={[editStyle]} onValueChange={(v) => setEditStyle(v[0])} max={1} min={0.5} step={0.05} />
                                  </div>
                                </div>
                                <div className="flex gap-4 pt-2">
                                  <Button size="sm" onClick={saveEdit} className="bg-black hover:bg-black/90 text-white rounded-none text-[10px] font-bold uppercase tracking-widest px-6">Save Changes</Button>
                                  <Button size="sm" variant="ghost" onClick={cancelEdit} className="text-black/40 hover:text-black text-[10px] font-bold uppercase tracking-widest">Cancel</Button>
                                </div>
                              </div>
                            ) : (
                              <div className="relative flex gap-6">
                                <span className="text-[11px] font-bold text-black/10 mt-1.5 shrink-0">{String(idx + 1).padStart(2, '0')}</span>
                                <div className="flex-1">
                                  <div className="flex items-center gap-3 mb-4">
                                    <Badge className="bg-black/5 text-black border-none rounded-none text-[9px] font-black uppercase tracking-[0.2em] px-2 py-0.5">
                                      {ROLE_LABELS[intent.role as Role]}
                                    </Badge>
                                    <span className="text-[9px] font-black uppercase tracking-[0.2em] text-black/20">
                                      Style: {Math.round((intent.queryStyle || 0.75) * 100)}%
                                    </span>
                                  </div>

                                  <p className="text-lg font-serif leading-relaxed text-black/80 max-w-xl group-hover:text-black transition-colors">
                                    {intent.text}
                                  </p>

                                  <div className="absolute top-0 right-0 opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
                                    <Button variant="ghost" size="sm" onClick={() => startEdit(intent)} className="w-8 h-8 p-0 hover:bg-black/5">
                                      <Pencil className="w-3 h-3" />
                                    </Button>
                                    <Button variant="ghost" size="sm" onClick={() => onIntentDelete(intent.id)} className="w-8 h-8 p-0 hover:bg-red-50 hover:text-red-500">
                                      <Trash2 className="w-3 h-3" />
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}

                      {/* Add New Intent (As next item in list) */}
                      <AnimatePresence>
                        {isAddingNew && (
                          <motion.div
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="flex gap-6 pt-6"
                          >
                            <span className="text-[11px] font-bold text-black mt-3 shrink-0">{String(intents.length + 1).padStart(2, '0')}</span>
                            <div className="flex-1 bg-[#faf9f6]/50 border border-black/5 p-8 mt-2 relative">
                              <button
                                onClick={cancelEdit}
                                className="absolute top-4 right-4 p-2 text-black/20 hover:text-black transition-colors"
                              >
                                <X className="w-4 h-4" />
                              </button>
                              <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-black/20 mb-6">New Intent</h3>
                              <div className="space-y-8">
                                <div>
                                  <textarea
                                    value={editText}
                                    onChange={(e) => setEditText(e.target.value)}
                                    className="w-full text-lg font-serif text-black bg-transparent border-b border-black/20 focus:border-black py-2 focus:outline-none resize-none"
                                    rows={2}
                                    placeholder="What would this persona want to know at this stage?"
                                    autoFocus
                                  />
                                </div>

                                <div className="flex items-center gap-12">
                                  <div className="space-y-3">
                                    <label className="text-[9px] font-bold uppercase text-black/30 tracking-widest block">Role</label>
                                    <div className="flex bg-white rounded-none p-1 border border-black/10">
                                      {(['cpo', 'family_unit'] as const).map(r => (
                                        <button
                                          key={r}
                                          onClick={() => setEditRole(r)}
                                          className={`px-4 py-1.5 text-[10px] font-bold uppercase tracking-wider transition-all ${editRole === r ? 'bg-black text-white' : 'text-black/40 hover:text-black/60'}`}
                                        >
                                          {ROLE_LABELS[r]}
                                        </button>
                                      ))}
                                    </div>
                                  </div>

                                  <div className="flex-1 space-y-3">
                                    <label className="text-[9px] font-bold uppercase text-black/30 tracking-widest block">Style ({Math.round(editStyle * 100)}%)</label>
                                    <Slider
                                      value={[editStyle]}
                                      onValueChange={(vals) => setEditStyle(vals[0])}
                                      max={1}
                                      min={0.5}
                                      step={0.05}
                                      className="mt-2"
                                    />
                                  </div>
                                </div>

                                <div className="flex items-center gap-4 pt-4">
                                  <Button size="sm" onClick={saveNew} className="bg-black hover:bg-black/90 text-white rounded-none h-12 px-8 font-bold uppercase tracking-wider text-[11px]" disabled={!editText.trim()}>
                                    Create Intent
                                  </Button>
                                  <Button size="sm" variant="ghost" onClick={cancelEdit} className="text-black/40 hover:text-black rounded-none h-12 px-8 font-bold uppercase tracking-wider text-[11px]">
                                    Cancel
                                  </Button>
                                </div>
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  )}
                </div>
              ) : (
                // Queries Tab
                <div className="max-w-2xl mx-auto space-y-12 pb-24">
                  {intents.length === 0 ? (
                    <div className="text-center py-24">
                      <p className="font-serif italic text-black/30">You must define your research objectives before generating queries.</p>
                    </div>
                  ) : (
                    intents.map((intent) => {
                      const intentQueries = queries[intent.id] || [];
                      const isRegenerating = regeneratingIntent === intent.id;

                      return (
                        <div key={intent.id} className="space-y-6">
                          <div className="flex items-start justify-between border-b border-black/5 pb-4">
                            <div className="flex-1 pr-12">
                              <h4 className="text-[9px] font-black uppercase tracking-[0.3em] text-black/20 mb-2">Intent Objective</h4>
                              <p className="text-sm font-serif leading-relaxed text-black/70 italic">"{intent.text}"</p>
                            </div>

                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleRegenerate(intent.id)}
                              disabled={isRegenerating}
                              className="rounded-none border-l border-black/5 pl-6 h-10 hover:bg-black/5"
                            >
                              {isRegenerating ? (
                                <Loader2 className="h-3 w-3 animate-spin text-black/40" />
                              ) : (
                                <div className="flex items-center gap-2">
                                  <RefreshCw className="h-3 w-3" />
                                  <span className="text-[9px] font-bold uppercase tracking-widest text-black/60">Regenerate</span>
                                </div>
                              )}
                            </Button>
                          </div>

                          <div className="space-y-4">
                            {!intentQueries.length ? (
                              <div className="py-12 px-6 bg-[#faf9f6] text-center">
                                <p className="text-[10px] font-bold uppercase tracking-widest text-black/30 mb-4">No Queries Generated</p>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleRegenerate(intent.id)}
                                  className="rounded-none border-black/20 hover:border-black text-[10px] font-bold uppercase tracking-wider h-8"
                                >
                                  Bulk Generate Now
                                </Button>
                              </div>
                            ) : (
                              <div className="grid gap-2">
                                {intentQueries.map((q, qIdx) => (
                                  <div key={qIdx} className="group flex items-center justify-between gap-4 p-4 bg-[#faf9f6] hover:bg-white transition-colors border border-transparent hover:border-black/5">
                                    <div className="flex gap-4 flex-1">
                                      <span className="text-[10px] font-bold text-black/20 mt-0.5 shrink-0">{String(qIdx + 1).padStart(2, '0')}</span>
                                      <p className="text-sm font-light leading-relaxed text-black/80">{q}</p>
                                    </div>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => onQueryDelete?.(intent.id, qIdx)}
                                      className="opacity-0 group-hover:opacity-100 h-8 w-8 p-0 hover:bg-red-50 hover:text-red-500"
                                    >
                                      <X className="w-3 h-3" />
                                    </Button>
                                  </div>
                                ))}

                                {intentQueries.length < 5 && (
                                  <div className="mt-4 pt-4 border-t border-black/5">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => onQueryAdd?.(intent.id)}
                                      className="text-[10px] font-bold uppercase tracking-wider text-black/40 hover:text-black hover:bg-black/5 px-4"
                                    >
                                      <Plus className="w-3 h-3 mr-2" />
                                      Add Single Query
                                    </Button>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
