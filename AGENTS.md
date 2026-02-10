# AI Visibility Matrix - Agent Guidelines

## Project Context

- **Stack**: Next.js 16 + React 19 + TypeScript
- **UI**: shadcn/ui components (prefer over custom implementations)
- **Design System**: Warm palette - sage green `#1f3b2c`, cream `#f6f1e8`, terracotta `#b86f3a`
- **Architecture**: White-label platform (brand/competitors configurable)
- **Default Brand**: Lakewood Ranch (Florida master-planned community)

## Platform Architecture (v0.6.0)

The app is now a **white-label platform** supporting multiple industries.

### Configuration System

```
config/
├── tenant.json           # Main config (brand, competitors, personas, stages)
├── prompts/              # Externalized prompt templates
│   ├── query-generation/
│   ├── extraction/
│   └── chat/
└── templates/            # Industry templates
    ├── real-estate.json
    ├── education.json
    ├── healthcare.json
    └── marketing-general.json
```

### Config Module (`src/lib/config/`)

```typescript
// Server-side (API routes, server components)
import { getTenantConfig, getBrandName, getCompetitors } from "@/lib/config";

// Client-side (React components)
import { useTenantConfig, useBrandConfig } from "@/lib/config/client";
```

### Key Utilities

| Function | Purpose |
|----------|---------|
| `getBrandName()` | Get brand name from config |
| `getBrandTerms()` | Get brand + aliases for matching |
| `findCompetitorMentions(text)` | Find competitors in text |
| `getExtractionPrompt(stage)` | Get extraction prompt for stage |
| `useTenantConfig()` | React hook for client components |

### Environment Overrides

Brand config can be overridden via environment variables:
- `BRAND_NAME` - Override brand name
- `BRAND_ALIASES` - Comma-separated aliases
- `BRAND_DOMAIN` - Brand website domain

### Industry Templates

Apply a template to start with a pre-configured setup:

```bash
./scripts/apply-template.sh education
```

## Architecture

```
src/
├── app/
│   ├── visibility-matrix/page.tsx  # Main UI (~1600 lines, intentionally single file)
│   └── api/benchmark/run/route.ts  # Benchmark execution endpoint
├── lib/benchmark/
│   ├── scoring.ts    # Brand detection, sentiment, position analysis
│   └── runner.ts     # Multi-provider API execution
└── components/ui/    # shadcn components
```

## Key Learnings (Compounding)

### SSR / Hydration
- **Never use `Math.random()` or `Date.now()` at module level** - causes hydration mismatch
- Use deterministic mock data for demos (see `MOCK_HISTORY` constant)

### Data Fetching Architecture
- **Centralized data layer**: All Matrix page data fetching goes through `useMatrixData` hook (`src/lib/matrix/data/`)
- **Explicit state machine**: Status = `"idle" | "loading" | "ready" | "error"` for clear UI states
- **Zod-validated responses**: All API responses are parsed and validated at the data layer boundary
- **Error boundary**: `MatrixDataBoundary` component wraps the Matrix page for error display and recovery
- **Intent library polling**: Automatic 10s polling for multi-user sync, cleaned up on unmount/deactivate
- **Re-activation handling**: Hook detects navigation back to page and reloads data via `refreshToken`

### Components
- **Prefer shadcn over custom** - shadcn chart replaced our buggy custom SVG chart
- shadcn handles SSR, accessibility, responsive design correctly

### Scoring System
- Rule-based regex analysis (fast, free, deterministic)
- Known limitation: can't detect negation ("Lakewood Ranch isn't the best" scores positive)
- Future: consider hybrid LLM analysis for ambiguous cases

### API Models (as of Jan 2026)
- OpenAI: `gpt-5.2`
- Anthropic: `claude-haiku-4-5`
- Google: `gemini-3-flash-preview` (ALWAYS use Gemini 3 series - see below)
- xAI: `grok-4-latest`

### Gemini Model Policy (IMPORTANT)
**Always use the latest Gemini 3 series models.** This applies to:
- Web search/grounding: `gemini-3-flash-preview`
- Position extraction (scoring): `gemini-3-flash-preview`
- Chat/analysis: `gemini-3-flash-preview`
- File Search queries: `gemini-3-flash-preview` (supports structured output + file search)

**Why Gemini 3:**
- Gemini 3 supports File Search + Structured Output together (2.5 doesn't)
- Latest capabilities and improved accuracy
- Embedding pricing is same regardless of model version

**Embedding Note:**
- Embeddings use `gemini-embedding-001` (handled automatically by FileSearchStore)
- You don't call embedding API directly - upload to FileSearchStore and Gemini handles it
- Cost: $0.15/1M tokens at indexing time, FREE at query time

## Verification Commands

```bash
npm run build    # Must pass - catches TypeScript errors
npm test         # 19 benchmark tests must pass
```

**Known failing test**: `geminiCitations.test.ts` (pre-existing issue, not blocking)

## Don't

- Don't add dependencies without checking if shadcn/existing libs cover it
- Don't extract components until proven reuse (2+ places)
- Don't delete `/visibility-board` page yet (may reuse)
- Don't use `Math.random()` for any data that renders on page load

## Do

- Add learnings to this file when Claude makes a mistake
- Run `npm run build` before considering work complete
- Use shadcn CLI to add new UI components: `npx shadcn@latest add [component]`
- Keep mock data deterministic for reliable SSR

## Current State (v0.5.0 - Supabase Auth + DB Progress)

**Just Completed (Pending Code Review):**
- **Supabase Auth**: Google OAuth for user authentication
- **DB-backed Progress**: Progress tracking persisted in Postgres (works across serverless instances)
- **User Attribution**: Intent edits tracked by user_id
- **Atomic Transactions**: Intent updates are transactional (race-condition safe)
- Intent library migrated from JSON file to Postgres (multi-user sync)
- All library functions now async (loadIntentLibrary, createIntent, updateIntent, etc.)
- Cron schedule updated to midnight EST (`0 5 * * *`)
- Scheduled benchmark generates 3 queries per intent (matching manual runs)
- Generated queries saved to intent library after scheduled runs
- Back button removed from main matrix page header

**Complete:**
- Visibility Matrix with Persona × Stage grid
- 4 AI provider benchmarking (OpenAI, Anthropic, Gemini, xAI)
- Stage-specific insights (Position, Sentiment, Win Rate, Recommendations)
- Evidence modals for all insight panels
- Time slider with historical view (mock data)
- 150+ real queries from Reddit, Quora, forums
- Chat panel with AI SDK 6 integration (Field Intelligence)
- LLM-based position extraction (accurate ranking detection)
- Markdown rendering in Deep Dive and Chat responses
- Query panel with scope tabs (cell/row/column/all)
- **Gemini File Search integration (RAG-based chat)**

**Hybrid Chat Architecture:**
```
Current Session Data → Context Injection (fast, immediate)
Historical Data → Gemini File Search (RAG, semantic search)
```

The chat API automatically chooses the right mode:
- If `queryResults` present → Context injection
- If `useFileSearch=true` + no current data → File Search

**File Search Module (`src/lib/filesearch/`):**
```
├── client.ts      # GoogleGenAI client singleton
├── store.ts       # FileSearchStore management
├── formatter.ts   # Format benchmark data for upload
├── uploader.ts    # Upload to FileSearchStore
├── query.ts       # Query with File Search tool
└── index.ts       # Public exports
```

**Next Phase:**
- Auto-upload benchmarks to FileSearchStore after completion
- Add date range filtering for historical queries
- Historical comparison across runs

## Model Usage Map

| Layer | Model | Purpose |
|-------|-------|---------|
| Benchmark | OpenAI GPT-5.2 | Web search responses |
| Benchmark | Anthropic Claude Haiku 4.5 | Web search responses |
| Benchmark | Gemini 3 Flash | Web search responses |
| Benchmark | xAI Grok 4 | Web search responses |
| Scoring | Gemini 3 Flash | Position extraction (structured output) |
| Chat (context) | Gemini 3 Flash | Conversational insights (current data) |
| Chat (RAG) | Gemini 3 Flash + FileSearchStore | RAG-based retrieval (historical) |

## File Search Cost Model

| Operation | Cost | When |
|-----------|------|------|
| Embedding at indexing | $0.15/1M tokens | Once per upload |
| Storage | FREE | Ongoing |
| Query-time embedding | FREE | Every chat |
| Input/output tokens | Standard Gemini pricing | Every chat |

Typical full benchmark (~1600 responses): ~$0.12 embedding cost

## Cost Optimization Strategies

| Strategy | Location | Effect |
|----------|----------|--------|
| Anthropic Prompt Caching | `lib/providers/anthropic.ts` | ~90% input token savings |
| Response Deduplication | `lib/cache/responseCache.ts` | Avoids duplicate API calls (24h TTL) |
| Scheduled Runs | `vercel.json` cron | Daily batch at 10PM SGT |

**Anthropic Caching**: Uses `cache_control: { type: "ephemeral" }` and `anthropic-beta` header. System prompt is cached; query is dynamic.

**Response Cache**: In-memory with file persistence. Key = SHA256(`provider:model:query`).

**Vercel Cron**: Runs at midnight EST (`0 5 * * *`). Requires Pro plan. Endpoint at `/api/benchmark/scheduled`. Set `CRON_SECRET` env var for auth.

---

## Pre-Deployment Changes (Code Review Checklist)

### Authentication (Supabase)

**New Files:**
| File | Purpose |
|------|---------|
| `src/lib/auth/supabase.ts` | Supabase client helpers (server & browser) |
| `src/app/login/page.tsx` | Google OAuth login page |
| `src/app/auth/callback/route.ts` | OAuth callback handler |
| `src/middleware.ts` | Auth enforcement middleware |

**Auth Flow:**
1. Unauthenticated users → redirected to `/login`
2. Click "Sign in with Google" → Supabase OAuth
3. Callback exchanges code → session cookie set
4. Redirect to `/visibility-matrix`

**Protected Routes:**
- All pages except `/login` and `/auth/callback`
- API mutations: `/api/intents/*`, `/api/benchmark/run`, `/api/chat`
- Cron uses `CRON_SECRET` header (no user auth)

### Database Migration (Intent Library)

**Files Changed:**
| File | Change |
|------|--------|
| `src/lib/intents/library.ts` | Async DB calls + actorUserId param |
| `src/lib/intents/db.ts` | Atomic transactions, user attribution |
| `src/lib/intents/schema.sql` | Added user attribution columns |
| `sql/2026-01-20-supabase-auth.sql` | Migration for auth columns + progress |
| `src/app/api/intents/library/queries/route.ts` | User attribution from session |
| `src/app/api/benchmark/run/route.ts` | Async progress calls |

**New Database Columns:**
```sql
-- On intents table
created_by UUID NULL
updated_by UUID NULL
updated_at TIMESTAMPTZ

-- On intent_history table
actor_user_id UUID NULL

-- New run_progress table
run_progress (run_id, status, total_steps, completed_steps, unit, events, started_by, ...)
```

### DB-backed Progress

**Files Changed:**
| File | Change |
|------|--------|
| `src/lib/benchmark/progress.ts` | Replaced Map with Postgres |
| `src/app/api/benchmark/progress/[runId]/route.ts` | Async getProgress |

**Benefits:**
- Progress persists across serverless instances
- Works reliably during Vercel cold starts
- 1% cleanup on reads (entries older than 24h)

### Cron & Benchmark Changes

| Change | Before | After |
|--------|--------|-------|
| Cron schedule | `0 14 * * *` | `0 5 * * *` (midnight EST) |
| Queries per intent | 5 | 3 (matches manual runs) |
| Generated queries | Not saved | Saved to intent library |

### Environment Variables

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous key |
| `DATABASE_URL` | Supabase Postgres connection string |
| `CRON_SECRET` | Auth token for scheduled benchmarks |

### Deployment Steps

1. Create Supabase project, enable Google OAuth provider
2. Run SQL migrations:
   - `sql/2026-01-20-supabase-auth.sql` (auth + progress tables)
   - `sql/2026-01-20-user-activity.sql` (activity tracking)
3. Set environment variables in Vercel
4. Deploy to Vercel
5. Test login flow
6. Test cron: `curl -H "Authorization: Bearer $CRON_SECRET" https://app.vercel.app/api/benchmark/scheduled`

### Security Hardening (v0.5.1)

**All AI-calling endpoints now require auth:**
- `/api/query` - AI query endpoint
- `/api/run/execute` - AI execution endpoint
- `/api/run/analyze` - AI analysis endpoint

**Schema bootstrap synced:**
- `ensureIntentSchema()` now includes `created_by`, `updated_by`, `updated_at`, `actor_user_id` columns
- Fresh DB setup works without requiring migration

### Usage Tracking (v0.5.1)

**Lightweight activity tracking:**
- `app_users.last_active_at` - Updated on benchmark runs and intent edits
- `run_progress.started_by` - Records who initiated each benchmark
- Non-invasive: Only tracks last activity timestamp, no logging

### Test Results

- `npm run build` ✓ passes
- `npm test` ✓ all 185 tests pass

---

## Terminology

| Term | Meaning |
|------|---------|
| Intent | What the buyer wants (e.g., "Find communities for retirement") |
| "Buyer Might Ask" | Example queries derived from intent (formerly "manifestations") |
| CPO | Chief Purchasing Officer role - analytical, practical queries |
| Family Unit | Emotional, lifestyle-focused queries |
| Cell | One persona × stage intersection in the 4×4 matrix |
