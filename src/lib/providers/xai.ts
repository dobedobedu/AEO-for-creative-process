import { z } from "zod";

// Agent Tools API response schema (replaces deprecated Live Search API)
// See: https://docs.x.ai/docs/guides/tools/search-tools

// Content item within a message block (new Responses API format)
const XaiContentItemSchema = z.object({
  type: z.string(),
  text: z.string().optional(),
  annotations: z.array(z.object({
    type: z.string(),
    url: z.string().optional(),
    title: z.string().optional(),
    start_index: z.number().optional(),
    end_index: z.number().optional(),
  })).optional(),
});

// Output block — can be message, web_search_call, text, etc.
const XaiOutputBlockSchema = z.object({
  type: z.string(),
  // Old format: content as string; New format: content as array of items
  content: z.union([z.string(), z.array(XaiContentItemSchema)]).optional(),
  text: z.string().optional(),
  role: z.string().optional(),
  status: z.string().optional(),
}).passthrough();

const XaiResponseSchema = z.object({
  id: z.string().optional(),
  model: z.string().optional(),
  output: z.array(XaiOutputBlockSchema).optional(),
  citations: z.array(z.string()).optional(),
});

export type XaiResponse = z.infer<typeof XaiResponseSchema>;
export type XaiContentItem = z.infer<typeof XaiContentItemSchema>;

export type XaiSearchMode = "x_search" | "web_search";

export async function callXaiSearch(params: {
  model: string;
  query: string;
  searchMode: XaiSearchMode;
}): Promise<XaiResponse> {
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) {
    throw new Error("XAI_API_KEY is not set");
  }

  const toolType = params.searchMode === "x_search" ? "x_search" : "web_search";

  // Agent Tools API - /v1/responses endpoint with search tools
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
      tools: [{ type: toolType }],
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
  console.log("[xai] Raw response keys:", Object.keys(json));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  console.log("[xai] Output block types:", json.output?.map((b: any) => b.type));
  console.log("[xai] Citations count:", json.citations?.length ?? 0);
  // Log first output block structure for debugging format changes
  if (json.output?.[0]) {
    const first = json.output[0];
    console.log("[xai] First output block:", JSON.stringify({
      type: first.type,
      contentType: typeof first.content,
      contentIsArray: Array.isArray(first.content),
      hasText: !!first.text,
      role: first.role,
    }));
  }
  // Log the message block specifically
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const msgBlock = json.output?.find((b: any) => b.type === "message");
  if (msgBlock) {
    console.log("[xai] Message block content sample:", JSON.stringify(msgBlock.content)?.slice(0, 300));
  } else {
    console.log("[xai] No message block found. Full output:", JSON.stringify(json.output)?.slice(0, 500));
  }
  return XaiResponseSchema.parse(json);
}
