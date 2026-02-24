/**
 * Tests for DeepSeek Query Generator
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the OpenRouter call
vi.mock("../../providers/openrouter", () => ({
    callOpenRouter: vi.fn(),
}));

import { generateQueriesFromIntent } from "../queryGenerator";
import { callOpenRouter } from "../../providers/openrouter";
import { getBrandName, getTenantConfig } from "@/lib/config";

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

            expect(result.queries).toHaveLength(3);
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
                intent: "Best schools in the area",
                role: "family_unit",
                queryStyle: 0.75,
                count: 5,
            });

            expect(result.queries.length).toBeGreaterThan(0);
        });
    });

    describe("Prompt Construction", () => {
        it("includes persona description from config", async () => {
            mockedCallOpenRouter.mockResolvedValue('{"queries": ["test"]}');

            // Use a persona that exists in the current config
            const config = getTenantConfig();
            const testPersona = config.personas[0];

            await generateQueriesFromIntent({
                persona: testPersona?.id ?? "retiree",
                stage: "consider",
                intent: "Test intent",
                role: "cpo",
                queryStyle: 0.75,
            });

            const systemPrompt = mockedCallOpenRouter.mock.calls[0][0].messages[0].content;
            // The prompt should contain the persona description from config
            if (testPersona?.description) {
                // Check that some part of the config description appears in the prompt
                const descWords = testPersona.description.split(" ").slice(0, 3).join(" ");
                expect(systemPrompt).toContain(descWords);
            } else {
                // Fallback: generic persona description should be present
                expect(systemPrompt).toContain("buyer");
            }
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
            expect(systemPrompt).toContain("household decision-maker");
        });

        it("Explore stage has no-brand policy", async () => {
            mockedCallOpenRouter.mockResolvedValue('{"queries": ["test"]}');

            const brandName = getBrandName();

            await generateQueriesFromIntent({
                persona: "luxury",
                stage: "explore",
                intent: "Find luxury communities",
                role: "cpo",
                queryStyle: 0.5,
            });

            const systemPrompt = mockedCallOpenRouter.mock.calls[0][0].messages[0].content;
            expect(systemPrompt).toContain(`Do NOT mention ${brandName}`);
        });

        it("Compare stage requires brand comparisons", async () => {
            mockedCallOpenRouter.mockResolvedValue('{"queries": ["test"]}');

            const brandName = getBrandName();

            await generateQueriesFromIntent({
                persona: "retiree",
                stage: "compare",
                intent: "Compare retirement communities",
                role: "cpo",
                queryStyle: 0.75,
            });

            const systemPrompt = mockedCallOpenRouter.mock.calls[0][0].messages[0].content;
            expect(systemPrompt).toContain(`Include ${brandName} explicitly`);
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
