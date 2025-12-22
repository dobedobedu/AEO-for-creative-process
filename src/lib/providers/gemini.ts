import { z } from "zod";

const GeminiResponseSchema = z.object({
  responseId: z.string().optional(),
  candidates: z.array(z.record(z.any())).optional(),
  groundingMetadata: z.record(z.any()).optional(),
});

export type GeminiResponse = z.infer<typeof GeminiResponseSchema>;

function normalizeModel(model: string): string {
  if (model.startsWith("models/")) return model;
  return `models/${model}`;
}

export async function callGeminiWebSearch(params: {
  model: string;
  query: string;
}): Promise<GeminiResponse> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not set");
  }

  const modelPath = normalizeModel(params.model);
  const url = new URL(`https://generativelanguage.googleapis.com/v1beta/${modelPath}:generateContent`);
  url.searchParams.set("key", apiKey);

  const body = {
    contents: [
      {
        role: "user",
        parts: [{ text: params.query }],
      },
    ],
    tools: [{ google_search: {} }],
  };

  const response = await fetch(url.toString(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini error ${response.status}: ${errorText}`);
  }

  const json = await response.json();
  return GeminiResponseSchema.parse(json);
}
