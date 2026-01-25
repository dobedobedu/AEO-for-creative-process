import {
  MatrixConfigApiResponseSchema,
  HistoryRunsApiResponseSchema,
  IntentLibraryApiResponseSchema,
} from "./schemas";

/**
 * Parse and validate matrix config API response
 * @throws {ZodError} if response is invalid
 */
export function parseMatrixConfig(input: unknown) {
  return MatrixConfigApiResponseSchema.parse(input);
}

/**
 * Parse and validate history runs API response
 * @throws {ZodError} if response is invalid
 */
export function parseHistoryRuns(input: unknown) {
  return HistoryRunsApiResponseSchema.parse(input);
}

/**
 * Parse and validate intent library API response
 * @throws {ZodError} if response is invalid
 */
export function parseIntentLibrary(input: unknown) {
  return IntentLibraryApiResponseSchema.parse(input);
}
