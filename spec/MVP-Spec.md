# MVP Spec

## Functional requirements
- Single persona input (free text + optional structured normalization).
- Trigger selection by buying stage (Explore / Consider / Compare).
- Generate 5 queries per run; allow user edits.
- Execute 4 model calls per query in standard mode.
- Deep Research toggle routes all queries to deep research models.
- Persist raw responses + tool metadata.
- Extract citations into a normalized table.
- Generate insights using Gemini 3 Pro (narrative + charts).
- React Flow UI displays the pipeline with node status.
- OpenRouter model selector for query generation (default deepseek/deepseek-v3.2).

## Non-functional requirements
- Vercel deployable
- Async queue fallback if batch not available
- Observability: run_id, cost estimate, latency, status

## Test plan (MVP)
### Unit
- Persona normalization returns required fields.
- Trigger -> query generation returns 5 queries.
- Citation parser extracts url/domain/title/snippet.

### Integration
- OpenAI standard mode returns tool metadata when web search is enabled.
- Gemini standard mode returns grounding_metadata.
- Deep Research mode returns plain-text response and metadata.

### End-to-end
- 1 persona -> 5 queries -> 20 responses recorded.
- pending_count hits 0 -> analysis job runs.
- Insight summary and charts saved and visible.

## Acceptance criteria
- Run completes without manual intervention.
- Insight node displays narrative + 3+ charts.
- User can view raw responses + citations per query.
