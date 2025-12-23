import { getDefaultSearchModels } from "@/lib/models/searchModels";

export async function GET() {
  return Response.json({
    models: getDefaultSearchModels(),
    concurrency: {
      openai: 1,
      gemini: 1,
    },
  });
}
