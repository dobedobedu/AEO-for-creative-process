# Requirements Document

## Introduction

This spec addresses five failing merge gates identified during the white-label platform audit. The fixes ensure that tenant configuration flows end-to-end from admin UI through DB persistence to runtime consumption, that admin routes are properly protected, that hardcoded brand defaults are eliminated, and that new API surfaces have adequate test coverage.

## Glossary

- **Config_Loader**: The module at `src/lib/config/loader.ts` responsible for loading tenant configuration from DB, file, or defaults, and caching the result in memory.
- **Tenant_Config_API**: The REST endpoints under `/api/tenant/config` that serve and accept tenant configuration.
- **Cron_Route**: The scheduled benchmark endpoint at `/api/benchmark/scheduled/[stage]/route.ts` that runs daily benchmarks.
- **Provider_Config**: The tenant-configurable provider settings (active/inactive toggles, models, weights) stored in the `providers` section of tenant config.
- **Admin_Routes**: All pages under the `/admin/*` path prefix that require elevated access.
- **Middleware**: The Next.js middleware at `src/middleware.ts` that enforces authentication and admin access control.
- **FileSearch_Formatter**: The module at `src/lib/filesearch/formatter.ts` that formats benchmark results for upload.
- **FileSearch_Uploader**: The module at `src/lib/filesearch/uploader.ts` that uploads formatted benchmarks to Google FileSearchStore.
- **Brand_Config_Helpers**: Functions like `getBrandName()` from `@/lib/config` that return the configured brand name.
- **DEFAULT_PROVIDERS**: A hardcoded array in `src/lib/runs/utils.ts` listing all four AI providers with fixed model strings.

## Requirements

### Requirement 1: DB-First Config Reads

**User Story:** As a platform admin, I want configuration changes saved through the admin UI to be returned by subsequent API reads, so that my changes actually take effect at runtime.

#### Acceptance Criteria

1. WHEN the `GET /api/tenant/config` endpoint is called, THE Tenant_Config_API SHALL load configuration using the async DB-first strategy (`loadTenantConfigAsync`) instead of the sync file-only loader.
2. WHEN the DB contains a tenant configuration row, THE Config_Loader SHALL return the DB-stored configuration (with env overrides applied) in preference to the file-based configuration.
3. WHEN the DB is unavailable or contains no configuration row, THE Config_Loader SHALL fall back to the file-based configuration and then to embedded defaults.
4. WHEN a `POST /api/tenant/config` saves configuration to the DB and the cache is cleared, THE Config_Loader SHALL return the newly saved configuration on the next read.
5. IF the DB query fails during an async config load, THEN THE Config_Loader SHALL log a warning and fall back to file-based configuration without returning an error to the caller.

### Requirement 2: Cron Uses Tenant Provider Config

**User Story:** As a platform admin, I want scheduled benchmark runs to use the provider toggles, models, and weights I configured in the admin panel, so that cron runs reflect my provider preferences.

#### Acceptance Criteria

1. WHEN the Cron_Route executes a scheduled benchmark, THE Cron_Route SHALL derive the provider list from the tenant Provider_Config instead of using the hardcoded DEFAULT_PROVIDERS array.
2. WHEN a provider is marked as inactive in the tenant Provider_Config, THE Cron_Route SHALL exclude that provider from the scheduled benchmark run.
3. WHEN the tenant Provider_Config specifies custom model strings, THE Cron_Route SHALL use those model strings for each provider during the benchmark run.
4. IF the tenant Provider_Config is unavailable or empty, THEN THE Cron_Route SHALL fall back to the DEFAULT_PROVIDERS array.

### Requirement 3: Admin Route Protection

**User Story:** As a platform operator, I want all admin pages to be gated behind the admin access check, so that unauthorized users cannot access any admin functionality.

#### Acceptance Criteria

1. WHEN a request targets any path under `/admin/`, THE Middleware SHALL apply the admin access check (requiring `NEXT_PUBLIC_ADMIN_ENABLED=true`).
2. WHEN `NEXT_PUBLIC_ADMIN_ENABLED` is not set to `"true"` and a request targets any `/admin/*` route, THE Middleware SHALL return a 403 response.
3. WHEN `NEXT_PUBLIC_ADMIN_ENABLED` is set to `"true"` and the user is authenticated, THE Middleware SHALL allow access to all `/admin/*` routes.

### Requirement 4: Eliminate Hardcoded Brand Defaults

**User Story:** As a platform admin, I want all modules to use the configured brand name instead of hardcoded defaults, so that the white-label experience is consistent across all features.

#### Acceptance Criteria

1. THE FileSearch_Formatter SHALL use `getBrandName()` from Brand_Config_Helpers as the default brand parameter instead of a hardcoded string.
2. THE FileSearch_Uploader SHALL use `getBrandName()` from Brand_Config_Helpers as the default brand parameter instead of a hardcoded string.
3. WHEN the brand name is changed in tenant configuration, THE FileSearch_Formatter and FileSearch_Uploader SHALL use the updated brand name for subsequent operations without code changes.

### Requirement 5: Test Coverage for New API Surfaces

**User Story:** As a developer, I want focused tests for the tenant API routes and cron provider-config integration, so that regressions in these critical paths are caught automatically.

#### Acceptance Criteria

1. THE Test_Suite SHALL include tests for the `GET /api/tenant/config` endpoint verifying that it returns DB-sourced configuration when available.
2. THE Test_Suite SHALL include tests for the `POST /api/tenant/config` endpoint verifying that saved configuration is returned by subsequent GET requests (round-trip).
3. THE Test_Suite SHALL include tests verifying that the cron provider-derivation logic returns only active providers with correct models from tenant config.
4. THE Test_Suite SHALL include tests verifying that the admin route middleware blocks access to `/admin/*` routes when `NEXT_PUBLIC_ADMIN_ENABLED` is not `"true"`.
5. THE Test_Suite SHALL include tests verifying that `getBrandName()` is used instead of hardcoded brand strings in FileSearch modules.
