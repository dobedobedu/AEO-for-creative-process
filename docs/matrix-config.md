# Matrix Configuration Guide

The AI Visibility Matrix now supports dynamic configuration of personas and stages through database-backed configuration. This allows customization of the buyer journey matrix without code changes.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     Database Configuration                       │
│  ┌─────────────────────┐  ┌─────────────────────┐             │
│  │ matrix_personas     │  │ matrix_stages       │             │
│  │ - id (string)       │  │ - id (string)       │             │
│  │ - label (string)    │  │ - label (string)    │             │
│  │ - description       │  │ - description       │             │
│  │ - coreStage (enum)  │  │ - coreStage (enum)  │             │
│  │ - active (boolean)  │  │ - active (boolean)  │             │
│  │ - orderIndex (int)  │  │ - orderIndex (int)  │             │
│  └─────────────────────┘  └─────────────────────┘             │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Runtime Config Layer                          │
│                   src/lib/matrix/runtime.ts                     │
│                                                                 │
│  • getActiveMatrixConfig() - Fetch from DB                     │
│  • getActiveMatrixConfigCached() - 60s TTL cache               │
│  • getActivePersonaIds() - Active persona IDs                  │
│  • getActiveStageIds() - Active stage IDs                      │
│  • getCoreStageMapping(stageId) → coreStage                    │
│  • assertValidPersonaStage(persona, stage)                     │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                        Usage Points                             │
│                                                                 │
│  API Endpoints:                                                 │
│  • /api/matrix/active - Public config endpoint                 │
│  • /api/intents/generate - Validates against config            │
│  • /api/benchmark/run - Validates cells against config         │
│  • /api/benchmark/scheduled/[stage] - Uses active personas     │
│                                                                 │
│  UI:                                                            │
│  • /visibility-matrix - Loads personas/stages from API         │
│                                                                 │
│  Aggregation:                                                   │
│  • run_metrics.stage_id (actual stage)                         │
│  • run_metrics.core_stage (scoring stage)                      │
└─────────────────────────────────────────────────────────────────┘
```

## Core Concepts

### Core Stages vs Custom Stages

The system distinguishes between **core stages** (fixed for scoring logic) and **custom stages** (configurable):

| Core Stage | Purpose | Metrics |
|-----------|---------|---------|
| `explore` | Initial discovery phase | Top-3 positioning, mention rate |
| `consider` | Evaluation phase | Sentiment analysis, strengths/concerns |
| `compare` | Comparison phase | Win/loss ratios, competitive positioning |
| `decide` | Decision phase | Recommendation strength |

**Custom stages** map to a `coreStage` for scoring purposes. This allows flexible stage naming while maintaining consistent metric computation.

Example:
```typescript
// Custom stage "early_research" maps to "explore" for scoring
{
  id: "early_research",
  label: "Early Research",
  coreStage: "explore",
  active: true,
  orderIndex: 0
}
```

### Persona Configuration

Personas represent buyer archetypes in the matrix:

```typescript
// Default personas
{
  id: "move_up",
  label: "Move-Up Buyer",
  description: "Looking for larger home within same community",
  coreStage: null, // Not applicable for personas
  active: true,
  orderIndex: 0
}
```

## Database Schema

### `matrix_personas` Table

```sql
CREATE TABLE matrix_personas (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  description TEXT,
  active BOOLEAN DEFAULT true,
  orderIndex INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### `matrix_stages` Table

```sql
CREATE TABLE matrix_stages (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  description TEXT,
  coreStage TEXT CHECK (coreStage IN ('explore', 'consider', 'compare', 'decide')),
  active BOOLEAN DEFAULT true,
  orderIndex INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

## API Usage

### Get Active Configuration

```typescript
// Fetch active matrix config
const response = await fetch("/api/matrix/active");
const config = await response.json();

// Response format:
{
  personas: [
    { id: "move_up", label: "Move-Up Buyer", ... },
    { id: "retiree", label: "Retiree", ... },
    ...
  ],
  stages: [
    { id: "explore", label: "Explore", coreStage: "explore", ... },
    { id: "consider", label: "Consider", coreStage: "consider", ... },
    ...
  ]
}
```

### Runtime Helper Functions

```typescript
import {
  getActiveMatrixConfigCached,
  getActivePersonaIds,
  getActiveStageIds,
  getCoreStageMapping,
  assertValidPersonaStage
} from "@/lib/matrix/runtime";

// Get cached config (60s TTL)
const config = await getActiveMatrixConfigCached();

// Get active persona IDs
const personaIds = getActivePersonaIds(config);
// Returns: ["move_up", "retiree", "luxury", "first_time"]

// Get active stage IDs
const stageIds = getActiveStageIds(config);
// Returns: ["explore", "consider", "compare", "decide"]

// Map custom stage to core stage
const coreStage = getCoreStageMapping("early_research", config);
// Returns: "explore"

// Validate persona/stage combination
assertValidPersonaStage("move_up", "explore", config);
// Throws if persona or stage is invalid/inactive
```

## Configuration Management

### Adding a New Persona

1. Insert into database:
```sql
INSERT INTO matrix_personas (id, label, description, active, orderIndex)
VALUES (
  'investor',
  'Real Estate Investor',
  'Looking for investment properties with high ROI',
  true,
  4
);
```

2. Create intents for the new persona:
```typescript
await createIntent({
  persona: 'investor',
  stage: 'explore',
  text: 'Find high-growth communities for investment properties',
  role: 'cpo',
  queryStyle: 0.75,
  active: true
});
```

3. Run benchmarks to populate data:
```bash
curl -X POST /api/benchmark/run
```

### Adding a Custom Stage

1. Insert into database with `coreStage` mapping:
```sql
INSERT INTO matrix_stages (id, label, description, coreStage, active, orderIndex)
VALUES (
  'early_research',
  'Early Research',
  'Initial discovery before active searching',
  'explore',  -- Maps to explore for scoring
  true,
  0
);
```

2. Create intents for the new stage:
```typescript
await createIntent({
  persona: 'move_up',
  stage: 'early_research',
  text: 'What are the best communities for families?',
  role: 'cpo',
  queryStyle: 0.75,
  active: true
});
```

### Deactivating a Persona/Stage

Set `active: false` instead of deleting - this preserves historical data:

```sql
UPDATE matrix_personas SET active = false WHERE id = 'investor';
UPDATE matrix_stages SET active = false WHERE id = 'early_research';
```

## Historical Run Compatibility

The system handles personas/stages from historical runs that may no longer be active:

1. **Run Storage**: Runs store the actual persona/stage IDs at benchmark time
2. **Display**: The UI shows labels for inactive personas/stages using the ID as fallback
3. **Aggregation**: Both `stage_id` (actual) and `core_stage` (scoring) are stored

### Viewing Historical Runs

When viewing runs with inactive personas/stages:
- Cells display using the stored persona/stage ID
- Labels fall back to the ID if not found in current config
- All historical data remains accessible

## Aggregation Tables

The `run_metrics` and `run_citations` tables store both the actual stage and its core mapping:

```sql
-- run_metrics table
CREATE TABLE run_metrics (
  run_id UUID,
  persona TEXT,
  stage_id TEXT,       -- Actual stage ID from config
  core_stage TEXT,     -- explore|consider|compare|decide for scoring
  provider TEXT,
  -- ... metrics columns ...
  PRIMARY KEY (run_id, persona, stage_id, provider)
);

-- Example data
{
  run_id: "123e4567-e89b-12d3-a456-426614174000",
  persona: "move_up",
  stage_id: "early_research",   -- Custom stage ID
  core_stage: "explore",        -- Used for metric computation
  provider: "openai",
  top3_rate: 0.75,             -- Computed using explore metrics
  ...
}
```

## Migration Guide

### For Existing Code

If you have code using the old hardcoded enums:

**Before:**
```typescript
import { Persona, Stage, ALL_PERSONAS, ALL_STAGES } from "@/lib/intents/types";

function processCell(persona: Persona, stage: Stage) {
  // ...
}
```

**After:**
```typescript
import { getActiveMatrixConfigCached } from "@/lib/matrix/runtime";

async function processCell(persona: string, stage: string) {
  const config = await getActiveMatrixConfigCached();
  
  // Validate against active config
  assertValidPersonaStage(persona, stage, config);
  
  // Get core stage for scoring
  const coreStage = getCoreStageMapping(stage, config);
  
  // ... rest of logic
}
```

### For Frontend Components

**Before:**
```typescript
import { DEFAULT_PERSONAS, DEFAULT_STAGES } from "./constants";

const [personas] = useState(DEFAULT_PERSONAS);
const [stages] = useState(DEFAULT_STAGES);
```

**After:**
```typescript
const [personas, setPersonas] = useState([]);
const [stages, setStages] = useState([]);

useEffect(() => {
  fetch("/api/matrix/active")
    .then(r => r.json())
    .then(config => {
      setPersonas(config.personas);
      setStages(config.stages);
    });
}, []);
```

## Best Practices

1. **Use Core Stage Mapping**: Always map custom stages to core stages for consistent scoring
2. **Validate at API Boundaries**: Use `assertValidPersonaStage()` before processing
3. **Deactivate, Don't Delete**: Keep historical data intact by using `active: false`
4. **Cache Config**: Use `getActiveMatrixConfigCached()` to reduce DB queries
5. **Handle Fallbacks**: Use label helpers that return the ID as fallback for unknown values

## Troubleshooting

### "Invalid persona/stage" Error

**Cause**: Persona or stage not in active config

**Solution**:
- Check if persona/stage exists in database
- Verify `active = true`
- Check for typos in ID

### "Core stage mapping failed" Error

**Cause**: Stage ID doesn't have a valid `coreStage` value

**Solution**:
```sql
UPDATE matrix_stages 
SET coreStage = 'explore'  -- or appropriate core stage
WHERE id = 'your_stage_id';
```

### Historical Runs Missing Labels

**Expected Behavior**: Personas/stages not in current config show ID as label

**If Needed**: Temporarily reactivate to get labels, or update label helpers to include historical mapping table

## Future Enhancements

Potential improvements to the matrix config system:

1. **Versioning**: Track config versions to correlate with runs
2. **A/B Testing**: Support multiple active configs for experimentation
3. **Per-Run Config**: Store config snapshot with each run
4. **Config History**: Audit log of persona/stage changes
5. **Dynamic Metrics**: Customize metrics per stage via config
