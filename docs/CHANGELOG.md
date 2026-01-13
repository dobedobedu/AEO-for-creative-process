# Changelog

## January 2026

### 2026-01-13 (Feature Kanban UI)
- Added Feature Kanban board with 4 visibility tiers and category tabs
- Simplified cards to title + mention rate with detail modal placeholder
- Switched to vertical divider layout inspired by vibe-kanban

### 2026-01-13 (KPI Chart + Selector Simplification)
- Replaced KPI selector pills with right-side model selector/legend next to stacked area chart
- Added Daily/Weekly/Monthly range toggle for KPI chart windowing
- Removed Trend Over Time card (streamlined to a single KPI chart)
- Added KPI metric tabs (Mention/Sentiment/Win Rate/Top 3 Rec)
- Note: KPI metric tabs are UI-only for now; wire to real series per metric + date buckets

### 2026-01-06 (Cost Optimizations + Debugging)
- Added Anthropic prompt caching with `cache_control` header (~90% input token savings)
- Added response deduplication cache with 24h TTL (`lib/cache/responseCache.ts`)
- Added scheduled benchmark endpoint (`/api/benchmark/scheduled`) with Vercel Cron
- Configured daily runs at 10PM SGT (2PM UTC) via `vercel.json`
- Fixed Gemini File Search by clearing corrupt store data
- Verified `claude-haiku-4-5` access with new API key
- Added comprehensive tests for cache and scheduled endpoint (79 tests passing)
- Updated documentation: PRD.md, Data-Model.md, Intent-Library.md

### 2026-01-05 (Intent Library Refactor)
- Renamed "queries" to "intents" with "Buyer Might Ask" manifestations
- Added CPO vs Family Unit role toggle
- Added creativity/temperature dial for query generation
- Refactored benchmark runner to use intent-based configuration

---

## December 2025

### 2025-12-23 (Analysis + streaming results + build fixes)
- Added Gemini 3 Pro analysis endpoint and Insights UI
- Added client-side sequential execution for streaming-like response updates
- Added insights persistence with upsert
- Fixed TypeScript build errors for postgres queries and JSON params

### 2025-12-23 (Provider concurrency lanes)
- Added per-provider concurrency config (1 per provider default)
- Client executor runs one lane per provider in parallel
- API exposes provider concurrency config for future expansion

### 2025-12-23 (Anthropic + xAI lanes + Claude docs)
- Added Anthropic and xAI as native-search providers
- Documented Claude search result citation shape and structured-output constraints

### 2025-12-23 (Citation normalization + analysis schema v2)
- Added normalized citation summary + model breakdown payload for Gemini 3 Pro analysis
- Expanded analysis schema to include citation_summary and model_breakdown
- Added unit test for analysis input normalization

### 2025-12-23 (Insight framework + cards)
- Documented the 10-point insight framework and technical steps
- Added flexible `insight_cards` to analysis schema and UI

### 2025-12-23 (Trigger groups + DeepSeek conditioning)
- Added stage-based trigger library and UI selection
- Passed selected triggers into DeepSeek query generation
- Stored triggers with runs and inserted into triggers table

### 2025-12-23 (Geography input for query generation)
- Added geography input (zip/city/county/state) to the UI
- Stored geo in run config and passed into DeepSeek query generation

### 2025-12-23 (Memory toggle + query length)
- Added memory toggle (compact/full) to include persona context in model search calls
- Added query length dial for DeepSeek query generation

### 2025-12-23 (Run history + analysis selection)
- Added run history API + UI view
- Added response selection controls for analysis
- Gemini analysis can now filter by selected response IDs

### 2025-12-23 (Dual Gemini analysis + thought summaries)
- Added dual analysis passes (consultant + hypothesis) for Gemini 3 Flash and Pro
- Enabled Gemini thinking config with thought summaries
- Analysis now returns multiple variants side-by-side in the UI

### 2025-12-23 (Dashboard UI refactor - in progress)
- New dashboard layout with KPI row + collapsible columns
- Added default personas and persona selection logic
- Added KPI v0.1 row with deterministic metrics

### 2025-12-22 (MVP: Query gen + sequential execution + response visibility)
- Added OpenRouter (DeepSeek) query generation endpoint and UI button
- Added sequential run executor with progress tracking
- Added responses + citations API and UI display
- Persisted run execution metadata to config_json
- Forced OpenAI web search tool usage for citations

---

## Planned

- [ ] Batch processing for AI providers (Anthropic batch API)
- [ ] Intent Library admin UI
- [ ] Database migration from file-based storage
- [ ] Deep Research mode integration
- [ ] Historical comparison across runs
