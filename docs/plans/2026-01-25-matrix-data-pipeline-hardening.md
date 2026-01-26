# Matrix Data Pipeline Hardening Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make Matrix data fetching resilient to navigation and UI changes by isolating data loading into testable hooks with explicit loading/error states.

**Architecture:** Introduce a small Matrix data layer (`src/lib/matrix/data/`) with Zod-validated response parsing and a single `useMatrixData` hook that orchestrates config, intent library polling, and history loading. The UI consumes a stable view model and refresh triggers, reducing coupling between rendering and fetch logic.

**Tech Stack:** Next.js (App Router), React 19, TypeScript, Vitest, Zod (already in repo).

---

### Task 1: Add response schemas + parsers for Matrix endpoints

**Files:**
- Create: `src/lib/matrix/data/schemas.ts`
- Create: `src/lib/matrix/data/parse.ts`
- Test: `src/lib/matrix/data/__tests__/parse.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { parseMatrixConfig, parseHistoryRuns } from "@/lib/matrix/data/parse";

describe("matrix data parsers", () => {
  it("parses valid matrix config", () => {
    const config = parseMatrixConfig({ personas: [{ id: "cpo", label: "CPO" }], stages: [{ id: "explore", label: "Explore" }] });
    expect(config.personas[0].id).toBe("cpo");
  });

  it("throws on invalid history payload", () => {
    expect(() => parseHistoryRuns({ runs: [{ id: 123 }] })).toThrow();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/matrix/data/__tests__/parse.test.ts`
Expected: FAIL (module not found / parser not implemented)

**Step 3: Write minimal implementation**

```ts
// schemas.ts
import { z } from "zod";

export const MatrixConfigSchema = z.object({
  personas: z.array(z.object({ id: z.string(), label: z.string(), description: z.string().optional() })),
  stages: z.array(z.object({ id: z.string(), label: z.string(), description: z.string().optional() })),
});

export const HistoryRunsSchema = z.object({
  runs: z.array(z.object({ id: z.string(), timestamp: z.string() })),
});

// parse.ts
import { MatrixConfigSchema, HistoryRunsSchema } from "./schemas";

export function parseMatrixConfig(input: unknown) {
  return MatrixConfigSchema.parse(input);
}
export function parseHistoryRuns(input: unknown) {
  return HistoryRunsSchema.parse(input);
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- src/lib/matrix/data/__tests__/parse.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/matrix/data/schemas.ts src/lib/matrix/data/parse.ts src/lib/matrix/data/__tests__/parse.test.ts
git commit -m "test: add matrix data parsers"
```

---

### Task 2: Create a `useMatrixData` hook with explicit state machine

**Files:**
- Create: `src/lib/matrix/data/useMatrixData.ts`
- Test: `src/lib/matrix/data/__tests__/useMatrixData.test.tsx`

**Step 1: Write the failing test**

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useMatrixData } from "@/lib/matrix/data/useMatrixData";

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("useMatrixData", () => {
  it("loads config and history when active", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: RequestInfo) => {
      if (String(url).includes("/api/matrix/active")) {
        return new Response(JSON.stringify({ personas: [{ id: "cpo", label: "CPO" }], stages: [{ id: "explore", label: "Explore" }] }));
      }
      if (String(url).includes("/api/benchmark/runs/history")) {
        return new Response(JSON.stringify({ runs: [] }));
      }
      return new Response(JSON.stringify({ intents: [] }));
    }));

    const { result } = renderHook(() => useMatrixData({ active: true }));
    await waitFor(() => expect(result.current.status).toBe("ready"));
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/matrix/data/__tests__/useMatrixData.test.tsx`
Expected: FAIL (hook not implemented)

**Step 3: Write minimal implementation**

```ts
import { useEffect, useMemo, useState } from "react";
import { parseMatrixConfig, parseHistoryRuns } from "./parse";

type Status = "idle" | "loading" | "ready" | "error";

export function useMatrixData({ active }: { active: boolean }) {
  const [status, setStatus] = useState<Status>("idle");
  const [config, setConfig] = useState<{ personas: any[]; stages: any[] } | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    setStatus("loading");

    Promise.all([
      fetch("/api/matrix/active").then((r) => r.json()).then(parseMatrixConfig),
      fetch("/api/benchmark/runs/history?limit=45").then((r) => r.json()).then(parseHistoryRuns),
    ])
      .then(([cfg, hist]) => {
        if (cancelled) return;
        setConfig(cfg);
        setHistory(hist.runs);
        setStatus("ready");
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Unknown error");
        setStatus("error");
      });

    return () => {
      cancelled = true;
    };
  }, [active]);

  return useMemo(() => ({ status, config, history, error }), [status, config, history, error]);
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- src/lib/matrix/data/__tests__/useMatrixData.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/matrix/data/useMatrixData.ts src/lib/matrix/data/__tests__/useMatrixData.test.tsx
git commit -m "feat: add matrix data hook"
```

---

### Task 3: Integrate `useMatrixData` into the Matrix page

**Files:**
- Modify: `src/app/visibility-matrix/page.tsx`
- Test: `src/lib/matrix/data/__tests__/useMatrixData.test.tsx` (extend for re-activation)

**Step 1: Write the failing test**

```tsx
import { describe, it, expect, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useMatrixData } from "@/lib/matrix/data/useMatrixData";

describe("useMatrixData re-activation", () => {
  it("reloads when active toggles off -> on", async () => {
    const fetchSpy = vi.fn(async () => new Response(JSON.stringify({ personas: [], stages: [] })));
    vi.stubGlobal("fetch", fetchSpy as any);

    const { rerender } = renderHook(({ active }) => useMatrixData({ active }), {
      initialProps: { active: true },
    });

    await waitFor(() => expect(fetchSpy).toHaveBeenCalled());
    fetchSpy.mockClear();

    rerender({ active: false });
    rerender({ active: true });
    await waitFor(() => expect(fetchSpy).toHaveBeenCalled());
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/matrix/data/__tests__/useMatrixData.test.tsx`
Expected: FAIL (no re-activation behavior)

**Step 3: Write minimal implementation**

Add a `refreshToken` state in `useMatrixData` that increments when `active` flips `false -> true`, and include it in the fetch effect dependencies.

**Step 4: Run test to verify it passes**

Run: `npm test -- src/lib/matrix/data/__tests__/useMatrixData.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/matrix/data/useMatrixData.ts src/lib/matrix/data/__tests__/useMatrixData.test.tsx src/app/visibility-matrix/page.tsx
git commit -m "refactor: wire matrix page to data hook"
```

---

### Task 4: Add intent library polling to data layer

**Files:**
- Modify: `src/lib/matrix/data/useMatrixData.ts`
- Test: `src/lib/matrix/data/__tests__/useMatrixData.test.tsx`

**Step 1: Write the failing test**

```tsx
import { describe, it, expect, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useMatrixData } from "@/lib/matrix/data/useMatrixData";

describe("useMatrixData polling", () => {
  it("polls intent library when active", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: RequestInfo) => {
      if (String(url).includes("/api/intents/library")) {
        return new Response(JSON.stringify({ intents: [] }));
      }
      return new Response(JSON.stringify({ personas: [], stages: [] }));
    }));

    renderHook(() => useMatrixData({ active: true }));
    await waitFor(() => expect((fetch as any).mock.calls.some((c: any[]) => String(c[0]).includes("/api/intents/library"))).toBe(true));
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/matrix/data/__tests__/useMatrixData.test.tsx`
Expected: FAIL

**Step 3: Write minimal implementation**

Add an interval when `active` that hits `/api/intents/library` every 10s and cleans up on unmount/deactivate.

**Step 4: Run test to verify it passes**

Run: `npm test -- src/lib/matrix/data/__tests__/useMatrixData.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/matrix/data/useMatrixData.ts src/lib/matrix/data/__tests__/useMatrixData.test.tsx
git commit -m "feat: add intent library polling to matrix data hook"
```

---

### Task 5: Add error boundary + data state UI mapping

**Files:**
- Create: `src/components/visibility-matrix/MatrixDataBoundary.tsx`
- Modify: `src/app/visibility-matrix/page.tsx`
- Test: `src/components/visibility-matrix/__tests__/MatrixDataBoundary.test.tsx`

**Step 1: Write the failing test**

```tsx
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { MatrixDataBoundary } from "@/components/visibility-matrix/MatrixDataBoundary";

describe("MatrixDataBoundary", () => {
  it("renders fallback on error", () => {
    const { getByText } = render(
      <MatrixDataBoundary error="Boom" onRetry={() => {}} />
    );
    expect(getByText(/boom/i)).toBeTruthy();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/components/visibility-matrix/__tests__/MatrixDataBoundary.test.tsx`
Expected: FAIL

**Step 3: Write minimal implementation**

Create a lightweight boundary component that renders error + retry button when `error` is set; otherwise renders children.

**Step 4: Run test to verify it passes**

Run: `npm test -- src/components/visibility-matrix/__tests__/MatrixDataBoundary.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add src/components/visibility-matrix/MatrixDataBoundary.tsx src/components/visibility-matrix/__tests__/MatrixDataBoundary.test.tsx src/app/visibility-matrix/page.tsx
git commit -m "feat: add matrix data boundary"
```

---

### Task 6: Docs + verification

**Files:**
- Modify: `AGENTS.md` (add learning about matrix data hook)

**Step 1: Update docs**
Add a short note under “Key Learnings” that data fetching is centralized in `useMatrixData`.

**Step 2: Run tests**
Run: `npm test`
Expected: PASS (except known `geminiCitations.test.ts` if still failing)

**Step 3: Commit**

```bash
git add AGENTS.md
git commit -m "docs: document matrix data hook"
```
