# Changelog

## Checkpoint 2025-12-23 (Analysis + streaming results + build fixes)
- Added Gemini 3 Pro analysis endpoint and Insights UI.
- Added client-side sequential execution for streaming-like response updates.
- Added insights persistence with upsert.
- Fixed TypeScript build errors for postgres queries and JSON params.

## Checkpoint 2025-12-23 (Provider concurrency lanes)
- Added per-provider concurrency config (1 per provider default).
- Client executor runs one lane per provider in parallel.
- API exposes provider concurrency config for future expansion.

## Checkpoint 2025-12-22 (MVP: Query gen + sequential execution + response visibility)
- Added OpenRouter (DeepSeek) query generation endpoint and UI button.
- Added sequential run executor with progress tracking (completed/total calls).
- Added responses + citations API and UI display.
- Persisted run execution metadata to config_json.
- Forced OpenAI web search tool usage for citations.

## Planned (next checkpoints)
- Add Anthropic and xAI as native-search providers.
- Add OpenRouter “experimental” model lane with external search tool.
- Add insight history endpoints and UI timeline.
- Render charts with Vega-Lite and UI components with shadcn.

