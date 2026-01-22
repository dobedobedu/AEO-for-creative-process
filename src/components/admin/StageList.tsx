"use client";

import { useState } from "react";
import { GripVertical, Eye, EyeOff, Pencil, Check, X, Star, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import type { MatrixStage } from "@/lib/matrix/types";

interface StageListProps {
  stages: MatrixStage[];
  onUpdate: (stageId: string, updates: Partial<MatrixStage>) => void;
  onReorder: (stages: MatrixStage[]) => void;
  onAdd: (stage: Omit<MatrixStage, "id">) => void;
  onDelete: (stageId: string) => void;
}

const METRIC_OPTIONS = [
  { value: "discovery_rate", label: "Discovery Rate" },
  { value: "mention_rate", label: "Mention Rate" },
  { value: "top3_rate", label: "Top 3 Rate" },
  { value: "sentiment_score", label: "Sentiment Score" },
  { value: "win_rate", label: "Win Rate" },
  { value: "recommendation_rate", label: "Recommendation Rate" },
];

const CORE_STAGE_OPTIONS = [
  { value: "explore", label: "Explore" },
  { value: "consider", label: "Consider" },
  { value: "compare", label: "Compare" },
  { value: "decide", label: "Decide" },
];

export function StageList({ stages, onUpdate, onReorder, onAdd, onDelete }: StageListProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [addingNew, setAddingNew] = useState(false);
  const [editLabel, setEditLabel] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editCoreStage, setEditCoreStage] = useState(false);
  const [editCoreStageMapping, setEditCoreStageMapping] = useState<string>("");
  const [editPrimaryMetric, setEditPrimaryMetric] = useState<string>("");
  const [draggedId, setDraggedId] = useState<string | null>(null);

  const startAdd = () => {
    setAddingNew(true);
    setEditLabel("");
    setEditDescription("");
    setEditCoreStage(false);
    setEditCoreStageMapping("");
    setEditPrimaryMetric("");
  };

  const saveNew = () => {
    if (editLabel.trim()) {
      const newStage: Omit<MatrixStage, "id"> = {
        label: editLabel.trim(),
        description: editDescription.trim() || undefined,
        orderIndex: stages.length,
        active: true,
        coreStage: editCoreStage,
        coreStageMapping: (editCoreStageMapping || undefined) as any,
        primaryMetric: (editPrimaryMetric || undefined) as any,
      };
      onAdd(newStage);
      setAddingNew(false);
      setEditLabel("");
      setEditDescription("");
      setEditCoreStage(false);
      setEditCoreStageMapping("");
      setEditPrimaryMetric("");
    }
  };

  const cancelAdd = () => {
    setAddingNew(false);
    setEditLabel("");
    setEditDescription("");
    setEditCoreStage(false);
    setEditCoreStageMapping("");
    setEditPrimaryMetric("");
  };

  const startEdit = (stage: MatrixStage) => {
    setEditingId(stage.id);
    setEditLabel(stage.label);
    setEditDescription(stage.description || "");
    setEditCoreStage(stage.coreStage || false);
    setEditCoreStageMapping(stage.coreStageMapping || "");
    setEditPrimaryMetric(stage.primaryMetric || "");
  };

  const saveEdit = () => {
    if (editingId) {
      onUpdate(editingId, {
        label: editLabel,
        description: editDescription,
        coreStage: editCoreStage,
        coreStageMapping: (editCoreStageMapping || undefined) as any,
        primaryMetric: (editPrimaryMetric || undefined) as any,
      });
      setEditingId(null);
    }
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  const toggleActive = (stage: MatrixStage) => {
    onUpdate(stage.id, { active: !stage.active });
  };

  const toggleCoreStage = (stage: MatrixStage) => {
    onUpdate(stage.id, { coreStage: !stage.coreStage });
  };

  const handleDragStart = (e: React.DragEvent, stageId: string) => {
    setDraggedId(stageId);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();

    if (draggedId === null || draggedId === targetId) return;

    const newStages = [...stages];
    const draggedIndex = newStages.findIndex((s) => s.id === draggedId);
    const targetIndex = newStages.findIndex((s) => s.id === targetId);

    if (draggedIndex < 0 || targetIndex < 0) return;

    const [removed] = newStages.splice(draggedIndex, 1);
    newStages.splice(targetIndex, 0, removed);

    onReorder(newStages);
    setDraggedId(null);
  };

  const handleDragEnd = () => {
    setDraggedId(null);
  };

  const getMetricLabel = (metric: string | undefined) => {
    return METRIC_OPTIONS.find((m) => m.value === metric)?.label || "None";
  };

  return (
    <div className="space-y-3">
      {stages.map((stage) => (
        <div
          key={stage.id}
          draggable={!editingId}
          onDragStart={(e) => handleDragStart(e, stage.id)}
          onDragOver={handleDragOver}
          onDrop={(e) => handleDrop(e, stage.id)}
          onDragEnd={handleDragEnd}
          className={`
            relative border rounded-lg transition-all
            ${editingId === stage.id ? "border-emerald-500 ring-2 ring-emerald-200" : "border-gray-200"}
            ${draggedId === stage.id ? "opacity-50" : ""}
            ${!stage.active ? "bg-gray-50" : "bg-white"}
            ${!editingId ? "cursor-move hover:border-gray-300" : ""}
          `}
        >
          {editingId === stage.id ? (
            // Edit mode
            <div className="p-4 space-y-3">
              <Input
                value={editLabel}
                onChange={(e) => setEditLabel(e.target.value)}
                placeholder="Stage label"
                className="font-medium"
              />

              <Input
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                placeholder="Short description (optional)"
              />

              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editCoreStage}
                    onChange={(e) => setEditCoreStage(e.target.checked)}
                    className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500"
                  />
                  <span>Core Stage</span>
                </label>

                <select
                  value={editPrimaryMetric}
                  onChange={(e) => setEditPrimaryMetric(e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="">No Primary Metric</option>
                  {METRIC_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              {editCoreStage && (
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 text-sm">
                    <span className="text-gray-600">Maps to:</span>
                    <select
                      value={editCoreStageMapping}
                      onChange={(e) => setEditCoreStageMapping(e.target.value)}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    >
                      <option value="">Select core stage...</option>
                      {CORE_STAGE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              )}

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
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <h3 className="font-semibold text-gray-900">{stage.label}</h3>
                    {stage.coreStage && (
                      <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                    )}
                    {!stage.active && (
                      <Badge variant="secondary" className="text-xs">Inactive</Badge>
                    )}
                  </div>

                  {stage.description && (
                    <p className="text-sm text-gray-600">{stage.description}</p>
                  )}

                  <div className="flex items-center gap-3 mt-2">
                    {stage.primaryMetric && (
                      <span className="text-xs text-gray-500">
                        Metric: <span className="font-medium">{getMetricLabel(stage.primaryMetric)}</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => toggleCoreStage(stage)}
                    className="h-8 w-8 p-0"
                    title={stage.coreStage ? "Remove from core" : "Mark as core"}
                  >
                    <Star
                      className={`w-4 h-4 ${stage.coreStage ? "text-amber-500 fill-amber-500" : "text-gray-400"}`}
                    />
                  </Button>

                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => toggleActive(stage)}
                    className="h-8 w-8 p-0"
                    title={stage.active ? "Deactivate" : "Activate"}
                  >
                    {stage.active ? (
                      <Eye className="w-4 h-4 text-gray-500" />
                    ) : (
                      <EyeOff className="w-4 h-4 text-gray-400" />
                    )}
                  </Button>

                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => startEdit(stage)}
                    className="h-8 w-8 p-0"
                    title="Edit"
                  >
                    <Pencil className="w-4 h-4 text-gray-500" />
                  </Button>

                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      if (confirm(`Delete stage "${stage.label}"?`)) {
                        onDelete(stage.id);
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

      {/* Add new stage */}
      {addingNew ? (
        <div className="border border-dashed border-emerald-300 rounded-lg bg-emerald-50 p-4 space-y-3">
          <Input
            value={editLabel}
            onChange={(e) => setEditLabel(e.target.value)}
            placeholder="New stage label"
            className="font-medium"
            autoFocus
          />

          <Input
            value={editDescription}
            onChange={(e) => setEditDescription(e.target.value)}
            placeholder="Short description (optional)"
          />

          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={editCoreStage}
                onChange={(e) => setEditCoreStage(e.target.checked)}
                className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500"
              />
              <span>Core Stage</span>
            </label>

            <select
              value={editPrimaryMetric}
              onChange={(e) => setEditPrimaryMetric(e.target.value)}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">No Primary Metric</option>
              {METRIC_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {editCoreStage && (
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-sm">
                <span className="text-gray-600">Maps to:</span>
                <select
                  value={editCoreStageMapping}
                  onChange={(e) => setEditCoreStageMapping(e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="">Select core stage...</option>
                  {CORE_STAGE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          )}

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
          Add Stage
        </Button>
      )}
    </div>
  );
}
