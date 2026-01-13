/**
 * Tests for Anthropic Provider with Prompt Caching
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock environment
vi.stubEnv("ANTHROPIC_API_KEY", "test-key");

describe("anthropic provider", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe("callAnthropicWebSearch", () => {
        it("includes prompt caching headers", async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    id: "msg_123",
                    model: "claude-haiku-4-5",
                    content: [{ type: "text", text: "Response" }],
                }),
            });

            const { callAnthropicWebSearch } = await import("@/lib/providers/anthropic");
            await callAnthropicWebSearch({
                model: "claude-haiku-4-5",
                query: "test query",
            });

            // Verify headers include prompt caching beta
            const callArgs = mockFetch.mock.calls[0];
            const headers = callArgs[1].headers;
            expect(headers["anthropic-beta"]).toBe("prompt-caching-2024-07-31");
        });

        it("includes cache_control in system prompt", async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    id: "msg_123",
                    model: "claude-haiku-4-5",
                    content: [],
                }),
            });

            const { callAnthropicWebSearch } = await import("@/lib/providers/anthropic");
            await callAnthropicWebSearch({
                model: "claude-haiku-4-5",
                query: "test query",
            });

            // Verify body includes cache_control
            const callArgs = mockFetch.mock.calls[0];
            const body = JSON.parse(callArgs[1].body);

            expect(body.system).toBeDefined();
            expect(Array.isArray(body.system)).toBe(true);
            expect(body.system[0].cache_control).toEqual({ type: "ephemeral" });
        });

        it("places dynamic query in messages, not system", async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    id: "msg_123",
                    model: "claude-haiku-4-5",
                    content: [],
                }),
            });

            const { callAnthropicWebSearch } = await import("@/lib/providers/anthropic");
            const testQuery = "my unique test query";
            await callAnthropicWebSearch({
                model: "claude-haiku-4-5",
                query: testQuery,
            });

            const callArgs = mockFetch.mock.calls[0];
            const body = JSON.parse(callArgs[1].body);

            // System should NOT contain the query
            const systemText = body.system[0].text;
            expect(systemText).not.toContain(testQuery);

            // Messages should contain the query
            expect(body.messages[0].content).toBe(testQuery);
        });

        it("throws error when API key missing", async () => {
            vi.stubEnv("ANTHROPIC_API_KEY", "");

            // Re-import to get fresh module
            vi.resetModules();
            const { callAnthropicWebSearch } = await import("@/lib/providers/anthropic");

            await expect(
                callAnthropicWebSearch({ model: "claude", query: "test" })
            ).rejects.toThrow("ANTHROPIC_API_KEY");
        });
    });
});
