"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import {
  Loader2,
  ChevronRight,
  ChevronLeft,
  SkipForward,
  CheckCircle2,
  AlertTriangle,
  Plus,
  X,
  Sparkles,
} from "lucide-react";
import type {
  TenantConfig,
  BrandConfig,
  GeographyConfig,
  Competitor,
  EntityCategory,
  ProviderEntry,
  Industry,
} from "@/lib/config/types";

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

interface TemplateInfo {
  name: string;
  description: string;
  examples: string[];
}

interface TemplateFile {
  _filename: string;
  _templateInfo: TemplateInfo;
  brand: BrandConfig;
  competitors: Competitor[];
  personas: Array<{ id: string; label: string; description: string }>;
  stages: Array<{ id: string; label: string; description: string }>;
  entityCategories: EntityCategory[];
  geography: GeographyConfig;
  providers: {
    weights?: Record<string, number>;
    models?: Record<string, string>;
    providers?: ProviderEntry[];
  };
  industry: Industry;
}

/* ------------------------------------------------------------------ */
/*  Constants                                                         */
/* ------------------------------------------------------------------ */

const STEPS = [
  { id: "template", label: "Industry" },
  { id: "brand", label: "Brand" },
  { id: "competitors", label: "Competitors" },
  { id: "geography", label: "Geography" },
  { id: "providers", label: "Providers" },
  { id: "personas", label: "Personas & Stages" },
] as const;

const TOTAL_STEPS = STEPS.length;

const DEFAULT_PROVIDERS: ProviderEntry[] = [
  { id: "openai", label: "OpenAI", model: "gpt-5.2", weight: 0.4, active: true, apiKeyEnvVar: "OPENAI_API_KEY" },
  { id: "anthropic", label: "Anthropic", model: "claude-haiku-4-5", weight: 0.2, active: true, apiKeyEnvVar: "ANTHROPIC_API_KEY" },
  { id: "gemini", label: "Google Gemini", model: "gemini-3-flash-preview", weight: 0.3, active: true, apiKeyEnvVar: "GEMINI_API_KEY" },
  { id: "xai", label: "xAI", model: "grok-4-latest", weight: 0.1, active: true, apiKeyEnvVar: "XAI_API_KEY" },
];

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

const DEFAULT_PERSONAS: Array<{ id: string; label: string; description: string }> = [
  {
    id: "known_valued_parents",
    label: "Known & Valued Parents",
    description:
      "Public-school switchers seeking safety, accountability, and affordability with financial aid.",
  },
  {
    id: "known_valued_students",
    label: "Known & Valued Students",
    description:
      "Students who feel overlooked and want a safe, structured environment where they are known and supported.",
  },
  {
    id: "optimization_outcomes_parents",
    label: "Optimization & Outcomes Parents",
    description:
      "High-achieving families prioritizing rigor, Honors/AP pathways, and elite college outcomes.",
  },
  {
    id: "optimization_outcomes_students",
    label: "Optimization & Outcomes Students",
    description:
      "Driven students seeking challenge, strong peers, and a competitive profile for top universities.",
  },
  {
    id: "whole_child_parents",
    label: "Whole-Child Parents",
    description:
      "Families who value character, values, inclusion, and whole-child development alongside academics.",
  },
  {
    id: "whole_child_students",
    label: "Whole-Child Students",
    description:
      "Well-rounded students who thrive in leadership, service, chapel, and community engagement.",
  },
  {
    id: "balanced_specialists_parents",
    label: "Balanced Specialists Parents",
    description:
      "Families seeking niche excellence or athletic rigor without sacrificing balance and a normal school life.",
  },
  {
    id: "balanced_specialists_students",
    label: "Balanced Specialists Students",
    description:
      "Talented athletes or specialized learners seeking high performance with real friendships and balance.",
  },
];

const DEFAULT_STAGES: Array<{ id: string; label: string; description: string }> = [
  {
    id: "discover",
    label: "Discover",
    description: "Families identify options and define their core priorities.",
  },
  {
    id: "research",
    label: "Research",
    description: "Families evaluate academics, culture, support, and fit in depth.",
  },
  {
    id: "compare",
    label: "Compare",
    description: "Families benchmark top schools across outcomes, value, and experience.",
  },
  {
    id: "apply",
    label: "Apply",
    description: "Families finalize decisions, complete steps, and prepare to enroll.",
  },
];

/* ------------------------------------------------------------------ */
/*  Reusable sub-components                                           */
/* ------------------------------------------------------------------ */

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

function StepIndicator({ currentStep }: { currentStep: number }) {
  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: TOTAL_STEPS }, (_, i) => (
        <div
          key={i}
          className={`h-2 flex-1 rounded-full transition-colors ${
            i < currentStep
              ? "bg-[#1f3b2c]"
              : i === currentStep
              ? "bg-[#b86f3a]"
              : "bg-gray-200"
          }`}
        />
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main page component                                               */
/* ------------------------------------------------------------------ */

export default function SetupWizardPage() {
  const router = useRouter();

  /* ---- wizard state ---- */
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [setupAlreadyComplete, setSetupAlreadyComplete] = useState(false);

  /* ---- template state ---- */
  const [templates, setTemplates] = useState<TemplateFile[]>([]);
  const [selectedTemplateIdx, setSelectedTemplateIdx] = useState<number | null>(null);

  /* ---- config state ---- */
  const [brand, setBrand] = useState<BrandConfig>(DEFAULT_BRAND);
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [geography, setGeography] = useState<GeographyConfig>(DEFAULT_GEOGRAPHY);
  const [providers, setProviders] = useState<ProviderEntry[]>(DEFAULT_PROVIDERS);
  const [personas, setPersonas] = useState<Array<{ id: string; label: string; description: string }>>(DEFAULT_PERSONAS);
  const [stages, setStages] = useState<Array<{ id: string; label: string; description: string }>>(DEFAULT_STAGES);
  const [entityCategories, setEntityCategories] = useState<EntityCategory[]>([]);
  const [industry, setIndustry] = useState<Industry>("other");

  /* ---- load templates + check setup status on mount ---- */
  useEffect(() => {
    async function init() {
      try {
        // Check if setup is already complete
        const statusRes = await fetch("/api/tenant/setup-status");
        if (statusRes.ok) {
          const { setupComplete } = await statusRes.json();
          if (setupComplete) {
            setSetupAlreadyComplete(true);
            setLoading(false);
            return;
          }
        }

        // Load templates
        try {
          const res = await fetch("/api/tenant/templates");
          if (res.ok) {
            const data = await res.json();
            setTemplates(data);
          }
        } catch {
          // Templates not available — wizard still works without them
        }
      } catch (err) {
        console.error("Error initializing setup wizard:", err);
      } finally {
        setLoading(false);
      }
    }
    init();
  }, []);

  /* ---- apply template to all config fields ---- */
  const applyTemplate = useCallback((template: TemplateFile) => {
    setBrand(template.brand ?? DEFAULT_BRAND);
    setCompetitors(template.competitors ?? []);
    setGeography(template.geography ?? DEFAULT_GEOGRAPHY);
    setEntityCategories(template.entityCategories ?? []);
    setIndustry(template.industry ?? "other");

    // Convert old-style provider config to ProviderEntry[] if needed
    if (template.providers?.providers && template.providers.providers.length > 0) {
      setProviders(template.providers.providers);
    } else {
      const weights = template.providers?.weights ?? {};
      const models = template.providers?.models ?? {};
      setProviders(
        DEFAULT_PROVIDERS.map((p) => ({
          ...p,
          weight: weights[p.id] ?? p.weight,
          model: models[p.id] ?? p.model,
        }))
      );
    }

    setPersonas(template.personas ?? []);
    setStages(template.stages ?? []);
  }, []);

  /* ---- navigation ---- */
  const goNext = () => setStep((s) => Math.min(s + 1, TOTAL_STEPS - 1));
  const goBack = () => setStep((s) => Math.max(s - 1, 0));

  const isLastStep = step === TOTAL_STEPS - 1;

  /* ---- final save ---- */
  const handleFinish = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      // Build the full config payload
      // Derive legacy weights/models from the ProviderEntry[] for backward compat
      const weights: Record<string, number> = {};
      const models: Record<string, string> = {};
      for (const p of providers) {
        weights[p.id] = p.weight;
        models[p.id] = p.model;
      }

      const configPayload: Partial<TenantConfig> = {
        brand,
        competitors,
        geography,
        entityCategories,
        providers: {
          weights: weights as TenantConfig["providers"]["weights"],
          models: models as TenantConfig["providers"]["models"],
          providers,
        },
        personas,
        stages,
        industry,
      };

      // Save the full config
      const configRes = await fetch("/api/tenant/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(configPayload),
      });

      if (!configRes.ok) {
        const data = await configRes.json();
        throw new Error(data.error || "Failed to save configuration");
      }

      // Mark setup as complete
      const completeRes = await fetch("/api/tenant/setup-complete", {
        method: "POST",
      });

      if (!completeRes.ok) {
        throw new Error("Failed to mark setup as complete");
      }

      // Redirect to the main dashboard
      router.push("/visibility-matrix");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to save configuration.";
      setSaveError(message);
    } finally {
      setSaving(false);
    }
  };

  /* ---- competitor helpers ---- */
  const addCompetitor = () => {
    setCompetitors((prev) => [...prev, { name: "", aliases: [], isPrimary: false }]);
  };

  const updateCompetitor = (idx: number, updates: Partial<Competitor>) => {
    setCompetitors((prev) => prev.map((c, i) => (i === idx ? { ...c, ...updates } : c)));
  };

  const removeCompetitor = (idx: number) => {
    setCompetitors((prev) => prev.filter((_, i) => i !== idx));
  };

  /* ---- provider helpers ---- */
  const updateProvider = (id: string, updates: Partial<ProviderEntry>) => {
    setProviders((prev) => prev.map((p) => (p.id === id ? { ...p, ...updates } : p)));
  };

  /* ---- loading state ---- */
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#f6f1e8]">
        <div className="text-center space-y-4">
          <Loader2 className="w-8 h-8 animate-spin text-[#1f3b2c] mx-auto" />
          <p className="text-sm text-gray-500">Loading setup wizard…</p>
        </div>
      </div>
    );
  }

  /* ---- already complete state ---- */
  if (setupAlreadyComplete) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#f6f1e8]">
        <Card className="max-w-md w-full mx-4">
          <CardContent className="pt-6 text-center space-y-4">
            <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
            <h2 className="text-xl font-semibold text-[#1f3b2c]">Setup Already Complete</h2>
            <p className="text-sm text-gray-500">
              Your platform has already been configured. You can manage settings from the admin panel.
            </p>
            <div className="flex gap-3 justify-center pt-2">
              <Button variant="outline" onClick={() => router.push("/admin/brand")}>
                Admin Settings
              </Button>
              <Button
                onClick={() => router.push("/visibility-matrix")}
                className="bg-[#1f3b2c] hover:bg-[#1f3b2c]/90"
              >
                Go to Dashboard
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  /* ================================================================ */
  /*  Step renderers                                                  */
  /* ================================================================ */

  /* ---- Step 1: Industry Template Selection ---- */
  const renderTemplateStep = () => (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold text-[#1f3b2c]">Choose Your Industry</h2>
        <p className="text-sm text-gray-500 mt-1">
          Select a template to pre-populate your configuration, or skip to start from scratch.
        </p>
      </div>

      {templates.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-sm text-gray-400">No templates available. You can configure everything manually.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {templates.map((t, idx) => (
            <Card
              key={t._filename}
              className={`cursor-pointer transition-all hover:shadow-md ${
                selectedTemplateIdx === idx
                  ? "ring-2 ring-[#b86f3a] bg-orange-50/50"
                  : "hover:border-gray-300"
              }`}
              onClick={() => {
                setSelectedTemplateIdx(idx);
                applyTemplate(t);
              }}
            >
              <CardContent className="py-4">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium text-[#1f3b2c]">{t._templateInfo.name}</h3>
                      {selectedTemplateIdx === idx && (
                        <CheckCircle2 className="w-4 h-4 text-[#b86f3a]" />
                      )}
                    </div>
                    <p className="text-sm text-gray-500">{t._templateInfo.description}</p>
                    {t._templateInfo.examples.length > 0 && (
                      <div className="flex flex-wrap gap-1 pt-1">
                        {t._templateInfo.examples.map((ex) => (
                          <Badge key={ex} variant="secondary" className="text-xs">
                            {ex}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                  <Badge variant="outline" className="shrink-0 ml-3">
                    {t.personas?.length ?? 0} personas · {t.stages?.length ?? 0} stages
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );

  /* ---- Step 2: Brand Configuration ---- */
  const renderBrandStep = () => (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold text-[#1f3b2c]">Brand Identity</h2>
        <p className="text-sm text-gray-500 mt-1">
          Configure your brand name, aliases, and domain.
        </p>
      </div>

      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="brand-name" className="text-sm font-medium">Brand Name *</Label>
            <Input
              id="brand-name"
              value={brand.name}
              onChange={(e) => setBrand((b) => ({ ...b, name: e.target.value }))}
              placeholder="e.g. Your Brand Name"
            />
          </div>

          <StringListEditor
            label="Aliases"
            items={brand.aliases}
            onChange={(aliases) => setBrand((b) => ({ ...b, aliases }))}
            placeholder="Add an alias and press Enter"
          />

          <div className="space-y-2">
            <Label htmlFor="brand-domain" className="text-sm font-medium">Domain</Label>
            <Input
              id="brand-domain"
              value={brand.domain ?? ""}
              onChange={(e) => setBrand((b) => ({ ...b, domain: e.target.value }))}
              placeholder="e.g. yourbrand.com"
            />
          </div>

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
    </div>
  );

  /* ---- Step 3: Competitors ---- */
  const renderCompetitorsStep = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-[#1f3b2c]">Competitors</h2>
          <p className="text-sm text-gray-500 mt-1">
            Add the competitors you want to track in AI visibility benchmarks.
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={addCompetitor} className="gap-1">
          <Plus className="w-4 h-4" /> Add
        </Button>
      </div>

      {competitors.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-sm text-gray-400">No competitors yet. Click &quot;Add&quot; to get started.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {competitors.map((comp, idx) => (
            <Card key={idx}>
              <CardContent className="pt-4 space-y-3 relative">
                <button
                  type="button"
                  onClick={() => removeCompetitor(idx)}
                  className="absolute top-3 right-3 text-gray-400 hover:text-red-500"
                  aria-label="Remove competitor"
                >
                  <X className="w-4 h-4" />
                </button>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs font-medium">Name</Label>
                    <Input
                      value={comp.name}
                      onChange={(e) => updateCompetitor(idx, { name: e.target.value })}
                      placeholder="Competitor name"
                    />
                  </div>
                  <div className="flex items-end gap-2 pb-1">
                    <Switch
                      id={`comp-primary-${idx}`}
                      checked={comp.isPrimary}
                      onCheckedChange={(checked) => updateCompetitor(idx, { isPrimary: checked })}
                    />
                    <Label htmlFor={`comp-primary-${idx}`} className="text-xs">Primary competitor</Label>
                  </div>
                </div>

                <StringListEditor
                  label="Aliases"
                  items={comp.aliases}
                  onChange={(aliases) => updateCompetitor(idx, { aliases })}
                  placeholder="Add alias and press Enter"
                />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );

  /* ---- Step 4: Geography ---- */
  const renderGeographyStep = () => (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold text-[#1f3b2c]">Geography</h2>
        <p className="text-sm text-gray-500 mt-1">
          Define the geographic context for your brand. This helps AI models generate relevant queries.
        </p>
      </div>

      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="geo-region" className="text-sm font-medium">Region</Label>
            <Input
              id="geo-region"
              value={geography.region}
              onChange={(e) => setGeography((g) => ({ ...g, region: e.target.value }))}
              placeholder="e.g. Southwest Florida"
            />
          </div>

          <StringListEditor
            label="Localities"
            items={geography.localities}
            onChange={(localities) => setGeography((g) => ({ ...g, localities }))}
            placeholder="Add a locality and press Enter"
          />

          <StringListEditor
            label="Nearby Metros"
            items={geography.nearbyMetros}
            onChange={(nearbyMetros) => setGeography((g) => ({ ...g, nearbyMetros }))}
            placeholder="Add a metro area and press Enter"
          />
        </CardContent>
      </Card>
    </div>
  );

  /* ---- Step 5: Providers ---- */
  const renderProvidersStep = () => {
    const allDisabled = providers.every((p) => !p.active);

    return (
      <div className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold text-[#1f3b2c]">AI Providers</h2>
          <p className="text-sm text-gray-500 mt-1">
            Choose which AI providers to use for benchmarks and configure their models.
          </p>
        </div>

        {allDisabled && (
          <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            Benchmarks cannot run without at least one active provider.
          </div>
        )}

        <div className="space-y-3">
          {providers.map((provider) => (
            <Card
              key={provider.id}
              className={`transition-opacity ${!provider.active ? "opacity-60" : ""}`}
            >
              <CardContent className="pt-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-[#1f3b2c]">{provider.label}</span>
                    <Badge variant={provider.active ? "default" : "secondary"} className="text-xs">
                      {provider.active ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                  <Switch
                    checked={provider.active}
                    onCheckedChange={(checked) => updateProvider(provider.id, { active: checked })}
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-medium">Model</Label>
                  <Input
                    value={provider.model}
                    onChange={(e) => updateProvider(provider.id, { model: e.target.value })}
                    placeholder="Model identifier"
                    disabled={!provider.active}
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-medium">Weight</Label>
                    <span className="text-xs font-mono text-[#b86f3a]">{provider.weight.toFixed(2)}</span>
                  </div>
                  <Slider
                    value={[provider.weight * 100]}
                    onValueChange={([val]) => updateProvider(provider.id, { weight: Math.round(val) / 100 })}
                    min={0}
                    max={100}
                    step={1}
                    disabled={!provider.active}
                  />
                </div>

                <div className="text-xs text-gray-400">
                  API Key: <code className="bg-gray-100 px-1 py-0.5 rounded">{provider.apiKeyEnvVar}</code>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  };

  /* ---- Step 6: Personas & Stages Review ---- */
  const renderPersonasStep = () => (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold text-[#1f3b2c]">Personas &amp; Stages</h2>
        <p className="text-sm text-gray-500 mt-1">
          Review the personas and journey stages for your visibility matrix.
          {selectedTemplateIdx !== null && " These were pre-populated from your selected template."}
        </p>
      </div>

      {/* Personas */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base text-[#1f3b2c]">Personas</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {personas.length === 0 ? (
            <p className="text-sm text-gray-400 italic">No personas configured. You can add them later in Matrix Studio.</p>
          ) : (
            personas.map((p, idx) => (
              <div key={idx} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{p.label}</span>
                    <Badge variant="outline" className="text-xs font-mono">{p.id}</Badge>
                  </div>
                  {p.description && (
                    <p className="text-xs text-gray-500 mt-0.5">{p.description}</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setPersonas((prev) => prev.filter((_, i) => i !== idx))}
                  className="text-gray-400 hover:text-red-500 shrink-0"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Stages */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base text-[#1f3b2c]">Journey Stages</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {stages.length === 0 ? (
            <p className="text-sm text-gray-400 italic">No stages configured. You can add them later in Matrix Studio.</p>
          ) : (
            stages.map((s, idx) => (
              <div key={idx} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{s.label}</span>
                    <Badge variant="outline" className="text-xs font-mono">{s.id}</Badge>
                  </div>
                  {s.description && (
                    <p className="text-xs text-gray-500 mt-0.5">{s.description}</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setStages((prev) => prev.filter((_, i) => i !== idx))}
                  className="text-gray-400 hover:text-red-500 shrink-0"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Entity Categories (read-only summary) */}
      {entityCategories.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base text-[#1f3b2c]">Entity Categories</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {entityCategories.map((cat) => (
                <Badge key={cat.id} variant="secondary">{cat.label}</Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );

  /* ---- step content switcher ---- */
  const renderStepContent = () => {
    switch (step) {
      case 0: return renderTemplateStep();
      case 1: return renderBrandStep();
      case 2: return renderCompetitorsStep();
      case 3: return renderGeographyStep();
      case 4: return renderProvidersStep();
      case 5: return renderPersonasStep();
      default: return null;
    }
  };

  /* ================================================================ */
  /*  Main render                                                     */
  /* ================================================================ */

  return (
    <div className="min-h-screen bg-[#f6f1e8]">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-6 py-4">
          <div className="flex items-center gap-3 mb-3">
            <Sparkles className="w-5 h-5 text-[#b86f3a]" />
            <h1 className="text-xl font-bold text-[#1f3b2c]">Platform Setup</h1>
          </div>
          <div className="space-y-2">
            <StepIndicator currentStep={step} />
            <div className="flex items-center justify-between text-xs text-gray-500">
              <span>Step {step + 1} of {TOTAL_STEPS}: {STEPS[step].label}</span>
              {selectedTemplateIdx !== null && (
                <span className="text-[#b86f3a]">
                  Template: {templates[selectedTemplateIdx]?._templateInfo.name}
                </span>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-2xl mx-auto px-6 py-8">
        {renderStepContent()}

        {/* Error message */}
        {saveError && (
          <div className="mt-4 flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            {saveError}
          </div>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between mt-8 pt-6 border-t border-gray-200">
          <div>
            {step > 0 && (
              <Button variant="ghost" onClick={goBack} className="gap-1">
                <ChevronLeft className="w-4 h-4" /> Back
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {!isLastStep && (
              <Button
                variant="ghost"
                onClick={() => goNext()}
                className="gap-1 text-gray-500"
              >
                <SkipForward className="w-4 h-4" /> Skip
              </Button>
            )}

            {isLastStep ? (
              <Button
                onClick={handleFinish}
                disabled={saving}
                className="gap-2 bg-[#1f3b2c] hover:bg-[#1f3b2c]/90"
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-4 h-4" />
                )}
                Finish Setup
              </Button>
            ) : (
              <Button
                onClick={goNext}
                className="gap-1 bg-[#1f3b2c] hover:bg-[#1f3b2c]/90"
              >
                Next <ChevronRight className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
