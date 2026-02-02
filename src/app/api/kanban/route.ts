/**
 * Kanban API
 *
 * GET /api/kanban?runId=xxx
 * Returns entity mention data grouped by category for Kanban display.
 */

import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getEntitySummaryByCategory } from "@/lib/runs/aggregator";

// UUID validation regex
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Status thresholds (matching Kanban UI)
const STATUS_THRESHOLDS = {
  preferred: 0.8,    // >= 80%
  recommended: 0.6,  // >= 60%
  mentioned: 0.4,    // >= 40%
  blind_spot: 0,     // < 40%
};

function getStatusFromRate(rate: number): string {
  if (rate >= STATUS_THRESHOLDS.preferred) return "preferred";
  if (rate >= STATUS_THRESHOLDS.recommended) return "recommended";
  if (rate >= STATUS_THRESHOLDS.mentioned) return "mentioned";
  return "blind_spot";
}

export async function GET(request: Request): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    let runId = searchParams.get("runId");

    // Validate runId format if provided
    if (runId && !UUID_REGEX.test(runId)) {
      return NextResponse.json(
        { error: "Invalid run ID format" },
        { status: 400 }
      );
    }

    // If no runId provided, prefer latest run that has Kanban data (partial OK),
    // then fall back to latest run with cells, then latest completed run.
    if (!runId) {
      const latestWithSummary = await sql`
        SELECT r.id::text FROM runs r
        WHERE EXISTS (
          SELECT 1 FROM run_entity_summary s WHERE s.run_id = r.id
        )
        ORDER BY COALESCE(r.completed_at, r.created_at) DESC
        LIMIT 1
      ` as Array<{ id: string }>;

      if (latestWithSummary.length > 0) {
        runId = latestWithSummary[0].id;
      } else {
        const latestWithCells = await sql`
          SELECT id::text FROM runs
          WHERE result_json IS NOT NULL
            AND jsonb_typeof(result_json->'cells') = 'object'
            AND jsonb_object_length(result_json->'cells') > 0
          ORDER BY created_at DESC
          LIMIT 1
        ` as Array<{ id: string }>;

        if (latestWithCells.length > 0) {
          runId = latestWithCells[0].id;
        } else {
          const latest = await sql`
            SELECT id::text FROM runs
            WHERE status = 'completed'
            ORDER BY completed_at DESC NULLS LAST, created_at DESC
            LIMIT 1
          ` as Array<{ id: string }>;

          if (latest.length === 0) {
            return NextResponse.json(
              { error: "No completed runs found" },
              { status: 404 }
            );
          }

          runId = latest[0].id;
        }
      }
    }

    // Get entity summary grouped by category
    const byCategory = await getEntitySummaryByCategory(runId!);

    // Get all categories for complete lane structure
    const categories = await sql`
      SELECT id, label, description, display_order
      FROM matrix_entity_categories
      ORDER BY display_order
    ` as Array<{ id: string; label: string; description: string | null; display_order: number }>;

    // Get all entity terms for items without mentions
    const allTerms = await sql`
      SELECT
        t.id::text as entity_term_id,
        t.canonical_name,
        t.category_id,
        c.label as category_label
      FROM matrix_entity_terms t
      JOIN matrix_entity_categories c ON t.category_id = c.id
      WHERE t.active = true
      ORDER BY c.display_order, t.display_order
    ` as Array<{ entity_term_id: string; canonical_name: string; category_id: string; category_label: string }>;

    // Build complete lane structure
    const lanes = categories.map((cat) => {
      const categoryEntities = byCategory[cat.id] || [];

      // Create a set of entity IDs that have mentions
      const mentionedEntityIds = new Set(
        categoryEntities.map((e: any) => e.entity_term_id)
      );

      // Get all terms for this category
      const categoryTerms = allTerms.filter((t) => t.category_id === cat.id);

      // Build items array: entities with mentions + entities without
      const items = categoryTerms.map((term) => {
        const entityData = categoryEntities.find(
          (e: { entity_term_id: string }) => e.entity_term_id === term.entity_term_id
        );

        if (entityData) {
          // Cap rate at 1.0 (100%) - an entity can be mentioned multiple times per response
          const cappedRate = Math.min(entityData.mention_rate, 1.0);
          return {
            id: entityData.entity_term_id,
            label: entityData.canonical_name,
            status: getStatusFromRate(cappedRate),
            mentionRate: cappedRate,
            mentionCount: entityData.mention_count,
            totalResponses: entityData.total_responses,
            avgSentiment: entityData.avg_sentiment,
            byProvider: entityData.by_provider || {},
          };
        } else {
          // No mentions for this entity
          return {
            id: term.entity_term_id,
            label: term.canonical_name,
            status: "blind_spot",
            mentionRate: 0,
            mentionCount: 0,
            totalResponses: 0,
            avgSentiment: null,
            byProvider: {},
          };
        }
      });

      // Sort by mention rate descending
      items.sort((a: any, b: any) => b.mentionRate - a.mentionRate);

      return {
        id: cat.id,
        label: cat.label,
        description: cat.description,
        items,
      };
    });

    // Get run metadata
    const runMeta = await sql`
      SELECT
        id::text,
        status,
        completed_at,
        created_at,
        (result_json->>'brand') as brand,
        (result_json->>'timestamp') as timestamp
      FROM runs
      WHERE id = ${runId}::uuid
    ` as Array<{
      id: string;
      status: string;
      completed_at: Date | string | null;
      created_at: Date | string | null;
      brand: string | null;
      timestamp: string | null;
    }>;

    // Get last 30 days of completed runs for mentionsHistory
    const recentRuns = await sql`
      SELECT
        r.id::text as run_id,
        r.completed_at,
        r.created_at,
        COALESCE((SELECT SUM(mention_count)::int FROM run_entity_summary WHERE run_id = r.id), 0) as mention_count
      FROM runs r
      WHERE r.status = 'completed'
        AND r.completed_at IS NOT NULL
        AND r.completed_at > NOW() - INTERVAL '30 days'
      ORDER BY r.completed_at DESC
      LIMIT 30
    ` as Array<{
      run_id: string;
      completed_at: Date | string;
      created_at: Date | string | null;
      mention_count: number | string;
    }>;

    // Build mentionsHistory with one entry per day (last 30 days)
    const mentionsHistory: { date: string; mentions: number; runId?: string }[] = [];
    const now = new Date();
    const runsByDate = new Map<string, { runId: string; mentions: number }>();

    // Map runs by date (use latest run per day)
    for (const run of recentRuns) {
      const completedAt = run.completed_at instanceof Date
        ? run.completed_at.toISOString()
        : String(run.completed_at);
      const date = completedAt.split("T")[0];
      if (!runsByDate.has(date)) {
        runsByDate.set(date, {
          runId: run.run_id,
          mentions: Number(run.mention_count ?? 0),
        });
      }
    }

    // Build 30-day array
    for (let i = 29; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split("T")[0];
      const runData = runsByDate.get(dateStr);

      mentionsHistory.push({
        date: dateStr,
        mentions: runData?.mentions || 0,
        runId: runData?.runId,
      });
    }

    // Cache for 30s, serve stale for 5min while revalidating
    return NextResponse.json(
      {
        runId,
        run: runMeta[0] || null,
        lanes,
        thresholds: STATUS_THRESHOLDS,
        mentionsHistory,
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=30, stale-while-revalidate=300",
        },
      }
    );
  } catch (error) {
    console.error("[api/kanban] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch kanban data" },
      { status: 500 }
    );
  }
}
