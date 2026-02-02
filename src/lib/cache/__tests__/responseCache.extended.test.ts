/**
 * Extended tests for Response Cache - Edge Cases
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
    getCacheKey,
    getCachedResponse,
    setCachedResponse,
    clearCache,
    getCacheStats,
} from "../responseCache";

describe("responseCache - Extended", () => {
    beforeEach(() => {
        clearCache();
    });

    describe("cache expiration", () => {
        it("expires entries after 24 hours", () => {
            // Set a cached response
            setCachedResponse("query", "openai", "gpt-5", {
                text: "Cached",
                citations: [],
                raw: null,
            });

            // Verify it exists
            expect(getCachedResponse("query", "openai", "gpt-5")).not.toBeNull();

            // Mock time passing 25 hours
            const originalDateNow = Date.now;
            Date.now = vi.fn(() => originalDateNow() + 25 * 60 * 60 * 1000);

            // Should be expired
            expect(getCachedResponse("query", "openai", "gpt-5")).toBeNull();

            // Restore
            Date.now = originalDateNow;
        });

        it("does not expire entries within 24 hours", () => {
            setCachedResponse("query", "openai", "gpt-5", {
                text: "Cached",
                citations: [],
                raw: null,
            });

            // Mock time passing 23 hours
            const originalDateNow = Date.now;
            Date.now = vi.fn(() => originalDateNow() + 23 * 60 * 60 * 1000);

            // Should still exist
            expect(getCachedResponse("query", "openai", "gpt-5")).not.toBeNull();

            // Restore
            Date.now = originalDateNow;
        });
    });

    describe("cache stats", () => {
        it("returns correct size", () => {
            expect(getCacheStats().size).toBe(0);

            setCachedResponse("q1", "openai", "gpt-5", { text: "1", citations: [], raw: null });
            expect(getCacheStats().size).toBe(1);

            setCachedResponse("q2", "anthropic", "claude", { text: "2", citations: [], raw: null });
            expect(getCacheStats().size).toBe(2);

            clearCache();
            expect(getCacheStats().size).toBe(0);
        });
    });

    describe("cache key uniqueness", () => {
        it("generates unique keys for similar queries with different case", () => {
            const key1 = getCacheKey("Test Query", "openai", "gpt-5");
            const key2 = getCacheKey("test query", "openai", "gpt-5");
            // Case matters - different keys
            expect(key1).not.toBe(key2);
        });

        it("generates unique keys for queries with extra whitespace", () => {
            const key1 = getCacheKey("test query", "openai", "gpt-5");
            const key2 = getCacheKey("test  query", "openai", "gpt-5");
            expect(key1).not.toBe(key2);
        });

        it("includes context in cache keys when provided", () => {
            const key1 = getCacheKey("test query", "xai", "grok-4", "searchMode:x_search");
            const key2 = getCacheKey("test query", "xai", "grok-4", "searchMode:web_search");
            expect(key1).not.toBe(key2);
        });
    });

    describe("overwriting entries", () => {
        it("overwrites existing entry with same key", () => {
            setCachedResponse("query", "openai", "gpt-5", {
                text: "Original",
                citations: [],
                raw: null,
            });

            setCachedResponse("query", "openai", "gpt-5", {
                text: "Updated",
                citations: ["http://new.com"],
                raw: { updated: true },
            });

            const cached = getCachedResponse("query", "openai", "gpt-5");
            expect(cached?.text).toBe("Updated");
            expect(cached?.citations).toEqual(["http://new.com"]);
            expect(getCacheStats().size).toBe(1);
        });
    });

    describe("data integrity", () => {
        it("preserves complex raw data", () => {
            const complexRaw = {
                nested: { deeply: { value: 123 } },
                array: [1, 2, { three: 3 }],
                unicode: "日本語テスト",
            };

            setCachedResponse("query", "openai", "gpt-5", {
                text: "Response",
                citations: ["http://a.com", "http://b.com"],
                raw: complexRaw,
            });

            const cached = getCachedResponse("query", "openai", "gpt-5");
            expect(cached?.raw).toEqual(complexRaw);
        });
    });
});
