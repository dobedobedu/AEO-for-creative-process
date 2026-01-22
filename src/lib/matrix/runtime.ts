import { getActiveMatrixConfig } from "@/lib/matrix/db";
import type { MatrixConfig } from "@/lib/matrix/types";

// Cache with TTL for serverless environments
let cached: MatrixConfig | null = null;
let cachedAt = 0;
const TTL_MS = 60_000; // 1 minute

/**
 * Get active matrix config with caching
 * Cache is per-instance (serverless-aware)
 */
export async function getActiveMatrixConfigCached(): Promise<MatrixConfig> {
  const now = Date.now();
  if (cached && now - cachedAt < TTL_MS) {
    return cached;
  }

  const cfg = await getActiveMatrixConfig();
  if (!cfg || !cfg.personas.length || !cfg.stages.length) {
    throw new Error("Matrix config not found or empty - check matrix_personas/matrix_stages tables");
  }

  cached = cfg;
  cachedAt = now;
  return cfg;
}

/**
 * Clear cache (for testing)
 */
export function clearConfigCache(): void {
  cached = null;
  cachedAt = 0;
}

/**
 * Validate that a persona/stage combination is valid in the current config
 */
export function assertValidPersonaStage(
  personaId: string,
  stageId: string,
  cfg: MatrixConfig
): void {
  const persona = cfg.personas.find((p) => p.id === personaId && p.active);
  const stage = cfg.stages.find((s) => s.id === stageId && s.active);

  if (!persona) {
    throw new Error(`Invalid or inactive persona: ${personaId}`);
  }
  if (!stage) {
    throw new Error(`Invalid or inactive stage: ${stageId}`);
  }
}

/**
 * Get the core stage mapping for scoring
 * Custom stages must map to one of: explore, consider, compare, decide
 */
export function getCoreStageMapping(
  stageId: string,
  cfg: MatrixConfig
): "explore" | "consider" | "compare" | "decide" {
  const stage = cfg.stages.find((s) => s.id === stageId && s.active);

  if (!stage) {
    throw new Error(`Stage not found: ${stageId}`);
  }

  // Core stages map to themselves
  if (stage.coreStage && !stage.coreStageMapping) {
    if (["explore", "consider", "compare", "decide"].includes(stageId)) {
      return stageId as "explore" | "consider" | "compare" | "decide";
    }
  }

  if (!stage.coreStageMapping) {
    throw new Error(`Stage ${stageId} missing coreStageMapping - required for scoring`);
  }

  return stage.coreStageMapping;
}

/**
 * Get active persona IDs (convenience helper)
 */
export function getActivePersonaIds(cfg: MatrixConfig): string[] {
  return cfg.personas.filter((p) => p.active).map((p) => p.id);
}

/**
 * Get active stage IDs (convenience helper)
 */
export function getActiveStageIds(cfg: MatrixConfig): string[] {
  return cfg.stages.filter((s) => s.active).map((s) => s.id);
}

/**
 * Parse a cell key back into persona and stage
 * Cell keys are formatted as "{persona}_{stage}" e.g., "move_up_explore"
 *
 * NOTE: This version returns string types (not Persona/Stage enums) because
 * dynamic matrix configs can have arbitrary IDs not bound to hardcoded enums.
 * For typed enum parsing, see src/lib/runs/utils.ts parseCellKey.
 */
export function parseCellKey(cellKey: string): { persona: string; stage: string } {
  // Stage is always the last segment after underscore
  const lastUnderscore = cellKey.lastIndexOf("_");
  if (lastUnderscore === -1) {
    throw new Error(`Invalid cell key format: ${cellKey}`);
  }
  const persona = cellKey.slice(0, lastUnderscore);
  const stage = cellKey.slice(lastUnderscore + 1);
  return { persona, stage };
}
