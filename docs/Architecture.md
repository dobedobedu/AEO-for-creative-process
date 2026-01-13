# Architecture Overview

> Last Updated: January 2026

## Directory Structure

```
src/
├── app/                      # Next.js App Router
│   ├── api/                  # API Routes
│   │   ├── benchmark/        # Benchmark endpoints
│   │   │   ├── run/          # Ad-hoc benchmark runs
│   │   │   └── scheduled/    # Daily cron benchmarks
│   │   ├── intents/          # Intent management
│   │   │   ├── generate/     # DeepSeek query generation
│   │   │   └── library/      # Intent CRUD
│   │   ├── query/            # Legacy query endpoints
│   │   └── run/              # Run data access
│   └── visibility-matrix/    # Main dashboard page
│
├── components/               # React UI Components
│   ├── query-panel-v2.tsx    # Intent editing modal
│   └── ui/                   # shadcn/ui primitives
│
└── lib/                      # Core Business Logic
    ├── benchmark/            # Benchmark execution
    │   ├── runner.ts         # Query → Provider → Responses
    │   └── scoring.ts        # Response → Metrics
    ├── intents/              # Intent Library
    │   ├── types.ts          # Intent, IntentNode schemas
    │   ├── library.ts        # CRUD operations
    │   └── queryGenerator.ts # DeepSeek query generation
    ├── providers/            # AI Provider Adapters
    │   ├── openai.ts
    │   ├── anthropic.ts
    │   ├── gemini.ts
    │   └── xai.ts
    ├── scoring/              # Extraction & Metrics
    │   ├── extractor.ts      # Stage-specific metrics
    │   └── schemas.ts        # StageExtraction schemas
    ├── runs/                 # Run Storage
    │   ├── storage.ts        # JSON file persistence
    │   ├── types.ts          # BenchmarkRun, CellResult
    │   └── utils.ts          # Shared constants/helpers
    └── filesearch/           # RAG Integration
        └── uploader.ts       # Gemini FileSearch upload
```

---

## Key Types

### Intent Library (`lib/intents/types.ts`)

```typescript
interface Intent {
  id: string;
  persona: "move_up" | "retiree" | "luxury" | "first_time";
  stage: "explore" | "consider" | "compare" | "decide";
  text: string;
  role: "cpo" | "family_unit";
  queryStyle: number;  // 0.5 (common) to 1.0 (niche)
  active: boolean;
}

interface IntentNode {
  id: string;
  text: string;
  role: "cpo" | "family_unit";
  queryStyle: number;
  generatedQueries?: string[];  // UI state only
}
```

### Benchmark Results (`lib/runs/types.ts`)

```typescript
interface BenchmarkRun {
  id: string;
  brand: string;
  createdAt: string;
  cells: Record<string, CellResult>;
  summary: { discoveryRate: number; topThreeRate: number; ... };
}

interface CellResult {
  persona: Persona;
  stage: Stage;
  queriesUsed: string[];
  metrics: StageMetrics;
  results: QueryResult[];
}
```

### Stage Extractions (`lib/scoring/schemas.ts`)

```typescript
// Stage-specific extraction schemas
ExploreExtraction: { mentioned, responseRelevant, inTopThree, totalOptionsListed, ... }
ConsiderExtraction: { mentioned, sentiment, qualityIndicators, ... }
CompareExtraction: { mentioned, winPosition, alternatives, ... }
DecideExtraction: { mentioned, recommendation, confidence, ... }
```

---

## Data Flow

```
┌─────────────────┐     ┌─────────────┐     ┌─────────────┐
│  Intent Library │────▶│  DeepSeek   │────▶│  Queries    │
│  + Role/Style   │     │  V3         │     │  (5 each)   │
└─────────────────┘     └─────────────┘     └──────┬──────┘
                                                   │
              ┌────────────────────────────────────┴───────┐
              ▼                    ▼                       ▼
       ┌──────────┐         ┌──────────┐           ┌──────────┐
       │  OpenAI  │         │ Anthropic│    ...    │   xAI    │
       │  GPT-5.2 │         │  Haiku   │           │  Grok-4  │
       └────┬─────┘         └────┬─────┘           └────┬─────┘
            │                    │                      │
            └────────────────────┴──────────────────────┘
                                 │
                                 ▼
                        ┌────────────────┐
                        │ Gemini 3 Flash │  Structured scoring
                        │   (Extractor)  │
                        └───────┬────────┘
                                │
               ┌────────────────┴────────────────┐
               ▼                                 ▼
       ┌───────────────┐                ┌────────────────┐
       │ Run Storage   │                │ Gemini Cloud   │
       │ (JSON files)  │                │ FileSearch     │
       └───────────────┘                └────────────────┘
               │                                 │
               ▼                                 ▼
         Dashboards                          RAG Chat
```

---

## Environment Variables

| Variable | Description |
|----------|-------------|
| `OPENAI_API_KEY` | OpenAI GPT-5.2 |
| `ANTHROPIC_API_KEY` | Claude Haiku 4.5 |
| `GOOGLE_AI_API_KEY` | Gemini 3 Flash |
| `XAI_API_KEY` | xAI Grok-4 |
| `OPENROUTER_API_KEY` | DeepSeek via OpenRouter |
| `DEEPSEEK_MODEL` | DeepSeek model (default: `deepseek/deepseek-chat`) |
| `CRON_SECRET` | Auth token for scheduled benchmarks |
