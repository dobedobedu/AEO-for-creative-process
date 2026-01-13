/**
 * Upload benchmark results to FileSearchStore
 */

import { getGenAIClient } from "./client";
import { getStoreName } from "./store";
import { formatBenchmarkForUpload, formatRunForUpload, type FormattedBenchmark } from "./formatter";
import type { BenchmarkResult } from "@/lib/benchmark/runner";
import type { BenchmarkRun } from "@/lib/runs/types";

export interface UploadResult {
  success: boolean;
  documentName?: string;
  error?: string;
}

/**
 * Upload formatted benchmark to FileSearchStore
 */
async function uploadFormattedBenchmark(
  formatted: FormattedBenchmark
): Promise<UploadResult> {
  const client = getGenAIClient();
  const storeName = await getStoreName();

  try {
    console.log(`[FileSearch] Uploading: ${formatted.displayName}`);

    // Create a Blob from the content
    const blob = new Blob([formatted.content], { type: "text/markdown" });

    // Upload to FileSearchStore
    let operation = await client.fileSearchStores.uploadToFileSearchStore({
      fileSearchStoreName: storeName,
      file: blob,
      config: {
        displayName: formatted.displayName,
        mimeType: "text/markdown",
        customMetadata: formatted.metadata,
        chunkingConfig: {
          whiteSpaceConfig: {
            maxTokensPerChunk: 500,
            maxOverlapTokens: 50,
          },
        },
      },
    });

    // Wait for indexing to complete
    let attempts = 0;
    const maxAttempts = 30; // 60 seconds max

    while (!operation.done && attempts < maxAttempts) {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      operation = await client.operations.get({ operation });
      attempts++;
      
      if (attempts % 5 === 0) {
        console.log(`[FileSearch] Still indexing... (${attempts * 2}s)`);
      }
    }

    if (!operation.done) {
      return {
        success: false,
        error: "Upload timed out after 60 seconds",
      };
    }

    const response = operation.response;
    console.log(`[FileSearch] Upload complete: ${response?.documentName ?? "unknown"}`);

    return {
      success: true,
      documentName: response?.documentName,
    };
  } catch (error) {
    // Safely extract error message to avoid issues with read-only error objects
    let errorMessage = "Unknown upload error";
    try {
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (error && typeof error === "object" && "message" in error) {
        errorMessage = String((error as { message: unknown }).message);
      } else {
        errorMessage = String(error);
      }
    } catch {
      errorMessage = "Upload error (details unavailable)";
    }
    console.error("[FileSearch] Upload failed:", errorMessage);
    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Upload benchmark results to FileSearchStore
 */
export async function uploadBenchmarkResults(
  results: BenchmarkResult,
  persona: string,
  stage: string,
  brand: string = "Lakewood Ranch"
): Promise<UploadResult> {
  const formatted = formatBenchmarkForUpload(results, persona, stage, brand);
  return uploadFormattedBenchmark(formatted);
}

/**
 * Upload benchmark results in background (non-blocking)
 */
export function uploadBenchmarkResultsAsync(
  results: BenchmarkResult,
  persona: string,
  stage: string,
  brand: string = "Lakewood Ranch"
): void {
  // Fire and forget - don't await
  uploadBenchmarkResults(results, persona, stage, brand)
    .then((result) => {
      if (result.success) {
        console.log(`[FileSearch] Background upload succeeded: ${result.documentName}`);
      } else {
        console.error(`[FileSearch] Background upload failed: ${result.error}`);
      }
    })
    .catch((error) => {
      // Safely log error without passing the raw object
      let msg = "Unknown error";
      try {
        msg = error instanceof Error ? error.message : String(error);
      } catch {
        msg = "Error details unavailable";
      }
      console.error("[FileSearch] Background upload error:", msg);
    });
}

/**
 * Upload a full run (new Intent Library + Stage-Aware format) to FileSearchStore.
 * This creates one document per cell for better retrieval.
 */
export async function uploadRun(run: BenchmarkRun): Promise<UploadResult[]> {
  const formattedDocs = formatRunForUpload(run);
  const results: UploadResult[] = [];

  for (const doc of formattedDocs) {
    results.push(await uploadFormattedBenchmark(doc));
  }

  return results;
}

/**
 * Upload a run in the background (non-blocking).
 */
export function uploadRunAsync(run: BenchmarkRun): void {
  uploadRun(run)
    .then((results) => {
      const succeeded = results.filter((r) => r.success).length;
      const failed = results.filter((r) => !r.success);
      console.log(`[FileSearch] Run upload finished: ${succeeded}/${results.length} docs succeeded`);
      if (failed.length > 0) {
        console.error(`[FileSearch] ${failed.length} docs failed`, failed);
      }
    })
    .catch((error) => {
      // Safely log error without passing the raw object
      let msg = "Unknown error";
      try {
        msg = error instanceof Error ? error.message : String(error);
      } catch {
        msg = "Error details unavailable";
      }
      console.error("[FileSearch] Run background upload error:", msg);
    });
}
