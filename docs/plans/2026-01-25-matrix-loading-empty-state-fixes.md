# Matrix Loading Empty-State Fixes Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Ensure the matrix shows a clear loading state, clears stale history when no runs exist, and surfaces empty-state UI instead of a blank grid.

**Architecture:** Adjust the matrix data hook and visibility-matrix page state handling to correctly reflect empty history and config error paths. Add explicit empty-state UI when there are no runs. Keep changes localized to the Matrix data layer and Insight modal metrics.

**Tech Stack:** Next.js (App Router), React 19, TypeScript, Vitest.

---

### Task 1: Clear history state when API returns no runs

**Files:**
- Modify: `src/lib/matrix/data/useMatrixData.ts`
- Test: `src/lib/matrix/data/__tests__/useMatrixData.test.tsx`

**Step 1: Write the failing test**

```ts
import { describe, it, expect, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useMatrixData } from "@/lib/matrix/data/useMatrixData";

const respond = (body: unknown) => new Response(JSON.stringify(body));

describe("useMatrixData empty history", () => {
  it("clears history when history API returns empty runs", async () => {
    const fetchSpy = vi.fn(async (url: RequestInfo) => {
      const u = String(url);
      if (u.includes("/api/matrix/active")) {
        return respond({ personas: [{ id: "cpo", label: "CPO" }], stages: [{ id: "explore", label: "Explore" }] });
      }
      if (u.includes("/api/benchmark/runs/history")) {
        return respond({ runs: [] });
      }
      if (u.includes("/api/intents/library")) {
        return respond({ version: 1, updatedAt: new Date().toISOString(), intents: [], history: [] });
      }
      return respond({});
    });
    vi.stubGlobal("fetch", fetchSpy as unknown as typeof fetch);

    const { result } = renderHook(() => useMatrixData({ active: true }));
    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(result.current.history).toEqual([]);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/matrix/data/__tests__/useMatrixData.test.tsx`
Expected: FAIL (history not cleared / stale)

**Step 3: Write minimal implementation**

```ts
// useMatrixData.ts (inside history load)
const next = hist.runs as StoredRun[];
if (!areRunsEquivalent(historyRef.current, next)) {
  historyRef.current = next;
  setHistory(next);
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- src/lib/matrix/data/__tests__/useMatrixData.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/matrix/data/useMatrixData.ts src/lib/matrix/data/__tests__/useMatrixData.test.tsx
git commit -m "fix: clear matrix history when empty"
```

---

### Task 2: Unblock config loading on error

**Files:**
- Modify: `src/app/visibility-matrix/page.tsx`
- Test: `src/lib/matrix/data/__tests__/useMatrixData.test.tsx` (new test for error status) OR manual verification

**Step 1: Write the failing test (optional if no page tests)**

```ts
import { describe, it, expect, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useMatrixData } from "@/lib/matrix/data/useMatrixData";

describe("useMatrixData error", () => {
  it("sets status=error when config fetch fails", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: RequestInfo) => {
      if (String(url).includes("/api/matrix/active")) {
        return new Response("boom", { status: 500 });
      }
      return new Response(JSON.stringify({ runs: [] }));
    })) as any;

    const { result } = renderHook(() => useMatrixData({ active: true }));
    await waitFor(() => expect(result.current.status).toBe("error"));
  });
});
```

**Step 2: Minimal implementation**

```ts
// page.tsx: in effect syncing config
useEffect(() => {
  if (matrixDataHook.config) {
    ...
    setMatrixConfigLoading(false);
  } else if (matrixDataHook.status === "error") {
    setMatrixConfigLoading(false);
  }
}, [matrixDataHook.config, matrixDataHook.status]);
```

**Step 3: Verify**

- Manual: load `/visibility-matrix` with config API returning 500 → banner shows + page renders default config (no hard block).

**Step 4: Commit**

```bash
git add src/app/visibility-matrix/page.tsx
# add test file if created
# git add src/lib/matrix/data/__tests__/useMatrixData.test.tsx
git commit -m "fix: unblock matrix on config error"
```

---

### Task 3: Add explicit empty-state for no history + no results

**Files:**
- Modify: `src/app/visibility-matrix/page.tsx`
- Optional Test: `src/components/visibility-matrix/__tests__/MatrixDataBoundary.test.tsx` or new simple UI test

**Step 1: Define a derived empty state**

```ts
const isEmptyState = matrixDataHook.status === "ready"
  && historicalRuns.length === 0
  && Object.values(matrixData).every(cell => cell.results.length === 0);
```

**Step 2: Render a minimal empty-state block**

```tsx
{isEmptyState && (
  <div className="rounded-none border border-dashed border-[#e3dacb] bg-white px-8 py-12 text-center">
    <p className="text-sm text-black/60">No benchmark data yet.</p>
    <p className="text-xs text-black/40 mt-2">Run a benchmark to populate the matrix.</p>
  </div>
)}
```

**Step 3: Manual verify**

- Fresh DB → empty state visible. Run a benchmark → matrix fills.

**Step 4: Commit**

```bash
git add src/app/visibility-matrix/page.tsx
git commit -m "feat: add matrix empty-state"
```

---

### Task 4: Fix compare win-rate denominator to exclude “none” outcomes

**Files:**
- Modify: `src/lib/matrix/insightMetrics.ts`
- Test: `src/lib/matrix/__tests__/insightMetrics.test.ts`

**Step 1: Write failing test**

```ts
it("excludes comparisonOutcome 'none' from win-rate denominator", () => {
  const results = [{
    responses: [
      { provider: "openai", visibility: { comparisonOutcome: "favorable" } },
      { provider: "openai", visibility: { comparisonOutcome: "none" } },
    ]
  }];
  const metrics = computeInsightMetrics("compare", results as any);
  expect(metrics.overall.winRate).toBe(1); // 1 favorable / 1 compared
});
```

**Step 2: Minimal implementation**

```ts
const considered = validResponses.filter(r => r.visibility?.comparisonOutcome && r.visibility.comparisonOutcome !== "none");
const wins = considered.filter(r => r.visibility?.comparisonOutcome === "favorable").length;
const total = considered.length;
```

**Step 3: Run test**

Run: `npm test -- src/lib/matrix/__tests__/insightMetrics.test.ts`
Expected: PASS

**Step 4: Commit**

```bash
git add src/lib/matrix/insightMetrics.ts src/lib/matrix/__tests__/insightMetrics.test.ts
git commit -m "fix: compare win-rate excludes none"
```

---

### Task 5: Always show all providers in Insight modal (N/A when missing)

**Files:**
- Modify: `src/components/visibility-matrix/InsightModal.tsx`
- Test: `src/components/visibility-matrix/__tests__/InsightModal.test.tsx`

**Step 1: Write failing test**

```tsx
it("shows all providers in breakdown even when missing", () => {
  // render modal with results that only include openai
  // expect rows for openai, anthropic, gemini, xai
});
```

**Step 2: Minimal implementation**

```tsx
const PROVIDER_ORDER: ProviderKey[] = ["openai", "anthropic", "gemini", "xai"];
const providers = PROVIDER_ORDER.map((p) => [p, metrics.byProvider[p] ?? null] as const);
```

Render `N/A` when `providerMetrics` is null.

**Step 3: Run test**

Run: `npm test -- src/components/visibility-matrix/__tests__/InsightModal.test.tsx`
Expected: PASS

**Step 4: Commit**

```bash
git add src/components/visibility-matrix/InsightModal.tsx src/components/visibility-matrix/__tests__/InsightModal.test.tsx
git commit -m "fix: show all providers in insight breakdown"
```

---

### Task 6: Remove dead activationTick state

**Files:**
- Modify: `src/app/visibility-matrix/page.tsx`

**Step 1: Remove unused hook call**

```ts
// Remove activationTick usage + import
```

**Step 2: Commit**

```bash
git add src/app/visibility-matrix/page.tsx
git commit -m "chore: remove unused activation tick"
```

---

### Task 7: Clean local/editor artifacts from branch

**Files:**
- Delete: `.CLAUDE.md.swp`
- Delete: `.claude/settings.local.json`

**Steps:**

```bash
git rm .CLAUDE.md.swp .claude/settings.local.json
git commit -m "chore: remove local editor artifacts"
```

---

### Verification

```bash
npm test
npm run build
```

