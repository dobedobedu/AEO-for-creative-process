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

## Current State (v0.3.0)

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
