/**
 * LLM-based position extraction for accurate brand ranking detection
 */

import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateObject } from "ai";
import { z } from "zod";

const google = createGoogleGenerativeAI({
  apiKey: process.env.GEMINI_API_KEY,
});

const PositionSchema = z.object({
  position: z.enum(["1st", "2nd", "3rd", "later", "absent"]).describe(
    "Where the brand appears relative to other communities/options mentioned"
  ),
  confidence: z.enum(["high", "medium", "low"]).describe(
    "Confidence in the position assessment"
  ),
  reasoning: z.string().describe(
    "Brief explanation of why this position was assigned"
  ),
});

export type PositionResult = z.infer<typeof PositionSchema>;

/**
 * Use LLM to accurately determine brand position in AI response
 */
export async function extractPositionWithLLM(
  responseText: string,
  brand: string,
  brandAliases: string[] = []
): Promise<PositionResult> {
  const brandTerms = [brand, ...brandAliases].join(", ");
  
  try {
    const result = await generateObject({
      model: google("gemini-3-flash-preview"),
      schema: PositionSchema,
      prompt: `Analyze this AI response about Florida communities/real estate and determine where "${brand}" (also known as: ${brandTerms}) appears in the ranking or list of recommendations.

RESPONSE TO ANALYZE:
${responseText}

INSTRUCTIONS:
1. If the brand is NOT mentioned at all, position is "absent"
2. If the brand is the FIRST community/option mentioned or recommended, position is "1st"
3. If ONE other community is mentioned before the brand, position is "2nd"
4. If TWO other communities are mentioned before the brand, position is "3rd"
5. If THREE or more communities are mentioned before the brand, position is "later"

Consider the semantic structure - being mentioned in a list of "communities from X to Y" where the brand is at the end counts as "later", not "1st".

Be accurate - count actual community/development names mentioned before the brand.`,
    });

    return result.object;
  } catch (error) {
    console.error("Position extraction failed:", error);
    // Fallback to text-position heuristic
    return fallbackPositionDetection(responseText, brand, brandAliases);
  }
}

/**
 * Fallback: Use text position percentage when LLM fails
 */
function fallbackPositionDetection(
  text: string,
  brand: string,
  aliases: string[]
): PositionResult {
  const lowerText = text.toLowerCase();
  const allTerms = [brand, ...aliases];
  
  let firstPos = -1;
  for (const term of allTerms) {
    const pos = lowerText.indexOf(term.toLowerCase());
    if (pos !== -1 && (firstPos === -1 || pos < firstPos)) {
      firstPos = pos;
    }
  }
  
  if (firstPos === -1) {
    return {
      position: "absent",
      confidence: "high",
      reasoning: "Brand not found in response text",
    };
  }
  
  const percentPosition = firstPos / text.length;
  
  let position: PositionResult["position"];
  if (percentPosition < 0.15) {
    position = "1st";
  } else if (percentPosition < 0.30) {
    position = "2nd";
  } else if (percentPosition < 0.50) {
    position = "3rd";
  } else {
    position = "later";
  }
  
  return {
    position,
    confidence: "low",
    reasoning: `Fallback: Brand appears at ${(percentPosition * 100).toFixed(0)}% into the text`,
  };
}

/**
 * Batch extract positions for multiple responses (more efficient)
 */
export async function extractPositionsBatch(
  responses: Array<{ text: string; id: string }>,
  brand: string,
  brandAliases: string[] = []
): Promise<Map<string, PositionResult>> {
  const results = new Map<string, PositionResult>();
  
  // Process in parallel with concurrency limit
  const batchSize = 5;
  for (let i = 0; i < responses.length; i += batchSize) {
    const batch = responses.slice(i, i + batchSize);
    const promises = batch.map(async (r) => {
      const result = await extractPositionWithLLM(r.text, brand, brandAliases);
      return { id: r.id, result };
    });
    
    const batchResults = await Promise.all(promises);
    for (const { id, result } of batchResults) {
      results.set(id, result);
    }
  }
  
  return results;
}
