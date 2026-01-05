import { z } from "zod";

export const PersonaSchema = z.enum(["move_up", "retiree", "luxury", "first_time"]);
export const StageSchema = z.enum(["explore", "consider", "compare", "decide"]);

export type Persona = z.infer<typeof PersonaSchema>;
export type Stage = z.infer<typeof StageSchema>;

export const IntentSchema = z.object({
  id: z.string(),
  persona: PersonaSchema,
  stage: StageSchema,
  text: z.string().min(1).max(200),
  defaultQueries: z.array(z.string()).min(1),
  temperature: z.number().min(0.1).max(0.9).default(0.5),
  createdAt: z.string().datetime(),
  active: z.boolean().default(true),
});

export type Intent = z.infer<typeof IntentSchema>;

export const IntentChangeSchema = z.object({
  action: z.enum(["created", "modified", "deactivated", "reactivated"]),
  intentId: z.string(),
  field: z.string().optional(),
  oldValue: z.unknown().optional(),
  newValue: z.unknown().optional(),
});

export type IntentChange = z.infer<typeof IntentChangeSchema>;

export const IntentHistoryEntrySchema = z.object({
  version: z.number().int().positive(),
  date: z.string(),
  changes: z.array(IntentChangeSchema),
});

export type IntentHistoryEntry = z.infer<typeof IntentHistoryEntrySchema>;

export const IntentLibrarySchema = z.object({
  version: z.number().int().positive(),
  updatedAt: z.string().datetime(),
  intents: z.array(IntentSchema),
  history: z.array(IntentHistoryEntrySchema),
});

export type IntentLibrary = z.infer<typeof IntentLibrarySchema>;

export function generateIntentId(persona: Persona, stage: Stage): string {
  const timestamp = Date.now().toString(36);
  return `int_${persona}_${stage}_${timestamp}`;
}

export function getCellKey(persona: Persona, stage: Stage): string {
  return `${persona}_${stage}`;
}

export function parseCellKey(key: string): { persona: Persona; stage: Stage } | null {
  const [persona, stage] = key.split("_") as [Persona, Stage];
  if (PersonaSchema.safeParse(persona).success && StageSchema.safeParse(stage).success) {
    return { persona, stage };
  }
  return null;
}
