# MVP Spec

> ⚠️ **SUPERSEDED** - This document reflects the original MVP scope from Dec 2025.
> See **[docs/PRD.md](../docs/PRD.md)** for current architecture.

---

## Original MVP (Archived)

The original MVP targeted:
- Single persona input (free text)
- 3 stages (Explore / Consider / Compare)
- 5 queries per run via DeepSeek generation
- 4 model calls per query
- OpenAI + Gemini only

## Current State (Jan 2026)

The product has evolved to:
- 4 fixed personas × 4 stages (16-cell matrix)
- Intent Library with versioned queries
- 4 AI providers (OpenAI, Anthropic, Gemini, xAI)
- Stage-aware LLM scoring (Gemini 3 Flash)
- Hybrid storage (file + FileSearchStore)
- RAG-based chat for insights

See [docs/PRD.md](../docs/PRD.md) for full specification.
