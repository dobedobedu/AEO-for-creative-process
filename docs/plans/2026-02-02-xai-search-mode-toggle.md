# xAI Search Mode Toggle Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a global admin-controlled xAI search mode toggle (x_search vs web_search) stored in Supabase and applied to all new runs (UI + cron), while keeping schema backward compatible and RAG-aware.

**Architecture:** Introduce an `app_settings` table for runtime flags, add a small data layer with cached reads, expose GET/PUT API for admin, and thread the active search mode through xAI calls, response caching, and FileSearch metadata. No xAI batch support (tools unsupported in batch API).

**Tech Stack:** Next.js 16, React 19, TypeScript, Supabase Postgres, shadcn/ui, Vitest.

---

### Task 1: Add `app_settings` table + data layer

**Files:**
- Create: `sql/2026-02-02-app-settings.sql`
- Modify: `src/lib/db.ts`
- Create: `src/lib/appSettings.ts`
- Test: `src/lib/__tests__/appSettings.test.ts`

**Step 1: Write the failing test**

```ts
// src/lib/__tests__/appSettings.test.ts
import { describe, expect, it, vi, beforeEach } from "vitest";
import { getSearchMode } from "@/lib/appSettings";

vi.mock("@/lib/db", () => ({
  sql: vi.fn(),
}));

const { sql } = await import("@/lib/db");

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getSearchMode", () => {
  it("defaults to x_search when setting is missing", async () => {
    (sql as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce([]);
    await expect(getSearchMode()).resolves.toBe("x_search");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/__tests__/appSettings.test.ts`
Expected: FAIL (module not found / function missing)

**Step 3: Write minimal implementation**

```ts
// src/lib/appSettings.ts
import { sql } from "@/lib/db";

export type SearchMode = "x_search" | "web_search";

const SEARCH_MODE_KEY = "xai_search_mode";
const DEFAULT_SEARCH_MODE: SearchMode = "x_search";

let cachedSearchMode: { value: SearchMode; expiresAt: number } | null = null;
const CACHE_TTL_MS = 30_000;

export async function getAppSetting<T>(key: string): Promise<T | null> {
  const rows = await sql`
    SELECT value FROM app_settings WHERE key = ${key} LIMIT 1;
  `;
  if (rows.length === 0) return null;
  return rows[0].value as T;
}

export async function setAppSetting(key: string, value: unknown, actorUserId?: string | null) {
  await sql`
    INSERT INTO app_settings (key, value, updated_by)
    VALUES (${key}, ${sql.json(value)}, ${actorUserId ?? null})
    ON CONFLICT (key)
    DO UPDATE SET value = EXCLUDED.value, updated_by = EXCLUDED.updated_by, updated_at = NOW();
  `;
}

export function clearSearchModeCache() {
  cachedSearchMode = null;
}

export async function getSearchMode(): Promise<SearchMode> {
  if (cachedSearchMode && cachedSearchMode.expiresAt > Date.now()) {
    return cachedSearchMode.value;
  }
  const setting = await getAppSetting<{ mode?: string } | SearchMode>(SEARCH_MODE_KEY);
  let mode = DEFAULT_SEARCH_MODE;
  if (typeof setting === "string" && (setting === "x_search" || setting === "web_search")) {
    mode = setting;
  } else if (setting && typeof setting === "object") {
    const candidate = setting.mode;
    if (candidate === "x_search" || candidate === "web_search") mode = candidate;
  }
  cachedSearchMode = { value: mode, expiresAt: Date.now() + CACHE_TTL_MS };
  return mode;
}
```

**Step 4: Update schema bootstrap + migration**

```ts
// src/lib/db.ts (inside ensureSchema)
await sql`
  CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    updated_by UUID
  );
`;
```

```sql
-- sql/2026-02-02-app-settings.sql
CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID
);
```

**Step 5: Run test to verify it passes**

Run: `npm test -- src/lib/__tests__/appSettings.test.ts`
Expected: PASS

**Step 6: Commit**

```bash
git add sql/2026-02-02-app-settings.sql src/lib/db.ts src/lib/appSettings.ts src/lib/__tests__/appSettings.test.ts
git commit -m "feat: add app settings store with search mode"
```

---

### Task 2: API route for search mode settings

**Files:**
- Create: `src/app/api/app-settings/route.ts`
- Test: `src/app/api/app-settings/__tests__/route.test.ts`

**Step 1: Write the failing test**

```ts
// src/app/api/app-settings/__tests__/route.test.ts
import { describe, expect, it, vi } from "vitest";
import { GET, PUT } from "@/app/api/app-settings/route";

vi.mock("@/lib/appSettings", () => ({
  getSearchMode: vi.fn().mockResolvedValue("x_search"),
  setAppSetting: vi.fn(),
}));

vi.mock("@/lib/auth/supabase", () => ({
  getCurrentUser: vi.fn().mockResolvedValue({ id: "user-1" }),
}));

it("GET returns search mode", async () => {
  const res = await GET();
  const body = await res.json();
  expect(body.searchMode).toBe("x_search");
});

it("PUT updates search mode", async () => {
  const req = new Request("http://localhost/api/app-settings", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ searchMode: "web_search" }),
  });
  const res = await PUT(req);
  const body = await res.json();
  expect(body.success).toBe(true);
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/app/api/app-settings/__tests__/route.test.ts`
Expected: FAIL (route not found)

**Step 3: Write minimal implementation**

```ts
// src/app/api/app-settings/route.ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSearchMode, setAppSetting } from "@/lib/appSettings";
import { getCurrentUser } from "@/lib/auth/supabase";
import { cookies } from "next/headers";

const UpdateSchema = z.object({
  searchMode: z.enum(["x_search", "web_search"]),
});

export async function GET() {
  const searchMode = await getSearchMode();
  return NextResponse.json({ searchMode });
}

export async function PUT(request: NextRequest) {
  const body = await request.json();
  const data = UpdateSchema.parse(body);
  const cookieStore = await cookies();
  const user = await getCurrentUser(cookieStore);
  await setAppSetting("xai_search_mode", data.searchMode, user?.id ?? null);
  return NextResponse.json({ success: true });
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- src/app/api/app-settings/__tests__/route.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/app/api/app-settings/route.ts src/app/api/app-settings/__tests__/route.test.ts
git commit -m "feat: add app settings API"
```

---

### Task 3: Admin panel UI toggle

**Files:**
- Modify: `src/app/admin/matrix/page.tsx`

**Step 1: Implement UI state + fetch/save**

```ts
// add state
const [searchMode, setSearchMode] = useState<"x_search" | "web_search">("x_search");
const [loadingMode, setLoadingMode] = useState(true);
const [savingMode, setSavingMode] = useState(false);

// in loadConfig or separate useEffect
const loadSearchMode = async () => {
  setLoadingMode(true);
  const res = await fetch("/api/app-settings");
  if (res.ok) {
    const data = await res.json();
    setSearchMode(data.searchMode ?? "x_search");
  }
  setLoadingMode(false);
};

// save
const saveSearchMode = async (next: "x_search" | "web_search") => {
  setSavingMode(true);
  await fetch("/api/app-settings", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ searchMode: next }),
  });
  setSavingMode(false);
};
```

Render a new Card with two buttons (X Search / Web Search) and helper text “Applies to new runs only.” Update UI optimistically and call save on click.

**Step 2: Manual verification**
- Load `/admin/matrix` and confirm toggle state matches server.
- Toggle mode; refresh page to ensure persistence.

**Step 3: Commit**

```bash
git add src/app/admin/matrix/page.tsx
git commit -m "feat: add admin search mode toggle"
```

---

### Task 4: Thread search mode through xAI calls + cache + FileSearch metadata

**Files:**
- Modify: `src/lib/providers/xai.ts`
- Modify: `src/app/api/query/route.ts`
- Modify: `src/lib/benchmark/runner.ts`
- Modify: `src/lib/cache/responseCache.ts`
- Modify: `src/lib/filesearch/formatter.ts`
- Modify: `src/lib/filesearch/uploader.ts`
- Test: `src/lib/cache/__tests__/responseCache.test.ts`

**Step 1: Update xAI provider to accept mode**

```ts
// src/lib/providers/xai.ts
export type XaiSearchMode = "x_search" | "web_search";

export async function callXaiSearch(params: { model: string; query: string; searchMode: XaiSearchMode; }) {
  const toolType = params.searchMode === "x_search" ? "x_search" : "web_search";
  // ... tools: [{ type: toolType }]
}
```

**Step 2: Pass mode from API + benchmark**

```ts
// src/app/api/query/route.ts
import { getSearchMode } from "@/lib/appSettings";
const searchMode = await getSearchMode();
const response = await callXaiSearch({ model: data.model, query: finalQuery, searchMode });
```

```ts
// src/lib/benchmark/runner.ts
import { getSearchMode } from "@/lib/appSettings";
...
const searchMode = await getSearchMode();
const response = await callXaiSearch({ model, query, searchMode });
```

**Step 3: Add searchMode to cache key (xAI only)**

```ts
// responseCache.ts
export function getCacheKey(query: string, provider: string, model: string, context?: string): string {
  const extra = context ? `:${context}` : "";
  const input = `${provider}:${model}:${query}${extra}`;
  return createHash("sha256").update(input).digest("hex").slice(0, 16);
}

// Use context = `searchMode:${mode}` when provider === "xai"
```

Add a test that verifies different searchMode yields different cache keys.

**Step 4: Add searchMode metadata to FileSearch uploads**

```ts
// formatter.ts
export function formatBenchmarkForUpload(..., searchMode?: string) { ... metadata.push({ key: "search_mode", stringValue: searchMode ?? "unknown" }); }
```

Update uploader call sites to pass searchMode from `getSearchMode()` at upload time.

**Step 5: Run targeted tests**

Run:
- `npm test -- src/lib/cache/__tests__/responseCache.test.ts`
- `npm test -- src/lib/benchmark/__tests__/runner.test.ts` (if needed for mock updates)

**Step 6: Commit**

```bash
git add src/lib/providers/xai.ts src/app/api/query/route.ts src/lib/benchmark/runner.ts src/lib/cache/responseCache.ts src/lib/filesearch/formatter.ts src/lib/filesearch/uploader.ts src/lib/cache/__tests__/responseCache.test.ts
git commit -m "feat: apply xai search mode across runtime"
```

---

### Task 5: Verification

**Step 1: Run tests**

Run: `npm test`
Expected: PASS (known flaky test in personaManager may still appear; document if it does)

**Step 2: Build**

Run: `npm run build`
Expected: PASS

---

## Notes / Constraints

- xAI Batch API does **not** support tools, so xAI remains synchronous for both UI and cron runs.
- Backward compatibility: no changes required to existing response/citation schema; search mode is stored in settings + run metadata + FileSearch metadata.
- Default mode is `x_search` if no setting exists.

