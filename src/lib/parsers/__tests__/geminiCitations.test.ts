import { describe, expect, it } from "vitest";
import { parseGeminiResponse } from "../geminiCitations";

const sample = {
  candidates: [
    {
      content: {
        parts: [{ text: "Lakewood Ranch is known for its amenities." }],
      },
      groundingMetadata: {
        webSearchQueries: ["Lakewood Ranch amenities"],
        groundingChunks: [
          {
            web: {
              uri: "https://example.org/amenities",
              title: "Amenities Overview",
            },
          },
        ],
        groundingSupports: [
          {
            segment: { startIndex: 0, endIndex: 15, text: "Lakewood Ranch" },
            groundingChunkIndices: [0],
          },
        ],
      },
    },
  ],
};

describe("parseGeminiResponse", () => {
  it("extracts text, search query, and citations", () => {
    const result = parseGeminiResponse(sample);
    expect(result.text).toContain("Lakewood Ranch");
    expect(result.searchQueries).toEqual(["Lakewood Ranch amenities"]);
    expect(result.citations).toHaveLength(1);
    expect(result.citations[0]?.url).toBe("https://example.org/amenities");
    expect(result.citations[0]?.domain).toBe("example.org");
    expect(result.citations[0]?.sourceType).toBe("grounding_chunk");
  });
});
