# CHANGELOG

```
    _    ___   __     ___     _ _     _ _ _ _
   / \  |_ _|  \ \   / (_)___(_) |__ (_) (_) |_ _   _
  / _ \  | |    \ \ / /| / __| | '_ \| | | | __| | | |
 / ___ \ | |     \ V / | \__ \ | |_) | | | | |_| |_| |
/_/   \_\___|     \_/  |_|___/_|_.__/|_|_|_|\__|\__, |
                                                |___/
```

All notable changes to the AI Visibility Baseline app are documented here.

---

## [Unreleased]

### Added
- Admin panel integration into view toggle (Matrix | Kanban | Admin)
- Environment-based admin access control (`NEXT_PUBLIC_ADMIN_ENABLED`)
- Expanded SSES query library with 14 research-aligned intents
- SSES deployment guide with Supabase and Vercel setup instructions

### Changed
- ViewToggle component now supports 3 views (matrix, kanban, admin)
- Middleware enforces `NEXT_PUBLIC_ADMIN_ENABLED` check for `/admin/matrix` route
- Admin routes protected with authentication and feature flag

### Fixed
- Test expectations for role parameter mismatch

### Technical Details
- **ViewToggle**: Added admin view with conditional rendering based on `NEXT_PUBLIC_ADMIN_ENABLED`
- **Middleware**: Added admin route protection and feature flag checking
- **Query Library**: Created `data/intents/education-k12-elite-expanded.json` with 14 intents across 4 personas
- **Documentation**: Added `docs/SSES-DEPLOYMENT-GUIDE.md` for complete deployment instructions

---

## 2026-01-26 - Platformization (Phase 1)

### Added
```
+------------------------------------------+
|  feat: White-label Platform Architecture |
+------------------------------------------+
|  - File-based tenant configuration       |
|  - Industry templates (4 industries)     |
|  - Prompt templates with interpolation   |
|  - Database multi-tenancy preparation    |
+------------------------------------------+
```

**Configuration System (`config/`)**
- `config/tenant.json` - Main tenant configuration file
- `config/templates/` - Industry templates (real-estate, education, healthcare, marketing)
- `config/prompts/` - Externalized prompt templates

**Config Module (`src/lib/config/`)**
- `types.ts` - TenantConfig schema with Zod validation
- `loader.ts` - File-based config loading with env overrides
- `brand.ts` - Brand name, aliases, domain utilities
- `competitors.ts` - Competitor matching with aliases
- `entities.ts` - Entity category management
- `thresholds.ts` - Score threshold and color utilities
- `providers.ts` - Provider weights and models
- `prompts.ts` - Prompt template loading and interpolation
- `client.ts` - Client-side config hooks for React

**API Endpoints**
- `GET /api/tenant/config` - Fetch tenant configuration

**Database Migrations (`sql/migrations/`)**
- `001_add_tenant_id.sql` - Add tenant_id columns (nullable)
- `002_create_tenant_configs.sql` - Create tenant_configs table
- `003_backfill_tenant_id.sql` - Backfill existing data
- `004_add_tenant_indexes.sql` - Performance indexes
- `005_add_prompt_version.sql` - Prompt version tracking

**Scripts**
- `scripts/apply-template.sh` - Apply industry template to config

### Changed
- Brand constants now loaded from `config/tenant.json`
- Competitors loaded from config instead of hardcoded array
- Scoring functions use config-based competitor matching
- Login page shows dynamic brand name
- Provider weights can be configured per-tenant

### Architectural Decisions
| Decision | Choice |
|----------|--------|
| Tenant Model | Single-tenant per deployment |
| Config Source | JSON file + env overrides (DB in Phase 2) |
| Prompt Storage | File-based with variable interpolation |
| Migration Strategy | Nullable tenant_id for backward compatibility |

---

## 2025-01-16

### Features
```
+------------------------------------------+
|  feat(intents): Intent Library Modal     |
+------------------------------------------+
|  - Centralized intent management         |
|  - Tabbed spreadsheet view               |
|  - Auto-save with 500ms debounce         |
|  - Stage-based organization              |
+------------------------------------------+
```

```
+------------------------------------------+
|  feat(ui): Model Logos & Home Redirect   |
+------------------------------------------+
|  - OpenAI, Claude, Gemini, Grok logos    |
|  - Provider KPI section visual upgrade   |
|  - Home redirects to /visibility-matrix  |
+------------------------------------------+
```

### Documentation
```
+------------------------------------------+
|  docs: UI documentation & dev settings   |
+------------------------------------------+
|  - Updated design system reference       |
|  - Component patterns documented         |
+------------------------------------------+
```

---

## 2025-01-15

### Features
```
+------------------------------------------+
|  feat: Neon PostgreSQL Migration         |
+------------------------------------------+
|  - Migrated from JSON files to Neon DB   |
|  - Benchmark storage in PostgreSQL       |
|  - Improved data persistence             |
+------------------------------------------+
```

### Documentation
```
+------------------------------------------+
|  docs: PRD v3.0 + CLAUDE.md + diagrams   |
+------------------------------------------+
|  - Product requirements document v3.0    |
|  - Claude Code guidance file             |
|  - Architecture diagrams                 |
+------------------------------------------+
```

---

## Earlier Releases

```
+------------------------------------------+
|  KPI Chart & Selector Improvements       |
+------------------------------------------+
|  - Refresh functionality                 |
|  - Selector cleanup                      |
+------------------------------------------+

+------------------------------------------+
|  Feature Kanban UI                       |
+------------------------------------------+
|  - Refined kanban board interface        |
|  - Documentation updates                 |
+------------------------------------------+
```

---

## Commit History

```
   +---------+----------------------------------------+
   | Hash    | Message                                |
   +---------+----------------------------------------+
   | 86551ab | docs: update UI documentation          |
   | aea484c | test: fix role parameter expectation   |
   | fb351a7 | feat(ui): model logos + redirect       |
   | 535f0ea | feat(intents): Intent Library modal    |
   | 9a733b8 | feat: migrate to Neon PostgreSQL       |
   | 0cf0660 | docs: PRD v3.0 + CLAUDE.md             |
   | 0860dff | kpi chart refresh + selector cleanup   |
   | c3bc117 | refine feature kanban UI + docs        |
   +---------+----------------------------------------+
```

---

```
  _____           _
 | ____|_ __   __| |
 |  _| | '_ \ / _` |
 | |___| | | | (_| |
 |_____|_| |_|\__,_|
```
