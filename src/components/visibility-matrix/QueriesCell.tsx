"use client";

import { useState } from "react";
import { Persona, Stage } from "./types";
import { IntentNode } from "@/lib/intents/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus, Pencil, Trash2, RotateCcw } from "lucide-react";

interface IntentWithQueries {
  intent: IntentNode;
  queries: string[];
}

interface QueriesCellProps {
  persona: Persona;
  stage: Stage;
  intentsWithQueries: IntentWithQueries[];
  onQueryChange: (intentId: string, queryIndex: number, text: string) => void;
  onQueryDelete: (intentId: string, queryIndex: number) => void;
  onQueryAdd: (intentId: string) => void;
  onQueryRegenerate: (intentId: string, queryIndex: number) => void;
}

export function QueriesCell({
  persona,
  stage,
  intentsWithQueries,
  onQueryChange,
  onQueryDelete,
  onQueryAdd,
  onQueryRegenerate,
}: QueriesCellProps) {
  const [editingQuery, setEditingQuery] = useState<{ intentId: string; index: number } | null>(null);
  const [editText, setEditText] = useState("");

  const startEdit = (intentId: string, index: number, query: string) => {
    setEditingQuery({ intentId, index });
    setEditText(query);
  };

  const saveEdit = () => {
    if (editingQuery) {
      onQueryChange(editingQuery.intentId, editingQuery.index, editText);
    }
    setEditingQuery(null);
  };

  const cancelEdit = () => {
    setEditingQuery(null);
  };

  return (
    <div className="max-h-[400px] overflow-y-auto">
      {/* Spreadsheet-style table */}
      <table className="w-full border-collapse">
        <thead className="sticky top-0 bg-white z-10">
          <tr className="border-b border-[#e3dacb]">
            <th className="text-left py-2 px-3 text-[10px] font-semibold text-[#1e1b16]/60 uppercase tracking-wider">
              Query
            </th>
            <th className="text-center py-2 px-2 text-[10px] font-semibold text-[#1e1b16]/60 uppercase tracking-wider w-24">
              Intent
            </th>
            <th className="text-center py-2 px-2 text-[10px] font-semibold text-[#1e1b16]/60 uppercase tracking-wider w-20">
              #
            </th>
            <th className="text-center py-2 px-2 text-[10px] font-semibold text-[#1e1b16]/60 uppercase tracking-wider w-28">
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          {intentsWithQueries.map(({ intent, queries }) =>
            queries.map((query, idx) => {
              const isEditing = editingQuery?.intentId === intent.id && editingQuery?.index === idx;

              return (
                <tr
                  key={`${intent.id}-${idx}`}
                  className={`
                    border-b border-[#e3dacb]/50 hover:bg-[#f6f1e8]/50
                    transition-colors
                    ${isEditing ? "bg-[#f6f1e8]" : ""}
                  `}
                >
                  {/* Query Text */}
                  <td className="py-2 px-3 align-top">
                    {isEditing ? (
                      <textarea
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        className="w-full text-xs text-[#1e1b16] bg-white border border-[#e3dacb] rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#b86f3a] resize-none"
                        rows={2}
                        autoFocus
                      />
                    ) : (
                      <div
                        className="text-xs text-[#1e1b16] leading-relaxed cursor-pointer hover:text-[#b86f3a]"
                        onClick={() => startEdit(intent.id, idx, query)}
                      >
                        {query}
                      </div>
                    )}
                  </td>

                  {/* Intent */}
                  <td className="py-2 px-2 align-top">
                    <Badge
                      variant="outline"
                      className="text-[9px] px-1.5 py-0.5 bg-[#f6f1e8] border-[#e3dacb] text-[#1e1b16]/70"
                    >
                      {intent.text.length > 15
                        ? intent.text.slice(0, 15) + "..."
                        : intent.text}
                    </Badge>
                  </td>

                  {/* Index */}
                  <td className="py-2 px-2 align-top text-center">
                    <span className="text-[10px] text-[#1e1b16]/50 font-mono">
                      {idx + 1}
                    </span>
                  </td>

                  {/* Actions */}
                  <td className="py-2 px-2 align-top">
                    <div className="flex items-center justify-center gap-1">
                      {isEditing ? (
                        <>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 w-6 p-0 text-[#6e7c5b] hover:bg-[#d4e5d4]"
                            onClick={saveEdit}
                          >
                            ✓
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 w-6 p-0 text-[#b86f3a] hover:bg-[#f5e6d3]"
                            onClick={cancelEdit}
                          >
                            ✕
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 w-6 p-0 text-[#1e1b16]/40 hover:text-[#b86f3a] hover:bg-[#f5e6d3]"
                            onClick={() => onQueryRegenerate(intent.id, idx)}
                            title="Regenerate"
                          >
                            <RotateCcw className="h-3 w-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 w-6 p-0 text-[#1e1b16]/40 hover:text-[#1f3b2c] hover:bg-[#efe6d9]"
                            onClick={() => startEdit(intent.id, idx, query)}
                            title="Edit"
                          >
                            <Pencil className="h-3 w-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 w-6 p-0 text-[#1e1b16]/40 hover:text-[#b86f3a] hover:bg-[#f5e6d3]"
                            onClick={() => onQueryDelete(intent.id, idx)}
                            title="Delete"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>

      {/* Add Query Buttons - One per intent */}
      <div className="mt-2 space-y-1">
        {intentsWithQueries.map(({ intent }) => (
          <Button
            key={intent.id}
            variant="ghost"
            size="sm"
            className="w-full h-7 text-[10px] text-[#1e1b16]/60 hover:text-[#b86f3a] hover:bg-[#f6f1e8]"
            onClick={() => onQueryAdd(intent.id)}
          >
            <Plus className="h-3 w-3 mr-2" />
            Add to &quot;{intent.text.length > 20 ? intent.text.slice(0, 20) + "..." : intent.text}&quot;
          </Button>
        ))}
      </div>
    </div>
  );
}
