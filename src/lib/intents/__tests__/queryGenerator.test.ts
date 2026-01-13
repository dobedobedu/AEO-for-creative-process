/**
 * Tests for DeepSeek Query Generator
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the OpenRouter call
vi.mock("../../providers/openrouter", () => ({
    callOpenRouter: vi.fn(),
}));

import { generateQueriesFromIntent, type QueryGenerationParams } from "../queryGenerator";
import { callOpenRouter } from "../../providers/openrouter";

const mockedCallOpenRouter = vi.mocked(callOpenRouter);

describe("Query Generator", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe("Output Format", () => {
        it("parses valid JSON response", async () => {
            mockedCallOpenRouter.mockResolvedValue(JSON.stringify({
                queries: ["query 1", "query 2", "query 3", "query 4", "query 5"],
                reasoning: "Test reasoning",
            }));

            const result = await generateQueriesFromIntent({
                persona: "retiree",
                stage: "explore",
                intent: "Find active adult communities",
                role: "cpo",
                queryStyle: 0.75,
            });

            expect(result.queries).toHaveLength(5);
            expect(result.reasoning).toBe("Test reasoning");
        });

        it("handles markdown-wrapped JSON", async () => {
            mockedCallOpenRouter.mockResolvedValue(`\`\`\`json
{
  "queries": ["query 1", "query 2", "query 3"],
  "reasoning": "wrapped"
}
\`\`\``);

            const result = await generateQueriesFromIntent({
                persona: "retiree",
                stage: "explore",
                intent: "Test",
                role: "cpo",
                queryStyle: 0.5,
                count: 3,
            });

            expect(result.queries).toHaveLength(3);
        });

        it("returns fallback on parse error", async () => {
            mockedCallOpenRouter.mockResolvedValue("This is not valid JSON");

            const result = await generateQueriesFromIntent({
                persona: "move_up",
                stage: "consider",
                intent: "Lakewood Ranch schools",
                role: "family_unit",
                queryStyle: 0.75,
                count: 5,
            });

            expect(result.queries.length).toBeGreaterThan(0);
        });
    });

    describe("Prompt Construction", () => {
        it("includes persona description", async () => {
            mockedCallOpenRouter.mockResolvedValue('{"queries": ["test"]}');

            await generateQueriesFromIntent({
                persona: "retiree",
                stage: "consider",
                intent: "Test intent",
                role: "cpo",
                queryStyle: 0.75,
            });

            const systemPrompt = mockedCallOpenRouter.mock.calls[0][0].messages[0].content;
            expect(systemPrompt).toContain("55+");
            expect(systemPrompt).toContain("active adult");
        });

        it("includes role descriptor", async () => {
            mockedCallOpenRouter.mockResolvedValue('{"queries": ["test"]}');

            await generateQueriesFromIntent({
                persona: "first_time",
                stage: "explore",
                intent: "Test",
                role: "family_unit",
                queryStyle: 0.75,
            });

            const systemPrompt = mockedCallOpenRouter.mock.calls[0][0].messages[0].content;
            expect(systemPrompt).toContain("family unit");
        });

        it("Explore stage has no-brand policy", async () => {
            mockedCallOpenRouter.mockResolvedValue('{"queries": ["test"]}');

            await generateQueriesFromIntent({
                persona: "luxury",
                stage: "explore",
                intent: "Find luxury communities",
                role: "cpo",
                queryStyle: 0.5,
            });

            const systemPrompt = mockedCallOpenRouter.mock.calls[0][0].messages[0].content;
            expect(systemPrompt).toContain("Do NOT mention Lakewood Ranch");
        });

        it("Compare stage requires brand comparisons", async () => {
            mockedCallOpenRouter.mockResolvedValue('{"queries": ["test"]}');

            await generateQueriesFromIntent({
                persona: "retiree",
                stage: "compare",
                intent: "Compare retirement communities",
                role: "cpo",
                queryStyle: 0.75,
            });

            const systemPrompt = mockedCallOpenRouter.mock.calls[0][0].messages[0].content;
            expect(systemPrompt).toContain("Include Lakewood Ranch explicitly");
        });
    });

    describe("Query Style (Temperature)", () => {
        it("Common style (0.5) uses low temperature", async () => {
            mockedCallOpenRouter.mockResolvedValue('{"queries": ["test"]}');

            await generateQueriesFromIntent({
                persona: "first_time",
                stage: "explore",
                intent: "First home",
                role: "cpo",
                queryStyle: 0.5,
            });

            const callArgs = mockedCallOpenRouter.mock.calls[0][0];
            expect(callArgs.temperature).toBe(0.5);
        });

        it("Niche style (1.0) uses high temperature", async () => {
            mockedCallOpenRouter.mockResolvedValue('{"queries": ["test"]}');

            await generateQueriesFromIntent({
                persona: "luxury",
                stage: "consider",
                intent: "Luxury homes",
                role: "family_unit",
                queryStyle: 1.0,
            });

            const callArgs = mockedCallOpenRouter.mock.calls[0][0];
            expect(callArgs.temperature).toBe(1.0);
        });
    });
});
