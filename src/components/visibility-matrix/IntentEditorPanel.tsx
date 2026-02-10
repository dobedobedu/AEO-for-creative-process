"use client";

import { useState } from "react";
import { Persona, Stage, Role } from "./types";
import { IntentNode } from "@/lib/intents/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Plus, Pencil, Trash2, Check, X } from "lucide-react";
import { useBrandConfig } from "@/lib/config/client";

interface IntentEditorPanelProps {
  persona: Persona;
  stage: Stage;
  intents: IntentNode[];
  onIntentChange: (intent: IntentNode) => void;
  onIntentDelete: (intentId: string) => void;
  onIntentAdd: (text: string, role: Role, style: number) => void;
}

const ROLE_LABELS: Record<Role, string> = {
  cpo: "CPO",
  family_unit: "Family Unit",
};

export function IntentEditorPanel({
  intents,
  onIntentChange,
  onIntentDelete,
  onIntentAdd,
}: IntentEditorPanelProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [editRole, setEditRole] = useState<Role>("cpo");
  const [editStyle, setEditStyle] = useState(0.75);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const { brand } = useBrandConfig();
  const brandName = brand?.name ?? "Brand";

  const startEdit = (intent: IntentNode) => {
    setEditingId(intent.id);
    setEditText(intent.text);
    setEditRole(intent.role as Role);
    setEditStyle(intent.queryStyle || 0.75);
    setIsAddingNew(false);
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
    setEditingId(null);
  };

  const saveNew = () => {
    if (editText.trim()) {
      onIntentAdd(editText.trim(), editRole, editStyle);
      setIsAddingNew(false);
      setEditText("");
    }
  };

  return (
    <div className="h-full flex flex-col bg-[#fffaf2]">
      {/* Header / Toolbar */}
      <div className="px-8 py-6 border-b border-brand-secondary flex justify-between items-center bg-white/50 backdrop-blur-sm sticky top-0 z-10">
        <div>
          <h2 className="text-xl font-semibold text-[#1e1b16] tracking-tight">Research Intents</h2>
          <p className="text-sm text-[#1e1b16]/60 mt-1">
            Define what the buyer wants to know at this stage.
          </p>
        </div>
        <Button
          onClick={addNew}
          className="bg-brand-primary hover:bg-brand-primary-light text-white shadow-sm transition-all hover:shadow-md"
          disabled={isAddingNew}
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Intent
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-8 space-y-6">
        {/* Ad New Form */}
        {isAddingNew && (
          <div className="border border-brand-primary bg-white rounded-xl shadow-lg p-6 animate-in slide-in-from-top-4 duration-200">
            <h3 className="text-sm font-bold uppercase tracking-wider text-brand-primary mb-4 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-brand-primary" />
              New Intent
            </h3>
            
            <div className="space-y-6">
              <div>
                <label className="text-xs font-semibold text-[#1e1b16]/70 mb-2 block uppercase tracking-wide">
                  Intent Description
                </label>
                <textarea
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  className="w-full text-base text-[#1e1b16] bg-[#f6f1e8]/50 border border-brand-secondary rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent resize-none leading-relaxed transition-all placeholder:text-[#1e1b16]/20"
                  rows={4}
                  placeholder={`e.g., Understanding the differences between ${brandName} and competitors...`}
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-2 gap-8">
                <div>
                  <label className="text-xs font-semibold text-[#1e1b16]/70 mb-2 block uppercase tracking-wide">
                    Perspective (Role)
                  </label>
                  <div className="relative">
                    <select
                      value={editRole}
                      onChange={(e) => setEditRole(e.target.value as Role)}
                      className="w-full text-sm font-medium bg-white border border-brand-secondary rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-primary appearance-none"
                    >
                      <option value="cpo">CPO (Chief Purchasing Officer)</option>
                      <option value="family_unit">Family Unit</option>
                    </select>
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-[#1e1b16]/40">
                      <svg width="10" height="6" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between mb-2">
                     <label className="text-xs font-semibold text-[#1e1b16]/70 block uppercase tracking-wide">
                      Query Style
                    </label>
                    <span className="text-xs font-mono text-brand-primary font-medium">{Math.round(editStyle * 100)}%</span>
                  </div>
                  <div className="flex items-center gap-3 pt-1">
                    <span className="text-xs text-[#1e1b16]/50 font-medium">Common</span>
                    <Slider
                      value={[editStyle]}
                      onValueChange={(vals) => setEditStyle(vals[0])}
                      max={1}
                      min={0.5}
                      step={0.05}
                      className="flex-1"
                    />
                    <span className="text-xs text-[#1e1b16]/50 font-medium">Niche</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 pt-2 border-t border-brand-secondary/50">
                <Button
                  onClick={saveNew}
                  disabled={!editText.trim()}
                  className="bg-brand-primary hover:bg-brand-primary-light text-white flex-1"
                >
                  <Check className="h-4 w-4 mr-2" />
                  Save Intent
                </Button>
                <Button
                  variant="outline"
                  onClick={cancelEdit}
                  className="border-brand-secondary text-[#1e1b16] hover:bg-[#f6f1e8] flex-1"
                >
                  <X className="h-4 w-4 mr-2" />
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Existing Intents */}
        <div className="space-y-4">
          {intents.length === 0 && !isAddingNew ? (
            <div className="text-center py-20 bg-white/40 rounded-xl border-2 border-dashed border-brand-secondary">
              <div className="w-16 h-16 rounded-full bg-[#f6f1e8] flex items-center justify-center mx-auto mb-4">
                 <Plus className="h-8 w-8 text-brand-secondary" />
              </div>
              <p className="text-[#1e1b16]/60 font-medium text-lg">No intents defined yet.</p>
              <p className="text-sm text-[#1e1b16]/40 mt-1 max-w-sm mx-auto">
                Start by adding what this persona is looking for at this stage of their journey.
              </p>
              <Button
                variant="outline"
                onClick={addNew}
                className="mt-6 border-brand-primary text-brand-primary hover:bg-brand-primary hover:text-white transition-all"
              >
                Create First Intent
              </Button>
            </div>
          ) : (
            intents.map((intent) => {
              const isEditing = editingId === intent.id;

              if (isEditing) {
                return (
                  <div key={intent.id} className="border border-brand-primary bg-white rounded-xl shadow-lg p-6">
                     <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-bold uppercase tracking-wider text-brand-primary flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-[#b86f3a]" />
                        Editing Intent
                        </h3>
                         <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => onIntentDelete(intent.id)}
                            className="h-8 w-8 p-0 text-red-400 hover:text-red-600 hover:bg-red-50"
                        >
                            <Trash2 className="h-4 w-4" />
                        </Button>
                    </div>
                    
                    <div className="space-y-6">
                      <div>
                        <label className="text-xs font-semibold text-[#1e1b16]/70 mb-2 block uppercase tracking-wide">
                            Intent Description
                        </label>
                        <textarea
                          value={editText}
                          onChange={(e) => setEditText(e.target.value)}
                          className="w-full text-base text-[#1e1b16] bg-[#f6f1e8]/50 border border-brand-secondary rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent resize-none leading-relaxed"
                          rows={4}
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-8">
                        <div>
                          <label className="text-xs font-semibold text-[#1e1b16]/70 mb-2 block uppercase tracking-wide">
                            Role
                          </label>
                           <div className="relative">
                            <select
                                value={editRole}
                                onChange={(e) => setEditRole(e.target.value as Role)}
                                className="w-full text-sm font-medium bg-white border border-brand-secondary rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-primary appearance-none"
                            >
                                <option value="cpo">CPO</option>
                                <option value="family_unit">Family Unit</option>
                            </select>
                             <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-[#1e1b16]/40">
                                <svg width="10" height="6" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                                </svg>
                            </div>
                           </div>
                        </div>

                        <div>
                           <div className="flex justify-between mb-2">
                                <label className="text-xs font-semibold text-[#1e1b16]/70 block uppercase tracking-wide">
                                    Style
                                </label>
                                <span className="text-xs font-mono text-brand-primary font-medium">{Math.round(editStyle * 100)}%</span>
                            </div>
                          <div className="flex items-center gap-3 pt-1">
                            <span className="text-xs text-[#1e1b16]/50 font-medium">Common</span>
                            <Slider
                              value={[editStyle]}
                              onValueChange={(vals) => setEditStyle(vals[0])}
                              max={1}
                              min={0.5}
                              step={0.05}
                              className="flex-1"
                            />
                            <span className="text-xs text-[#1e1b16]/50 font-medium">Niche</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 pt-2 border-t border-brand-secondary/50">
                        <Button
                          onClick={saveEdit}
                          className="bg-brand-primary hover:bg-brand-primary-light text-white flex-1"
                        >
                          <Check className="h-4 w-4 mr-2" />
                          Save Changes
                        </Button>
                        <Button
                          variant="outline"
                          onClick={cancelEdit}
                          className="border-brand-secondary text-[#1e1b16] hover:bg-[#f6f1e8] flex-1"
                        >
                          <X className="h-4 w-4 mr-2" />
                          Cancel
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              }

              return (
                <div
                  key={intent.id}
                  className="group relative bg-white border border-brand-secondary rounded-xl p-5 hover:border-[#b86f3a]/30 hover:shadow-md transition-all duration-200"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                        <div className="flex items-center gap-3 mb-3">
                            <Badge
                                className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 border-none shadow-none ${
                                    intent.role === "cpo"
                                    ? "bg-brand-primary/10 text-brand-primary"
                                    : "bg-[#6e7c5b]/10 text-[#6e7c5b]"
                                }`}
                            >
                                {ROLE_LABELS[intent.role as Role]}
                            </Badge>
                             <div className="h-3 w-[1px] bg-brand-secondary" />
                             <span className="text-[10px] text-[#1e1b16]/40 uppercase tracking-wider font-medium">
                                Style {Math.round((intent.queryStyle || 0.75) * 100)}%
                            </span>
                        </div>
                      
                      <p className="text-base text-[#1e1b16] leading-relaxed font-medium">
                        {intent.text}
                      </p>
                    </div>

                    <div className="flex flex-col gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => startEdit(intent)}
                        className="h-8 w-8 p-0 text-[#1e1b16]/40 hover:text-brand-primary hover:bg-brand-primary/10"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
