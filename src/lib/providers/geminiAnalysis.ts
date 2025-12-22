import { z } from "zod";

const AnalysisSchema = z.object({
  narrative: z.string(),
  charts: z
    .array(
      z.object({
        title: z.string(),
        type: z.enum(["bar", "line", "stacked", "table"]),
        data: z.object({
          labels: z.array(z.string()),
          series: z.array(
            z.object({
              name: z.string(),
              values: z.array(z.number()),
            })
          ),
        }),
        insight: z.string(),
      })
    )
    .default([]),
  blind_spots: z.array(z.string()).default([]),
});

export type AnalysisResult = z.infer<typeof AnalysisSchema>;

function normalizeModel(model: string): string {
  if (model.startsWith("models/")) return model;
  return `models/${model}`;
}

export async function callGeminiAnalysis(params: {
  model: string;
  prompt: string;
}): Promise<AnalysisResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not set");
  }

  const modelPath = normalizeModel(params.model);
  const url = new URL(`https://generativelanguage.googleapis.com/v1beta/${modelPath}:generateContent`);
  url.searchParams.set("key", apiKey);

  const responseSchema = {
    type: "object",
    properties: {
      narrative: { type: "string" },
      charts: {
        type: "array",
        items: {
          type: "object",
          properties: {
            title: { type: "string" },
            type: { type: "string", enum: ["bar", "line", "stacked", "table"] },
            data: {
              type: "object",
              properties: {
                labels: { type: "array", items: { type: "string" } },
                series: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      name: { type: "string" },
                      values: { type: "array", items: { type: "number" } },
                    },
                    required: ["name", "values"],
                  },
                },
              },
              required: ["labels", "series"],
            },
            insight: { type: "string" },
          },
          required: ["title", "type", "data", "insight"],
        },
      },
      blind_spots: { type: "array", items: { type: "string" } },
    },
    required: ["narrative", "charts", "blind_spots"],
  };

  const body = {
    contents: [
      {
        role: "user",
        parts: [{ text: params.prompt }],
      },
    ],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema,
      temperature: 0.2,
    },
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
    throw new Error(`Gemini analysis error ${response.status}: ${errorText}`);
  }

  const json = await response.json();
  const rawText = json?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!rawText) {
    throw new Error("Gemini analysis returned no content");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    throw new Error("Gemini analysis returned non-JSON output");
  }

  return AnalysisSchema.parse(parsed);
}
