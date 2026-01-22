# Dynamic Matrix Config Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Remove hard-coded personas/stages and drive the matrix from admin-configured data while keeping scoring stable via core-stage mapping.

**Architecture:** Introduce a runtime matrix-config loader (active personas/stages). Replace enum-based Stage/Persona with string IDs validated against config. Map custom stages to the fixed core stages (explore/consider/compare/decide) for scoring. Adjust aggregation tables to store stage_id + core_stage.

**Tech Stack:** Next.js (App Router), TypeScript, Zod, Supabase Postgres, existing run JSON schema.

---

## Pre-Requisite: Verify/Seed Matrix Config Tables

**CRITICAL:** Before starting, ensure the database has initial config data that matches current hardcoded values.

**Step 1: Check existing data**

```bash
# Run these queries in Supabase SQL Editor or via CLI
SELECT COUNT(*) FROM matrix_personas;
SELECT COUNT(*) FROM matrix_stages;
```

**Step 2: If tables are empty, seed with current values**

```sql
-- Seed personas matching current hardcoded values
INSERT INTO matrix_personas (persona_id, label, description, order_index, active) VALUES
  ('move_up', 'Move Up Buyer', 'Homeowner looking to upgrade', 0, true),
  ('retiree', 'Active Adult Retiree', 'Retiring and relocating', 1, true),
  ('luxury', 'Luxury Buyer', 'High-end property seeker', 2, true),
  ('first_time', 'First Time Buyer', 'First home purchase', 3, true)
ON CONFLICT (persona_id) DO NOTHING;

-- Seed stages matching current hardcoded values (all are core stages initially)
INSERT INTO matrix_stages (stage_id, label, description, order_index, active, core_stage, core_stage_mapping, primary_metric) VALUES
  ('explore', 'Explore', 'Discovery phase', 0, true, true, 'explore', 'discovery_rate'),
  ('consider', 'Consider', 'Evaluation phase', 1, true, true, 'consider', 'sentiment_score'),
  ('compare', 'Compare', 'Comparison phase', 2, true, true, 'compare', 'win_rate'),
  ('decide', 'Decide', 'Decision phase', 3, true, true, 'decide', 'recommendation_rate')
ON CONFLICT (stage_id) DO NOTHING;
```

**Step 3: Verify `get_active_matrix_config()` function exists**

```sql
-- Check if the function exists
SELECT routine_name FROM information_schema.routines
WHERE routine_name = 'get_active_matrix_config';
```

If missing, create it:
```sql
CREATE OR REPLACE FUNCTION get_active_matrix_config()
RETURNS TABLE (personas JSONB, stages JSONB) AS $$
BEGIN
  RETURN QUERY
  SELECT
    (SELECT jsonb_agg(jsonb_build_object(
      'id', persona_id,
      'label', label,
      'description', description,
      'fullText', full_text,
      'orderIndex', order_index,
      'active', active
    ) ORDER BY order_index) FROM matrix_personas WHERE active = true) as personas,
    (SELECT jsonb_agg(jsonb_build_object(
      'id', stage_id,
      'label', label,
      'description', description,
      'orderIndex', order_index,
      'active', active,
      'coreStage', core_stage,
      'coreStageMapping', core_stage_mapping,
      'primaryMetric', primary_metric
    ) ORDER BY order_index) FROM matrix_stages WHERE active = true) as stages;
END;
$$ LANGUAGE plpgsql;
```

---

## Task 1: Add runtime matrix config loader + validation helpers

**Files:**
- Create: `src/lib/matrix/runtime.ts`
- Modify: `src/lib/intents/types.ts`
- Test: `src/lib/matrix/__tests__/runtime.test.ts`

**Step 1: Write the failing test**

```ts
// src/lib/matrix/__tests__/runtime.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock before imports
vi.mock("@/lib/matrix/db", () => ({
  getActiveMatrixConfig: vi.fn(async () => ({
    personas: [{ id: "move_up", label: "Move Up Buyer", orderIndex: 0, active: true }],
    stages: [{ id: "explore", label: "Explore", orderIndex: 0, active: true, coreStageMapping: "explore" }],
  }))
}));

import { getActiveMatrixConfigCached, assertValidPersonaStage, getCoreStageMapping, clearConfigCache } from "@/lib/matrix/runtime";

describe("matrix runtime", () => {
  beforeEach(() => {
    clearConfigCache();
  });

  it("loads active config and caches it", async () => {
    const cfg1 = await getActiveMatrixConfigCached();
    const cfg2 = await getActiveMatrixConfigCached();
    expect(cfg1).toBe(cfg2); // Same reference = cached
    expect(cfg1.personas[0].id).toBe("move_up");
  });

  it("validates persona/stage combinations", async () => {
    const cfg = await getActiveMatrixConfigCached();
    expect(() => assertValidPersonaStage("move_up", "explore", cfg)).not.toThrow();
    expect(() => assertValidPersonaStage("invalid", "explore", cfg)).toThrow();
    expect(() => assertValidPersonaStage("move_up", "invalid", cfg)).toThrow();
  });

  it("maps stage to core stage for scoring", async () => {
    const cfg = await getActiveMatrixConfigCached();
    expect(getCoreStageMapping("explore", cfg)).toBe("explore");
    expect(() => getCoreStageMapping("invalid", cfg)).toThrow();
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npm test -- src/lib/matrix/__tests__/runtime.test.ts
```

Expected: FAIL (module not found)

**Step 3: Write implementation**

```ts
// src/lib/matrix/runtime.ts
import { getActiveMatrixConfig } from "@/lib/matrix/db";
import type { MatrixConfig } from "@/lib/matrix/types";

// Cache with TTL for serverless environments
let cached: MatrixConfig | null = null;
let cachedAt = 0;
const TTL_MS = 60_000; // 1 minute

/**
 * Get active matrix config with caching
 * Cache is per-instance (serverless-aware)
 */
export async function getActiveMatrixConfigCached(): Promise<MatrixConfig> {
  const now = Date.now();
  if (cached && now - cachedAt < TTL_MS) {
    return cached;
  }

  const cfg = await getActiveMatrixConfig();
  if (!cfg || !cfg.personas.length || !cfg.stages.length) {
    throw new Error("Matrix config not found or empty - check matrix_personas/matrix_stages tables");
  }

  cached = cfg;
  cachedAt = now;
  return cfg;
}

/**
 * Clear cache (for testing)
 */
export function clearConfigCache(): void {
  cached = null;
  cachedAt = 0;
}

/**
 * Validate that a persona/stage combination is valid in the current config
 */
export function assertValidPersonaStage(
  personaId: string,
  stageId: string,
  cfg: MatrixConfig
): void {
  const persona = cfg.personas.find(p => p.id === personaId && p.active);
  const stage = cfg.stages.find(s => s.id === stageId && s.active);

  if (!persona) {
    throw new Error(`Invalid or inactive persona: ${personaId}`);
  }
  if (!stage) {
    throw new Error(`Invalid or inactive stage: ${stageId}`);
  }
}

/**
 * Get the core stage mapping for scoring
 * Custom stages must map to one of: explore, consider, compare, decide
 */
export function getCoreStageMapping(
  stageId: string,
  cfg: MatrixConfig
): "explore" | "consider" | "compare" | "decide" {
  const stage = cfg.stages.find(s => s.id === stageId && s.active);

  if (!stage) {
    throw new Error(`Stage not found: ${stageId}`);
  }

  // Core stages map to themselves
  if (stage.coreStage && !stage.coreStageMapping) {
    if (["explore", "consider", "compare", "decide"].includes(stageId)) {
      return stageId as "explore" | "consider" | "compare" | "decide";
    }
  }

  if (!stage.coreStageMapping) {
    throw new Error(`Stage ${stageId} missing coreStageMapping - required for scoring`);
  }

  return stage.coreStageMapping;
}

/**
 * Get active persona IDs (convenience helper)
 */
export function getActivePersonaIds(cfg: MatrixConfig): string[] {
  return cfg.personas.filter(p => p.active).map(p => p.id);
}

/**
 * Get active stage IDs (convenience helper)
 */
export function getActiveStageIds(cfg: MatrixConfig): string[] {
  return cfg.stages.filter(s => s.active).map(s => s.id);
}
```

**Step 4: Add CoreStage type to types.ts (keep backward compatibility)**

```ts
// In src/lib/intents/types.ts - ADD these lines, don't remove existing enums yet

// Core stages are fixed for scoring logic
export const CoreStageSchema = z.enum(["explore", "consider", "compare", "decide"]);
export type CoreStage = z.infer<typeof CoreStageSchema>;

// Note: PersonaSchema and StageSchema remain as enums for now
// They will be migrated to strings in Task 6 after all consumers are updated
```

**Step 5: Run tests**

```bash
npm test -- src/lib/matrix/__tests__/runtime.test.ts
```

Expected: PASS

**Step 6: Commit**

```bash
git add src/lib/matrix/runtime.ts src/lib/intents/types.ts src/lib/matrix/__tests__/runtime.test.ts
git commit -m "feat: add runtime matrix config loader with caching and validation"
```

---

## Task 2: Add public endpoint for active config

**Files:**
- Create: `src/app/api/matrix/active/route.ts`
- Test: `src/app/api/matrix/active/__tests__/route.test.ts`

**Step 1: Write the failing test**

```ts
// src/app/api/matrix/active/__tests__/route.test.ts
import { GET } from "@/app/api/matrix/active/route";
import { vi, describe, it, expect, beforeEach } from "vitest";

vi.mock("@/lib/matrix/db", () => ({
  getActiveMatrixConfig: vi.fn(async () => ({
    personas: [{ id: "move_up", label: "Move Up", orderIndex: 0, active: true }],
    stages: [{ id: "explore", label: "Explore", orderIndex: 0, active: true, coreStageMapping: "explore" }],
  }))
}));

describe("GET /api/matrix/active", () => {
  it("returns active config with 200", async () => {
    const res = await GET();
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.personas).toHaveLength(1);
    expect(data.stages).toHaveLength(1);
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npm test -- src/app/api/matrix/active/__tests__/route.test.ts
```

Expected: FAIL (route missing)

**Step 3: Implement route**

```ts
// src/app/api/matrix/active/route.ts
import { NextResponse } from "next/server";
import { getActiveMatrixConfigCached } from "@/lib/matrix/runtime";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const cfg = await getActiveMatrixConfigCached();
    return NextResponse.json(cfg);
  } catch (err) {
    console.error("[matrix/active] Error:", err instanceof Error ? err.message : err);
    return NextResponse.json(
      { error: "Matrix config not available" },
      { status: 500 }
    );
  }
}
```

**Step 4: Run tests**

```bash
npm test -- src/app/api/matrix/active/__tests__/route.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add src/app/api/matrix/active/route.ts src/app/api/matrix/active/__tests__/route.test.ts
git commit -m "feat: add public endpoint for active matrix config"
```

---

## Task 3: Replace hardcoded personas/stages in UI

**Files:**
- Modify: `src/app/visibility-matrix/page.tsx`
- Modify: `src/components/visibility-matrix/SplitViewEditor.tsx` (if needed)
- Test: Manual verification

**Step 1: Add config loading hook**

Create a custom hook or load config in the page component:

```tsx
// In src/app/visibility-matrix/page.tsx

// Add state for matrix config
const [matrixConfig, setMatrixConfig] = useState<{
  personas: Array<{ id: string; label: string; orderIndex: number; active: boolean }>;
  stages: Array<{ id: string; label: string; orderIndex: number; active: boolean; coreStageMapping?: string }>;
} | null>(null);

// Load config on mount
useEffect(() => {
  fetch("/api/matrix/active")
    .then(res => res.json())
    .then(cfg => {
      if (cfg.personas && cfg.stages) {
        setMatrixConfig(cfg);
      }
    })
    .catch(err => console.error("[visibility-matrix] Failed to load config:", err));
}, []);

// Derive personas/stages from config (with fallback to current hardcoded values)
const personas = matrixConfig?.personas.map(p => p.id) ?? ALL_PERSONAS;
const stages = matrixConfig?.stages.map(s => s.id) ?? ALL_STAGES;
const personaLabels = Object.fromEntries(
  matrixConfig?.personas.map(p => [p.id, p.label]) ?? ALL_PERSONAS.map(p => [p, p])
);
const stageLabels = Object.fromEntries(
  matrixConfig?.stages.map(s => [s.id, s.label]) ?? ALL_STAGES.map(s => [s, s])
);
```

**Step 2: Replace hardcoded references**

- Replace `ALL_PERSONAS` iteration with `personas`
- Replace `ALL_STAGES` iteration with `stages`
- Use `personaLabels[id]` and `stageLabels[id]` for display

**Step 3: Update selection defaults**

```tsx
// Default to first persona/stage from config
const [selectedPersona, setSelectedPersona] = useState<string>(personas[0]);
const [selectedStage, setSelectedStage] = useState<string>(stages[0]);
```

**Step 4: Verify manually**

1. Run `npm run dev`
2. Open `/visibility-matrix`
3. Verify personas/stages render from config
4. Verify selection works

**Step 5: Run build**

```bash
npm run build
```

Expected: No TypeScript errors

**Step 6: Commit**

```bash
git add src/app/visibility-matrix/page.tsx
git commit -m "feat: load matrix personas/stages from config in UI"
```

---

## Task 4: Wire config into intent generation (BEFORE cron - critical dependency)

**Files:**
- Modify: `src/app/api/intents/generate/route.ts`
- Modify: `src/lib/intents/queryGenerator.ts`

**Step 1: Add validation in intent generation**

```ts
// In src/app/api/intents/generate/route.ts
import { getActiveMatrixConfigCached, assertValidPersonaStage, getCoreStageMapping } from "@/lib/matrix/runtime";

// In the handler:
const cfg = await getActiveMatrixConfigCached();

// Validate persona/stage against config
try {
  assertValidPersonaStage(data.persona, data.stage, cfg);
} catch (err) {
  return Response.json({ error: err instanceof Error ? err.message : "Invalid persona/stage" }, { status: 400 });
}

// Get core stage for prompt context
const coreStage = getCoreStageMapping(data.stage, cfg);
```

**Step 2: Update queryGenerator to accept coreStage**

```ts
// In src/lib/intents/queryGenerator.ts
export async function generateQueriesFromIntent(params: {
  persona: string;
  stage: string;
  coreStage?: string; // For prompt context
  intent: string;
  role: string;
  queryStyle: number;
  count?: number;
}): Promise<{ queries: string[] }>
```

Use `coreStage` (or fallback to `stage`) in the prompt for scoring context.

**Step 3: Test manually**

Generate an intent and verify it works with config validation.

**Step 4: Commit**

```bash
git add src/app/api/intents/generate/route.ts src/lib/intents/queryGenerator.ts
git commit -m "feat: validate intents against matrix config"
```

---

## Task 5: Use config in cron/manual run pipeline

**Files:**
- Modify: `src/app/api/benchmark/run/route.ts`
- Modify: `src/app/api/benchmark/scheduled/[stage]/route.ts`

**Step 1: Update manual run route**

```ts
// In src/app/api/benchmark/run/route.ts
import { getActiveMatrixConfigCached, assertValidPersonaStage, getCoreStageMapping } from "@/lib/matrix/runtime";

// Early in POST handler:
const cfg = await getActiveMatrixConfigCached();

// Validate each cell against config
for (const cell of data.cells) {
  try {
    assertValidPersonaStage(cell.persona, cell.stage, cfg);
  } catch (err) {
    return Response.json({ error: `Invalid cell: ${err instanceof Error ? err.message : err}` }, { status: 400 });
  }
}
```

**Step 2: Update scheduled cron route**

```ts
// In src/app/api/benchmark/scheduled/[stage]/route.ts
import { getActiveMatrixConfigCached, getActivePersonaIds, getCoreStageMapping } from "@/lib/matrix/runtime";

// Replace hardcoded constants:
const cfg = await getActiveMatrixConfigCached();

// Validate stage parameter against config
const activeStageIds = cfg.stages.filter(s => s.active).map(s => s.id);
if (!activeStageIds.includes(stageParam)) {
  return Response.json(
    { error: `Invalid stage: ${stageParam}. Active stages: ${activeStageIds.join(", ")}` },
    { status: 400 }
  );
}

// Replace ALL_PERSONAS with config
const activePersonas = getActivePersonaIds(cfg);

// Use coreStage for scoring
const coreStage = getCoreStageMapping(stage, cfg);
```

**Step 3: Add fallback for empty config**

```ts
if (!cfg.personas.length || !cfg.stages.length) {
  console.error("[cron] Matrix config is empty - cannot run benchmark");
  return Response.json({ error: "Matrix config empty" }, { status: 500 });
}
```

**Step 4: Run build**

```bash
npm run build
```

**Step 5: Commit**

```bash
git add src/app/api/benchmark/run/route.ts src/app/api/benchmark/scheduled/[stage]/route.ts
git commit -m "feat: use matrix config in benchmark cron and manual runs"
```

---

## Task 6: Update aggregation tables for custom stage IDs

**Files:**
- Create: `sql/2026-01-23-aggregation-stage-id.sql`
- Modify: `src/lib/runs/aggregator.ts`

**Step 1: Create migration**

```sql
-- sql/2026-01-23-aggregation-stage-id.sql

-- Add stage_id column to run_metrics (stage becomes core_stage)
ALTER TABLE run_metrics
  RENAME COLUMN stage TO core_stage;

ALTER TABLE run_metrics
  ADD COLUMN stage_id TEXT NOT NULL DEFAULT 'unknown';

-- Update constraint
ALTER TABLE run_metrics
  DROP CONSTRAINT IF EXISTS run_metrics_stage_check;

ALTER TABLE run_metrics
  ADD CONSTRAINT run_metrics_core_stage_check
  CHECK (core_stage IN ('explore', 'consider', 'compare', 'decide'));

-- Update unique constraint
ALTER TABLE run_metrics
  DROP CONSTRAINT IF EXISTS run_metrics_run_id_persona_stage_provider_key;

ALTER TABLE run_metrics
  ADD CONSTRAINT run_metrics_run_id_persona_stage_id_provider_key
  UNIQUE (run_id, persona, stage_id, provider);

-- Same for run_citations
ALTER TABLE run_citations
  RENAME COLUMN stage TO core_stage;

ALTER TABLE run_citations
  ADD COLUMN stage_id TEXT NOT NULL DEFAULT 'unknown';

ALTER TABLE run_citations
  DROP CONSTRAINT IF EXISTS run_citations_stage_check;

ALTER TABLE run_citations
  ADD CONSTRAINT run_citations_core_stage_check
  CHECK (core_stage IN ('explore', 'consider', 'compare', 'decide'));

-- Backfill: set stage_id = core_stage for existing data
UPDATE run_metrics SET stage_id = core_stage WHERE stage_id = 'unknown';
UPDATE run_citations SET stage_id = core_stage WHERE stage_id = 'unknown';

-- Remove default
ALTER TABLE run_metrics ALTER COLUMN stage_id DROP DEFAULT;
ALTER TABLE run_citations ALTER COLUMN stage_id DROP DEFAULT;
```

**Step 2: Update aggregator.ts**

```ts
// In src/lib/runs/aggregator.ts
import { getActiveMatrixConfigCached, getCoreStageMapping, parseCellKey } from "@/lib/matrix/runtime";

// In computeRunMetrics:
export async function computeRunMetrics(run: BenchmarkRun): Promise<RunMetricRow[]> {
  const cfg = await getActiveMatrixConfigCached();

  for (const [cellKey, cell] of Object.entries(run.cells)) {
    const { persona, stage: stageId } = parseCellKey(cellKey);
    const coreStage = getCoreStageMapping(stageId, cfg);

    // Store both stage_id and core_stage
    metrics.push({
      run_id: run.id,
      persona,
      stage_id: stageId,      // Custom or core stage ID
      core_stage: coreStage,  // Always one of 4 core stages
      provider,
      // ... rest of metrics
    });
  }
}
```

**Step 3: Update types**

```ts
// In aggregator types
export interface RunMetricRow {
  run_id: string;
  persona: string;
  stage_id: string;      // The actual stage ID from config
  core_stage: string;    // explore|consider|compare|decide
  provider: string;
  // ... rest
}
```

**Step 4: Apply migration**

```bash
npx supabase db push
# or run the SQL manually in Supabase dashboard
```

**Step 5: Commit**

```bash
git add sql/2026-01-23-aggregation-stage-id.sql src/lib/runs/aggregator.ts
git commit -m "feat: store stage_id + core_stage in aggregation tables"
```

---

## Task 7: Remove remaining hardcoded constants

**Files:**
- Modify: `src/lib/runs/utils.ts`
- Modify: `src/lib/intents/types.ts`

**Step 1: Update utils.ts**

```ts
// In src/lib/runs/utils.ts

// Keep constants for backward compatibility but mark as deprecated
/** @deprecated Use getActiveMatrixConfigCached() instead */
export const ALL_PERSONAS: string[] = ["move_up", "retiree", "luxury", "first_time"];

/** @deprecated Use getActiveMatrixConfigCached() instead */
export const ALL_STAGES: string[] = ["explore", "consider", "compare", "decide"];

// Remove the duplicate parseCellKey - use the one from runtime.ts
// Export from runtime instead
export { parseCellKey } from "@/lib/matrix/runtime";
```

**Step 2: Update types.ts schemas**

```ts
// In src/lib/intents/types.ts

// Change from enum to string with refinement
export const PersonaSchema = z.string().min(1).max(50);
export const StageSchema = z.string().min(1).max(50);

// Keep CoreStage as enum (fixed for scoring)
export const CoreStageSchema = z.enum(["explore", "consider", "compare", "decide"]);
export type CoreStage = z.infer<typeof CoreStageSchema>;

// Type aliases for clarity
export type Persona = string;
export type Stage = string;
```

**Step 3: Fix any TypeScript errors**

Run `npm run build` and fix any type errors caused by the schema change.

**Step 4: Commit**

```bash
git add src/lib/runs/utils.ts src/lib/intents/types.ts
git commit -m "refactor: deprecate hardcoded constants, use config-driven personas/stages"
```

---

## Task 8: Handle historical run compatibility

**Files:**
- Modify: `src/app/visibility-matrix/page.tsx`

**Step 1: Add fallback for unknown persona/stage labels**

```ts
// When displaying historical runs, persona/stage IDs may not be in current config
const getPersonaLabel = (id: string): string => {
  return personaLabels[id] ?? formatLegacyId(id);
};

const getStageLabel = (id: string): string => {
  return stageLabels[id] ?? formatLegacyId(id);
};

// Format legacy IDs for display (e.g., "move_up" -> "Move Up")
function formatLegacyId(id: string): string {
  return id
    .split("_")
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
```

**Step 2: Handle missing cells in historical runs**

Historical runs may have cells for personas/stages no longer in config. Display them with a visual indicator:

```tsx
// When rendering cells
const isLegacyCell = !personas.includes(cellPersona) || !stages.includes(cellStage);

<div className={cn(
  "cell",
  isLegacyCell && "opacity-60 border-dashed"
)}>
  {isLegacyCell && <span className="text-xs text-muted">(archived)</span>}
</div>
```

**Step 3: Commit**

```bash
git add src/app/visibility-matrix/page.tsx
git commit -m "feat: handle historical runs with archived personas/stages"
```

---

## Task 9: Documentation

**Files:**
- Create: `docs/matrix-config.md`
- Modify: `README.md`

**Step 1: Create documentation**

```markdown
# Matrix Configuration

The visibility matrix is driven by admin-configurable personas and stages stored in the database.

## Tables

- `matrix_personas` - Persona definitions (id, label, description, order, active)
- `matrix_stages` - Stage definitions (id, label, order, active, core_stage_mapping)

## Core Stage Mapping

Custom stages must map to one of 4 core stages for scoring:
- `explore` - Discovery metrics (discovery rate, top 3 rate)
- `consider` - Evaluation metrics (sentiment score)
- `compare` - Comparison metrics (win rate)
- `decide` - Decision metrics (recommendation rate)

## Adding a New Stage

1. Go to Admin > Matrix Config
2. Add stage with unique ID
3. Set `coreStageMapping` to appropriate core stage
4. Publish config
5. Create intents for the new stage

## Adding a New Persona

1. Go to Admin > Matrix Config
2. Add persona with unique ID and label
3. Publish config
4. Create intents for each stage

## API Endpoints

- `GET /api/matrix/active` - Get active config (public)
- `GET /api/matrix/config` - Admin config management
```

**Step 2: Update README**

Add a section pointing to the matrix config docs.

**Step 3: Commit**

```bash
git add docs/matrix-config.md README.md
git commit -m "docs: add matrix configuration documentation"
```

---

## Execution Summary

| Task | Description | Est. Time |
|------|-------------|-----------|
| Pre-req | Seed database tables | 10 min |
| Task 1 | Runtime config loader | 30 min |
| Task 2 | Public API endpoint | 15 min |
| Task 3 | UI config loading | 45 min |
| Task 4 | Intent validation | 30 min |
| Task 5 | Cron/manual run updates | 45 min |
| Task 6 | Aggregation schema update | 30 min |
| Task 7 | Remove hardcoded constants | 30 min |
| Task 8 | Historical run compatibility | 20 min |
| Task 9 | Documentation | 15 min |

**Total: ~4.5 hours**

---

## Verification Checklist

After completing all tasks:

- [ ] `npm run build` passes
- [ ] `/api/matrix/active` returns config
- [ ] Visibility matrix UI loads personas/stages from config
- [ ] Manual benchmark run validates against config
- [ ] Cron job uses config personas/stages
- [ ] Aggregation tables have `stage_id` + `core_stage`
- [ ] Historical runs display correctly with archived indicators
- [ ] Adding new persona in admin reflects in UI without code changes
- [ ] Adding new stage with core mapping works for scoring
