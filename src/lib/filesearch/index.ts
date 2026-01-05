/**
 * Gemini File Search integration for AI Visibility Benchmark
 * 
 * This module provides RAG-based chat using Gemini's FileSearchStore.
 * Data is uploaded after benchmarks and retrieved via semantic search during chat.
 */

// Client
export { getGenAIClient } from "./client";

// Store management
export { 
  getOrCreateStore, 
  getStoreName, 
  deleteStore, 
  listDocuments 
} from "./store";

// Formatting
export { 
  formatBenchmarkForUpload, 
  formatQueryResult,
  type FormattedBenchmark 
} from "./formatter";

// Upload
export { 
  uploadBenchmarkResults, 
  uploadBenchmarkResultsAsync,
  type UploadResult 
} from "./uploader";

// Query
export { 
  queryWithFileSearch, 
  streamQueryWithFileSearch, 
  hasDocuments,
  type FileSearchResponse,
  type Citation 
} from "./query";
