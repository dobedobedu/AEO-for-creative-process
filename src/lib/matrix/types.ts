import { z } from "zod";

// Persona configuration
export const MatrixPersonaSchema = z.object({
  id: z.string(),
  label: z.string().min(1).max(50),
  description: z.string().max(200).optional(),
  fullText: z.string().max(1000).optional(),
  orderIndex: z.number().int().min(0),
  active: z.boolean().default(true),
});

export type MatrixPersona = z.infer<typeof MatrixPersonaSchema>;

// Stage configuration
export const MatrixStageSchema = z.object({
  id: z.string(),
  label: z.string().min(1).max(50),
  description: z.string().max(200).optional(),
  orderIndex: z.number().int().min(0),
  active: z.boolean().default(true),
  coreStage: z.boolean().default(false),
  coreStageMapping: z.enum(["explore", "consider", "compare", "decide"]).optional(),
  primaryMetric: z.enum(["discovery_rate", "mention_rate", "top3_rate", "sentiment_score", "win_rate", "recommendation_rate"]).optional(),
});

export type MatrixStage = z.infer<typeof MatrixStageSchema>;

// Full matrix configuration
export const MatrixConfigSchema = z.object({
  personas: z.array(MatrixPersonaSchema),
  stages: z.array(MatrixStageSchema),
});

export type MatrixConfig = z.infer<typeof MatrixConfigSchema>;

// Config version
export const MatrixConfigVersionSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int().positive(),
  status: z.enum(["draft", "published", "archived"]),
  personasJson: z.any(), // JSONB
  stagesJson: z.any(), // JSONB
  createdBy: z.string().uuid().nullable(),
  createdAt: z.string().datetime(),
  publishedAt: z.string().datetime().nullable(),
});

export type MatrixConfigVersion = z.infer<typeof MatrixConfigVersionSchema>;

// Draft state
export interface MatrixDraft {
  personas: MatrixPersona[];
  stages: MatrixStage[];
  lastSaved: string | null;
  hasUnsavedChanges: boolean;
}

// Update actions
export type PersonaUpdate = Partial<Omit<MatrixPersona, "id">>;
export type StageUpdate = Partial<Omit<MatrixStage, "id">>;

// Reorder action
export interface ReorderAction {
  fromIndex: number;
  toIndex: number;
}
