import { z } from "zod";

const XaiResponseSchema = z.object({
  id: z.string().optional(),
  model: z.string().optional(),
  choices: z.array(z.record(z.any())).optional(),
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

  const searchMode = process.env.XAI_SEARCH_MODE || "auto";
  const maxResults = Number(process.env.XAI_MAX_SEARCH_RESULTS ?? 10) || 10;

  const response = await fetch("https://api.x.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: params.model,
      messages: [
        { role: "user", content: params.query },
      ],
      search_parameters: {
        mode: searchMode,
        return_citations: true,
        max_search_results: maxResults,
      },
      temperature: 0.2,
      max_tokens: 512,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`xAI error ${response.status}: ${errorText}`);
  }

  const json = await response.json();
  return XaiResponseSchema.parse(json);
}
