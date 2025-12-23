# Insight Analysis Framework (Draft)

This document describes 10 analysis lenses for Lakewood Ranch AI visibility and how to implement them technically. The goal is to produce a marketing diagnosis with AEO + SEO context, grounded in citations, across discovery and comparison stages.

## 1) Source Authority Share
**Goal:** Identify where authority comes from (Owned, Earned, Media, UGC, Partner, MLS/Listing).
**How:**
- Build a domain classifier (rules + optional LLM tagging).
- Aggregate citation counts by authority class.
- Output: authority share chart + top domains per class.

**Inputs:** citations (domain, url), optional domain taxonomy table.
**Output:** `insight_cards[type=authority]`, chart `authority_share`.

## 2) Topical Authority Map
**Goal:** See which topics dominate citations and whether they align to brand value.
**How:**
- Topic label each citation or response paragraph via Gemini 3 Pro.
- Aggregate by topic per stage and per provider.
- Output: topic share of voice + gaps.

**Inputs:** response text, citations, query triggers.
**Output:** `insight_cards[type=positioning]`, chart `topic_share`.

## 3) Pros / Cons Extraction
**Goal:** Understand what LLMs present as positives vs negatives.
**How:**
- Extract pro/con claims from responses, tag with source URL if cited.
- Aggregate by topic and by provider.
- Output: pro/con table and top evidence sources.

**Inputs:** response text, citation spans.
**Output:** `insight_cards[type=pros_cons]`, chart `pros_cons_split`.

## 4) Alternatives & Comparisons
**Goal:** Identify the alternative communities/brands that appear in comparison.
**How:**
- Extract proper nouns/entities from comparison stage answers.
- Count frequency by provider.
- Output: alternatives list + overlap with Lakewood Ranch positioning.

**Inputs:** responses, queries labeled as compare.
**Output:** `insight_cards[type=alternatives]`, chart `top_alternatives`.

## 5) Recency & Content Half-Life
**Goal:** Determine if LLMs rely on stale vs recent sources.
**How:**
- Fetch top cited URLs via Gemini URL Context (or later Exa).
- Extract publish/update dates and bucket by year/quarter.
- Output: timeline chart + staleness risks.

**Inputs:** citation URLs, URL Context metadata.
**Output:** `insight_cards[type=recency]`, chart `citation_timeline`.

## 6) Stage Alignment (Discover vs Compare)
**Goal:** Ensure cited sources match user intent by stage.
**How:**
- Tag each query with stage.
- Compare topics and sources across stages.
- Output: misalignment warnings and missing content types.

**Inputs:** trigger stage, topic labels, authority classes.
**Output:** `insight_cards[type=source_gaps]`.

## 7) Message Consistency vs Brand Positioning
**Goal:** Identify discrepancies between official positioning and LLM summaries.
**How:**
- Provide a short brand positioning prompt to Gemini 3 Pro.
- Compare LLM response claims to the official positioning.
- Output: mismatches + clarification opportunities.

**Inputs:** brand positioning snippet, responses.
**Output:** `insight_cards[type=message_mismatch]`.

## 8) Evidence Quality & Citation Density
**Goal:** Measure confidence and rigor in LLM answers.
**How:**
- Compute citations per 1k characters.
- Flag answers with low citation density.
- Output: evidence quality score by provider/model.

**Inputs:** response_text length, citation counts.
**Output:** `insight_cards[type=evidence_quality]`, chart `citation_density`.

## 9) Opportunity Targets (Partnerships)
**Goal:** Identify publishers/domains to collaborate with.
**How:**
- Use high-frequency, high-authority domains.
- Filter to non-owned sources.
- Output: prioritized partnership shortlist.

**Inputs:** authority class, domain counts.
**Output:** `insight_cards[type=opportunity_targets]`.

## 10) Blind Spots & Unknown Unknowns
**Goal:** Surface missing topics or unaddressed concerns.
**How:**
- Ask Gemini 3 Pro to infer missing themes based on query intents.
- Output: blind_spots list.

**Inputs:** trigger list, query set, response summaries.
**Output:** `blind_spots`.

## Implementation Path
1. Keep analysis schema flexible: `insight_cards[]`.
2. Run 2–3 real datasets.
3. Promote recurring insight types to dedicated fields.
4. Add URL Context enrichment pass for recency and source profiling.
