# Database Migrations

> **⚠️ DEPRECATED**: These migrations are no longer the source of truth.
> The canonical migration source is `supabase/migrations/` using the Supabase CLI workflow.
> See `docs/SSES-DEPLOYMENT-GUIDE.md` for the canonical process.

This directory contains SQL migrations for the AI Visibility Platform.

## Migration Order

Run migrations in order:

1. `001_add_tenant_id.sql` - Add tenant_id columns (nullable)
2. `002_create_tenant_configs.sql` - Create tenant_configs table and default tenant
3. `003_backfill_tenant_id.sql` - Backfill existing data to default tenant
4. `004_add_tenant_indexes.sql` - Add performance indexes
5. `005_add_prompt_version.sql` - Add prompt version tracking

## Running Migrations

### Prerequisites

- PostgreSQL database
- `DATABASE_URL` environment variable set

### Run a single migration

```bash
psql $DATABASE_URL -f sql/migrations/001_add_tenant_id.sql
```

### Run all migrations

```bash
for f in sql/migrations/0*.sql; do
  echo "Running $f..."
  psql $DATABASE_URL -f "$f"
done
```

### Via Supabase

If using Supabase, run migrations through the SQL Editor:

1. Go to SQL Editor in Supabase Dashboard
2. Paste migration content
3. Execute

## Rollback

Each migration has a corresponding rollback script (`*_rollback.sql`) where applicable.

**Warning:** Rollbacks may result in data loss. Only use in development or with proper backups.

```bash
# Rollback migration 001
psql $DATABASE_URL -f sql/migrations/001_add_tenant_id_rollback.sql
```

## Phase 1 Notes

In Phase 1, all `tenant_id` columns are **nullable** for backward compatibility:

- Existing queries continue to work without modification
- New data can optionally include tenant_id
- Migration 003 backfills existing data to the default tenant

## Phase 2 Preparation

Migrations 002 and 005 create tables needed for Phase 2 (Admin UI):

- `tenant_configs` - Database-backed tenant configuration
- `tenant_prompts` - Versioned prompt storage

These tables can be populated when Admin UI is implemented.

## Default Tenant

The default tenant UUID is: `00000000-0000-0000-0000-000000000001`

This is used for backward compatibility with existing single-tenant data.
