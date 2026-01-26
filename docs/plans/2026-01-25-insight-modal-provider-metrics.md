# Insight Modal Provider Metrics Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** In the Insight modal, show both the overall stage-specific metric and a per‑provider breakdown (Explore shows both mention rate and top‑3 rate). Summary tiles remain unchanged.

**Architecture:** Compute stage metrics locally from `results` inside the Insight modal via a shared helper (`src/lib/matrix/insightMetrics.ts`). The helper returns overall + per‑provider metrics for each stage, excluding errored responses to keep parity with Summary tiles. The Insight modal renders a compact “Overall” row plus a provider table.

**Tech Stack:** Next.js, React 19, TypeScript, Vitest.

---

### Task 1: Add metric helper + tests

**Files:**
- Create: `src/lib/matrix/insightMetrics.ts`
- Test: `src/lib/matrix/__tests__/insightMetrics.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { computeInsightMetrics } from "@/lib/matrix/insightMetrics";

describe("computeInsightMetrics", () => {
  it("computes Explore overall + per-provider mention and top3 rates", () => {
    const results = [
      {
        query: "q1",
        responses: [
          { provider: "openai", error: undefined, visibility: { mentioned: true, position: "1st" } },
          { provider: "gemini", error: undefined, visibility: { mentioned: false, position: "absent" } },
          { provider: "anthropic", error: "timeout", visibility: { mentioned: false, position: "absent" } },
        ],
      },
    ];

    const metrics = computeInsightMetrics("explore", results);
    expect(metrics.overall.mentionRate).toBeCloseTo(0.5); // 1/2 valid
    expect(metrics.overall.top3Rate).toBeCloseTo(0.5); // 1/2 valid
    expect(metrics.byProvider.openai?.mentionRate).toBe(1);
    expect(metrics.byProvider.gemini?.mentionRate).toBe(0);
    expect(metrics.byProvider.anthropic).toBeUndefined(); // all errored
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/matrix/__tests__/insightMetrics.test.ts`
Expected: FAIL (module not found)

**Step 3: Write minimal implementation**

```ts
// src/lib/matrix/insightMetrics.ts
import type { ProviderKey } from "@/lib/matrix/weights";

type Response = {
  provider: ProviderKey;
  error?: string;
  visibility?: {
    mentioned?: boolean;
    position?: string;
    sentiment?: "positive" | "neutral" | "negative";
    comparisonOutcome?: "favorable" | "unfavorable" | "neutral" | "none";
    recommendationStrength?: "strong" | "moderate" | "weak" | "none";
  };
};

type QueryResult = { responses?: Response[] };

type ExploreMetrics = { mentionRate: number | null; top3Rate: number | null };
type ConsiderMetrics = { avgSentiment: number | null };
type CompareMetrics = { winRate: number | null };
type DecideMetrics = { recommendationRate: number | null };

type InsightMetrics =
  | { stage: "explore"; overall: ExploreMetrics; byProvider: Partial<Record<ProviderKey, ExploreMetrics>> }
  | { stage: "consider"; overall: ConsiderMetrics; byProvider: Partial<Record<ProviderKey, ConsiderMetrics>> }
  | { stage: "compare"; overall: CompareMetrics; byProvider: Partial<Record<ProviderKey, CompareMetrics>> }
  | { stage: "decide"; overall: DecideMetrics; byProvider: Partial<Record<ProviderKey, DecideMetrics>> };

function sentimentToScore(sentiment?: string) {
  return sentiment === "positive" ? 1 : sentiment === "negative" ? -1 : 0;
}

export function computeInsightMetrics(stage: string, results: QueryResult[]): InsightMetrics {
  const validResponses: Response[] = [];
  const byProvider: Partial<Record<ProviderKey, Response[]>> = {};

  for (const r of results || []) {
    for (const resp of r.responses || []) {
      if (resp.error) continue;
      validResponses.push(resp);
      const p = resp.provider as ProviderKey;
      if (!byProvider[p]) byProvider[p] = [];
      byProvider[p]?.push(resp);
    }
  }

  if (stage === "explore") {
    const total = validResponses.length;
    const mentioned = validResponses.filter(r => r.visibility?.mentioned).length;
    const top3 = validResponses.filter(r => ["1st","2nd","3rd"].includes(r.visibility?.position || "")).length;
    const overall = {
      mentionRate: total > 0 ? mentioned / total : null,
      top3Rate: total > 0 ? top3 / total : null,
    };
    const per: Partial<Record<ProviderKey, ExploreMetrics>> = {};
    for (const [p, arr] of Object.entries(byProvider) as [ProviderKey, Response[]][]) {
      const t = arr.length;
      const m = arr.filter(r => r.visibility?.mentioned).length;
      const top = arr.filter(r => ["1st","2nd","3rd"].includes(r.visibility?.position || "")).length;
      per[p] = { mentionRate: t > 0 ? m / t : null, top3Rate: t > 0 ? top / t : null };
    }
    return { stage: "explore", overall, byProvider: per };
  }

  if (stage === "consider") {
    const total = validResponses.length;
    const sum = validResponses.reduce((acc, r) => acc + sentimentToScore(r.visibility?.sentiment), 0);
    const overall = { avgSentiment: total > 0 ? sum / total : null };
    const per: Partial<Record<ProviderKey, ConsiderMetrics>> = {};
    for (const [p, arr] of Object.entries(byProvider) as [ProviderKey, Response[]][]) {
      const t = arr.length;
      const s = arr.reduce((acc, r) => acc + sentimentToScore(r.visibility?.sentiment), 0);
      per[p] = { avgSentiment: t > 0 ? s / t : null };
    }
    return { stage: "consider", overall, byProvider: per };
  }

  if (stage === "compare") {
    const total = validResponses.length;
    const wins = validResponses.filter(r => r.visibility?.comparisonOutcome === "favorable").length;
    const overall = { winRate: total > 0 ? wins / total : null };
    const per: Partial<Record<ProviderKey, CompareMetrics>> = {};
    for (const [p, arr] of Object.entries(byProvider) as [ProviderKey, Response[]][]) {
      const t = arr.length;
      const w = arr.filter(r => r.visibility?.comparisonOutcome === "favorable").length;
      per[p] = { winRate: t > 0 ? w / t : null };
    }
    return { stage: "compare", overall, byProvider: per };
  }

  const total = validResponses.length;
  const recommended = validResponses.filter(r => (r.visibility?.recommendationStrength || "none") !== "none").length;
  const overall = { recommendationRate: total > 0 ? recommended / total : null };
  const per: Partial<Record<ProviderKey, DecideMetrics>> = {};
  for (const [p, arr] of Object.entries(byProvider) as [ProviderKey, Response[]][]) {
    const t = arr.length;
    const rec = arr.filter(r => (r.visibility?.recommendationStrength || "none") !== "none").length;
    per[p] = { recommendationRate: t > 0 ? rec / t : null };
  }
  return { stage: "decide", overall, byProvider: per };
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- src/lib/matrix/__tests__/insightMetrics.test.ts`  
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/matrix/insightMetrics.ts src/lib/matrix/__tests__/insightMetrics.test.ts
git commit -m "feat: add insight metrics helper"
```

---

### Task 2: Wire helper into InsightModal

**Files:**
- Modify: `src/components/visibility-matrix/InsightModal.tsx`

**Step 1: Write the failing test**

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { InsightModal } from "@/components/visibility-matrix/InsightModal";

describe("InsightModal metrics", () => {
  it("shows overall + provider breakdown for explore", () => {
    render(
      <InsightModal
        open
        onClose={() => {}}
        persona="move_up"
        stage="explore"
        personaLabel="Move-Up"
        stageLabel="Explore"
        brand="Lakewood Ranch"
        results={[{
          query: "q",
          responses: [{ provider: "openai", text: "x", visibility: { mentioned: true, position: "1st", sentiment: "neutral" } }],
        }]}
      />
    );
    expect(screen.getByText(/overall/i)).toBeInTheDocument();
    expect(screen.getByText(/openai/i)).toBeInTheDocument();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/components/visibility-matrix/__tests__/InsightModal.test.tsx`  
Expected: FAIL (metrics UI missing)

**Step 3: Implement minimal UI**

In `InsightModal.tsx`:
- import `computeInsightMetrics`
- compute `const metrics = computeInsightMetrics(stage, results);`
- render a new “Overall” section + provider rows inside `renderExplore` (and analogous blocks for other stages).

**Step 4: Run test to verify it passes**

Run: `npm test -- src/components/visibility-matrix/__tests__/InsightModal.test.tsx`  
Expected: PASS

**Step 5: Commit**

```bash
git add src/components/visibility-matrix/InsightModal.tsx src/components/visibility-matrix/__tests__/InsightModal.test.tsx
git commit -m "feat: add overall + provider metrics in insight modal"
```

---

### Task 3: Keep Summary tiles unchanged

**Files:**
- No changes (confirm only)

**Step 1: Verify**
- No edits required in `SplitViewEditor` or `GalleryTile`.

**Step 2: Commit (if needed)**
- Not needed.

---

### Task 4: Full verification

**Step 1: Run tests**

Run: `npm test`  
Expected: PASS (except known `geminiCitations.test.ts` if it remains pre‑existing)

**Step 2: Manual check**
- Click an Explore cell. Confirm modal shows **Overall Mention + Top‑3** and **per‑provider rows**.
- Compare overall % to Summary tile: they should match.

---

Plan complete and saved to `docs/plans/2026-01-25-insight-modal-provider-metrics.md`.

Two execution options:
1) Subagent‑Driven (this session)  
2) Parallel Session (new session with `superpowers:executing-plans`)

Which approach should droid use?*** End Patch"}```
