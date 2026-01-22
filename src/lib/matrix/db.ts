import { sql } from "@/lib/db";
import type { MatrixConfig, MatrixPersona, MatrixStage, MatrixConfigVersion } from "./types";

// Get active matrix configuration
export async function getActiveMatrixConfig(): Promise<MatrixConfig | null> {
  const result = await sql`
    SELECT * FROM get_active_matrix_config()
  `;

  if (result.length === 0) {
    return null;
  }

  const row = result[0];
  return {
    personas: row.personas || [],
    stages: row.stages || [],
  };
}

// Get all personas (including inactive)
export async function getAllPersonas(): Promise<MatrixPersona[]> {
  const rows = await sql`
    SELECT
      persona_id as id,
      label,
      description,
      full_text as "fullText",
      order_index as "orderIndex",
      active
    FROM matrix_personas
    ORDER BY order_index
  `;

  return rows as MatrixPersona[];
}

// Get all stages (including inactive)
export async function getAllStages(): Promise<MatrixStage[]> {
  const rows = await sql`
    SELECT
      stage_id as id,
      label,
      description,
      order_index as "orderIndex",
      active,
      core_stage as "coreStage",
      primary_metric as "primaryMetric"
    FROM matrix_stages
    ORDER BY order_index
  `;

  return rows as MatrixStage[];
}

// Update persona
export async function updatePersona(
  personaId: string,
  updates: Partial<MatrixPersona>
): Promise<void> {
  if (updates.label !== undefined) {
    await sql`
      UPDATE matrix_personas
      SET label = ${updates.label}
      WHERE persona_id = ${personaId}
    `;
  }
  if (updates.description !== undefined) {
    await sql`
      UPDATE matrix_personas
      SET description = ${updates.description}
      WHERE persona_id = ${personaId}
    `;
  }
  if (updates.fullText !== undefined) {
    await sql`
      UPDATE matrix_personas
      SET full_text = ${updates.fullText}
      WHERE persona_id = ${personaId}
    `;
  }
  if (updates.orderIndex !== undefined) {
    await sql`
      UPDATE matrix_personas
      SET order_index = ${updates.orderIndex}
      WHERE persona_id = ${personaId}
    `;
  }
  if (updates.active !== undefined) {
    await sql`
      UPDATE matrix_personas
      SET active = ${updates.active}
      WHERE persona_id = ${personaId}
    `;
  }
}

// Update stage
export async function updateStage(
  stageId: string,
  updates: Partial<MatrixStage>
): Promise<void> {
  if (updates.label !== undefined) {
    await sql`
      UPDATE matrix_stages
      SET label = ${updates.label}
      WHERE stage_id = ${stageId}
    `;
  }
  if (updates.description !== undefined) {
    await sql`
      UPDATE matrix_stages
      SET description = ${updates.description}
      WHERE stage_id = ${stageId}
    `;
  }
  if (updates.orderIndex !== undefined) {
    await sql`
      UPDATE matrix_stages
      SET order_index = ${updates.orderIndex}
      WHERE stage_id = ${stageId}
    `;
  }
  if (updates.active !== undefined) {
    await sql`
      UPDATE matrix_stages
      SET active = ${updates.active}
      WHERE stage_id = ${stageId}
    `;
  }
  if (updates.coreStage !== undefined) {
    await sql`
      UPDATE matrix_stages
      SET core_stage = ${updates.coreStage}
      WHERE stage_id = ${stageId}
    `;
  }
  if (updates.primaryMetric !== undefined) {
    await sql`
      UPDATE matrix_stages
      SET primary_metric = ${updates.primaryMetric}
      WHERE stage_id = ${stageId}
    `;
  }
}

// Add persona
export async function addPersona(persona: MatrixPersona): Promise<void> {
  await sql`
    INSERT INTO matrix_personas (persona_id, label, description, full_text, order_index, active)
    VALUES (${persona.id}, ${persona.label}, ${persona.description || null}, ${persona.fullText || null}, ${persona.orderIndex}, ${persona.active})
  `;
}

// Delete persona
export async function deletePersona(personaId: string): Promise<void> {
  await sql`
    DELETE FROM matrix_personas
    WHERE persona_id = ${personaId}
  `;
}

// Add stage
export async function addStage(stage: MatrixStage): Promise<void> {
  await sql`
    INSERT INTO matrix_stages (stage_id, label, description, order_index, active, core_stage, primary_metric)
    VALUES (${stage.id}, ${stage.label}, ${stage.description || null}, ${stage.orderIndex}, ${stage.active}, ${stage.coreStage || false}, ${stage.primaryMetric || null})
  `;
}

// Delete stage
export async function deleteStage(stageId: string): Promise<void> {
  await sql`
    DELETE FROM matrix_stages
    WHERE stage_id = ${stageId}
  `;
}

// Reorder personas
export async function reorderPersonas(personaIds: string[]): Promise<void> {
  await sql.begin(async (sql: any) => {
    for (let i = 0; i < personaIds.length; i++) {
      await sql`
        UPDATE matrix_personas
        SET order_index = ${i}
        WHERE persona_id = ${personaIds[i]}
      `;
    }
  });
}

// Reorder stages
export async function reorderStages(stageIds: string[]): Promise<void> {
  await sql.begin(async (sql: any) => {
    for (let i = 0; i < stageIds.length; i++) {
      await sql`
        UPDATE matrix_stages
        SET order_index = ${i}
        WHERE stage_id = ${stageIds[i]}
      `;
    }
  });
}

// Save draft version
export async function saveDraftVersion(
  config: MatrixConfig,
  userId?: string
): Promise<string> {
  const result = await sql`
    INSERT INTO matrix_config_versions (version, status, personas_json, stages_json, created_by)
    VALUES (
      COALESCE((SELECT MAX(version) + 1 FROM matrix_config_versions), 1),
      'draft',
      ${sql.json(config.personas)},
      ${sql.json(config.stages)},
      ${userId || null}::uuid
    )
    RETURNING id
  `;

  return result[0].id;
}

// Publish configuration
export async function publishConfig(
  config: MatrixConfig,
  userId?: string
): Promise<string> {
  // Get existing personas and stages
  const existingPersonas = await getAllPersonas();
  const existingStages = await getAllStages();

  const existingPersonaIds = new Set(existingPersonas.map((p) => p.id));
  const existingStageIds = new Set(existingStages.map((s) => s.id));

  const configPersonaIds = new Set(config.personas.map((p) => p.id));
  const configStageIds = new Set(config.stages.map((s) => s.id));

  // Update all personas and stages
  await sql.begin(async (sql: any) => {
    // Delete personas not in config
    for (const existingPersona of existingPersonas) {
      if (!configPersonaIds.has(existingPersona.id)) {
        await sql`DELETE FROM matrix_personas WHERE persona_id = ${existingPersona.id}`;
      }
    }

    // Delete stages not in config
    for (const existingStage of existingStages) {
      if (!configStageIds.has(existingStage.id)) {
        await sql`DELETE FROM matrix_stages WHERE stage_id = ${existingStage.id}`;
      }
    }

    // Upsert personas
    for (const persona of config.personas) {
      await sql`
        INSERT INTO matrix_personas (persona_id, label, description, full_text, order_index, active)
        VALUES (${persona.id}, ${persona.label}, ${persona.description || null}, ${persona.fullText || null}, ${persona.orderIndex}, ${persona.active})
        ON CONFLICT (persona_id) DO UPDATE SET
          label = EXCLUDED.label,
          description = EXCLUDED.description,
          full_text = EXCLUDED.full_text,
          order_index = EXCLUDED.order_index,
          active = EXCLUDED.active,
          updated_at = NOW()
      `;
    }

    // Upsert stages
    for (const stage of config.stages) {
      await sql`
        INSERT INTO matrix_stages (stage_id, label, description, order_index, active, core_stage, primary_metric)
        VALUES (${stage.id}, ${stage.label}, ${stage.description || null}, ${stage.orderIndex}, ${stage.active}, ${stage.coreStage || false}, ${stage.primaryMetric || null})
        ON CONFLICT (stage_id) DO UPDATE SET
          label = EXCLUDED.label,
          description = EXCLUDED.description,
          order_index = EXCLUDED.order_index,
          active = EXCLUDED.active,
          core_stage = EXCLUDED.core_stage,
          primary_metric = EXCLUDED.primary_metric,
          updated_at = NOW()
      `;
    }

    // Create published version
    await sql`
      INSERT INTO matrix_config_versions (version, status, personas_json, stages_json, created_by, published_at)
      VALUES (
        COALESCE((SELECT MAX(version) + 1 FROM matrix_config_versions), 1),
        'published',
        ${sql.json(config.personas)},
        ${sql.json(config.stages)},
        ${userId || null}::uuid,
        NOW()
      )
    `;
  });

  // Get the version ID of the just-published config
  const result = await sql`
    SELECT id FROM matrix_config_versions
    WHERE status = 'published'
    ORDER BY published_at DESC
    LIMIT 1
  `;

  return result[0]?.id || "";
}

// Get version history
export async function getVersionHistory(): Promise<MatrixConfigVersion[]> {
  const rows = await sql`
    SELECT
      id,
      version,
      status,
      personas_json as "personasJson",
      stages_json as "stagesJson",
      created_by as "createdBy",
      created_at as "createdAt",
      published_at as "publishedAt"
    FROM matrix_config_versions
    ORDER BY created_at DESC
    LIMIT 20
  `;

  return rows as MatrixConfigVersion[];
}
