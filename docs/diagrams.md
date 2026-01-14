# Architecture Diagrams

## System Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                         INTENT LIBRARY                          │
│  Personas × Stages = Matrix Cells                               │
│  Each cell: Intent + "Buyer Might Ask" queries                  │
│  Controls: CPO/Family Unit toggle, Query Style dial             │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      QUERY GENERATION                           │
│  DeepSeek v3.2 interprets intents → search queries              │
│  System prompt varies by CPO vs Family Unit role                │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      AI PROVIDERS (4)                           │
│  OpenAI (gpt-5.2) | Anthropic (claude-haiku-4-5)                │
│  Gemini (gemini-3-flash) | xAI (grok-4-1-fast-reasoning)        │
│  Web search enabled, batch processing, response cache           │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                   STAGE-AWARE SCORING                           │
│  Gemini 3 Flash structured output                               │
│  Stage-specific metrics:                                        │
│    Explore: Discovery Rate                                      │
│    Consider: Trust Signal Rate                                  │
│    Compare: Win Rate                                            │
│    Decide: Evidence Rate                                        │
└─────────────────────────────────────────────────────────────────┘
                              │
                    ┌─────────┴─────────┐
                    ▼                   ▼
┌───────────────────────────┐ ┌───────────────────────────┐
│     SUPABASE              │ │   GEMINI FILE SEARCH      │
│  Persistence + history    │ │  RAG chat + semantic      │
│  Trend tracking           │ │  search over runs         │
└───────────────────────────┘ └───────────────────────────┘
```

## Data Flow

```
Intent (user-defined)
    │
    ▼
DeepSeek v3.2 ──► Generated Queries (5 per intent)
    │
    ├──► OpenAI ──────┐
    ├──► Anthropic ───┤
    ├──► Gemini ──────┼──► Raw Responses
    └──► xAI ─────────┘
                │
                ▼
        Gemini Scoring ──► Stage Metrics
                │
                ├──► Supabase (persistence)
                └──► FileSearch (RAG)
```

## Page Structure

```
┌─────────────────────────────────────────────────────────────────┐
│  MATRIX PAGE (main)                                             │
│  ┌─────────┬──────────┬──────────┬──────────┬──────────┐        │
│  │         │ Explore  │ Consider │ Compare  │ Decide   │        │
│  ├─────────┼──────────┼──────────┼──────────┼──────────┤        │
│  │ Move Up │   cell   │   cell   │   cell   │   cell   │        │
│  │ Retiree │   cell   │   cell   │   cell   │   cell   │        │
│  │ Luxury  │   cell   │   cell   │   cell   │   cell   │        │
│  │ First   │   cell   │   cell   │   cell   │   cell   │        │
│  └─────────┴──────────┴──────────┴──────────┴──────────┘        │
│  + KPI Charts | Trend Panel | Chat Panel                        │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  KANBAN BOARD PAGE                                              │
│  ┌────────────┬────────────┬────────────┬────────────┐          │
│  │ High Vis   │ Medium     │ Low        │ Not Found  │          │
│  │ (features) │ (features) │ (features) │ (features) │          │
│  └────────────┴────────────┴────────────┴────────────┘          │
│  Category tabs: All / Amenity / Activities / Schools / Nature   │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  IMPLEMENTATION & EFFECT PAGE                                   │
│  Track content changes → Measure visibility impact over time    │
└─────────────────────────────────────────────────────────────────┘
```
