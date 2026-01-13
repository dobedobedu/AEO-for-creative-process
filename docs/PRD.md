# AI Visibility Baseline - Product Requirements Document

> **Last Updated**: January 2026 | **Version**: 2.0

## Goal

Build a recurring audit system for Lakewood Ranch AI visibility across the buyer journey. The product runs scheduled benchmarks, scores AI responses, powers insight dashboards, and enables RAG-based chat for stakeholder queries.

## Primary User

Marketing/brand stakeholders who want to understand how AI platforms represent their brand across the buyer decision journey.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         INTENT LIBRARY                          │
│  4 Personas × 4 Stages = 16 Cells                               │
│  Each cell: Intent + "Buyer Might Ask" queries                  │
│  Controls: CPO/Family Unit toggle, Temperature dial             │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      QUERY GENERATION                           │
│  DeepSeek interprets intents → actual search queries            │
│  System prompt varies by CPO vs Family Unit role                │
│  Temperature controls creativity                                │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      AI PROVIDERS (4)                           │
│  OpenAI (gpt-5.2) | Anthropic (claude-haiku-4-5)                │
│  Gemini (gemini-3-flash) | xAI (grok-4-latest)                  │
│  Web search enabled, batch processing, response cache           │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                   STAGE-AWARE SCORING                           │
│  Gemini 3 Flash structured output                               │
│  Stage-specific metrics:                                        │
│    Explore: Discovery Rate, Top-3 Rate                          │
│    Consider: Sentiment Score                                    │
│    Compare: Win Rate                                            │
│    Decide: Recommendation Rate                                  │
└─────────────────────────────────────────────────────────────────┘
                              │
                    ┌─────────┴─────────┐
                    ▼                   ▼
┌───────────────────────────┐ ┌───────────────────────────┐
│     RUN HISTORY (JSON)    │ │   GEMINI FILE SEARCH      │
│  Powers metrics panels    │ │  Scores + structured data │
│  Powers trend charts      │ │  Powers RAG chat          │
│  Powers insight cards     │ │  Semantic search          │
└───────────────────────────┘ └───────────────────────────┘
```

---

## Personas (4)

| Persona | Description |
|---------|-------------|
| `move_up` | Growing family, upgrading from starter home |
| `retiree` | Active adult buyer seeking 55+ community |
| `luxury` | High-net-worth buyer seeking premium amenities |
| `first_time` | First-time homebuyer entering market |

## Stages (4)

| Stage | Buyer State | Key Metric |
|-------|-------------|------------|
| `explore` | Awareness, life events triggering search | Discovery Rate |
| `consider` | Evaluating specific options | Sentiment Score |
| `compare` | Weighing alternatives | Win Rate |
| `decide` | Ready to commit, handoff to agent | Recommendation Rate |

---

## Intent Library Model

Each cell in the 4×4 matrix contains:

```typescript
interface Intent {
  id: string;
  persona: "move_up" | "retiree" | "luxury" | "first_time";
  stage: "explore" | "consider" | "compare" | "decide";
  text: string;                    // The core intent
  role: "cpo" | "family_unit";     // Decision lens
  queryStyle: number;              // 0.5 (common) to 1.0 (niche)
  active: boolean;
}
```

**Query Generation Flow**:
1. User writes intent text: "Find active adult communities"
2. User selects role toggle: CPO / Family Unit
3. User sets query style slider: Common ↔ Niche
4. DeepSeek generates search queries based on all inputs
5. UI displays queries under "Buyer Might Ask"
6. Queries sent to all 4 AI providers

**Role Toggle**:
- **CPO**: The pragmatic decision-maker focused on finances, risks, and investment protection
- **Family Unit**: The lifestyle architect focused on daily life, community, and well-being

**Query Style Slider**:
- **Common (0.5)**: High-volume, predictable queries many buyers would type
- **Niche (1.0)**: Long-tail, specific queries revealing deep concerns

---

## Cost Optimization

| Strategy | Implementation | Savings |
|----------|----------------|---------|
| Anthropic Prompt Caching | `cache_control` on system prompt | ~90% input tokens |
| Response Deduplication | 24h TTL cache by query+provider+model | Avoids duplicate calls |
| Scheduled Runs | Vercel Cron (10PM SGT daily) | Off-peak, batched |

---

## Hybrid Storage

| Store | Purpose | Format |
|-------|---------|--------|
| `data/runs/*.json` | Run history, metrics, trends | JSON files |
| `data/intent-library.json` | Intent definitions + versions | JSON file |
| Gemini FileSearchStore | RAG chat, semantic search | Embedded markdown |

---

## Non-Goals (Current)

- Multi-tenant / RBAC
- Deep Research mode (deferred)
- Real-time streaming UI
- Accuracy scoring against proprietary docs
- "Decide" stage optimization (placeholder for future)

---

## Success Metrics

- Scheduled runs complete daily without intervention
- All 4 providers respond per query
- Insight dashboards update automatically
- Chat correctly retrieves historical data via RAG
- Cost per run < $5 (target)
