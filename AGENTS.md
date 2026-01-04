# AI Visibility Matrix - Agent Guidelines

## Project Context

- **Stack**: Next.js 16 + React 19 + TypeScript
- **UI**: shadcn/ui components (prefer over custom implementations)
- **Design System**: Warm palette - sage green `#1f3b2c`, cream `#f6f1e8`, terracotta `#b86f3a`
- **Brand**: Lakewood Ranch (Florida master-planned community)

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

### Components
- **Prefer shadcn over custom** - shadcn chart replaced our buggy custom SVG chart
- shadcn handles SSR, accessibility, responsive design correctly

### Scoring System
- Rule-based regex analysis (fast, free, deterministic)
- Known limitation: can't detect negation ("Lakewood Ranch isn't the best" scores positive)
- Future: consider hybrid LLM analysis for ambiguous cases

### API Models (as of Jan 2025)
- OpenAI: `gpt-5.2`
- Anthropic: `claude-haiku-4-5`
- Google: `gemini-3-flash-preview`
- xAI: `grok-4-latest`

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

## Current State (v0.1.0)

**Complete:**
- Visibility Matrix with Persona × Stage grid
- 4 AI provider benchmarking (OpenAI, Anthropic, Gemini, xAI)
- Stage-specific insights (Position, Sentiment, Win Rate, Recommendations)
- Evidence modals for all insight panels
- Time slider with historical view (mock data)
- 150+ real queries from Reddit, Quora, forums

**Next Phase:**
- Chat interface for evidence exploration
- Persistent storage for benchmark history
