"use client";

import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Save,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  Plus,
  X,
} from "lucide-react";
import type {
  TenantConfig,
  BrandConfig,
  GeographyConfig,
  Competitor,
  EntityCategory,
} from "@/lib/config/types";

/* ------------------------------------------------------------------ */
/*  Defaults                                                          */
/* ------------------------------------------------------------------ */

const DEFAULT_BRAND: BrandConfig = {
  name: "",
  aliases: [],
  domain: "",
  highlightColor: "#dcf3dc",
};

const DEFAULT_GEOGRAPHY: GeographyConfig = {
  region: "",
  localities: [],
  nearbyMetros: [],
};

/* ------------------------------------------------------------------ */
/*  Reusable sub-components                                           */
/* ------------------------------------------------------------------ */

/** Editable string-list with add / remove chips */
function StringListEditor({
  label,
  items,
  onChange,
  placeholder,
}: {
  label: string;
  items: string[];
  onChange: (items: string[]) => void;
  placeholder?: string;
}) {
  const [draft, setDraft] = useState("");

  const add = () => {
    const trimmed = draft.trim();
    if (trimmed && !items.includes(trimmed)) {
      onChange([...items, trimmed]);
    }
    setDraft("");
  };

  const remove = (idx: number) => {
    onChange(items.filter((_, i) => i !== idx));
  };

  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium">{label}</Label>
      <div className="flex gap-2">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          placeholder={placeholder}
          className="flex-1"
        />
        <Button type="button" variant="outline" size="sm" onClick={add} className="shrink-0">
          <Plus className="w-4 h-4" />
        </Button>
      </div>
      {items.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-1">
          {items.map((item, idx) => (
            <Badge key={idx} variant="secondary" className="gap-1 pr-1">
              {item}
              <button
                type="button"
                onClick={() => remove(idx)}
                className="ml-0.5 rounded-full hover:bg-gray-300/50 p-0.5"
              >
                <X className="w-3 h-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main page                                                         */
/* ------------------------------------------------------------------ */

export default function AdminBrandPage() {
  /* ---- state ---- */
  const [brand, setBrand] = useState<BrandConfig>(DEFAULT_BRAND);
  const [geography, setGeography] = useState<GeographyConfig>(DEFAULT_GEOGRAPHY);
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [entityCategories, setEntityCategories] = useState<EntityCategory[]>([]);

  const [originalSnapshot, setOriginalSnapshot] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  /* ---- derived ---- */
  const currentSnapshot = useMemo(
    () => JSON.stringify({ brand, geography, competitors, entityCategories }),
    [brand, geography, competitors, entityCategories],
  );
  const hasChanges = currentSnapshot !== originalSnapshot;

  /* ---- load config on mount ---- */
  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/tenant/config");
        if (!res.ok) throw new Error("Failed to fetch config");
        const config: TenantConfig = await res.json();

        const b = config.brand ?? DEFAULT_BRAND;
        const g = config.geography ?? DEFAULT_GEOGRAPHY;
        const c = config.competitors ?? [];
        const e = config.entityCategories ?? [];

        setBrand(b);
        setGeography(g);
        setCompetitors(c);
        setEntityCategories(e);
        setOriginalSnapshot(JSON.stringify({ brand: b, geography: g, competitors: c, entityCategories: e }));
      } catch (err) {
        console.error("Error loading config:", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  /* ---- clear save message after 3s ---- */
  useEffect(() => {
    if (!saveMessage) return;
    const timer = setTimeout(() => setSaveMessage(null), 3000);
    return () => clearTimeout(timer);
  }, [saveMessage]);

  /* ---- save handler ---- */
  const handleSave = async () => {
    setSaving(true);
    setSaveMessage(null);
    try {
      const res = await fetch("/api/tenant/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brand, geography, competitors, entityCategories }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save");
      }
      setOriginalSnapshot(currentSnapshot);
      setSaveMessage({ type: "success", text: "Configuration saved successfully." });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to save configuration.";
      setSaveMessage({ type: "error", text: message });
    } finally {
      setSaving(false);
    }
  };

  /* ---- competitor helpers ---- */
  const addCompetitor = () => {
    setCompetitors((prev) => [
      ...prev,
      { name: "", aliases: [], isPrimary: false },
    ]);
  };

  const updateCompetitor = (idx: number, updates: Partial<Competitor>) => {
    setCompetitors((prev) =>
      prev.map((c, i) => (i === idx ? { ...c, ...updates } : c)),
    );
  };

  const removeCompetitor = (idx: number) => {
    setCompetitors((prev) => prev.filter((_, i) => i !== idx));
  };

  /* ---- entity category helpers ---- */
  const addEntityCategory = () => {
    setEntityCategories((prev) => [
      ...prev,
      { id: "", label: "", examples: [] },
    ]);
  };

  const updateEntityCategory = (idx: number, updates: Partial<EntityCategory>) => {
    setEntityCategories((prev) =>
      prev.map((e, i) => (i === idx ? { ...e, ...updates } : e)),
    );
  };

  const removeEntityCategory = (idx: number) => {
    setEntityCategories((prev) => prev.filter((_, i) => i !== idx));
  };

  /* ---- loading state ---- */
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  /* ---- render ---- */
  return (
    <div className="min-h-screen bg-[#f6f1e8]">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-[#1f3b2c]">Brand &amp; Geography</h1>
              <p className="text-sm text-gray-500 mt-1">
                Configure your brand identity, geography, competitors, and entity categories
              </p>
            </div>
            <div className="flex items-center gap-3">
              {saveMessage && (
                <span
                  className={`text-sm flex items-center gap-1 ${
                    saveMessage.type === "success" ? "text-emerald-600" : "text-red-600"
                  }`}
                >
                  {saveMessage.type === "success" ? (
                    <CheckCircle2 className="w-4 h-4" />
                  ) : (
                    <AlertTriangle className="w-4 h-4" />
                  )}
                  {saveMessage.text}
                </span>
              )}
              <Button
                onClick={handleSave}
                disabled={saving || !hasChanges}
                className="gap-2 bg-[#1f3b2c] hover:bg-[#1f3b2c]/90"
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                Save
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-6 py-8 space-y-6">
        {/* ============ Brand Section ============ */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg text-[#1f3b2c]">Brand</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="brand-name" className="text-sm font-medium">Brand Name</Label>
              <Input
                id="brand-name"
                value={brand.name}
                onChange={(e) => setBrand((b) => ({ ...b, name: e.target.value }))}
                placeholder="e.g. Your Brand Name"
              />
            </div>

            {/* Aliases */}
            <StringListEditor
              label="Aliases"
              items={brand.aliases}
              onChange={(aliases) => setBrand((b) => ({ ...b, aliases }))}
              placeholder="Add an alias and press Enter"
            />

            {/* Domain */}
            <div className="space-y-2">
              <Label htmlFor="brand-domain" className="text-sm font-medium">Domain</Label>
              <Input
                id="brand-domain"
                value={brand.domain ?? ""}
                onChange={(e) => setBrand((b) => ({ ...b, domain: e.target.value }))}
                placeholder="e.g. yourbrand.com"
              />
            </div>

            {/* Highlight Color */}
            <div className="space-y-2">
              <Label htmlFor="brand-color" className="text-sm font-medium">Highlight Color</Label>
              <div className="flex items-center gap-3">
                <input
                  id="brand-color"
                  type="color"
                  value={brand.highlightColor}
                  onChange={(e) => setBrand((b) => ({ ...b, highlightColor: e.target.value }))}
                  className="w-10 h-10 rounded border border-gray-300 cursor-pointer"
                />
                <Input
                  value={brand.highlightColor}
                  onChange={(e) => setBrand((b) => ({ ...b, highlightColor: e.target.value }))}
                  placeholder="#dcf3dc"
                  className="w-32 font-mono text-sm"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ============ Geography Section ============ */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg text-[#1f3b2c]">Geography</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Region */}
            <div className="space-y-2">
              <Label htmlFor="geo-region" className="text-sm font-medium">Region</Label>
              <Input
                id="geo-region"
                value={geography.region}
                onChange={(e) =>
                  setGeography((g) => ({ ...g, region: e.target.value }))
                }
                placeholder="e.g. Southwest Florida"
              />
            </div>

            {/* Localities */}
            <StringListEditor
              label="Localities"
              items={geography.localities}
              onChange={(localities) => setGeography((g) => ({ ...g, localities }))}
              placeholder="Add a locality and press Enter"
            />

            {/* Nearby Metros */}
            <StringListEditor
              label="Nearby Metros"
              items={geography.nearbyMetros}
              onChange={(nearbyMetros) => setGeography((g) => ({ ...g, nearbyMetros }))}
              placeholder="Add a metro area and press Enter"
            />
          </CardContent>
        </Card>

        {/* ============ Competitors Section ============ */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg text-[#1f3b2c]">Competitors</CardTitle>
              <Button type="button" variant="outline" size="sm" onClick={addCompetitor} className="gap-1">
                <Plus className="w-4 h-4" /> Add Competitor
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {competitors.length === 0 && (
              <p className="text-sm text-gray-400 italic">No competitors configured. Click &quot;Add Competitor&quot; to get started.</p>
            )}
            {competitors.map((comp, idx) => (
              <div
                key={idx}
                className="border border-gray-200 rounded-lg p-4 space-y-3 relative"
              >
                <button
                  type="button"
                  onClick={() => removeCompetitor(idx)}
                  className="absolute top-3 right-3 text-gray-400 hover:text-red-500"
                  aria-label="Remove competitor"
                >
                  <X className="w-4 h-4" />
                </button>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Name */}
                  <div className="space-y-1">
                    <Label className="text-xs font-medium">Name</Label>
                    <Input
                      value={comp.name}
                      onChange={(e) => updateCompetitor(idx, { name: e.target.value })}
                      placeholder="Competitor name"
                    />
                  </div>

                  {/* Primary toggle */}
                  <div className="flex items-end gap-2 pb-1">
                    <Switch
                      id={`comp-primary-${idx}`}
                      checked={comp.isPrimary}
                      onCheckedChange={(checked) => updateCompetitor(idx, { isPrimary: checked })}
                    />
                    <Label htmlFor={`comp-primary-${idx}`} className="text-xs">
                      Primary competitor
                    </Label>
                  </div>
                </div>

                {/* Aliases */}
                <StringListEditor
                  label="Aliases"
                  items={comp.aliases}
                  onChange={(aliases) => updateCompetitor(idx, { aliases })}
                  placeholder="Add alias and press Enter"
                />
              </div>
            ))}
          </CardContent>
        </Card>

        {/* ============ Entity Categories Section ============ */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg text-[#1f3b2c]">Entity Categories</CardTitle>
              <Button type="button" variant="outline" size="sm" onClick={addEntityCategory} className="gap-1">
                <Plus className="w-4 h-4" /> Add Category
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {entityCategories.length === 0 && (
              <p className="text-sm text-gray-400 italic">No entity categories configured. Click &quot;Add Category&quot; to get started.</p>
            )}
            {entityCategories.map((cat, idx) => (
              <div
                key={idx}
                className="border border-gray-200 rounded-lg p-4 space-y-3 relative"
              >
                <button
                  type="button"
                  onClick={() => removeEntityCategory(idx)}
                  className="absolute top-3 right-3 text-gray-400 hover:text-red-500"
                  aria-label="Remove category"
                >
                  <X className="w-4 h-4" />
                </button>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* ID */}
                  <div className="space-y-1">
                    <Label className="text-xs font-medium">ID</Label>
                    <Input
                      value={cat.id}
                      onChange={(e) => updateEntityCategory(idx, { id: e.target.value })}
                      placeholder="e.g. communities"
                      className="font-mono text-sm"
                    />
                  </div>

                  {/* Label */}
                  <div className="space-y-1">
                    <Label className="text-xs font-medium">Label</Label>
                    <Input
                      value={cat.label}
                      onChange={(e) => updateEntityCategory(idx, { label: e.target.value })}
                      placeholder="e.g. Communities"
                    />
                  </div>
                </div>

                {/* Examples */}
                <StringListEditor
                  label="Examples"
                  items={cat.examples}
                  onChange={(examples) => updateEntityCategory(idx, { examples })}
                  placeholder="Add example and press Enter"
                />
              </div>
            ))}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
