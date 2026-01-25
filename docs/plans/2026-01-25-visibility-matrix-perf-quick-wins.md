# Visibility Matrix Perf Quick Wins Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Reduce unnecessary re-processing on visibility-matrix without behavior changes, using low-risk optimizations.

**Architecture:** Avoid redundant state updates and recomputation by comparing fetched history/config before setting state, and cache expensive run transforms by run id+timestamp. Remove leftover debug logging in hot paths.

**Tech Stack:** Next.js 16, React 19, TypeScript, Zod, shadcn/ui

---

## Task 1: Avoid redundant history/config state updates

**Why:** `useMatrixData` refetches on re-activation; if results are unchanged, setting new arrays triggers downstream transforms. Low-risk to short-circuit identical data.

**Files:**
- Modify: `src/lib/matrix/data/useMatrixData.ts`
- Test: `src/lib/matrix/data/__tests__/useMatrixData.test.tsx`

**Step 1: Write failing test for history equality helper**

Add a tiny helper and test it to lock behavior:

```ts
// src/lib/matrix/data/useMatrixData.ts
export function areRunsEquivalent(prev: StoredRun[], next: StoredRun[]): boolean {
  if (prev.length !== next.length) return false;
  for (let i = 0; i < prev.length; i++) {
    if (prev[i].id !== next[i].id) return false;
    if (prev[i].timestamp !== next[i].timestamp) return false;
  }
  return true;
}
```

```ts
// src/lib/matrix/data/__tests__/useMatrixData.test.tsx
import { areRunsEquivalent } from "../useMatrixData";

test("areRunsEquivalent returns true when id+timestamp match", () => {
  const a = [{ id: "1", timestamp: "2026-01-25T00:00:00Z" }] as any;
  const b = [{ id: "1", timestamp: "2026-01-25T00:00:00Z" }] as any;
  expect(areRunsEquivalent(a, b)).toBe(true);
});

test("areRunsEquivalent returns false when id differs", () => {
  const a = [{ id: "1", timestamp: "2026-01-25T00:00:00Z" }] as any;
  const b = [{ id: "2", timestamp: "2026-01-25T00:00:00Z" }] as any;
  expect(areRunsEquivalent(a, b)).toBe(false);
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- useMatrixData.test.tsx`
Expected: FAIL (helper not exported yet)

**Step 3: Implement minimal code**

Add helper + use it before `setHistory` and optionally before `setConfig`.

```ts
// src/lib/matrix/data/useMatrixData.ts
const historyRef = useRef<StoredRun[]>([]);

// inside history fetch .then((hist) => { ... })
const next = hist.runs as StoredRun[];
if (!areRunsEquivalent(historyRef.current, next)) {
  historyRef.current = next;
  setHistory(next);
}
```

Optionally do a shallow config compare by ids/labels to avoid `setConfig` if identical.

**Step 4: Run tests**

Run: `npm test -- useMatrixData.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/matrix/data/useMatrixData.ts src/lib/matrix/data/__tests__/useMatrixData.test.tsx
git commit -m "perf: avoid redundant history state updates"
```

---

## Task 2: Cache `toUiBenchmarkRun` transforms by run id + timestamp

**Why:** If history is re-fetched with identical runs (or reordered), avoid re-transforming each run’s cells.

**Files:**
- Modify: `src/app/visibility-matrix/page.tsx`
- Test: (optional) `src/lib/matrix/__tests__/history.test.ts`

**Step 1: Write failing test for cache key (optional but preferred)**

If adding a helper to compute cache keys, add a unit test.

```ts
// src/lib/matrix/history.ts
export function getRunCacheKey(run: StoredRun): string {
  return `${run.id}:${run.timestamp}`;
}
```

```ts
// src/lib/matrix/__tests__/history.test.ts
import { getRunCacheKey } from "../history";

test("getRunCacheKey is stable", () => {
  const run = { id: "abc", timestamp: "2026-01-25T00:00:00Z" } as any;
  expect(getRunCacheKey(run)).toBe("abc:2026-01-25T00:00:00Z");
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- history.test.ts`
Expected: FAIL (helper not exported yet)

**Step 3: Implement cache in page**

```ts
// src/app/visibility-matrix/page.tsx
const historyCacheRef = useRef(new Map<string, BenchmarkRun>());

useEffect(() => {
  if (matrixDataHook.history.length > 0) {
    const sortedRawRuns = matrixDataHook.history
      .slice()
      .sort((a, b) => a.timestamp.localeCompare(b.timestamp));

    setHistoricalRuns(sortedRawRuns);

    const cache = historyCacheRef.current;
    const runs = sortedRawRuns.map((run) => {
      const key = getRunCacheKey(run);
      const cached = cache.get(key);
      if (cached) return cached;
      const next = toUiBenchmarkRun(run);
      cache.set(key, next);
      return next;
    });

    setBenchmarkHistory(runs);
    setSelectedTimeIndex(Math.max(0, runs.length - 1));
  }
}, [matrixDataHook.history]);
```

**Step 4: Run tests**

Run: `npm test -- history.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/app/visibility-matrix/page.tsx src/lib/matrix/history.ts src/lib/matrix/__tests__/history.test.ts
git commit -m "perf: cache history transforms"
```

---

## Task 3: Remove debug logging in benchmark run flow

**Why:** Reduce console noise and minor overhead; no behavior change.

**Files:**
- Modify: `src/app/visibility-matrix/page.tsx`

**Step 1: Remove DEBUG console logs**

Delete the block starting with:

```ts
// DEBUG: Log raw API response
console.log("[DEBUG] API resultsByCell keys:", ...)
```

and the per-cell logs:

```ts
console.log(`[DEBUG] Cell ${t.key}: result exists=...`)
```

**Step 2: Verify build/test**

Run: `npm run build`
Expected: PASS

**Step 3: Commit**

```bash
git add src/app/visibility-matrix/page.tsx
git commit -m "chore: remove debug logs from matrix run"
```

---

## Verification Checklist

- `npm test -- useMatrixData.test.tsx` passes
- `npm test -- history.test.ts` passes
- `npm run build` passes
- Manual check: navigate `/visibility-matrix` → timeline and KPIs still render correctly

---

## Notes for Droid

- Do NOT add `JSON.stringify` to dependency arrays (perf anti-pattern).
- Keep memoization minimal and data-driven; avoid broad refactors.
- If any step causes behavior differences, revert that step and report.
