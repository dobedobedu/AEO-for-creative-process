import { describe, expect, it } from "vitest";
import { parseOpenAIResponse } from "../openaiCitations";

const sample = {
  id: "resp_123",
  output: [
    {
      type: "web_search_call",
      query: "Lakewood Ranch community overview",
    },
    {
      type: "message",
      content: [
        {
          type: "output_text",
          text: "Lakewood Ranch is a master-planned community.",
          annotations: [
            {
              type: "url_citation",
              url: "https://example.com/lakewood-ranch",
              title: "Example Site",
              start_index: 0,
              end_index: 14,
            },
          ],
        },
      ],
    },
  ],
};

describe("parseOpenAIResponse", () => {
  it("extracts text, search query, and citations", () => {
    const result = parseOpenAIResponse(sample);
    expect(result.text).toContain("Lakewood Ranch");
    expect(result.searchQueries).toEqual(["Lakewood Ranch community overview"]);
    expect(result.citations).toHaveLength(1);
    expect(result.citations[0]?.url).toBe("https://example.com/lakewood-ranch");
    expect(result.citations[0]?.domain).toBe("example.com");
    expect(result.citations[0]?.sourceType).toBe("url_citation");
  });
});
