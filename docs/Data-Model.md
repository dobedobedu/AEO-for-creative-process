# Data Model

> **Last Updated**: January 2026

## Storage Architecture

The system uses **hybrid storage**:

| Store | Location | Purpose |
|-------|----------|---------|
| Intent Library | `data/intent-library.json` | Intent definitions, versions |
| Run History | `data/runs/*.json` | Benchmark results, metrics |
| Gemini FileSearchStore | Cloud (Gemini API) | RAG chat, semantic search |
| Response Cache | `data/cache/response-cache.json` | 24h deduplication |

---

## Intent Library Schema

```typescript
interface IntentLibrary {
  version: number;           // Increments on any change
  updatedAt: string;         // ISO datetime
  intents: Intent[];
  history: IntentHistoryEntry[];
}

// Storage format
interface Intent {
  id: string;                // e.g., "int_retiree_explore_abc123"
  persona: Persona;
  stage: Stage;
  text: string;              // The core intent (max 200 chars)
  role: "cpo" | "family_unit";
  queryStyle: number;        // 0.5 (common) to 1.0 (niche)
  createdAt: string;
  active: boolean;
}

// UI runtime type
interface IntentNode {
  id: string;
  text: string;
  role: "cpo" | "family_unit";
  queryStyle: number;
}
```

**Query Generation** (via DeepSeek):
- Intent text + persona + stage + role + queryStyle → 5 search queries
- Queries displayed in UI under "Buyer Might Ask"

---

## Benchmark Run Schema

```typescript
interface BenchmarkRun {
  id: string;                    // e.g., "run_2026-01-06_mk2q3dwy"
  timestamp: string;
  intentLibraryVersion: number;
  metricsConfigVersion: number;
  brand: string;
  summary: RunSummary;
  byPersona?: Record<Persona, DimensionSummary>;
  byStage?: Record<Stage, DimensionSummary>;
  cells: Record<string, CellResult>;  // key: "persona_stage"
}

interface CellResult {
  intentId: string;
  intentText: string;
  queriesUsed: string[];
  metrics: CellMetrics;
  results: QueryResult[];
}

interface CellMetrics {
  discoveryRate?: number;      // Explore
  topThreeRate?: number;       // Explore
  sentimentScore?: number;     // Consider
  winRate?: number;            // Compare
  recommendationRate?: number; // Decide
}
```

---

## Stage Extraction Schemas

Each stage has a specific extraction schema used by Gemini 3 Flash:

### Explore
```typescript
interface ExploreExtraction {
  mentioned: boolean;
  inTopThree: boolean;
  totalOptionsListed: number;
  competitors: string[];
  howDescribed: string;
}
```

### Consider
```typescript
interface ConsiderExtraction {
  mentioned: boolean;
  sentiment: "positive" | "neutral" | "negative";
  sentimentScore: number;  // -1 to 1
  strengthsMentioned: string[];
  concernsRaised: string[];
  overallPortrayal: string;
}
```

### Compare
```typescript
interface CompareExtraction {
  mentioned: boolean;
  outcome: "win" | "tie" | "loss" | "not_compared";
  comparedTo: string[];
  winsOn: string[];
  losesOn: string[];
  aiConclusion: string;
}
```

### Decide
```typescript
interface DecideExtraction {
  mentioned: boolean;
  recommended: boolean;
  recommendationStrength: "not_mentioned" | "mentioned" | "suggested" | "recommended" | "strongly_recommended";
  qualifiers: string[];
  alternativesOffered: string[];
  decisionRationale: string;
}
```

---

## Gemini FileSearchStore

Documents uploaded with metadata for filtering:

| Field | Type | Purpose |
|-------|------|---------|
| `brand` | string | Filter by brand |
| `persona` | string | Filter by persona |
| `stage` | string | Filter by stage |
| `run_id` | string | Link to specific run |
| `run_date` | string | Date filtering |
| `intent_id` | string | Link to intent |

---

## Response Cache

```typescript
interface CachedResponse {
  query: string;
  provider: string;
  model: string;
  text: string;
  citations: string[];
  timestamp: number;
  raw: unknown;
}
```

- **TTL**: 24 hours
- **Key**: SHA256 hash of `provider:model:query`
- **Persistence**: `data/cache/response-cache.json`
