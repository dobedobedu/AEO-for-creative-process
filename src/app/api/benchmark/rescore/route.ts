/**
 * Re-score benchmark runs API endpoint
 *
 * POST /api/benchmark/rescore
 * Body: { runIds: string[], brand?: string, brandAliases?: string[] }
 * Returns: { rescored: number, backed_up: string[], errors: string[] }
 */

import { z } from "zod";
import { loadRun, saveRun } from "@/lib/runs/storage";
import { backupRun } from "@/lib/runs/backup";
import { rescoreRun } from "@/lib/runs/rescore";
import { saveRunAggregates } from "@/lib/runs/aggregator";
import { getBrandName, getBrandAliases } from "@/lib/config";

const RequestSchema = z.object({
  runIds: z.array(z.string().uuid()).min(1).max(10),
  brand: z.string().optional(),
  brandAliases: z.array(z.string()).optional(),
});

export async function POST(req: Request) {
  try {
    const payload = await req.json();
    const data = RequestSchema.parse(payload);

    const brand = data.brand ?? getBrandName();
    const brandAliases = data.brandAliases ?? getBrandAliases();

    const results = {
      rescored: 0,
      backed_up: [] as string[],
      errors: [] as string[],
      details: [] as Array<{
        runId: string;
        success: boolean;
        stats?: {
          totalResponses: number;
          successfulExtractions: number;
          failedExtractions: number;
        };
        error?: string;
      }>,
    };

    for (const runId of data.runIds) {
      try {
        // Load the run
        const run = await loadRun(runId);
        if (!run) {
          results.errors.push(`Run not found: ${runId}`);
          results.details.push({
            runId,
            success: false,
            error: "Run not found",
          });
          continue;
        }

        // Create backup before modifying
        const backupPath = await backupRun(run);
        results.backed_up.push(backupPath);

        // Re-score the run
        const rescoreResult = await rescoreRun(run, brand, brandAliases, (progress) => {
          console.log(
            `[Rescore ${runId}] ${progress.completed}/${progress.total} - ${progress.currentCell || ""}`
          );
        });

        // Save the updated run
        if (rescoreResult.stats.successfulExtractions > 0) {
          await saveRun(rescoreResult.run);
          // Populate metrics + entity tables for Kanban
          await saveRunAggregates(rescoreResult.run);
          results.rescored++;
        }

        // Record details
        results.details.push({
          runId,
          success: rescoreResult.success,
          stats: {
            totalResponses: rescoreResult.stats.totalResponses,
            successfulExtractions: rescoreResult.stats.successfulExtractions,
            failedExtractions: rescoreResult.stats.failedExtractions,
          },
        });

        // Add any extraction errors
        if (rescoreResult.errors.length > 0) {
          results.errors.push(
            ...rescoreResult.errors.slice(0, 5).map((e) => `[${runId}] ${e}`)
          );
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        results.errors.push(`Failed to rescore ${runId}: ${errorMsg}`);
        results.details.push({
          runId,
          success: false,
          error: errorMsg,
        });
      }
    }

    return Response.json(results);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return Response.json(
        { error: "Invalid request", details: err.errors },
        { status: 400 }
      );
    }

    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error("[rescore] Error:", errorMsg);
    return Response.json({ error: errorMsg }, { status: 500 });
  }
}
