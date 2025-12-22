# Data Model (MVP)

## runs
- id (uuid)
- status (draft | queued | running | waiting_analysis | analyzing | complete | failed | canceled)
- config_json (persona, triggers, geo, mode)
- pending_count (int)
- started_at, completed_at

## personas
- id, run_id
- name
- text
- normalized_json

## triggers
- id, run_id
- stage (explore | consider | compare)
- label

## queries
- id, run_id, persona_id
- trigger_stage
- query_text

## responses
- id, run_id, query_id
- provider
- model
- response_text
- raw_tool_json
- created_at

## citations
- id, response_id
- url
- domain
- title
- snippet
- start_idx, end_idx

## insights
- id, run_id
- narrative_text
- charts_json
- created_at

