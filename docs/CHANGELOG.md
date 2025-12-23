# Changelog

## Checkpoint 2025-12-23 (Analysis + streaming results + build fixes)
- Added Gemini 3 Pro analysis endpoint and Insights UI.
- Added client-side sequential execution for streaming-like response updates.
- Added insights persistence with upsert.
- Fixed TypeScript build errors for postgres queries and JSON params.

## Checkpoint 2025-12-22 (MVP: Query gen + sequential execution + response visibility)
- Added OpenRouter (DeepSeek) query generation endpoint and UI button.
- Added sequential run executor with progress tracking (completed/total calls).
- Added responses + citations API and UI display.
- Persisted run execution metadata to config_json.
- Forced OpenAI web search tool usage for citations.

