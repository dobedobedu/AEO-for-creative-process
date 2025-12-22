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
Triggers: {{trigger_list}}
Geography: {{geo}}
Brand focus: Lakewood Ranch community + builder reputation

Generate exactly 5 queries. Return JSON:
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

## Deep Research mode note
Deep Research responses may not support structured outputs. If parsing fails, store the raw response and run a secondary classification pass using a standard model.

