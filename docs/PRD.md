# AI Visibility Baseline - Product Requirements Document

> **Version**: 3.0 | **Updated**: January 2026

## Goal

Build a recurring audit system for Lakewood Ranch AI visibility across the buyer journey. Run scheduled benchmarks, score AI responses, power insight dashboards, and enable RAG-based chat for stakeholder queries.

## Primary User

Marketing/brand stakeholders who want to understand how AI platforms represent their brand across the buyer decision journey.

---

## Pages

| Page | Purpose |
|------|---------|
| **Matrix** (main) | Persona × Stage grid with visibility metrics per cell |
| **Kanban Board** | Feature visibility tiers by category |
| **Implementation & Effect** | Track content changes and measure impact over time |

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

| Stage | Metric | What It Measures | Scoring |
|-------|--------|------------------|---------|
| Explore | **Discovery Rate** | Is brand surfaced in awareness queries? | Mentioned = 1, Absent = 0 |
| Consider | **Trust Signal Rate** | Are verifiable trust signals included? (awards, rankings, reviews) | Count of specific, quotable signals |
| Compare | **Win Rate** | Does brand win head-to-head comparisons? | Position 1 = 1.0, Position 2 = 0.5, etc. |
| Decide | **Evidence Rate** | Is there sufficient quotable content for tough objections? | Specific data = 1.0, Vague = 0.5, Deflects = 0 |

**Decide stage query examples:**
- "Is Lakewood Ranch politically extreme?"
- "Is traffic as bad as I've heard?"
- "Is there bullying in the schools?"
- "Is cellular signal bad?"
- "What's the best mortgage rate available?"
- "Is buying new actually cheaper than resale?"

---

## Intent & Query Management

Single view to manage all intents and generated queries across the matrix:
- View all intents by persona/stage
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
| Google | `gemini-3-flash-preview` | Web search + scoring + chat |
| xAI | `grok-4-1-fast-reasoning` | Web search responses |
| DeepSeek | `v3.2` (via OpenRouter) | Query generation |

---

## Storage

| Layer | Technology | Purpose |
|-------|------------|---------|
| Database | Neon PostgreSQL | Persistence, historical data, trend tracking |
| File Search | Gemini FileSearchStore | RAG chat, semantic search over runs |

---

## Environment Variables

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | Neon PostgreSQL connection (pooled) |
| `OPENAI_API_KEY` | OpenAI GPT-5.2 |
| `ANTHROPIC_API_KEY` | Claude Haiku 4.5 |
| `GOOGLE_AI_API_KEY` | Gemini 3 Flash |
| `XAI_API_KEY` | xAI Grok-4 |
| `OPENROUTER_API_KEY` | DeepSeek via OpenRouter |
| `CRON_SECRET` | Auth token for scheduled benchmarks |

---

## Cost Optimization

| Strategy | Implementation | Savings |
|----------|----------------|---------|
| Anthropic Prompt Caching | `cache_control` on system prompt | ~90% input tokens |
| Response Deduplication | 24h TTL cache by query+provider+model | Avoids duplicate calls |
| Scheduled Runs | Vercel Cron (daily) | Off-peak, batched |

---

## What's Next

- [ ] Supabase integration for persistence
- [ ] Editable personas and stages
- [ ] Implementation & Effect tracking page
- [ ] Intent library admin UI (single view for all intents/queries)
- [ ] Historical comparison across runs
- [ ] Batch processing for AI providers (Anthropic batch API)

---

## Non-Goals (Current)

- Multi-tenant / RBAC
- Deep Research mode
- Real-time streaming UI
- Accuracy scoring against proprietary docs
