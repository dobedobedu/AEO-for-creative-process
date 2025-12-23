# Data Model (MVP)

## runs
- id (uuid)
- status (draft | queued | running | waiting_analysis | analyzing | complete | failed | canceled)
- config_json (persona, triggers, geo, mode, execution config)
- pending_count (int)
- created_at, started_at, completed_at

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
- provider_response_id
- response_text
- output_json
- annotations_json
- grounding_metadata_json
- created_at

## web_search_calls
- id, response_id
- action, query, domains
- status
- raw_call_json
- created_at

## citations
- id, response_id
- provider
- url
- domain
- title
- snippet
- start_idx, end_idx
- source_type
- query
- raw_json

## insights
- id, run_id
- narrative_text
- charts_json
- created_at
