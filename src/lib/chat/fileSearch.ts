/**
 * Gemini File Search integration for RAG
 * 
 * This module handles:
 * - Creating and managing File Search stores
 * - Indexing benchmark responses
 * - Querying with semantic search
 */

const STORE_NAME = "benchmark-responses";

interface FileSearchStore {
  name: string;
  displayName?: string;
}

interface UploadOperation {
  name: string;
  done: boolean;
}

/**
 * Get API key from environment
 */
function getApiKey(): string {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not set");
  }
  return apiKey;
}

/**
 * Create a new File Search store
 */
export async function createFileSearchStore(displayName: string = STORE_NAME): Promise<string> {
  const apiKey = getApiKey();
  
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/fileSearchStores?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ displayName }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to create File Search store: ${error}`);
  }

  const store: FileSearchStore = await response.json();
  return store.name;
}

/**
 * List existing File Search stores
 */
export async function listFileSearchStores(): Promise<FileSearchStore[]> {
  const apiKey = getApiKey();
  
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/fileSearchStores?key=${apiKey}`
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to list File Search stores: ${error}`);
  }

  const data = await response.json();
  return data.fileSearchStores ?? [];
}

/**
 * Get or create a File Search store with the given name
 */
export async function getOrCreateStore(displayName: string = STORE_NAME): Promise<string> {
  const stores = await listFileSearchStores();
  const existing = stores.find((s) => s.displayName === displayName);
  
  if (existing) {
    return existing.name;
  }
  
  return createFileSearchStore(displayName);
}

/**
 * Upload and index a JSONL file to a File Search store
 */
export async function indexJsonlToStore(
  storeName: string,
  jsonlContent: string,
  fileName: string = "responses.jsonl"
): Promise<void> {
  const apiKey = getApiKey();
  
  // Create a blob from the JSONL content
  const blob = new Blob([jsonlContent], { type: "application/jsonl" });
  
  // Upload to File Search store
  const formData = new FormData();
  formData.append("file", blob, fileName);
  
  const uploadUrl = `https://generativelanguage.googleapis.com/upload/v1beta/${storeName}:uploadToFileSearchStore?key=${apiKey}`;
  
  const response = await fetch(uploadUrl, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to upload to File Search store: ${error}`);
  }

  const operation: UploadOperation = await response.json();
  
  // Poll for completion
  if (!operation.done) {
    await waitForOperation(operation.name);
  }
}

/**
 * Wait for an async operation to complete
 */
async function waitForOperation(operationName: string, maxAttempts = 30): Promise<void> {
  const apiKey = getApiKey();
  
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise((resolve) => setTimeout(resolve, 2000));
    
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/${operationName}?key=${apiKey}`
    );
    
    if (!response.ok) continue;
    
    const op: UploadOperation = await response.json();
    if (op.done) return;
  }
  
  throw new Error("Operation timed out");
}

/**
 * Delete a File Search store
 */
export async function deleteFileSearchStore(storeName: string): Promise<void> {
  const apiKey = getApiKey();
  
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/${storeName}?key=${apiKey}`,
    { method: "DELETE" }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to delete File Search store: ${error}`);
  }
}

/**
 * Get the store ID for chat API calls
 * Returns the full store name (e.g., "fileSearchStores/abc123")
 */
export async function getStoreId(): Promise<string | null> {
  try {
    const stores = await listFileSearchStores();
    const store = stores.find((s) => s.displayName === STORE_NAME);
    return store?.name ?? null;
  } catch {
    return null;
  }
}
