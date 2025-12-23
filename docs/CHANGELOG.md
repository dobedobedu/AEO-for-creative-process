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

## Checkpoint 2025-12-23 (Anthropic + xAI lanes + Claude docs)
- Added Anthropic and xAI as native-search providers.
- Documented Claude search result citation shape and structured-output constraints.

## Checkpoint 2025-12-23 (Citation normalization + analysis schema v2)
- Added normalized citation summary + model breakdown payload for Gemini 3 Pro analysis.
- Expanded analysis schema to include citation_summary and model_breakdown.
- Added unit test for analysis input normalization.

## Checkpoint 2025-12-23 (Insight framework + cards)
- Documented the 10-point insight framework and technical steps.
- Added flexible `insight_cards` to analysis schema and UI.

## Checkpoint 2025-12-23 (Trigger groups + DeepSeek conditioning)
- Added stage-based trigger library and UI selection.
- Passed selected triggers into DeepSeek query generation.
- Stored triggers with runs and inserted into triggers table.

## Checkpoint 2025-12-23 (Geography input for query generation)
- Added geography input (zip/city/county/state) to the UI.
- Stored geo in run config and passed into DeepSeek query generation.

## Checkpoint 2025-12-23 (Memory toggle + query length)
- Added memory toggle (compact/full) to include persona context in model search calls.
- Added query length dial for DeepSeek query generation.

## Checkpoint 2025-12-23 (Run history + analysis selection)
- Added run history API + UI view.
- Added response selection controls for analysis.
- Gemini analysis can now filter by selected response IDs.

## Checkpoint 2025-12-23 (Dual Gemini analysis + thought summaries)
- Added dual analysis passes (consultant + hypothesis) for Gemini 3 Flash and Pro.
- Enabled Gemini thinking config with thought summaries.
- Analysis now returns multiple variants side-by-side in the UI.

## Checkpoint 2025-12-22 (MVP: Query gen + sequential execution + response visibility)
- Added OpenRouter (DeepSeek) query generation endpoint and UI button.
- Added sequential run executor with progress tracking (completed/total calls).
- Added responses + citations API and UI display.
- Persisted run execution metadata to config_json.
- Forced OpenAI web search tool usage for citations.

## Planned (next checkpoints)
- Add OpenRouter “experimental” model lane with external search tool.
- Add insight history endpoints and UI timeline.
- Render charts with Vega-Lite and UI components with shadcn.
