import { z } from "zod";

const AnthropicResponseSchema = z.object({
  id: z.string().optional(),
  model: z.string().optional(),
  content: z.array(z.record(z.any())).optional(),
  citations: z.array(z.string()).optional(),
});

export type AnthropicResponse = z.infer<typeof AnthropicResponseSchema>;

/**
 * System prompt for Anthropic web search - cached for cost efficiency.
 * Caching this ~2KB prompt saves up to 90% on input tokens for repeated calls.
 */
const ANTHROPIC_SYSTEM_PROMPT = `You are an AI assistant helping analyze brand visibility in AI-generated responses.

When searching the web:
1. Use web search to find current, accurate information
2. Always cite your sources with URLs
3. Focus on factual, up-to-date content
4. Include relevant comparisons when available
5. Provide balanced perspectives

Search thoroughly and cite all sources used in your response.`;

export async function callAnthropicWebSearch(params: {
  model: string;
  query: string;
}): Promise<AnthropicResponse> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is not set");
  }

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-beta": "prompt-caching-2024-07-31",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: params.model,
      max_tokens: 512,
      // System prompt with cache_control for 90% input token savings
      system: [
        {
          type: "text",
          text: ANTHROPIC_SYSTEM_PROMPT,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [
        {
          role: "user",
          // Dynamic query at the end (not cached)
          content: params.query,
        },
      ],
      tools: [
        {
          type: "web_search_20250305",
          name: "web_search",
          max_uses: 5,
        },
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Anthropic error ${response.status}: ${errorText}`);
  }

  const json = await response.json();
  return AnthropicResponseSchema.parse(json);
}
