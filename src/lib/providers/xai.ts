import { z } from "zod";

// Agent Tools API response schema (replaces deprecated Live Search API)
// See: https://docs.x.ai/docs/guides/tools/search-tools
const XaiOutputBlockSchema = z.object({
  type: z.string(),
  content: z.string().optional(),
});

const XaiResponseSchema = z.object({
  id: z.string().optional(),
  model: z.string().optional(),
  output: z.array(XaiOutputBlockSchema).optional(),
  citations: z.array(z.string()).optional(),
});

export type XaiResponse = z.infer<typeof XaiResponseSchema>;

export async function callXaiSearch(params: {
  model: string;
  query: string;
}): Promise<XaiResponse> {
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) {
    throw new Error("XAI_API_KEY is not set");
  }

  // Agent Tools API - /v1/responses endpoint with web_search tool
  // Replaces deprecated search_parameters on /v1/chat/completions (deprecated Jan 12, 2026)
  const response = await fetch("https://api.x.ai/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: params.model,
      input: [
        { role: "user", content: params.query },
      ],
      tools: [{ type: "web_search" }],
      include: ["inline_citations"],
      temperature: 0.2,
      max_output_tokens: 512,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`xAI error ${response.status}: ${errorText}`);
  }

  const json = await response.json();
  return XaiResponseSchema.parse(json);
}
