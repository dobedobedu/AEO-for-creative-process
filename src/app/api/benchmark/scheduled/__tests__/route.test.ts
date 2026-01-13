/**
 * Integration tests for Scheduled Benchmark Endpoint
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock external dependencies
vi.mock("@/lib/intents/library", () => ({
    loadIntentLibrary: vi.fn(() => ({
        version: 1,
        intents: [
            {
                id: "test-intent-1",
                persona: "retiree",
                stage: "explore",
                text: "Test intent",
                role: "cpo",
                queryStyle: 0.75,
                active: true,
                createdAt: "2024-01-01",
            },
        ],
        history: [],
    })),
}));

vi.mock("@/lib/intents/queryGenerator", () => ({
    generateQueriesFromIntent: vi.fn(() => Promise.resolve({
        queries: ["test query 1", "test query 2"],
        reasoning: "test reasoning",
    })),
}));

vi.mock("@/lib/metrics/config", () => ({
    loadMetricsConfig: vi.fn(() => ({ version: 1 })),
}));

vi.mock("@/lib/runs/storage", () => ({
    saveRun: vi.fn(),
    generateRunId: vi.fn(() => "test-run-id"),
}));

vi.mock("@/lib/filesearch/uploader", () => ({
    uploadRunAsync: vi.fn(),
}));

vi.mock("@/lib/benchmark", () => ({
    runBenchmark: vi.fn(() => Promise.resolve({
        queries: [{
            query: "test query 1",
            intentId: "test-intent-1",
            responses: [{
                provider: "openai",
                model: "gpt-5.2",
                text: "Test response",
                citations: [],
                visibility: { score: 0.5, mentioned: true },
                stageExtraction: {
                    mentioned: true,
                    responseRelevant: true,
                    inTopThree: true,
                    totalOptionsListed: 5,
                    competitors: [],
                    howDescribed: "positive",
                },
                latencyMs: 100,
                raw: {},
            }],
        }],
        summary: {
            totalQueries: 1,
            providersUsed: ["openai"],
            brandMentionRate: { openai: 1 },
            avgVisibilityScore: { openai: 0.5 },
            executionTimeMs: 100,
        },
    })),
}));

describe("scheduled benchmark endpoint", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("should be accessible via GET", async () => {
        // The scheduled endpoint responds to GET requests
        const { GET } = await import("@/app/api/benchmark/scheduled/route");
        expect(typeof GET).toBe("function");
    });

    it("handles missing CRON_SECRET gracefully", async () => {
        vi.stubEnv("CRON_SECRET", "");
        const { GET } = await import("@/app/api/benchmark/scheduled/route");

        const mockRequest = new Request("http://localhost/api/benchmark/scheduled", {
            method: "GET",
        });

        const response = await GET(mockRequest);
        const data = await response.json();

        // Should succeed when no secret is configured
        expect(data.success).toBe(true);
    });

    it("returns 401 when CRON_SECRET is set but not provided", async () => {
        vi.stubEnv("CRON_SECRET", "my-secret");
        vi.resetModules();
        const { GET } = await import("@/app/api/benchmark/scheduled/route");

        const mockRequest = new Request("http://localhost/api/benchmark/scheduled", {
            method: "GET",
        });

        const response = await GET(mockRequest);
        expect(response.status).toBe(401);
    });

    it("returns success with valid authorization", async () => {
        vi.stubEnv("CRON_SECRET", "my-secret");
        vi.resetModules();
        const { GET } = await import("@/app/api/benchmark/scheduled/route");

        const mockRequest = new Request("http://localhost/api/benchmark/scheduled", {
            method: "GET",
            headers: {
                authorization: "Bearer my-secret",
            },
        });

        const response = await GET(mockRequest);
        const data = await response.json();

        expect(data.success).toBe(true);
        expect(data.runId).toBe("test-run-id");
        expect(data.cellsProcessed).toBeGreaterThan(0);
        expect(data.executionTimeMs).toBeDefined();
    });
});
