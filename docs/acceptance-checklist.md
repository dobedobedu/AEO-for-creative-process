# White-Label Acceptance Checklist

Final validation that the platform is fully white-labeled and operationally ready.

## Tenant Onboarding

- [ ] New tenant onboards via `/admin/setup` without code changes
- [ ] `tenant_config` persists DB-first, reflected in `/api/tenant/config`
- [ ] Tenant seed script applies cleanly after canonical bootstrap (`npm run seed:sses` or equivalent)

## Schema Integrity

- [ ] Canonical migrations (`supabase/migrations/`) contain no tenant-specific data
- [ ] `npm run db:verify` passes against the active Supabase project
- [ ] No tenant-specific strings in `src/` runtime code (excluding tests, seeds, and templates)

## Release Gates

- [ ] `npm run env:validate -- --target preview` passes
- [ ] `npm run deploy:precheck` passes (preview ≠ production Supabase refs)
- [ ] `npm run db:verify` passes
- [ ] `npm run secrets:check -- --target preview` passes
- [ ] `npm run build` passes
- [ ] `npm test` passes

## Deployment Verification

- [ ] Preview smoke test passes on tenant endpoints (`npm run smoke -- --base-url <preview-url>`)
- [ ] CI pipeline (`.github/workflows/ci.yml`) runs all gates on PR

## How to Use

Run through each item manually before declaring white-labeling complete. Items that involve running commands should be executed against the target environment (local, preview, or production as appropriate).

For the full workflow details behind each gate, see [`docs/runbook.md`](./runbook.md).
