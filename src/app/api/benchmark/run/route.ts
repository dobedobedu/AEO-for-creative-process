import { z } from "zod";
import { runBenchmark, type Provider } from "@/lib/benchmark";

const RequestSchema = z.object({
  queries: z.array(z.string().min(1)).min(1).max(10),
  brand: z.string().min(1),
  brandAliases: z.array(z.string()).optional(),
  providers: z
    .array(
      z.object({
        provider: z.enum(["openai", "anthropic", "gemini", "xai"]),
        model: z.string().min(1),
      })
    )
    .optional(),
});

const DEFAULT_PROVIDERS: Array<{ provider: Provider; model: string }> = [
  { provider: "openai", model: "gpt-5.2" },
  { provider: "anthropic", model: "claude-haiku-4-5" },
  { provider: "gemini", model: "gemini-3-flash-preview" },
  { provider: "xai", model: "grok-4-latest" },
];

export async function POST(req: Request) {
  try {
    const payload = await req.json();
    const data = RequestSchema.parse(payload);

    const providers = data.providers ?? DEFAULT_PROVIDERS;

    const result = await runBenchmark({
      queries: data.queries,
      brand: data.brand,
      brandAliases: data.brandAliases,
      providers,
      concurrency: 2,
    });

    return Response.json(result);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return Response.json({ error: "Invalid request", details: err.errors }, { status: 400 });
    }
    return Response.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
