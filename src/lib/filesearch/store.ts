/**
 * FileSearchStore management for AI Visibility Benchmark
 */

import { getGenAIClient } from "./client";
import type { FileSearchStore } from "@google/genai";

const STORE_DISPLAY_NAME = "ai-visibility-benchmark";

let cachedStore: FileSearchStore | null = null;

/**
 * Get or create the FileSearchStore for benchmark data
 */
export async function getOrCreateStore(): Promise<FileSearchStore> {
  if (cachedStore) {
    return cachedStore;
  }

  const client = getGenAIClient();

  // List existing stores and find ours
  const storesIterator = await client.fileSearchStores.list();
  
  for await (const store of storesIterator) {
    if (store.displayName === STORE_DISPLAY_NAME) {
      cachedStore = store;
      console.log(`[FileSearch] Found existing store: ${store.name}`);
      return store;
    }
  }

  // Create new store if not found
  const newStore = await client.fileSearchStores.create({
    config: { displayName: STORE_DISPLAY_NAME },
  });

  cachedStore = newStore;
  console.log(`[FileSearch] Created new store: ${newStore.name}`);
  return newStore;
}

/**
 * Get store name (for use in queries)
 */
export async function getStoreName(): Promise<string> {
  const store = await getOrCreateStore();
  if (!store.name) {
    throw new Error("FileSearchStore has no name");
  }
  return store.name;
}

/**
 * Delete the store (for cleanup/testing)
 */
export async function deleteStore(): Promise<void> {
  const client = getGenAIClient();
  const storeName = await getStoreName();
  
  await client.fileSearchStores.delete({
    name: storeName,
    config: { force: true },
  });
  
  cachedStore = null;
  console.log(`[FileSearch] Deleted store: ${storeName}`);
}

/**
 * List all documents in the store
 */
export async function listDocuments(): Promise<string[]> {
  const client = getGenAIClient();
  const storeName = await getStoreName();
  
  const docs: string[] = [];
  const docsIterator = await client.fileSearchStores.documents.list({
    parent: storeName,
  });
  
  for await (const doc of docsIterator) {
    if (doc.name) {
      docs.push(doc.name);
    }
  }
  
  return docs;
}
