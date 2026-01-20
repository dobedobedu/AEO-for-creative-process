# AI Visibility Baseline - Product Requirements Document

> **Version**: 3.4 | **Updated**: January 20th, 2026

## Goal

Build a recurring audit system for Lakewood Ranch AI visibility across the buyer journey. Run scheduled benchmarks, score AI responses, power insight dashboards, and enable integrated, context-aware RAG chat for real-time stakeholder auditing.

## Primary User

Marketing/brand stakeholders who want to understand how AI platforms represent their brand across the buyer decision journey.

---

## Deployment Architecture

### Multi-User Support
- **Shared data model**: All users (5 total) see the same intent library, queries, and benchmark results
- **Intent library stored in Supabase Postgres** for multi-user sync and persistence
- **Google OAuth**: Supabase Auth with Google provider for user authentication
- **User attribution**: All edits tracked by user_id for accountability

### Scheduled Benchmarks
- **Daily cron at midnight EST** (5 AM UTC): `0 5 * * *`
- **3 queries per intent** (matching manual runs)
- Generated queries saved to intent library for reference

### Database Tables
```sql
-- Intent library metadata (single row for version tracking)
intent_library_meta (id, version, updated_at)

-- Intents table
intents (id, persona, stage, text, role, query_style, generated_queries, active, created_at)

-- History table for audit trail
intent_history (id, version, date, changes, created_at)
```

### Migration
Run `npx tsx scripts/migrate-intents-to-db.ts` to copy existing `library.json` → Postgres

---

## Pages

| Page | Purpose |
|------|---------|
| **Matrix** (main) | Persona × Stage grid with visibility metrics and integrated Interactive Audit |
| **Kanban Board** | Feature visibility tiers by category |

---

## Data Model

### Personas (editable)
Default set - can add, remove, or edit:

| Persona | Description |
|---------|-------------|
| `move_up` | Growing family, upgrading from starter home |
| `retiree` | Active adult buyer seeking 55+ community |
| `luxury` | High-net-worth buyer seeking premium amenities |
| `first_time` | First-time homebuyer entering market |

### Stages (editable)
Default set - can add, remove, or edit:

| Stage | Buyer State | Key Metric |
|-------|-------------|------------|
| `explore` | Awareness, life events triggering search | Discovery Rate |
| `consider` | Evaluating specific options | Trust Signal Rate |
| `compare` | Weighing alternatives | Win Rate |
| `decide` | Objections, tough questions before commit | Evidence Rate |

### CPO / Family Unit (editable per persona)
Each persona has customizable defaults:
- **CPO**: Pragmatic decision-maker focused on finances, risks, investment protection
- **Family Unit**: Lifestyle architect focused on daily life, community, well-being

---

## Stage Metrics

| Stage | Primary Metric | Secondary Metric | What Marketing Learns |
|-------|---------------|------------------|----------------------|
| Explore | **Discovery Rate** (%) | **Top 3 Rate** (%) | "Are we being surfaced? Are we prominent?" |
| Consider | **Sentiment Score** (-1 to +1) | Concerns/Strengths counts | "How are we portrayed? What objections exist?" |
| Compare | **Win Rate** (%) | Attributes Won/Lost | "Do we win head-to-head? On what?" |
| Decide | **Recommendation Rate** (%) | **Concern Resolution** | "Are we recommended? Are concerns addressed?" |

### Metric Details

**Explore Stage:**
- Discovery Rate: % of responses where brand is mentioned
- Top 3 Rate: % where brand appears in positions 1st, 2nd, or 3rd
- Position tracking: 1st, 2nd, 3rd, later, absent

**Consider Stage:**
- Sentiment: -1 (negative) → 0 (neutral) → +1 (positive)
- UI shows both numeric value and label (e.g., "0.3 (Positive)")

**Compare Stage:**
- Win = 1.0, Tie/Mixed = 0.5, Lose = 0
- Tracks which attributes brand wins/loses on

**Decide Stage:**
- Recommendation strength: not_mentioned → mentioned → suggested → recommended → strongly_recommended
- Concern Resolution (NEW): Tracks concerns addressed vs unaddressed
- Actionable Guidance: Did AI provide clear next steps?

**Decide stage query examples:**
- "Is Lakewood Ranch politically extreme?"
- "Is traffic as bad as I've heard?"
- "Is there bullying in the schools?"
- "Is cellular signal bad?"
- "What's the best mortgage rate available?"
- "Is buying new actually cheaper than resale?"

---

## Scoring Architecture

| System | Location | Status |
|--------|----------|--------|
| **Gemini Extraction** | `src/lib/scoring/extractor.ts` | PRIMARY - Uses Gemini 3 Flash structured output |
| **Legacy Heuristics** | `src/lib/benchmark/scoring.ts` | SUPERSEDED - Code exists for reference |

All metrics flow from Gemini extractions with stage-specific schemas:
- `ExploreExtractionSchema`: mentioned, inTopThree, position, competitors
- `ConsiderExtractionSchema`: sentiment, sentimentScore, strengthsMentioned, concernsRaised
- `CompareExtractionSchema`: outcome, comparedTo, winsOn, losesOn
- `DecideExtractionSchema`: recommended, recommendationStrength, concernsAddressed, concernsUnaddressed, actionableGuidance

---

## AnswersPanel (LLM Response Viewer)

Stage-specific UI showing actual AI responses with:

**Stage Metrics Summary:**
- Explore: Discovery Rate, Top 3 Rate, Query Count
- Consider: Sentiment Score (numeric + label), Positive/Negative counts
- Compare: Win Rate, Comparison Count, Top Competitors
- Decide: Rec Rate, Strong Recommendations, Total Recommendations

**Provider Rows:**
- Brand mentions highlighted in green (`<mark>`)
- Stage-appropriate badges:
  - Explore: Mentioned, Position (best across responses), Query count
  - Consider: Mentioned, Sentiment, Query count
  - Compare/Decide: Mentioned, Query count

**Actions:**
- "Run" button to execute benchmark for current cell
- Week navigation for historical data

---

## Heatmap Thresholds (Standardized)

All components use consistent thresholds:
- **≥ 0.7**: Green (strong performance)
- **≥ 0.4**: Tan (moderate performance)
- **< 0.4**: Red (weak performance)

---

Single view to manage all intents and generated queries across the matrix:
- View all intents by persona/stage via "Focus Mode"
- View all generated "Buyer Might Ask" queries
- Edit intent text, role (CPO/Family Unit), query style (common↔niche)

### Intent Model

```typescript
interface Intent {
  id: string;
  persona: string;
  stage: string;
  text: string;
  role: "cpo" | "family_unit";
  queryStyle: number;  // 0.5 (common) to 1.0 (niche)
  active: boolean;
}
```

---

## Models (January 2026)

| Provider | Model | Purpose |
|----------|-------|---------|
| OpenAI | `gpt-5.2` | Web search responses |
| Anthropic | `claude-haiku-4-5` | Web search responses |
| Google | `gemini-3-flash-preview` | Web search + scoring + integrated audit |
| xAI | `grok-4-latest` | Web search responses |
| DeepSeek | `deepseek/deepseek-v3.2` (via OpenRouter) | Query generation |

---

## Storage

| Layer | Technology | Purpose |
|-------|------------|---------|
| Database | Supabase PostgreSQL | Persistence, auth, user tracking, progress |
| File Search | Gemini FileSearchStore | RAG chat, semantic search over runs |

---

## Environment Variables

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous key |
| `DATABASE_URL` | Supabase PostgreSQL connection string |
| `OPENAI_API_KEY` | OpenAI GPT-5.2 |
| `ANTHROPIC_API_KEY` | Claude Haiku 4.5 |
| `GEMINI_API_KEY` | Gemini 3 Flash (GOOGLE_API_KEY also works) |
| `XAI_API_KEY` | xAI Grok-4 |
| `DEEPSEEK_API_KEY` | DeepSeek V3.2 (for query generation) |
| `OPENROUTER_API_KEY` | DeepSeek via OpenRouter (alternative) |
| `CRON_SECRET` | Auth token for scheduled benchmarks (Vercel cron header) |

---

## Cost Optimization

| Strategy | Implementation | Savings |
|----------|----------------|---------|
| Anthropic Prompt Caching | `cache_control` on system prompt | ~90% input tokens |
| Response Deduplication | 24h TTL cache by query+provider+model | Avoids duplicate calls |
| Scheduled Runs | Vercel Cron (daily) | Off-peak, batched |

---

## What's Next

- [ ] Editable personas and stages (UI for add/remove/edit)
- [ ] Implementation & Effect tracking page (measure content changes over time)
- [ ] Intent library admin UI (single view for all intents/queries)
- [ ] Historical comparison across runs
- [ ] Batch processing for AI providers (Anthropic batch API)

---

## Non-Goals (Current)

- Multi-tenant / RBAC
- Deep Research mode
- Real-time streaming UI
- Accuracy scoring against proprietary docs
