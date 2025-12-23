import { describe, expect, it } from "vitest";
import { buildAnalysisInput } from "../normalize";

describe("buildAnalysisInput", () => {
  it("computes provider and domain metrics", () => {
    const input = buildAnalysisInput({
      persona: "Test persona",
      stage: "discover",
      queries: [
        { id: "q1", query_text: "Lakewood Ranch amenities" },
        { id: "q2", query_text: "Compare Lakewood Ranch vs Sarasota" },
      ],
      responses: [
        {
          id: "r1",
          query_id: "q1",
          provider: "openai",
          model: "gpt-5-mini",
          response_text: "Answer 1",
        },
        {
          id: "r2",
          query_id: "q2",
          provider: "gemini",
          model: "gemini-3-flash",
          response_text: "Answer 2",
        },
      ],
      citations: [
        {
          response_id: "r1",
          provider: "openai",
          url: "https://www.lakewoodranch.com/amenities",
          domain: "lakewoodranch.com",
          title: "Amenities",
          source_type: "url_citation",
        },
        {
          response_id: "r1",
          provider: "openai",
          url: "https://example.com/guide",
          domain: "example.com",
          title: "Guide",
          source_type: "url_citation",
        },
        {
          response_id: "r2",
          provider: "gemini",
          url: "https://example.com/compare",
          domain: "example.com",
          title: "Compare",
          source_type: "grounding_chunk",
        },
      ],
    });

    expect(input.summary.total_responses).toBe(2);
    expect(input.summary.total_citations).toBe(3);
    expect(input.summary.unique_domains).toBe(2);
    expect(input.summary.lakewoodranch_citations).toBe(1);
    expect(input.summary.citations_by_provider).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ provider: "openai", count: 2, unique_domains: 2 }),
        expect.objectContaining({ provider: "gemini", count: 1, unique_domains: 1 }),
      ])
    );
    expect(input.model_breakdown).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ provider: "openai", model: "gpt-5-mini", response_count: 1, citation_count: 2 }),
        expect.objectContaining({ provider: "gemini", model: "gemini-3-flash", response_count: 1, citation_count: 1 }),
      ])
    );
  });
});
