# Intent Library

> **Last Updated**: January 2026
> 
> Replaces the former "Trigger Library" concept.

## Overview

The Intent Library defines **what buyers want** at each stage of their journey. Each intent maps to a persona × stage cell in the 4×4 matrix.

---

## Structure

```
Intent Library
├── 4 Personas: move_up, retiree, luxury, first_time
├── 4 Stages: explore, consider, compare, decide
└── 16 Cells (one intent per cell, extensible to multiple)
```

Each intent contains:
- **Text**: The core buyer intent (e.g., "Find active adult communities in Florida")
- **Role**: CPO (analytical) or Family Unit (lifestyle) perspective
- **Query Style**: Temperature dial (0.5=Common, 1.0=Niche)

---

## Personas

| Persona | Profile | Key Concerns |
|---------|---------|--------------|
| `move_up` | Growing family upgrading | Schools, space, resale value |
| `retiree` | 55+ active adult | Amenities, healthcare, community |
| `luxury` | High-net-worth buyer | Premium features, exclusivity |
| `first_time` | Entering market | Affordability, builder reputation |

---

## Stages

### Explore (Awareness)
Life events trigger home search. Buyer is discovering options.

**Triggers:**
- Relocation for new job
- Growing family
- Retirement / downsizing
- Remote work relocation
- Empty nest
- First-time buyer readiness
- Investment interest

**Key Metric**: Discovery Rate (Is brand mentioned?)

### Consider (Evaluation)
Buyer is building a shortlist and evaluating specific communities.

**Evaluation Criteria:**
- Builder reputation & quality
- Amenities & lifestyle fit
- Schools & district reputation
- Safety / crime rate
- HOA fees / community rules
- Commute & services access
- Property taxes / insurance
- Resale value potential

**Key Metric**: Sentiment Score (-1 to +1)

### Compare (Alternatives)
Buyer is weighing alternatives against each other.

**Comparison Types:**
- Lakewood Ranch vs competitor community
- Lakewood Ranch vs Sarasota/Bradenton
- Builder A vs Builder B
- New build vs resale
- Price per sq ft comparisons
- Amenities comparison

**Key Metric**: Win Rate (Brand wins comparison?)

### Decide (Commitment)
Buyer is ready to commit, handoff to real estate agent.

**Decision Factors:**
- Final recommendation from AI
- Qualifier acknowledgment
- Alternative suggestions
- Confidence level

**Key Metric**: Recommendation Rate

---

## Query Generation Flow

```
Intent Text + Persona + Stage + Role + Query Style
                    │
                    ▼
              ┌──────────┐
              │ DeepSeek │  Infers persona-appropriate queries
              └──────────┘
                    │
                    ▼
         "Buyer Might Ask" (5 queries)
                    │
                    ▼
         4 AI Providers (web search)
```

### Query Style Slider

| Value | Label | DeepSeek Temperature | Result |
|-------|-------|---------------------|--------|
| 0.5 | Common | Low | High-volume, predictable queries |
| 0.75 | Balanced | Medium | Mix of common and specific |
| 1.0 | Niche | High | Long-tail, specific lifestyle queries |

### Role Toggle

**CPO (Chief Purchasing Officer)**:
Analytical lens - focuses on finances, risks, ROI, total cost of ownership.

**Family Unit**:
Lifestyle lens - focuses on daily life, community, social connections.

---

## Versioning

- `version`: Integer, increments on any change
- `history`: Array of changes with timestamps
- Changes tracked: created, modified, deactivated, reactivated

---

## File Location

```
data/intent-library.json
```
