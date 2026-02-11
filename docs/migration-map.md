# Migration Map

This document maps every legacy SQL file in `sql/` and `sql/migrations/` to its corresponding canonical migration in `supabase/migrations/`. Use this as a reference to trace legacy files to their canonical replacements. All legacy files have been superseded by the canonical migration chain and should no longer be used directly — see each file's deprecation header for details.

| Legacy file | Canonical migration(s) | Status | Notes |
|---|---|---|---|
| `sql/schema.sql` | `20240101000000_core_schema.sql` | Superseded | Already existed as canonical migration |
| `sql/2026-01-20-supabase-auth.sql` | `20240101000002_auth_columns.sql` | Superseded | Already existed as canonical migration |
| `sql/2026-01-20-user-activity.sql` | `20240101000003_user_activity.sql` | Superseded | Already existed as canonical migration |
| `sql/2026-01-22-matrix-config.sql` | `20240101000004_matrix_config.sql` | Superseded | Tenant-specific seed data removed |
| `sql/2026-01-22-optimization-tables.sql` | `20240101000005_optimization_tables.sql` | Superseded | BEGIN/COMMIT wrappers removed |
| `sql/2026-01-23-aggregation-stage-id.sql` | `20240101000006_aggregation_stage_id.sql` | Superseded | Broken materialized view removed |
| `sql/2026-01-24-entity-tables.sql` | `20240101000007_entity_tables.sql` | Superseded | Tenant-specific seed data removed |
| `sql/2026-01-28-batch-jobs.sql` | `20240101000008_batch_jobs.sql` | Superseded | Direct copy |
| `sql/2026-01-28-intents-generated-queries-at.sql` | `20240101000009_intents_gen_queries.sql` | Superseded | Direct copy |
| `sql/2026-02-02-app-settings.sql` | `20240101000010_app_settings.sql` | Superseded | Direct copy |
| `sql/2026-02-07-tenant-config.sql` | `20240101000011_tenant_config.sql` | Superseded | PL/pgSQL delimiter bug fixed |
| `sql/migrations/001_add_tenant_id.sql` | `20240101000012_multi_tenant_columns.sql` | Superseded | Consolidated with 002–004 |
| `sql/migrations/001_add_tenant_id_rollback.sql` | `20240101000012_multi_tenant_columns.sql` | Legacy-only | Rollback not part of canonical workflow |
| `sql/migrations/002_create_tenant_configs.sql` | `20240101000012_multi_tenant_columns.sql` | Superseded | Consolidated with 001, 003, 004 |
| `sql/migrations/003_backfill_tenant_id.sql` | `20240101000012_multi_tenant_columns.sql` | Superseded | Consolidated with 001, 002, 004 |
| `sql/migrations/004_add_tenant_indexes.sql` | `20240101000012_multi_tenant_columns.sql` | Superseded | CONCURRENTLY removed; consolidated |
| `sql/migrations/005_add_prompt_version.sql` | `20240101000013_prompt_versioning.sql` | Superseded | CONCURRENTLY removed |
| `sql/migrations/006_update_sses_personas_stages.sql` | N/A (000014 is a no-op placeholder) | Legacy-only tenant seed | SSES-specific data excluded from canonical chain; apply separately per deployment |
| `sql/migrations/007_add_rls_policies.sql` | `20240101000015_rls_policies.sql` | Superseded | Direct copy |
| `sql/migrations/007_add_rls_policies_rollback.sql` | `20240101000015_rls_policies.sql` | Legacy-only | Rollback not part of canonical workflow |
| `sql/migrations/README.md` | N/A | Documentation | Updated with deprecation notice |
