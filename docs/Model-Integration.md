# Model Integration and Deep Research Toggle

## Modes

### Standard search mode (default)
- OpenAI: gpt-5.2, gpt-5-mini with web search tool enabled
- Gemini: models/gemini-3-flash-preview with google_search grounding
- Anthropic: Claude Haiku 4.5 with web search tool enabled
- xAI: grok-4-latest with native live search via `search_parameters`

### Deep Research mode (toggle ON)
- OpenAI: o3-deep-research, o4-mini-deep-research
- Gemini: Deep Research Agent (Interactions API)

When Deep Research is enabled, all queries are routed to the deep research pathway instead of standard search-grounded calls.

## Deep Research differences
- OpenAI deep research models do not support function calling or structured outputs. Plan for plain-text response parsing only.
- Gemini deep research uses the Interactions API and requires background execution.
- Gemini deep research requires `background=true` and `store=true` for agent execution.
- Gemini deep research does not accept custom tools (no custom function calling or remote MCP).
- Gemini deep research does not support structured outputs.

## Batch vs async
- Attempt batch first if the provider supports batching for the chosen mode.
- If batch is unsupported for search-grounded or deep research calls, fall back to queue workers.

## Normalized response schema
Always store:
- provider, model, run_id, query_id
- response_text
- raw_tool_json (web search grounding, citations, or research metadata)

## Citation extraction
- OpenAI web search tool outputs: capture sources and map to citation table.
- Gemini google_search: use grounding_metadata to map URL, title, and text span.
- Anthropic search results: citations appear on text blocks as `search_result_location` with `source`, `title`, and `cited_text`. Store the URL + title and keep raw citation metadata.
- xAI live search: citations return as a list of URLs (last chunk when streaming). Store URL list and preserve raw response metadata.
- Deep research mode may include fewer explicit citations; capture any URLs present and keep raw metadata.

## Anthropic structured outputs (beta)
- JSON outputs are enabled via `output_format` with a JSON schema and the `structured-outputs-2025-11-13` beta header.
- Structured outputs are incompatible with citations, so do not enable `output_format` when using web search/citations. Use plain text and parse citations instead.

## xAI live search parameters
- Live Search runs on the chat completions endpoint via `search_parameters`; `mode` can be `off`, `auto` (default), or `on`. To enable defaults, send an empty object. 
- Citations return as a list of URLs (only in the final streaming chunk); controlled by `return_citations` (defaults true).
- Pricing is per source used; log `response.usage.num_sources_used` to estimate cost.
- Optional filters: `from_date`, `to_date` (ISO date), `max_search_results` (default 20), and `sources` list.
- Default sources are `web`, `news`, and `x` if `sources` is omitted; `rss` is also supported.
- Source parameters:
  - `web`: `country` (ISO alpha-2), `allowed_websites` or `excluded_websites` (max 5), `safe_search`
  - `news`: `country`, `excluded_websites` (max 5), `safe_search`
  - `x`: `included_x_handles` or `excluded_x_handles` (max 10), `post_favorite_count`, `post_view_count` (grok handle is excluded by default)
  - `rss`: `links`
- Usage: number of sources used is reported on `response.usage.num_sources_used` (used for pricing).
- Live Search API is slated for deprecation by Jan 12, 2026 in favor of the agentic tool calling API.

## Query generation provider (optional)
- Use OpenRouter for persona -> query generation only (DeepSeek default).
- Keep query generation separate from visibility evaluation to preserve comparability across runs.
- Store the model/provider used for query generation in run config for auditability.
- Default OpenRouter model: deepseek/deepseek-v3.2.
- Query generation output is parsed as JSON with fallback extraction if the model returns plain text.

## Analysis provider
- Use Gemini 3 Pro (models/gemini-3-pro-preview) for insight synthesis.
- Enforce JSON output via response schema for narrative + charts.

## Thinking config (Gemini 3)
- Use `generationConfig.thinkingConfig` with `thinkingLevel` and `includeThoughts: true` to receive thought summaries.
- Flash supports `medium` thinking; Pro supports `low`/`high`.
