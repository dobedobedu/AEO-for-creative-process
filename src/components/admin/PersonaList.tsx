"use client";

import { useState } from "react";
import { GripVertical, Eye, EyeOff, Pencil, Check, X, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import type { MatrixPersona } from "@/lib/matrix/types";

interface PersonaListProps {
  personas: MatrixPersona[];
  onUpdate: (personaId: string, updates: Partial<MatrixPersona>) => void;
  onReorder: (personas: MatrixPersona[]) => void;
  onAdd: (persona: Omit<MatrixPersona, "id">) => void;
  onDelete: (personaId: string) => void;
}

export function PersonaList({ personas, onUpdate, onReorder, onAdd, onDelete }: PersonaListProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [addingNew, setAddingNew] = useState(false);
  const [editLabel, setEditLabel] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editFullText, setEditFullText] = useState("");
  const [draggedId, setDraggedId] = useState<string | null>(null);

  const startAdd = () => {
    setAddingNew(true);
    setEditLabel("");
    setEditDescription("");
    setEditFullText("");
  };

  const saveNew = () => {
    if (editLabel.trim()) {
      const newPersona: Omit<MatrixPersona, "id"> = {
        label: editLabel.trim(),
        description: editDescription.trim() || undefined,
        fullText: editFullText.trim() || undefined,
        orderIndex: personas.length,
        active: true,
      };
      onAdd(newPersona);
      setAddingNew(false);
      setEditLabel("");
      setEditDescription("");
      setEditFullText("");
    }
  };

  const cancelAdd = () => {
    setAddingNew(false);
    setEditLabel("");
    setEditDescription("");
    setEditFullText("");
  };

  const startEdit = (persona: MatrixPersona) => {
    setEditingId(persona.id);
    setEditLabel(persona.label);
    setEditDescription(persona.description || "");
    setEditFullText(persona.fullText || "");
  };

  const saveEdit = () => {
    if (editingId) {
      onUpdate(editingId, {
        label: editLabel,
        description: editDescription,
        fullText: editFullText,
      });
      setEditingId(null);
    }
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  const toggleActive = (persona: MatrixPersona) => {
    onUpdate(persona.id, { active: !persona.active });
  };

  const handleDragStart = (e: React.DragEvent, personaId: string) => {
    setDraggedId(personaId);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();

    if (draggedId === null || draggedId === targetId) return;

    const newPersonas = [...personas];
    const draggedIndex = newPersonas.findIndex((p) => p.id === draggedId);
    const targetIndex = newPersonas.findIndex((p) => p.id === targetId);

    if (draggedIndex < 0 || targetIndex < 0) return;

    const [removed] = newPersonas.splice(draggedIndex, 1);
    newPersonas.splice(targetIndex, 0, removed);

    onReorder(newPersonas);
    setDraggedId(null);
  };

  const handleDragEnd = () => {
    setDraggedId(null);
  };

  return (
    <div className="space-y-3">
      {personas.map((persona) => (
        <div
          key={persona.id}
          draggable={!editingId}
          onDragStart={(e) => handleDragStart(e, persona.id)}
          onDragOver={handleDragOver}
          onDrop={(e) => handleDrop(e, persona.id)}
          onDragEnd={handleDragEnd}
          className={`
            relative border rounded-lg transition-all
            ${editingId === persona.id ? "border-emerald-500 ring-2 ring-emerald-200" : "border-gray-200"}
            ${draggedId === persona.id ? "opacity-50" : ""}
            ${!persona.active ? "bg-gray-50" : "bg-white"}
            ${!editingId ? "cursor-move hover:border-gray-300" : ""}
          `}
        >
          {editingId === persona.id ? (
            // Edit mode
            <div className="p-4 space-y-3">
              <Input
                value={editLabel}
                onChange={(e) => setEditLabel(e.target.value)}
                placeholder="Persona label"
                className="font-medium"
              />

              <Input
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                placeholder="Short description (optional)"
              />

              <Textarea
                value={editFullText}
                onChange={(e) => setEditFullText(e.target.value)}
                placeholder="Full persona description"
                rows={4}
                className="text-sm"
              />

              <div className="flex justify-end gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={cancelEdit}
                  className="gap-1"
                >
                  <X className="w-4 h-4" />
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={saveEdit}
                  className="gap-1"
                >
                  <Check className="w-4 h-4" />
                  Save
                </Button>
              </div>
            </div>
          ) : (
            // View mode
            <div className="p-4">
              <div className="flex items-start gap-3">
                {/* Drag handle */}
                <div className="flex items-center justify-center w-6 h-6 mt-1 text-gray-400">
                  <GripVertical className="w-4 h-4" />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-gray-900">{persona.label}</h3>
                    {!persona.active && (
                      <Badge variant="secondary" className="text-xs">Inactive</Badge>
                    )}
                  </div>

                  {persona.description && (
                    <p className="text-sm text-gray-600 line-clamp-1">{persona.description}</p>
                  )}

                  {persona.fullText && (
                    <p className="text-xs text-gray-500 mt-1 line-clamp-2">{persona.fullText}</p>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => toggleActive(persona)}
                    className="h-8 w-8 p-0"
                    title={persona.active ? "Deactivate" : "Activate"}
                  >
                    {persona.active ? (
                      <Eye className="w-4 h-4 text-gray-500" />
                    ) : (
                      <EyeOff className="w-4 h-4 text-gray-400" />
                    )}
                  </Button>

                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => startEdit(persona)}
                    className="h-8 w-8 p-0"
                    title="Edit"
                  >
                    <Pencil className="w-4 h-4 text-gray-500" />
                  </Button>

                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      if (confirm(`Delete persona "${persona.label}"?`)) {
                        onDelete(persona.id);
                      }
                    }}
                    className="h-8 w-8 p-0"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4 text-red-500" />
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      ))}

      {/* Add new persona */}
      {addingNew ? (
        <div className="border border-dashed border-emerald-300 rounded-lg bg-emerald-50 p-4 space-y-3">
          <Input
            value={editLabel}
            onChange={(e) => setEditLabel(e.target.value)}
            placeholder="New persona label"
            className="font-medium"
            autoFocus
          />

          <Input
            value={editDescription}
            onChange={(e) => setEditDescription(e.target.value)}
            placeholder="Short description (optional)"
          />

          <Textarea
            value={editFullText}
            onChange={(e) => setEditFullText(e.target.value)}
            placeholder="Full persona description"
            rows={4}
            className="text-sm"
          />

          <div className="flex justify-end gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={cancelAdd}
              className="gap-1"
            >
              <X className="w-4 h-4" />
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={saveNew}
              className="gap-1"
            >
              <Check className="w-4 h-4" />
              Add
            </Button>
          </div>
        </div>
      ) : (
        <Button
          variant="outline"
          onClick={startAdd}
          className="w-full gap-2 border-dashed"
        >
          <Plus className="w-4 h-4" />
          Add Persona
        </Button>
      )}
    </div>
  );
}
