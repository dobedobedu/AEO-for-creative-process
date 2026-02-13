# Runbook

Canonical workflows for local development, preview validation, production promotion, and operations.

## 1. Local Development Loop

```bash
# Start local Supabase (Postgres, Auth, Storage)
supabase start

# Reset DB and apply all 16 canonical migrations
supabase db reset

# Validate environment variables
npm run env:validate -- --target local

# Verify schema matches the manifest
npm run db:verify

# Start the dev server
npm run dev
```

After `db reset`, the database has a neutral schema with a generic default `tenant_config` row. Apply a tenant seed (see §5) to configure for a specific brand.

## 2. Preview Validation Loop

```bash
# 1. Push a PR — Vercel auto-deploys a preview

# 2. Verify preview and production use different Supabase projects
npm run deploy:precheck -- \
  --preview-url $PREVIEW_SUPABASE_URL \
  --production-url $PRODUCTION_SUPABASE_URL

# 3. Run smoke tests against the preview URL
npm run smoke -- --base-url https://<preview-url>
```

The CI pipeline (`.github/workflows/ci.yml`) runs `env:validate`, `deploy:precheck`, `db:verify`, `build`, and `test` automatically on every PR. Smoke tests are currently a manual post-deploy step (see the TODO in the workflow).

## 3. Production Promotion Rules

```bash
# 1. Merge PR to main

# 2. Push migrations to the production Supabase project
supabase db push --linked

# 3. Verify the production schema
npm run db:verify

# 4. Run smoke tests against production
npm run smoke -- --base-url https://<production-url>

# 5. Verify secrets are in sync
npm run secrets:check -- --target production
```

Never push migrations to production without first validating them in preview via `supabase db reset`.

## 4. Adding a Schema Change

```bash
# 1. Create a new migration file
supabase migration new <descriptive_name>
# Creates: supabase/migrations/<timestamp>_<descriptive_name>.sql

# 2. Edit the migration SQL
#    - Keep it tenant-neutral (no brand-specific data)
#    - Use IF NOT EXISTS / IF EXISTS for safety

# 3. Reset local DB to test the full migration chain
supabase db reset

# 4. Update the SCHEMA_MANIFEST in scripts/db/verify.ts
#    if you added tables, columns, triggers, or functions

# 5. Verify the updated manifest passes
npm run db:verify

# 6. Run tests
npm test

# 7. Open a PR
```

The canonical migration chain lives in `supabase/migrations/` (currently 16 files, `000000`–`000015`). See `docs/migration-map.md` for the mapping from legacy SQL files.

## 5. Applying a Tenant Seed

After the canonical bootstrap produces a neutral schema, apply tenant-specific data:

```bash
# SSES (Saint Stephen's Episcopal School)
npm run seed:sses
# Or with an explicit database URL:
npm run seed:sses -- --database-url <url>
```

The seed script (`scripts/seed/sses.ts`) upserts personas, stages, entity terms, brand config, competitors, and geography into the database. It is safe to re-run — all operations are upserts.

For other tenants, create a new seed script at `scripts/seed/<tenant>.ts` and register it in `package.json`:

```json
"seed:<tenant>": "tsx scripts/seed/<tenant>.ts"
```

Industry templates in `config/templates/` can serve as a starting point for new tenant seeds.

## 6. Secret Sync

Two shell scripts manage environment secrets:

### Push secrets to Vercel

```bash
# Sync all default keys to preview
scripts/secrets/sync-vercel.sh preview

# Sync specific keys to production
scripts/secrets/sync-vercel.sh production OPENAI_API_KEY XAI_API_KEY

# Dry run (no changes)
scripts/secrets/sync-vercel.sh preview --dry-run
```

### Pull secrets to local `.env.local`

```bash
# Merge from a source env file into .env.local
scripts/secrets/sync-local.sh .env.preview.example

# Merge specific keys only
scripts/secrets/sync-local.sh /tmp/secrets.env OPENAI_API_KEY XAI_API_KEY
```

`sync-local.sh` backs up `.env.local` before writing. Both scripts handle the default key set: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `DATABASE_URL`, `NEXT_PUBLIC_ADMIN_ENABLED`, `CRON_SECRET`, and all provider API keys.

### Verify secrets match runtime config

```bash
# Check that all enabled providers have API keys set
npm run secrets:check -- --target local
npm run secrets:check -- --target preview
npm run secrets:check -- --target production
```

`secrets:check` reads enabled providers from the DB first (`tenant_config.providers_json`), falling back to `config/tenant.json` if the DB is unavailable.

## 7. Rollback Procedures

### Revert a bad migration

```bash
# 1. Identify the breaking migration in supabase/migrations/

# 2. Create a new migration that reverses the changes
supabase migration new revert_<original_name>

# 3. Test locally
supabase db reset
npm run db:verify
npm test

# 4. Push the revert migration
supabase db push --linked

# 5. Redeploy the application (revert the code PR if needed)

# 6. Verify
npm run smoke -- --base-url https://<production-url>
npm run db:verify
```

Supabase does not support `down` migrations — always roll forward with a corrective migration.

### Revert a bad deployment (no schema change)

```bash
# 1. Revert the PR on GitHub (creates a revert commit on main)
# 2. Vercel auto-deploys the reverted code
# 3. Verify
npm run smoke -- --base-url https://<production-url>
```

## 8. Troubleshooting

### Missing `tenant_config` default row

`db:verify` or `smoke` reports the default row is missing.

```bash
# Check if the table exists
supabase db reset   # local — reapplies all migrations including 000011

# Production — the default row is created by migration 000011_tenant_config.sql
# If missing, insert manually:
# INSERT INTO tenant_config (id) VALUES ('default') ON CONFLICT DO NOTHING;
```

### Supabase link errors

```
Error: Cannot find linked project
```

```bash
# Re-link to the correct project
supabase link --project-ref <project-ref>

# Verify the link
supabase status
```

### Environment variable mismatch

`env:validate` fails with missing vars.

```bash
# Check what's set
npm run env:validate -- --target local

# Sync from a known-good source
scripts/secrets/sync-local.sh .env.preview.example

# For Vercel, sync from your shell
scripts/secrets/sync-vercel.sh preview
```

### Provider API key issues

`secrets:check` reports missing keys.

```bash
# See which providers are enabled in the DB
npm run secrets:check -- --target local

# The script reads from tenant_config.providers_json first.
# If a provider is enabled but its key is missing:
#   - local: warning (non-blocking)
#   - preview/production: error (blocks deployment)

# Fix: add the key to .env.local or Vercel
scripts/secrets/sync-local.sh .env.preview.example OPENAI_API_KEY
scripts/secrets/sync-vercel.sh preview OPENAI_API_KEY
```

### `deploy:precheck` fails

```
FAILED: preview and production share Supabase ref
```

Preview and production must use different Supabase projects. Check that `PREVIEW_SUPABASE_URL` and `PRODUCTION_SUPABASE_URL` (or the `--preview-url` / `--production-url` args) point to different project refs.
