import { z } from "zod";

const AnthropicResponseSchema = z.object({
  id: z.string().optional(),
  model: z.string().optional(),
  content: z.array(z.record(z.any())).optional(),
  citations: z.array(z.string()).optional(),
});

export type AnthropicResponse = z.infer<typeof AnthropicResponseSchema>;

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
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: params.model,
      max_tokens: 512,
      messages: [
        {
          role: "user",
          content: `Use web search and cite sources. ${params.query}`,
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
