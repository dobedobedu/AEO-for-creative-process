/**
 * Tests for Response Deduplication Cache
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
    getCacheKey,
    getCachedResponse,
    setCachedResponse,
    clearCache,
} from "../responseCache";

describe("responseCache", () => {
    beforeEach(() => {
        clearCache();
    });

    describe("getCacheKey", () => {
        it("generates consistent keys for same inputs", () => {
            const key1 = getCacheKey("test query", "openai", "gpt-5.2");
            const key2 = getCacheKey("test query", "openai", "gpt-5.2");
            expect(key1).toBe(key2);
        });

        it("generates different keys for different queries", () => {
            const key1 = getCacheKey("query 1", "openai", "gpt-5.2");
            const key2 = getCacheKey("query 2", "openai", "gpt-5.2");
            expect(key1).not.toBe(key2);
        });

        it("generates different keys for different providers", () => {
            const key1 = getCacheKey("test query", "openai", "gpt-5.2");
            const key2 = getCacheKey("test query", "anthropic", "gpt-5.2");
            expect(key1).not.toBe(key2);
        });

        it("generates different keys for different models", () => {
            const key1 = getCacheKey("test query", "openai", "gpt-5.2");
            const key2 = getCacheKey("test query", "openai", "gpt-5-mini");
            expect(key1).not.toBe(key2);
        });
    });

    describe("getCachedResponse / setCachedResponse", () => {
        it("returns null for cache miss", () => {
            const result = getCachedResponse("new query", "openai", "gpt-5.2");
            expect(result).toBeNull();
        });

        it("returns cached response for cache hit", () => {
            const response = {
                text: "Test response",
                citations: ["https://example.com"],
                raw: { test: true },
            };

            setCachedResponse("test query", "openai", "gpt-5.2", response);
            const cached = getCachedResponse("test query", "openai", "gpt-5.2");

            expect(cached).not.toBeNull();
            expect(cached?.text).toBe("Test response");
            expect(cached?.citations).toEqual(["https://example.com"]);
            expect(cached?.provider).toBe("openai");
            expect(cached?.model).toBe("gpt-5.2");
            expect(cached?.query).toBe("test query");
        });

        it("stores timestamp on cache entry", () => {
            const before = Date.now();
            setCachedResponse("test query", "openai", "gpt-5.2", {
                text: "Test",
                citations: [],
                raw: null,
            });
            const after = Date.now();

            const cached = getCachedResponse("test query", "openai", "gpt-5.2");
            expect(cached?.timestamp).toBeGreaterThanOrEqual(before);
            expect(cached?.timestamp).toBeLessThanOrEqual(after);
        });
    });

    describe("clearCache", () => {
        it("clears all cached entries", () => {
            setCachedResponse("query1", "openai", "gpt-5.2", {
                text: "Test 1",
                citations: [],
                raw: null,
            });
            setCachedResponse("query2", "anthropic", "claude", {
                text: "Test 2",
                citations: [],
                raw: null,
            });

            expect(getCachedResponse("query1", "openai", "gpt-5.2")).not.toBeNull();
            expect(getCachedResponse("query2", "anthropic", "claude")).not.toBeNull();

            clearCache();

            expect(getCachedResponse("query1", "openai", "gpt-5.2")).toBeNull();
            expect(getCachedResponse("query2", "anthropic", "claude")).toBeNull();
        });
    });
});
