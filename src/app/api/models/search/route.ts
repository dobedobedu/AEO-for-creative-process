import { getDefaultSearchModels } from "@/lib/models/searchModels";

export async function GET() {
  const defaultConcurrency = 4;
  const openaiConcurrency = Number(process.env.OPENAI_CONCURRENCY ?? defaultConcurrency) || defaultConcurrency;
  const geminiConcurrency = Number(process.env.GEMINI_CONCURRENCY ?? defaultConcurrency) || defaultConcurrency;
  const anthropicConcurrency = Number(process.env.ANTHROPIC_CONCURRENCY ?? defaultConcurrency) || defaultConcurrency;

  return Response.json({
    models: getDefaultSearchModels(),
    concurrency: {
      openai: Math.min(Math.max(openaiConcurrency, 3), 5),
      gemini: Math.min(Math.max(geminiConcurrency, 3), 5),
      anthropic: Math.min(Math.max(anthropicConcurrency, 3), 5),
    },
  });
}
