"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PersonaList } from "@/components/admin/PersonaList";
import { StageList } from "@/components/admin/StageList";
import { MatrixPreview } from "@/components/admin/MatrixPreview";
import { ViewToggle } from "@/components/ui/view-toggle";
import { Save, EyeOff, RotateCcw, Loader2 } from "lucide-react";
import type { MatrixConfig, MatrixPersona, MatrixStage } from "@/lib/matrix/types";

export default function AdminMatrixStudioPage() {
  const [config, setConfig] = useState<MatrixConfig>({ personas: [], stages: [] });
  const [originalConfig, setOriginalConfig] = useState<MatrixConfig>({ personas: [], stages: [] });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [searchMode, setSearchMode] = useState<"x_search" | "web_search">("x_search");
  const [loadingMode, setLoadingMode] = useState(true);
  const [savingMode, setSavingMode] = useState(false);

  // Load configuration
  const loadConfig = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/matrix/config");
      if (!response.ok) throw new Error("Failed to load config");

      const data: MatrixConfig = await response.json();
      setConfig(data);
      setOriginalConfig(data);
      setLastSaved(null);
      setHasChanges(false);
    } catch (error) {
      console.error("Error loading config:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadConfig();
    loadSearchMode();
  }, []);

  const loadSearchMode = async () => {
    setLoadingMode(true);
    try {
      const response = await fetch("/api/app-settings");
      if (!response.ok) throw new Error("Failed to load search mode");

      const data = await response.json();
      if (data?.searchMode === "x_search" || data?.searchMode === "web_search") {
        setSearchMode(data.searchMode);
      }
    } catch (error) {
      console.error("Error loading search mode:", error);
    } finally {
      setLoadingMode(false);
    }
  };

  // Check for changes
  useEffect(() => {
    const changed =
      JSON.stringify(config.personas) !== JSON.stringify(originalConfig.personas) ||
      JSON.stringify(config.stages) !== JSON.stringify(originalConfig.stages);
    setHasChanges(changed);
  }, [config, originalConfig]);

  // Handle persona updates
  const handlePersonaUpdate = (personaId: string, updates: Partial<MatrixPersona>) => {
    setConfig((prev) => ({
      ...prev,
      personas: prev.personas.map((p) =>
        p.id === personaId ? { ...p, ...updates } : p
      ),
    }));
  };

  // Handle stage updates
  const handleStageUpdate = (stageId: string, updates: Partial<MatrixStage>) => {
    setConfig((prev) => ({
      ...prev,
      stages: prev.stages.map((s) =>
        s.id === stageId ? { ...s, ...updates } : s
      ),
    }));
  };

  // Handle persona add
  const handlePersonaAdd = (newPersona: Omit<MatrixPersona, "id">) => {
    const id = `persona_${crypto.randomUUID().slice(0, 8)}`;
    setConfig((prev) => ({
      ...prev,
      personas: [...prev.personas, { ...newPersona, id }],
    }));
  };

  // Handle persona delete
  const handlePersonaDelete = (personaId: string) => {
    setConfig((prev) => ({
      ...prev,
      personas: prev.personas.filter((p) => p.id !== personaId),
    }));
  };

  // Handle stage add
  const handleStageAdd = (newStage: Omit<MatrixStage, "id">) => {
    const id = `stage_${crypto.randomUUID().slice(0, 8)}`;
    setConfig((prev) => ({
      ...prev,
      stages: [...prev.stages, { ...newStage, id }],
    }));
  };

  // Handle stage delete
  const handleStageDelete = (stageId: string) => {
    setConfig((prev) => ({
      ...prev,
      stages: prev.stages.filter((s) => s.id !== stageId),
    }));
  };

  // Handle persona reordering
  const handlePersonaReorder = (personas: MatrixPersona[]) => {
    setConfig((prev) => ({
      ...prev,
      personas: personas.map((p, i) => ({ ...p, orderIndex: i })),
    }));
  };

  // Handle stage reordering
  const handleStageReorder = (stages: MatrixStage[]) => {
    setConfig((prev) => ({
      ...prev,
      stages: stages.map((s, i) => ({ ...s, orderIndex: i })),
    }));
  };

  // Save draft
  const handleSaveDraft = async () => {
    setSaving(true);
    try {
      const response = await fetch("/api/matrix/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });

      if (!response.ok) throw new Error("Failed to save draft");

      await response.json();
      setLastSaved(new Date().toLocaleTimeString());
      setOriginalConfig(config);
      setHasChanges(false);
    } catch (error) {
      console.error("Error saving draft:", error);
    } finally {
      setSaving(false);
    }
  };

  // Publish configuration
  const handlePublish = async () => {
    if (!confirm("Are you sure you want to publish this configuration? This will update the live matrix.")) {
      return;
    }

    setPublishing(true);
    try {
      const response = await fetch("/api/matrix/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });

      if (!response.ok) throw new Error("Failed to publish");

      await response.json();
      setLastSaved(new Date().toLocaleTimeString());
      setOriginalConfig(config);
      setHasChanges(false);
    } catch (error) {
      console.error("Error publishing:", error);
    } finally {
      setPublishing(false);
    }
  };

  // Discard changes
  const handleDiscard = () => {
    if (!hasChanges || confirm("Discard all unsaved changes?")) {
      setConfig(originalConfig);
      setHasChanges(false);
    }
  };

  const handleSearchModeChange = async (nextMode: "x_search" | "web_search") => {
    if (savingMode || loadingMode || nextMode === searchMode) return;

    const previous = searchMode;
    setSearchMode(nextMode);
    setSavingMode(true);

    try {
      const response = await fetch("/api/app-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ searchMode: nextMode }),
      });

      if (!response.ok) throw new Error("Failed to update search mode");
    } catch (error) {
      console.error("Error saving search mode:", error);
      setSearchMode(previous);
    } finally {
      setSavingMode(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-[1800px] mx-auto px-6 py-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Matrix Studio</h1>
              <p className="text-sm text-gray-500 mt-1">Manage personas and stages for the visibility matrix</p>
            </div>
            <ViewToggle />
          </div>

          <div className="flex items-center gap-3">
            {lastSaved && (
              <span className="text-sm text-gray-500 mr-2">
                Last saved: {lastSaved}
              </span>
            )}

            <Button
              variant="outline"
              onClick={handleDiscard}
              disabled={!hasChanges}
              className="gap-2"
            >
              <RotateCcw className="w-4 h-4" />
              Discard
            </Button>

            <Button
              variant="outline"
              onClick={handleSaveDraft}
              disabled={!hasChanges || saving}
              className="gap-2"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              Save Draft
            </Button>

            <Button
              onClick={handlePublish}
              disabled={publishing}
              className="gap-2 bg-emerald-700 hover:bg-emerald-800"
            >
              {publishing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <EyeOff className="w-4 h-4" />
              )}
              Publish
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-[1800px] mx-auto px-6 py-8">
        <div className="mb-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">xAI Search Mode</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  variant={searchMode === "x_search" ? "default" : "outline"}
                  disabled={loadingMode || savingMode}
                  onClick={() => handleSearchModeChange("x_search")}
                >
                  X Search
                </Button>
                <Button
                  variant={searchMode === "web_search" ? "default" : "outline"}
                  disabled={loadingMode || savingMode}
                  onClick={() => handleSearchModeChange("web_search")}
                >
                  Web Search
                </Button>
                {savingMode && <Loader2 className="w-4 h-4 animate-spin text-gray-400" />}
                <span className="text-sm text-gray-500">Applies to new runs only.</span>
              </div>
            </CardContent>
          </Card>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Personas Column */}
          <div className="lg:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Personas</CardTitle>
              </CardHeader>
              <CardContent>
                <PersonaList
                  personas={config.personas}
                  onUpdate={handlePersonaUpdate}
                  onReorder={handlePersonaReorder}
                  onAdd={handlePersonaAdd}
                  onDelete={handlePersonaDelete}
                />
              </CardContent>
            </Card>
          </div>

          {/* Stages Column */}
          <div className="lg:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Stages</CardTitle>
              </CardHeader>
              <CardContent>
                <StageList
                  stages={config.stages}
                  onUpdate={handleStageUpdate}
                  onReorder={handleStageReorder}
                  onAdd={handleStageAdd}
                  onDelete={handleStageDelete}
                />
              </CardContent>
            </Card>
          </div>

          {/* Preview Column */}
          <div className="lg:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Live Preview</CardTitle>
              </CardHeader>
              <CardContent>
                <MatrixPreview personas={config.personas} stages={config.stages} />
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
