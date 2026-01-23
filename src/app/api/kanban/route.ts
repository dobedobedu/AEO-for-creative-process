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

    // If no runId provided, get latest completed run
    if (!runId) {
      const latest = await sql`
        SELECT id::text FROM runs
        WHERE status = 'completed'
        ORDER BY completed_at DESC NULLS LAST, created_at DESC
        LIMIT 1
      `;

      if (latest.length === 0) {
        return NextResponse.json(
          { error: "No completed runs found" },
          { status: 404 }
        );
      }

      runId = latest[0].id;
    }

    // Get entity summary grouped by category
    const byCategory = await getEntitySummaryByCategory(runId!);

    // Get all categories for complete lane structure
    const categories = await sql`
      SELECT id, label, description, display_order
      FROM matrix_entity_categories
      ORDER BY display_order
    `;

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
    `;

    // Build complete lane structure
    const lanes = categories.map((cat: any) => {
      const categoryEntities = byCategory[cat.id] || [];

      // Create a set of entity IDs that have mentions
      const mentionedEntityIds = new Set(
        categoryEntities.map((e: any) => e.entity_term_id)
      );

      // Get all terms for this category
      const categoryTerms = allTerms.filter(
        (t: any) => t.category_id === cat.id
      );

      // Build items array: entities with mentions + entities without
      const items = categoryTerms.map((term: any) => {
        const entityData = categoryEntities.find(
          (e: any) => e.entity_term_id === term.entity_term_id
        );

        if (entityData) {
          return {
            id: entityData.entity_term_id,
            label: entityData.canonical_name,
            status: getStatusFromRate(entityData.mention_rate),
            mentionRate: entityData.mention_rate,
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
    `;

    // Cache for 30s, serve stale for 5min while revalidating
    return NextResponse.json(
      {
        runId,
        run: runMeta[0] || null,
        lanes,
        thresholds: STATUS_THRESHOLDS,
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
