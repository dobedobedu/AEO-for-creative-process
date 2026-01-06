/**
 * Response Deduplication Cache
 * 
 * Caches benchmark responses to avoid re-running identical queries within 24 hours.
 * Uses a simple in-memory cache backed by file persistence.
 */

import { createHash } from "crypto";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";

export interface CachedResponse {
    query: string;
    provider: string;
    model: string;
    text: string;
    citations: string[];
    timestamp: number;
    raw: unknown;
}

// Cache TTL: 24 hours in milliseconds
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

// In-memory cache
const memoryCache = new Map<string, CachedResponse>();

// Cache file path (for persistence across restarts)
const CACHE_DIR = join(process.cwd(), "data", "cache");
const CACHE_FILE = join(CACHE_DIR, "response-cache.json");

/**
 * Generate a unique cache key for a query + provider + model combination
 */
export function getCacheKey(query: string, provider: string, model: string): string {
    const input = `${provider}:${model}:${query}`;
    return createHash("sha256").update(input).digest("hex").slice(0, 16);
}

/**
 * Check if a cached response exists and is still valid
 */
export function getCachedResponse(
    query: string,
    provider: string,
    model: string
): CachedResponse | null {
    const key = getCacheKey(query, provider, model);
    const cached = memoryCache.get(key);

    if (!cached) {
        return null;
    }

    // Check if cache entry has expired
    if (Date.now() - cached.timestamp > CACHE_TTL_MS) {
        memoryCache.delete(key);
        return null;
    }

    return cached;
}

/**
 * Store a response in the cache
 */
export function setCachedResponse(
    query: string,
    provider: string,
    model: string,
    response: Omit<CachedResponse, "query" | "provider" | "model" | "timestamp">
): void {
    const key = getCacheKey(query, provider, model);
    const entry: CachedResponse = {
        query,
        provider,
        model,
        timestamp: Date.now(),
        ...response,
    };

    memoryCache.set(key, entry);
}

/**
 * Get cache statistics
 */
export function getCacheStats(): { size: number; hitRate: number } {
    return {
        size: memoryCache.size,
        hitRate: 0, // Would need tracking to calculate
    };
}

/**
 * Clear all cached responses
 */
export function clearCache(): void {
    memoryCache.clear();
}

/**
 * Persist cache to disk (call on shutdown or periodically)
 */
export function persistCache(): void {
    try {
        if (!existsSync(CACHE_DIR)) {
            mkdirSync(CACHE_DIR, { recursive: true });
        }

        const data = Object.fromEntries(memoryCache.entries());
        writeFileSync(CACHE_FILE, JSON.stringify(data, null, 2));
    } catch {
        // Silently fail - caching is an optimization, not critical
    }
}

/**
 * Load cache from disk (call on startup)
 */
export function loadCache(): void {
    try {
        if (!existsSync(CACHE_FILE)) {
            return;
        }

        const data = JSON.parse(readFileSync(CACHE_FILE, "utf-8"));
        const now = Date.now();

        // Load entries that haven't expired
        for (const [key, entry] of Object.entries(data)) {
            const cached = entry as CachedResponse;
            if (now - cached.timestamp < CACHE_TTL_MS) {
                memoryCache.set(key, cached);
            }
        }
    } catch {
        // Silently fail - start with empty cache
    }
}
