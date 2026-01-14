# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Before Completing Work

Run `npm run build` to verify no TypeScript errors.

## Critical Rules

- No `Math.random()` or `Date.now()` at module level (SSR hydration)
- Always use Gemini 3 series (File Search + Structured Output support)
- Prefer shadcn over custom components
- Don't extract components until proven reuse (2+ places)

## Reference

- `docs/PRD.md` - product requirements, data model, metrics, what's next
- `docs/diagrams.md` - architecture and page structure visuals

Skip `AGENTS.md` - that file is for Codex.
