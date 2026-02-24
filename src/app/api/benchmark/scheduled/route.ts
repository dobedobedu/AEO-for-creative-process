/**
 * Scheduled Benchmark Dispatcher
 *
 * Dispatches all active stages in configured order using the stage-specific
 * scheduled route. This allows cron configuration to stay stable even when
 * tenant stage IDs are customized.
 */

import { getActiveMatrixConfigCached } from "@/lib/matrix/runtime";
import { GET as runScheduledStage } from "@/app/api/benchmark/scheduled/[stage]/route";

export const maxDuration = 800;

export async function GET(req: Request) {
  const startTime = Date.now();
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const cfg = await getActiveMatrixConfigCached();
    const activeStages = cfg.stages
      .filter((s) => s.active)
      .sort((a, b) => a.orderIndex - b.orderIndex)
      .map((s) => s.id);

    if (activeStages.length === 0) {
      return Response.json(
        { success: false, error: "No active stages configured" },
        { status: 400 }
      );
    }

    const stageResults: Array<{ stage: string; status: number }> = [];

    for (const stage of activeStages) {
      const response = await runScheduledStage(req, {
        params: Promise.resolve({ stage }),
      });
      stageResults.push({ stage, status: response.status });
    }

    const failed = stageResults.filter((r) => r.status >= 400);
    if (failed.length > 0) {
      return Response.json(
        {
          success: false,
          stageResults,
          failed,
          executionTimeMs: Date.now() - startTime,
        },
        { status: 500 }
      );
    }

    return Response.json({
      success: true,
      stageResults,
      executionTimeMs: Date.now() - startTime,
    });
  } catch (error) {
    return Response.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        executionTimeMs: Date.now() - startTime,
      },
      { status: 500 }
    );
  }
}
