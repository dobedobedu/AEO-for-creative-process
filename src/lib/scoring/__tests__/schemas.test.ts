import { describe, expect, it } from "vitest";
import { getExtractionSchemaForStage } from "../schemas";

describe("getExtractionSchemaForStage", () => {
  it("accepts configured entity categories plus fallback 'other'", () => {
    const schema = getExtractionSchemaForStage("consider", ["features", "pricing"]);
    const parsed = schema.parse({
      mentioned: true,
      responseRelevant: true,
      entitiesMentioned: [
        {
          name: "Transparent pricing",
          category: "pricing",
          sentiment: "positive",
          contextSnippet: "Pricing is clear and predictable.",
        },
        {
          name: "Uncategorized detail",
          category: "other",
          sentiment: "neutral",
          contextSnippet: "Some details did not fit a category.",
        },
      ],
      sentiment: "positive",
      sentimentScore: 0.8,
      strengthsMentioned: ["clear pricing"],
      concernsRaised: [],
      overallPortrayal: "Strong fit for cost-conscious buyers.",
    });

    expect(parsed.entitiesMentioned).toHaveLength(2);
  });

  it("rejects categories not present in tenant-config categories", () => {
    const schema = getExtractionSchemaForStage("explore", ["features"]);
    expect(() =>
      schema.parse({
        mentioned: true,
        responseRelevant: true,
        entitiesMentioned: [
          {
            name: "Premium support",
            category: "support",
            sentiment: "positive",
            contextSnippet: "Support quality is high.",
          },
        ],
        inTopThree: true,
        totalOptionsListed: 3,
        competitors: [],
        howDescribed: "Strong option.",
      })
    ).toThrow("Category must be one of");
  });
});
