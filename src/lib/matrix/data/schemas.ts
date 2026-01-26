import { z } from "zod";

// Schema for /api/matrix/active response
export const MatrixConfigApiResponseSchema = z.object({
  personas: z.array(z.object({
    id: z.string(),
    label: z.string(),
    description: z.string().optional(),
  })),
  stages: z.array(z.object({
    id: z.string(),
    label: z.string(),
    description: z.string().optional(),
  })),
});

export type MatrixConfigApiResponse = z.infer<typeof MatrixConfigApiResponseSchema>;

// Schema for /api/benchmark/runs/history response
// Note: Using passthrough() to preserve all fields from full BenchmarkRun objects
// The UI needs cells data for toUiBenchmarkRun conversion
export const HistoryRunsApiResponseSchema = z.object({
  runs: z.array(z.object({
    id: z.string(),
    timestamp: z.string(),
  }).passthrough()),
});

export type HistoryRunsApiResponse = z.infer<typeof HistoryRunsApiResponseSchema>;

// Schema for /api/intents/library response
export const IntentLibraryApiResponseSchema = z.object({
  version: z.number().int().positive(),
  updatedAt: z.string().datetime(),
  intents: z.array(z.object({
    id: z.string(),
    persona: z.string().min(1),
    stage: z.string().min(1),
    text: z.string().min(1),
    role: z.enum(["cpo", "family_unit"]),
    queryStyle: z.number().min(0.5).max(1.0),
    generatedQueries: z.array(z.string()).optional(),
    createdAt: z.string().datetime(),
    active: z.boolean(),
  })),
  history: z.array(z.object({
    version: z.number().int().positive(),
    date: z.string(),
    changes: z.array(z.object({
      action: z.enum(["created", "modified", "deactivated", "reactivated"]),
      intentId: z.string(),
      field: z.string().optional(),
      oldValue: z.unknown().optional(),
      newValue: z.unknown().optional(),
    })),
  })),
});

export type IntentLibraryApiResponse = z.infer<typeof IntentLibraryApiResponseSchema>;
