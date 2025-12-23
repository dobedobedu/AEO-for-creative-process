# Model Integration and Deep Research Toggle

## Modes

### Standard search mode (default)
- OpenAI: gpt-5.2, gpt-5-mini with web search tool enabled
- Gemini: models/gemini-3-flash-preview with google_search grounding

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
- Deep research mode may include fewer explicit citations; capture any URLs present and keep raw metadata.

## Query generation provider (optional)
- Use OpenRouter for persona -> query generation only (DeepSeek default).
- Keep query generation separate from visibility evaluation to preserve comparability across runs.
- Store the model/provider used for query generation in run config for auditability.
- Default OpenRouter model: deepseek/deepseek-v3.2.
- Query generation output is parsed as JSON with fallback extraction if the model returns plain text.

## Analysis provider
- Use Gemini 3 Pro (models/gemini-3-pro-preview) for insight synthesis.
- Enforce JSON output via response schema for narrative + charts.
