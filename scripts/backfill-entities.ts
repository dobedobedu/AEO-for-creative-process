/**
 * Backfill Entity Mentions from Historical Runs
 *
 * Run with: npx tsx scripts/backfill-entities.ts
 *
 * Options:
 *   --force              Force re-extraction even if mentions already exist (deletes existing data first)
 *   --run-id=<uuid>      Process only the specified run ID
 *   --summary-only       Only recompute summaries (skip mention extraction)
 *
 * Examples:
 *   npx tsx scripts/backfill-entities.ts                                    # Process all runs without existing mentions
 *   npx tsx scripts/backfill-entities.ts --force --run-id=20260126-...      # Force re-extract specific run
 *   npx tsx scripts/backfill-entities.ts --summary-only --run-id=20260126-... # Recompute summary for specific run
 *
 * This script processes historical benchmark runs to extract entity mentions
 * from LLM responses and populate the run_entity_mentions and run_entity_summary tables.
 *
 * It uses Gemini 3 Flash (same model used for regular scoring) to extract
 * entities from stored response text.
 */

import { sql } from "../src/lib/db";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateObject } from "ai";
import { z } from "zod";

// Create Google AI client using GEMINI_API_KEY env var
const google = createGoogleGenerativeAI({
  apiKey: process.env.GEMINI_API_KEY,
});
import {
  loadEntityRegistry,
  matchEntitiesToRegistry,
  type EntityTerm,
  type MatchedEntity,
} from "../src/lib/scoring/entityMatcher";
import { EntityCategorySchema, EntityMentionSchema } from "../src/lib/scoring/schemas";

// Schema for entity extraction from response text
const EntityExtractionSchema = z.object({
  entities: z.array(EntityMentionSchema).describe("Features, amenities, villages, builders, and differentiators mentioned"),
});

interface ResponseData {
  model: string;
  responseText?: string;
  score?: Record<string, unknown>;
}

interface CellData {
  results?: Array<{
    query: string;
    responses?: Record<string, ResponseData>;
  }>;
}

interface HistoricalRun {
  id: string;
  result_json: {
    cells?: Record<string, CellData>; // keyed by "persona_stage" e.g. "luxury_decide"
  };
}

const EXTRACTION_PROMPT = `You are analyzing an AI response about real estate communities in Florida.

Extract any Lakewood Ranch features, amenities, and differentiators mentioned in the response.

Categories:
- amenities: golf, polo, tennis, pickleball, shopping, restaurants, health care, UTC, pools, fitness
- activities: farmers market, Music on Main, arts, clubs, community foundation, events
- schools: specific school names, school districts, school ratings
- nature: parks (by name), trails, green space, preserves
- villages: specific village names (Waterside, Cresswind, Del Webb, etc.)
- builders: home builder companies (Taylor Morrison, Pulte, Lennar, etc.)
- location: I-75 access, beach proximity, Tampa Bay, Sarasota, airport
- accolades: awards, rankings, multi-generational community
- other: anything else notable

For each entity, note:
- name: The specific feature mentioned
- category: Which category it belongs to
- sentiment: How it was portrayed (positive/neutral/negative)
- contextSnippet: The sentence where it was mentioned

Response text to analyze:
`;

async function extractEntitiesFromText(
  text: string
): Promise<z.infer<typeof EntityMentionSchema>[]> {
  try {
    const result = await generateObject({
      model: google("gemini-3-flash-preview"),
      schema: EntityExtractionSchema,
      prompt: EXTRACTION_PROMPT + text,
    });
    return result.object.entities;
  } catch (error) {
    console.warn("Entity extraction failed:", error);
    return [];
  }
}

async function backfillRun(
  run: HistoricalRun,
  registry: EntityTerm[]
): Promise<{ mentions: number; errors: number }> {
  let mentions = 0;
  let errors = 0;

  const cells = run.result_json?.cells || {};

  // cells is an object keyed by "persona_stage" e.g. "luxury_decide"
  for (const [cellKey, cellData] of Object.entries(cells)) {
    // Parse persona and stage from key (e.g., "luxury_decide" -> persona="luxury", stage="decide")
    const parts = cellKey.split("_");
    const stage = parts.pop() || cellKey;
    const persona = parts.join("_") || "unknown";

    for (const result of cellData.results || []) {
      // responses is an object keyed by provider (e.g., "openai", "anthropic")
      const responses = result.responses || {};

      for (const [provider, resp] of Object.entries(responses)) {
        try {
          // Get text from responseText field
          const text = resp.responseText;

          // Skip if response text is too short or missing
          if (!text || text.length < 50) continue;

          // Extract entities from response text
          const extracted = await extractEntitiesFromText(text);

          if (extracted.length === 0) continue;

          // Match to registry
          const matched = matchEntitiesToRegistry(extracted, registry);

          // Insert mentions
          for (const entity of matched) {
            if (!entity.entityTermId) continue; // Skip unmatched

            await sql`
              INSERT INTO run_entity_mentions (
                run_id, persona, stage_id, provider,
                entity_term_id, raw_mention, sentiment, context_snippet
              ) VALUES (
                ${run.id}::uuid,
                ${persona},
                ${stage},
                ${provider},
                ${entity.entityTermId}::uuid,
                ${entity.rawMention},
                ${entity.sentiment},
                ${entity.contextSnippet}
              )
              ON CONFLICT DO NOTHING
            `;
            mentions++;
          }

          // Rate limit to avoid hitting API limits
          await new Promise((resolve) => setTimeout(resolve, 200));
        } catch (err) {
          console.error(`Error processing response for ${cellKey}/${provider}:`, err);
          errors++;
        }
      }
    }
  }

  return { mentions, errors };
}

async function computeSummary(runId: string): Promise<void> {
  // Get total responses for this run from run_metrics (more accurate)
  const totalResp = await sql`
    SELECT COALESCE(SUM(responses_count), 0)::int as total
    FROM run_metrics
    WHERE run_id = ${runId}::uuid
  `;
  const totalResponses = totalResp[0]?.total || 0;

  if (totalResponses === 0) {
    console.log(`  No mentions to aggregate for run ${runId}`);
    return;
  }

  // Aggregate mentions by entity using LATERAL JOIN to avoid nested aggregate
  const aggregated = await sql`
    SELECT
      m.entity_term_id,
      t.category_id,
      COUNT(*) as mention_count,
      AVG(CASE
        WHEN m.sentiment = 'positive' THEN 1
        WHEN m.sentiment = 'negative' THEN -1
        ELSE 0
      END) as avg_sentiment,
      jsonb_object_agg(
        prov.provider,
        prov.provider_count
      ) as by_provider
    FROM run_entity_mentions m
    JOIN matrix_entity_terms t ON m.entity_term_id = t.id
    JOIN LATERAL (
      SELECT provider, COUNT(*) as provider_count
      FROM run_entity_mentions
      WHERE run_id = m.run_id AND entity_term_id = m.entity_term_id
      GROUP BY provider
    ) prov ON true
    WHERE m.run_id = ${runId}::uuid
      AND m.entity_term_id IS NOT NULL
    GROUP BY m.entity_term_id, t.category_id
  `;

  // Insert/update summary rows
  for (const row of aggregated) {
    const mentionRate = row.mention_count / totalResponses;

    await sql`
      INSERT INTO run_entity_summary (
        run_id, entity_term_id, category_id,
        total_responses, mention_count, mention_rate,
        avg_sentiment, by_provider
      )
      VALUES (
        ${runId}::uuid,
        ${row.entity_term_id}::uuid,
        ${row.category_id},
        ${totalResponses},
        ${row.mention_count},
        ${mentionRate},
        ${row.avg_sentiment},
        ${sql.json(row.by_provider || {})}
      )
      ON CONFLICT (run_id, entity_term_id) DO UPDATE SET
        total_responses = EXCLUDED.total_responses,
        mention_count = EXCLUDED.mention_count,
        mention_rate = EXCLUDED.mention_rate,
        avg_sentiment = EXCLUDED.avg_sentiment,
        by_provider = EXCLUDED.by_provider,
        updated_at = NOW()
    `;
  }
}

async function main() {
  // Parse CLI arguments
  const args = process.argv.slice(2);
  const forceReprocess = args.includes("--force");
  const summaryOnly = args.includes("--summary-only");
  const targetRunId = args.find((a) => a.startsWith("--run-id="))?.split("=")[1];

  console.log("Starting entity backfill...\n");
  if (forceReprocess) console.log("  Mode: FORCE (will delete existing data)\n");
  if (summaryOnly) console.log("  Mode: SUMMARY-ONLY (skip mention extraction)\n");
  if (targetRunId) console.log(`  Target run: ${targetRunId}\n`);

  // Load entity registry
  const registry = await loadEntityRegistry(sql);
  console.log(`Loaded ${registry.length} entity terms from registry\n`);

  // Build query for runs
  let runs;
  if (targetRunId) {
    runs = await sql`
      SELECT id::text, result_json
      FROM runs
      WHERE id = ${targetRunId}::uuid
        AND status = 'completed'
        AND result_json IS NOT NULL
        AND result_json->'cells' IS NOT NULL
    `;
    if (runs.length === 0) {
      console.error(`Run ${targetRunId} not found or not completed`);
      process.exit(1);
    }
  } else {
    runs = await sql`
      SELECT id::text, result_json
      FROM runs
      WHERE status = 'completed'
        AND result_json IS NOT NULL
        AND result_json->'cells' IS NOT NULL
      ORDER BY created_at DESC
    `;
  }

  console.log(`Found ${runs.length} completed runs to process\n`);

  let totalMentions = 0;
  let totalErrors = 0;

  for (let i = 0; i < runs.length; i++) {
    const run = runs[i] as unknown as HistoricalRun;
    console.log(`Processing run ${i + 1}/${runs.length}: ${run.id}`);

    // Check if already processed
    const existing = await sql`
      SELECT COUNT(*)::int as count FROM run_entity_mentions
      WHERE run_id = ${run.id}::uuid
    `;

    if (existing[0]?.count > 0 && !forceReprocess && !summaryOnly) {
      console.log(`  Already processed (${existing[0].count} mentions), skipping...`);
      continue;
    }

    // Handle --force: delete existing data before re-extraction
    if (forceReprocess && existing[0]?.count > 0) {
      console.log(`  Deleting ${existing[0].count} existing mentions...`);
      await sql`DELETE FROM run_entity_mentions WHERE run_id = ${run.id}::uuid`;
      await sql`DELETE FROM run_entity_summary WHERE run_id = ${run.id}::uuid`;
    }

    // Handle --summary-only: skip mention extraction, just recompute summary
    if (summaryOnly) {
      if (existing[0]?.count > 0) {
        console.log(`  Recomputing summary from ${existing[0].count} existing mentions...`);
        await sql`DELETE FROM run_entity_summary WHERE run_id = ${run.id}::uuid`;
        await computeSummary(run.id);
        console.log(`  Summary recomputed`);
      } else {
        console.log(`  No mentions to summarize, skipping...`);
      }
      continue;
    }

    const { mentions, errors } = await backfillRun(run, registry);
    totalMentions += mentions;
    totalErrors += errors;

    if (mentions > 0) {
      console.log(`  Extracted ${mentions} mentions`);
      await computeSummary(run.id);
      console.log(`  Computed summary`);
    } else {
      console.log(`  No entities found`);
    }
  }

  console.log("\n========================================");
  console.log(`Total mentions extracted: ${totalMentions}`);
  console.log(`Total errors: ${totalErrors}`);
  console.log("========================================\n");

  process.exit(0);
}

main().catch((err) => {
  console.error("Backfill failed:", err);
  process.exit(1);
});
