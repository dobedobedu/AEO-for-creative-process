# Cron Query Refresh Guard + Batch Keying Fixes Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Ensure cron always uses freshly regenerated DeepSeek queries (daily, before cron), hard-fail if stale, and fix batch keying so Anthropic batch results map correctly.

**Architecture:** Two-phase cron: batch-submit regenerates and timestamps queries, stores intentId mapping metadata; scheduled stage cron validates freshness and aborts if stale; runner uses per-intent query index for batch lookup. Minimal DB changes (intents.generated_queries_at, batch_jobs.metadata).

**Tech Stack:** Next.js API routes, Postgres (Supabase), Vitest.

---

### Task 1: Add failing tests for cron freshness guard

**Files:**
- Create: `src/app/api/benchmark/scheduled/__tests__/route.test.ts`

**Step 1: Write failing test**
```ts
it("returns 409 when intents are missing fresh generated queries", async () => {
  // mock intent library with missing generatedQueriesAt
  // expect GET to return 409 and error payload
});
```

**Step 2: Run test to verify it fails**
Run: `npm test -- src/app/api/benchmark/scheduled/__tests__/route.test.ts`
Expected: FAIL with 409 assertion not met.

**Step 3: Write minimal implementation**
Implement guard in `scheduled/[stage]/route.ts` that checks freshness and returns 409.

**Step 4: Run test to verify it passes**
Run: `npm test -- src/app/api/benchmark/scheduled/__tests__/route.test.ts`
Expected: PASS.

**Step 5: Commit**
```bash
git add src/app/api/benchmark/scheduled/__tests__/route.test.ts src/app/api/benchmark/scheduled/[stage]/route.ts
git commit -m "test: add cron freshness guard"
```

---

### Task 2: Add failing test for per-intent queryIndex batch keying

**Files:**
- Modify: `src/lib/benchmark/__tests__/runner.batch.test.ts`

**Step 1: Write failing test**
```ts
it("uses per-intent queryIndex for batch key", async () => {
  // intent has 2 queries; ensure batch key uses index 1 for second query
});
```

**Step 2: Run test to verify it fails**
Run: `npm test -- src/lib/benchmark/__tests__/runner.batch.test.ts`
Expected: FAIL with wrong key.

**Step 3: Write minimal implementation**
Update `runBenchmark` to attach per-intent queryIndex and use it for batch key.

**Step 4: Run test to verify it passes**
Run: `npm test -- src/lib/benchmark/__tests__/runner.batch.test.ts`
Expected: PASS.

**Step 5: Commit**
```bash
git add src/lib/benchmark/__tests__/runner.batch.test.ts src/lib/benchmark/runner.ts
git commit -m "fix: use per-intent queryIndex for batch key"
```

---

### Task 3: Store intentIdMap metadata for batch jobs

**Files:**
- Modify: `src/lib/providers/batch.ts`
- Modify: `src/app/api/benchmark/batch-submit/route.ts`
- Migration: `sql/2026-01-28-batch-jobs-metadata.sql`

**Step 1: Write failing test**
```ts
it("stores intentIdMap metadata on batch submit", async () => {
  // mock createBatchJob and assert metadata passed
});
```

**Step 2: Run test to verify it fails**
Run: `npm test -- src/app/api/benchmark/batch-submit/__tests__/route.test.ts`
Expected: FAIL.

**Step 3: Write minimal implementation**
- Add `metadata` to createBatchJob
- Store mapping in batch-submit
- Add migration for metadata column

**Step 4: Run test to verify it passes**
Run: `npm test -- src/app/api/benchmark/batch-submit/__tests__/route.test.ts`
Expected: PASS.

**Step 5: Commit**
```bash
git add src/lib/providers/batch.ts src/app/api/benchmark/batch-submit/route.ts sql/2026-01-28-batch-jobs-metadata.sql
git commit -m "feat: store batch job metadata"
```

---

### Task 4: Cron uses metadata to reconstruct full intentId

**Files:**
- Modify: `src/app/api/benchmark/scheduled/[stage]/route.ts`

**Step 1: Write failing test**
```ts
it("reconstructs full intentId from batch metadata", async () => {
  // mock batch result + metadata; expect batch key to include full intentId
});
```

**Step 2: Run test to verify it fails**
Run: `npm test -- src/app/api/benchmark/scheduled/__tests__/route.test.ts`
Expected: FAIL.

**Step 3: Write minimal implementation**
Use `getBatchJobMetadata` and intentIdMap to build batch key.

**Step 4: Run test to verify it passes**
Run: `npm test -- src/app/api/benchmark/scheduled/__tests__/route.test.ts`
Expected: PASS.

**Step 5: Commit**
```bash
git add src/app/api/benchmark/scheduled/[stage]/route.ts
git commit -m "fix: map batch results to full intentId"
```

---

### Task 5: Update intent schema bootstrap

**Files:**
- Modify: `src/lib/intents/db.ts`
- Migration: `sql/2026-01-28-intents-generated-queries-at.sql`

**Step 1: Write failing test**
```ts
it("stores generated_queries_at on update", async () => {
  // mock db update and ensure column exists
});
```

**Step 2: Run test to verify it fails**
Run: `npm test -- src/lib/intents/__tests__/db.test.ts`
Expected: FAIL.

**Step 3: Write minimal implementation**
- Add column to CREATE TABLE
- Add migration for existing DB

**Step 4: Run test to verify it passes**
Run: `npm test -- src/lib/intents/__tests__/db.test.ts`
Expected: PASS.

**Step 5: Commit**
```bash
git add src/lib/intents/db.ts sql/2026-01-28-intents-generated-queries-at.sql
git commit -m "feat: add generated_queries_at"
```

---

### Task 6: Full verification

**Step 1:** Run `npm test` (expect known failures only)  
**Step 2:** Run `npm run build`

---

Plan complete.
