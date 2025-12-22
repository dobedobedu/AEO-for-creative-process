import { z } from "zod";

const OpenAIResponseSchema = z.object({
  id: z.string().optional(),
  output: z.array(z.record(z.any())).optional(),
});

export type OpenAIResponse = z.infer<typeof OpenAIResponseSchema>;

export async function callOpenAIWebSearch(params: {
  model: string;
  query: string;
}): Promise<OpenAIResponse> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not set");
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };

  if (process.env.OPENAI_ORG_ID) {
    headers["OpenAI-Organization"] = process.env.OPENAI_ORG_ID;
  }
  if (process.env.OPENAI_PROJECT_ID) {
    headers["OpenAI-Project"] = process.env.OPENAI_PROJECT_ID;
  }

  const body = {
    model: params.model,
    input: params.query,
    tools: [{ type: "web_search" }],
    tool_choice: "required",
  };

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI error ${response.status}: ${errorText}`);
  }

  const json = await response.json();
  return OpenAIResponseSchema.parse(json);
}
