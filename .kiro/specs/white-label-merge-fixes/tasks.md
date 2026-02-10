# Implementation Plan: White-Label Merge Fixes

## Overview

Surgical fixes for 5 failing merge gates: DB-first config reads, cron provider config, admin route protection, hardcoded brand removal, and test coverage. Each task maps to a specific gate. Implementation order ensures foundational fixes (G1) land first since G2 depends on the config cache being DB-populated.

## Tasks

- [x] 1. G1: DB-first config reads
  - [x] 1.1 Update GET /api/tenant/config to use loadTenantConfigAsync
    - In `src/app/api/tenant/config/route.ts`, change `GET` handler to call `await loadTenantConfigAsync()` instead of `getTenantConfig()`
    - Update imports accordingly
    - _Requirements: 1.1, 1.2, 1.3_

  - [x] 1.2 Update POST /api/tenant/config to re-populate cache after save
    - In `src/app/api/tenant/config/route.ts`, after `clearConfigCache()` in the POST handler, add `await loadTenantConfigAsync()` to re-populate the cache from DB immediately
    - _Requirements: 1.4_

  - [x] 1.3 Create instrumentation.ts for startup DB init
    - Create `src/instrumentation.ts` with a `register()` export that calls `initConfigFromDB()` when `NEXT_RUNTIME === "nodejs"`
    - This pre-populates the config cache from DB before any request handler runs, so all sync `getTenantConfig()` calls return DB-loaded config
    - _Requirements: 1.2, 1.5_

  - [ ]* 1.4 Write tests for tenant config API route
    - Create `src/app/api/tenant/__tests__/config.route.test.ts`
    - Test GET returns DB config when available
    - Test GET falls back to defaults when DB unavailable
    - Test POST + GET round-trip returns saved config
    - Mock `@/lib/tenant/db` and `node:fs` following patterns in `src/lib/config/__tests__/loader.test.ts`
    - _Requirements: 5.1, 5.2_

- [x] 2. G2: Cron uses tenant provider config
  - [x] 2.1 Add getConfiguredProviders() to src/lib/config/providers.ts
    - Add a shared `getConfiguredProviders()` function that calls `getEnabledProviders()` and `getProviderModel()` to build the `Array<{ provider, model }>` for benchmark runs
    - Fall back to `DEFAULT_PROVIDERS` from `@/lib/runs/utils` when no providers are configured
    - Export from `@/lib/config` index
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [x] 2.2 Update cron route to use getConfiguredProviders()
    - In `src/app/api/benchmark/scheduled/[stage]/route.ts`, replace `DEFAULT_PROVIDERS` usage with `getConfiguredProviders()` from `@/lib/config/providers`
    - Add `await loadTenantConfigAsync()` early in the GET handler to ensure DB-first cache population before sync provider reads
    - Remove the `DEFAULT_PROVIDERS` import from `@/lib/runs/utils` (no longer needed in this file)
    - _Requirements: 2.1, 2.2, 2.3_

  - [ ]* 2.3 Write tests for getConfiguredProviders()
    - Create or extend `src/lib/config/__tests__/providers.test.ts`
    - Test: returns only active providers with correct models
    - Test: falls back to DEFAULT_PROVIDERS when no providers configured
    - Test: handles mixed active/inactive providers
    - Mock config loader to control the cached config
    - _Requirements: 5.3_

  - [ ]* 2.4 Write property test for provider derivation
    - **Property 3: Cron provider derivation matches tenant config**
    - **Validates: Requirements 2.1, 2.2, 2.3**
    - Generate random `ProviderEntry[]` arrays with fast-check, verify output matches active providers with correct models
    - Add `fast-check` to devDependencies if not present

- [x] 3. Checkpoint - Verify G1 and G2
  - Ensure all tests pass with `npm test`, run `npm run build` to verify no TypeScript errors. Ask the user if questions arise.

- [x] 4. G3: Admin route protection
  - [x] 4.1 Update middleware to use /admin/ prefix check with setup exemption
    - In `src/middleware.ts`, replace the `ADMIN_ROUTES` array and `.some()` check with `pathname.startsWith("/admin/") && !pathname.startsWith("/admin/setup")`
    - Remove the `ADMIN_ROUTES` constant (no longer needed)
    - _Requirements: 3.1, 3.2, 3.3_

  - [ ]* 4.2 Write tests for admin route middleware
    - Create `src/__tests__/middleware.test.ts`
    - Test: `/admin/brand`, `/admin/providers` are blocked when ADMIN_ENABLED is not true
    - Test: `/admin/setup` is exempt from admin-enabled check
    - Test: non-admin routes are not affected by admin check
    - _Requirements: 5.4_

  - [ ]* 4.3 Write property test for admin route prefix gating
    - **Property 4: Admin route prefix gating**
    - **Validates: Requirements 3.1, 3.2, 3.3**
    - Generate random path strings with fast-check, verify admin detection logic

- [x] 5. G4: Eliminate hardcoded brand defaults
  - [x] 5.1 Replace hardcoded brand in FileSearch formatter
    - In `src/lib/filesearch/formatter.ts`, change `formatBenchmarkForUpload` and `formatQueryResult` to use `brand?: string` parameter with `brand ?? getBrandName()` fallback
    - Add `import { getBrandName } from "@/lib/config"` 
    - _Requirements: 4.1, 4.3_

  - [x] 5.2 Replace hardcoded brand in FileSearch uploader
    - In `src/lib/filesearch/uploader.ts`, change `uploadBenchmarkResults` and `uploadBenchmarkResultsAsync` to use `brand?: string` parameter with `brand ?? getBrandName()` fallback
    - Add `import { getBrandName } from "@/lib/config"`
    - _Requirements: 4.2, 4.3_

  - [ ]* 5.3 Write tests for FileSearch brand defaults
    - Create `src/lib/filesearch/__tests__/brandDefaults.test.ts`
    - Test: formatter functions use configured brand name when no brand arg passed
    - Test: explicit brand arg overrides config
    - Mock `@/lib/config` to return a custom brand name
    - _Requirements: 5.5_

  - [ ]* 5.4 Write property test for FileSearch brand default
    - **Property 5: FileSearch brand default from config**
    - **Validates: Requirements 4.1, 4.2, 4.3**
    - Generate random brand name strings with fast-check, verify formatter output contains the configured brand name

- [x] 6. Final checkpoint - Build and test verification
  - Run `npm run build` and `npm test` to verify all gates pass. Ensure no regressions. Ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- G1 is the critical path — G2 depends on the config cache being DB-populated
- The shared `getConfiguredProviders()` utility prevents cron/manual benchmark drift
- `/admin/setup` is intentionally exempt from the admin-enabled gate to avoid chicken-and-egg during initial setup
- Property tests require `fast-check` in devDependencies
