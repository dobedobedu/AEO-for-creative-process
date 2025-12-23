import { z } from "zod";

const AnalysisSchema = z.object({
  narrative: z.string(),
  citation_summary: z.object({
    total_citations: z.number(),
    unique_domains: z.number(),
    lakewoodranch_citations: z.number(),
    lakewoodranch_share: z.number(),
    top_domains: z
      .array(
        z.object({
          domain: z.string(),
          count: z.number(),
        })
      )
      .default([]),
    citations_by_provider: z
      .array(
        z.object({
          provider: z.string(),
          count: z.number(),
          unique_domains: z.number(),
        })
      )
      .default([]),
  }),
  model_breakdown: z
    .array(
      z.object({
        provider: z.string(),
        model: z.string(),
        response_count: z.number(),
        citation_count: z.number(),
        unique_domains: z.number(),
        top_domains: z
          .array(
            z.object({
              domain: z.string(),
              count: z.number(),
            })
          )
          .default([]),
      })
    )
    .default([]),
  insight_cards: z
    .array(
      z.object({
        title: z.string(),
        type: z.enum([
          "authority",
          "pros_cons",
          "alternatives",
          "positioning",
          "recency",
          "source_gaps",
          "message_mismatch",
          "evidence_quality",
          "opportunity_targets",
          "other",
        ]),
        evidence: z.array(z.string()).default([]),
        recommendations: z.array(z.string()).default([]),
        supporting_citations: z
          .array(
            z.object({
              url: z.string().optional(),
              domain: z.string().optional(),
            })
          )
          .default([]),
      })
    )
    .default([]),
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

export type AnalysisWithThoughts = AnalysisResult & {
  thought_summaries: string[];
};

function normalizeModel(model: string): string {
  if (model.startsWith("models/")) return model;
  return `models/${model}`;
}

export async function callGeminiAnalysis(params: {
  model: string;
  prompt: string;
  thinkingLevel?: "minimal" | "low" | "medium" | "high";
  includeThoughts?: boolean;
}): Promise<AnalysisWithThoughts> {
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
      citation_summary: {
        type: "object",
        properties: {
          total_citations: { type: "number" },
          unique_domains: { type: "number" },
          lakewoodranch_citations: { type: "number" },
          lakewoodranch_share: { type: "number" },
          top_domains: {
            type: "array",
            items: {
              type: "object",
              properties: {
                domain: { type: "string" },
                count: { type: "number" },
              },
              required: ["domain", "count"],
            },
          },
          citations_by_provider: {
            type: "array",
            items: {
              type: "object",
              properties: {
                provider: { type: "string" },
                count: { type: "number" },
                unique_domains: { type: "number" },
              },
              required: ["provider", "count", "unique_domains"],
            },
          },
        },
        required: [
          "total_citations",
          "unique_domains",
          "lakewoodranch_citations",
          "lakewoodranch_share",
          "top_domains",
          "citations_by_provider",
        ],
      },
      model_breakdown: {
        type: "array",
        items: {
          type: "object",
          properties: {
            provider: { type: "string" },
            model: { type: "string" },
            response_count: { type: "number" },
            citation_count: { type: "number" },
            unique_domains: { type: "number" },
            top_domains: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  domain: { type: "string" },
                  count: { type: "number" },
                },
                required: ["domain", "count"],
              },
            },
          },
          required: [
            "provider",
            "model",
            "response_count",
            "citation_count",
            "unique_domains",
            "top_domains",
          ],
        },
      },
      insight_cards: {
        type: "array",
        items: {
          type: "object",
          properties: {
            title: { type: "string" },
            type: {
              type: "string",
              enum: [
                "authority",
                "pros_cons",
                "alternatives",
                "positioning",
                "recency",
                "source_gaps",
                "message_mismatch",
                "evidence_quality",
                "opportunity_targets",
                "other",
              ],
            },
            evidence: { type: "array", items: { type: "string" } },
            recommendations: { type: "array", items: { type: "string" } },
            supporting_citations: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  url: { type: "string" },
                  domain: { type: "string" },
                },
              },
            },
          },
          required: ["title", "type", "evidence", "recommendations", "supporting_citations"],
        },
      },
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
    required: ["narrative", "citation_summary", "model_breakdown", "insight_cards", "charts", "blind_spots"],
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
      thinkingConfig: {
        thinkingLevel: params.thinkingLevel,
        includeThoughts: params.includeThoughts ?? false,
      },
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
  const parts = json?.candidates?.[0]?.content?.parts ?? [];
  const thoughtSummaries: string[] = [];
  const answerParts: string[] = [];

  for (const part of parts) {
    if (typeof part?.text !== "string") continue;
    if (part?.thought) {
      thoughtSummaries.push(part.text);
    } else {
      answerParts.push(part.text);
    }
  }

  const rawText = answerParts.join("\n").trim();
  if (!rawText) {
    throw new Error("Gemini analysis returned no content");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    throw new Error("Gemini analysis returned non-JSON output");
  }

  const parsedResult = AnalysisSchema.parse(parsed);
  return { ...parsedResult, thought_summaries: thoughtSummaries };
}
