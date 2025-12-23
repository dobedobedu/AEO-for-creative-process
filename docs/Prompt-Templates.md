# Prompt Templates (MVP)

## 1) Persona normalization (optional)
Goal: convert free-text persona into a structured card.

System
- You are a research assistant. Normalize the persona to a structured profile. Keep it concise.

User
```
Persona text:
{{persona_text}}

Return JSON with:
- name
- stage (explore | consider | compare)
- budget_range
- decision_factors (array)
- search_style
- trust_cues (array)
```

## 2) Query generation
Goal: generate 5 queries for a persona and selected triggers.

System
- You generate realistic search-style questions for a persona. Keep each query under 20 words.

User
```
Persona:
{{persona_card_json}}

Stage: {{stage}}
Explore stage: do NOT mention Lakewood Ranch or any specific community/brand. Keep queries generic, need-based, and location-agnostic (e.g., "master-planned community near Sarasota").
Consider stage: Lakewood Ranch may be mentioned, but keep phrasing balanced with needs and constraints.
Compare stage: include Lakewood Ranch explicitly and compare against alternatives or nearby communities.
Selected triggers: {{trigger_list}}
Geography: {{geo}} (zip, city, county, or state)
Brand focus: Lakewood Ranch community + builder reputation

Generate exactly 5 queries.
- Embody the persona's priorities, constraints, and life context.
- Stage intent: Explore = broad discovery; Consider = feasibility/costs/risks; Compare = side-by-side tradeoffs.
- Query length: short (5-9 words), medium (10-16), long (16-26), or auto (persona style).
- Each query should reflect at least one trigger.
- If triggers > 5, prioritize the most impactful triggers.
Return JSON:
{
  "queries": ["...", "...", "...", "...", "..."]
}
```

## 3) Response classification (standard search mode)
Goal: extract visibility and sentiment.

System
- You classify AI answers about Lakewood Ranch. Be strict and concise.

User
```
Query: {{query_text}}
Response: {{response_text}}

Return JSON:
{
  "mentions": {
    "community": true|false,
    "builder": true|false
  },
  "sentiment": "positive" | "neutral" | "negative",
  "intent": "informational" | "commercial" | "transactional" | "navigational",
  "note": "short justification"
}
```

## Memory context (optional)
When memory is enabled, prepend this block to the model search query:
```
User memory (compact):
Persona: {{persona_text}}
Stage: {{stage}}
Geography: {{geo}}
Triggers: {{trigger_list}}

User query: {{query_text}}
```

## 4) Insight synthesis (Gemini 3 Pro)
Goal: generate a consultant-style summary and chart specs.

System
- You are a senior strategy consultant. Write a concise narrative and propose charts.

User
```
Run summary:
{{aggregated_metrics_json}}

Sample responses:
{{sample_responses}}

Citations summary:
{{citations_summary}}

Return JSON:
{
  "narrative": "...",
  "citation_summary": { ... },
  "model_breakdown": [ ... ],
  "insight_cards": [
    {
      "title": "...",
      "type": "authority|pros_cons|alternatives|positioning|recency|source_gaps|message_mismatch|evidence_quality|opportunity_targets|other",
      "evidence": ["..."],
      "recommendations": ["..."],
      "supporting_citations": [{"url": "...", "domain": "..."}]
    }
  ],
  "charts": [
    {
      "title": "...",
      "type": "bar|line|stacked",
      "data": { "labels": [], "series": [] },
      "insight": "..."
    }
  ],
  "blind_spots": ["..."]
}
```

## 5) Hypothesis pass (Gemini 3 Pro / 3 Flash)
Goal: generate falsifiable hypotheses about LLM search/recommendation behavior.

User
```
You analyze LLM search and recommendation behavior across models.
Do NOT mention Lakewood Ranch or any specific brand/community.

Input JSON:
{{aggregated_metrics_json}}

Return JSON matching the analysis schema, but:
- Provide 3-5 hypotheses as insight_cards (type "other")
- Include evidence + how_to_test in recommendations
- Charts can be empty
```

## Thinking + thought summaries (Gemini 3)
Use `thinkingConfig` with `thinkingLevel` and `includeThoughts: true` to receive thought summaries.

## Deep Research mode note
Deep Research responses may not support structured outputs. If parsing fails, store the raw response and run a secondary classification pass using a standard model.
