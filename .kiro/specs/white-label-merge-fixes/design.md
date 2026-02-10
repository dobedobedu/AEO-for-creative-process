# Design Document: White-Label Merge Fixes

## Overview

This design addresses five failing merge gates that block the white-label feature branch from merging. The fixes are surgical — each gate maps to a small, well-scoped code change. No new tables, no new modules, no architectural changes. We're wiring up existing code that was written but never connected.

### Key Insight

The async DB-first config loader (`loadTenantConfigAsync`) and the provider config helpers (`getEnabledProviders`, `getProviderModel`) already exist and are fully tested. The problem is that the runtime code paths (API routes, cron, middleware) don't call them. The fixes are primarily about replacing sync calls with async calls and replacing hardcoded values with config lookups.

### DB-Init Strategy

Many modules call the sync `getTenantConfig()` which reads from the in-memory cache. If the cache was never populated from DB, it falls through to the file-only loader. The fix has two parts:

1. **API route (GET)**: Switch to `await loadTenantConfigAsync()` so the API always returns DB-first config.
2. **All other sync consumers**: Add `initConfigFromDB()` call in Next.js `instrumentation.ts` (the `register()` hook). This runs once at server startup and pre-populates the cache from DB before any request handler executes. After this, all sync `getTenantConfig()` calls throughout the app return the DB-loaded value.

This is the lightest touch — one startup call covers all sync consumers without changing every call site.

## Architecture

No architectural changes. The existing layered architecture remains:

```
Admin UI → POST /api/tenant/config → saveTenantConfig() → DB (tenant_config table)
                                                              ↓
Startup  → instrumentation.ts register() → initConfigFromDB() → cache populated from DB
                                                              ↓
Runtime  ← GET /api/tenant/config  ← loadTenantConfigAsync() ← DB → file → defaults → env overrides
Sync     ← getTenantConfig()       ← cache (pre-populated by initConfigFromDB at startup)
                                                              ↓
Cron     ← /api/benchmark/scheduled ← getConfiguredProviders() (shared utility)
```

The only change is making the arrows actually flow through the DB-first path instead of the file-only path.

## Components and Interfaces

### G1: DB-First Config Reads (Two-Part Fix)

#### Part A: API Route (`src/app/api/tenant/config/route.ts`)

**Current**: `GET` handler calls `getTenantConfig()` (sync, file-only).

**Fix**: Change `GET` handler to `await loadTenantConfigAsync()` so it reads from DB first.

```typescript
// Before
export async function GET() {
  const config = getTenantConfig();
  return Response.json(config);
}

// After
export async function GET() {
  const config = await loadTenantConfigAsync();
  return Response.json(config);
}
```

The import changes from `getTenantConfig` to `loadTenantConfigAsync` from `@/lib/config/loader`. The POST handler remains unchanged — it already saves to DB and clears cache correctly.

#### Part B: Startup DB Init (`src/instrumentation.ts`)

**Current**: No `instrumentation.ts` exists (or it doesn't call `initConfigFromDB()`).

**Fix**: Create or update `src/instrumentation.ts` with a `register()` export that calls `initConfigFromDB()`. This is Next.js's official server startup hook — it runs once before any request is handled.

```typescript
// src/instrumentation.ts
export async function register() {
  // Only run on the server (not edge runtime)
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { initConfigFromDB } = await import("@/lib/config/loader");
    await initConfigFromDB();
  }
}
```

After this, every sync `getTenantConfig()` call throughout the app returns the DB-loaded config. The POST handler's `clearConfigCache()` call still works — the next sync read will re-trigger `loadTenantConfig()` which returns the file-based fallback, but the next async read (or next server restart) will re-populate from DB. To make cache-clear + re-read fully DB-aware, the POST handler should also call `await loadTenantConfigAsync()` after clearing the cache:

```typescript
// In POST handler, after clearConfigCache():
clearConfigCache();
await loadTenantConfigAsync(); // re-populate cache from DB immediately
```

### G2: Shared Provider Derivation Utility (`src/lib/config/providers.ts`)

**Current**: Cron route at line 156 passes `DEFAULT_PROVIDERS` (hardcoded array) to `runBenchmark()`.

**Fix**: Add a shared `getConfiguredProviders()` function to `src/lib/config/providers.ts` so both cron and manual benchmark runs use the same derivation logic. This prevents drift between the two paths.

```typescript
// Added to src/lib/config/providers.ts
import { DEFAULT_PROVIDERS } from "@/lib/runs/utils";

/**
 * Get the provider list for benchmark runs, derived from tenant config.
 * Falls back to DEFAULT_PROVIDERS if no providers are configured.
 */
export function getConfiguredProviders(): Array<{ provider: Provider; model: string }> {
  const enabledProviders = getEnabledProviders();
  if (enabledProviders.length === 0) {
    return DEFAULT_PROVIDERS;
  }
  return enabledProviders.map((provider) => ({
    provider,
    model: getProviderModel(provider),
  }));
}
```

The cron route then replaces `DEFAULT_PROVIDERS` with `getConfiguredProviders()`:

```typescript
// In cron route, before calling runBenchmark:
const providers = getConfiguredProviders();
// ...
const benchmarkResult = await runBenchmark({
  // ...
  providers,
});
```

The cron route should also call `await loadTenantConfigAsync()` early in the handler to ensure the cache is DB-populated before the sync `getConfiguredProviders()` reads from it. (This is belt-and-suspenders with the instrumentation.ts init.)

### G3: Middleware Admin Route Check (`src/middleware.ts`)

**Current**: `ADMIN_ROUTES` array only contains `["/admin/matrix"]`.

**Fix**: Replace the specific route list with a prefix check for `/admin/`, but exempt `/admin/setup` from the `ADMIN_ENABLED` gate.

**Setup-route exemption policy**: The setup wizard at `/admin/setup` must remain accessible even when `NEXT_PUBLIC_ADMIN_ENABLED` is not set to `"true"`. The setup wizard is the mechanism by which a new tenant completes initial configuration — blocking it behind the admin flag creates a chicken-and-egg problem. The existing `SETUP_EXEMPT_PATHS` array already exempts `/admin/setup` from the setup-redirect logic; we extend this exemption to the admin-enabled check as well.

```typescript
// Before
const ADMIN_ROUTES = ["/admin/matrix"];
const isAdminRoute = ADMIN_ROUTES.some((route) => pathname.startsWith(route));

// After — covers all /admin/* routes, but exempts /admin/setup
const isAdminRoute = pathname.startsWith("/admin/") && !pathname.startsWith("/admin/setup");
```

This is a one-line change. The existing logic already returns 403 when `NEXT_PUBLIC_ADMIN_ENABLED !== "true"` for admin routes. The `/admin/setup` page still requires authentication (handled by the Supabase auth check above the admin check in the middleware flow).

### G4: FileSearch Hardcoded Brand Defaults (`src/lib/filesearch/formatter.ts`, `src/lib/filesearch/uploader.ts`)

**Current**: Four function signatures use `brand: string = "Lakewood Ranch"` as default parameter.

**Fix**: Replace the hardcoded default with a `getBrandName()` fallback inside the function body:

```typescript
// Before
export function formatBenchmarkForUpload(
  results: BenchmarkResult, persona: string, stage: string,
  brand: string = "Lakewood Ranch"
): FormattedBenchmark { ... }

// After
export function formatBenchmarkForUpload(
  results: BenchmarkResult, persona: string, stage: string,
  brand?: string
): FormattedBenchmark {
  const resolvedBrand = brand ?? getBrandName();
  // ... use resolvedBrand instead of brand
}
```

Files affected:
- `formatter.ts`: `formatBenchmarkForUpload` (line 51) and `formatQueryResult` (line 129)
- `uploader.ts`: `uploadBenchmarkResults` (line 106) and `uploadBenchmarkResultsAsync` (line 119)

### G5: Test Coverage

New test files:

1. **`src/app/api/tenant/__tests__/config.route.test.ts`** — Tests for GET/POST tenant config API
2. **`src/lib/runs/__tests__/cronProviders.test.ts`** — Tests for cron provider derivation logic
3. **`src/middleware.test.ts`** or extend existing middleware tests — Tests for admin route gating

Testing approach:
- Mock DB layer (`@/lib/tenant/db`) and config loader as done in existing `loader.test.ts`
- Use vitest with `vi.mock()` for module mocking
- Property-based tests with fast-check where applicable

## Data Models

No data model changes. All existing types and DB schemas remain unchanged.

The key types involved:
- `TenantConfig` (from `@/lib/config/types`) — full tenant configuration
- `ProviderEntry` — `{ id, label, model, weight, active, apiKeyEnvVar }`
- `Provider` — `"openai" | "anthropic" | "gemini" | "xai"`
- `BenchmarkConfig.providers` — `Array<{ provider: Provider; model: string }>`


## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: DB config takes priority over file config

*For any* valid `TenantConfig` object stored in the DB, calling `loadTenantConfigAsync()` should return a config whose brand name matches the DB-stored brand name (after env overrides), regardless of what the file-based config contains.

**Validates: Requirements 1.2**

### Property 2: Config save/load round-trip

*For any* valid partial `TenantConfig` containing a brand name, saving it via `saveTenantConfig()`, clearing the cache, and then loading via `loadTenantConfigAsync()` should return a config whose brand name equals the saved brand name (assuming no env override for `BRAND_NAME`).

**Validates: Requirements 1.4**

### Property 3: Cron provider derivation matches tenant config

*For any* `TenantConfig` with a non-empty `providers.providers` array, the derived provider list for cron should contain exactly the providers where `active === true`, and each entry's model string should match the corresponding `ProviderEntry.model` from the config.

**Validates: Requirements 2.1, 2.2, 2.3**

### Property 4: Admin route prefix gating

*For any* URL path string that starts with `/admin/` and does not start with `/admin/setup`, the middleware admin-route check should identify it as an admin route. For `/admin/setup` paths, the check should not identify it as an admin route (setup is exempt). For any path that does not start with `/admin/`, the check should not identify it as an admin route.

**Validates: Requirements 3.1, 3.2, 3.3**

### Property 5: FileSearch brand default from config

*For any* configured brand name in tenant config, calling `formatBenchmarkForUpload()` or `formatQueryResult()` without an explicit brand parameter should produce output containing the configured brand name (not a hardcoded default).

**Validates: Requirements 4.1, 4.2, 4.3**

## Error Handling

### G1: DB Failures
- `loadTenantConfigAsync()` already catches DB errors and falls back to file → defaults. No new error handling needed.
- The GET handler wraps the call in try/catch and returns 500 on unexpected errors (existing behavior).

### G2: Empty Provider Config
- If `getEnabledProviders()` returns an empty array (no providers configured or all inactive), the cron route falls back to `DEFAULT_PROVIDERS`. This prevents a cron run from silently doing nothing.

### G3: Middleware
- The prefix check `pathname.startsWith("/admin/")` has no failure mode — it's a string operation. The existing 403 response for disabled admin is preserved.

### G4: Brand Name Unavailable
- `getBrandName()` always returns a string (falls back to `"My Brand"` from DEFAULT_CONFIG). The `??` operator in the fixed functions ensures a brand name is always present.

## Testing Strategy

### Dependencies

- `fast-check` must be in `devDependencies`. Check if already present; if not, add it (`npm install -D fast-check`).

### Unit Tests — Must-Have (vitest)

1. **Tenant Config API Route** (`src/app/api/tenant/__tests__/config.route.test.ts`)
   - GET returns DB config when DB is available
   - GET falls back to file/defaults when DB unavailable
   - POST + clearCache + loadAsync round-trip returns saved config
   - Mock `@/lib/tenant/db` and `node:fs` as in existing `loader.test.ts`

2. **Cron Provider Derivation** (`src/lib/config/__tests__/providers.test.ts`)
   - `getConfiguredProviders()` returns only active providers with correct models
   - `getConfiguredProviders()` falls back to DEFAULT_PROVIDERS when no providers configured
   - Mock `@/lib/config/loader` to control the cached config

3. **Admin Route Middleware** (`src/__tests__/middleware.test.ts`)
   - `/admin/brand`, `/admin/providers` trigger admin check (blocked when disabled)
   - `/admin/setup` is exempt from admin-enabled check
   - Non-admin routes don't trigger admin check

4. **FileSearch Brand Defaults** (`src/lib/filesearch/__tests__/brandDefaults.test.ts`)
   - Formatter functions use `getBrandName()` when no brand arg passed
   - Mock `@/lib/config` to return a custom brand name

### Property-Based Tests — Optional (fast-check)

- **Property 3** (cron provider derivation): Generate random `ProviderEntry[]` arrays with varying active/inactive states and model strings. Verify `getConfiguredProviders()` output matches expectations.
  - Tag: `Feature: white-label-merge-fixes, Property 3: Cron provider derivation matches tenant config`
- **Property 4** (admin route prefix): Generate random path strings. Verify paths starting with `/admin/` (excluding `/admin/setup`) are identified as admin routes and others are not.
  - Tag: `Feature: white-label-merge-fixes, Property 4: Admin route prefix gating`
- **Property 5** (FileSearch brand default): Generate random brand name strings. Mock config to return them. Verify formatter output contains the brand name.
  - Tag: `Feature: white-label-merge-fixes, Property 5: FileSearch brand default from config`

Properties 1 and 2 are integration-style tests that involve DB mocking and async flows — they're better covered by the must-have unit tests above.

### Test Configuration

- Property-based tests: minimum 100 iterations per property
- Each property test tagged with comment referencing the design property
- Use `fc.assert(fc.property(...))` from fast-check
- All tests must pass with `npm test` (vitest)
