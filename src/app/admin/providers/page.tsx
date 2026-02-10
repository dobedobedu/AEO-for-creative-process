"use client";

import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Save, Loader2, AlertTriangle, CheckCircle2 } from "lucide-react";
import type { ProviderEntry } from "@/lib/config/types";

/** Default providers shown when config has none */
const DEFAULT_PROVIDERS: ProviderEntry[] = [
  { id: "openai", label: "OpenAI", model: "gpt-4.5-preview", weight: 0.25, active: true, apiKeyEnvVar: "OPENAI_API_KEY" },
  { id: "anthropic", label: "Anthropic", model: "claude-3-5-haiku-20241022", weight: 0.25, active: true, apiKeyEnvVar: "ANTHROPIC_API_KEY" },
  { id: "gemini", label: "Google Gemini", model: "gemini-3-pro-preview", weight: 0.25, active: true, apiKeyEnvVar: "GEMINI_API_KEY" },
  { id: "xai", label: "xAI", model: "grok-3-preview", weight: 0.25, active: true, apiKeyEnvVar: "XAI_API_KEY" },
];

export default function AdminProvidersPage() {
  const [providers, setProviders] = useState<ProviderEntry[]>([]);
  const [originalProviders, setOriginalProviders] = useState<ProviderEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Derived state
  const allDisabled = useMemo(() => providers.length > 0 && providers.every((p) => !p.active), [providers]);
  const hasChanges = useMemo(
    () => JSON.stringify(providers) !== JSON.stringify(originalProviders),
    [providers, originalProviders]
  );

  // Load current provider config
  useEffect(() => {
    async function loadProviders() {
      try {
        const res = await fetch("/api/tenant/config");
        if (!res.ok) throw new Error("Failed to fetch config");
        const config = await res.json();
        const loaded: ProviderEntry[] =
          config?.providers?.providers?.length > 0
            ? config.providers.providers
            : DEFAULT_PROVIDERS;
        setProviders(loaded);
        setOriginalProviders(loaded);
      } catch (err) {
        console.error("Error loading providers:", err);
        setProviders(DEFAULT_PROVIDERS);
        setOriginalProviders(DEFAULT_PROVIDERS);
      } finally {
        setLoading(false);
      }
    }
    loadProviders();
  }, []);

  // Clear save message after 3 seconds
  useEffect(() => {
    if (!saveMessage) return;
    const timer = setTimeout(() => setSaveMessage(null), 3000);
    return () => clearTimeout(timer);
  }, [saveMessage]);

  // Update a single provider field
  const updateProvider = (id: string, updates: Partial<ProviderEntry>) => {
    setProviders((prev) =>
      prev.map((p) => (p.id === id ? { ...p, ...updates } : p))
    );
  };

  // Save providers
  const handleSave = async () => {
    setSaving(true);
    setSaveMessage(null);
    try {
      const res = await fetch("/api/tenant/providers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ providers }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save");
      }

      setOriginalProviders(providers);
      setSaveMessage({ type: "success", text: "Provider configuration saved successfully." });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to save provider configuration.";
      setSaveMessage({ type: "error", text: message });
    } finally {
      setSaving(false);
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
    <div className="min-h-screen bg-[#f6f1e8]">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-[#1f3b2c]">Provider Configuration</h1>
              <p className="text-sm text-gray-500 mt-1">
                Manage AI providers, models, and scoring weights for benchmarks
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
                disabled={saving || !hasChanges || allDisabled}
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
        {/* Warning when all providers disabled */}
        {allDisabled && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>All providers disabled</AlertTitle>
            <AlertDescription>
              Benchmarks cannot run without at least one active provider. Enable at least one provider to continue.
            </AlertDescription>
          </Alert>
        )}

        {/* Provider Cards */}
        {providers.map((provider) => (
          <Card
            key={provider.id}
            className={`transition-opacity ${!provider.active ? "opacity-60" : ""}`}
          >
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <CardTitle className="text-lg text-[#1f3b2c]">{provider.label}</CardTitle>
                  <Badge variant={provider.active ? "default" : "secondary"}>
                    {provider.active ? "Active" : "Inactive"}
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  <Label htmlFor={`switch-${provider.id}`} className="text-sm text-gray-500">
                    {provider.active ? "Enabled" : "Disabled"}
                  </Label>
                  <Switch
                    id={`switch-${provider.id}`}
                    checked={provider.active}
                    onCheckedChange={(checked) =>
                      updateProvider(provider.id, { active: checked })
                    }
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Model Input */}
              <div className="space-y-2">
                <Label htmlFor={`model-${provider.id}`} className="text-sm font-medium">
                  Model
                </Label>
                <Input
                  id={`model-${provider.id}`}
                  value={provider.model}
                  onChange={(e) =>
                    updateProvider(provider.id, { model: e.target.value })
                  }
                  placeholder="Enter model identifier"
                  disabled={!provider.active}
                />
              </div>

              {/* Weight Slider */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">Scoring Weight</Label>
                  <span className="text-sm font-mono text-[#b86f3a]">
                    {provider.weight.toFixed(2)}
                  </span>
                </div>
                <Slider
                  value={[provider.weight * 100]}
                  onValueChange={([val]) =>
                    updateProvider(provider.id, { weight: Math.round(val) / 100 })
                  }
                  min={0}
                  max={100}
                  step={1}
                  disabled={!provider.active}
                />
                <div className="flex justify-between text-xs text-gray-400">
                  <span>0</span>
                  <span>0.5</span>
                  <span>1</span>
                </div>
              </div>

              {/* API Key Env Var (read-only info) */}
              <div className="text-xs text-gray-400">
                API Key: <code className="bg-gray-100 px-1 py-0.5 rounded">{provider.apiKeyEnvVar}</code>
              </div>
            </CardContent>
          </Card>
        ))}
      </main>
    </div>
  );
}
