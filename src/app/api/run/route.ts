import { z } from "zod";
import { createRunWithQueries } from "@/lib/storage/runStore";

const RequestSchema = z.object({
  personaText: z.string().min(1),
  personaName: z.string().optional(),
  triggerStage: z.enum(["explore", "consider", "compare"]),
  queries: z.array(z.string().min(1)).min(1),
  config: z.record(z.any()).optional(),
});

export async function POST(req: Request) {
  const payload = await req.json();
  const data = RequestSchema.parse(payload);

  const result = await createRunWithQueries({
    personaText: data.personaText,
    personaName: data.personaName,
    triggerStage: data.triggerStage,
    queries: data.queries,
    config: data.config,
  });

  return Response.json(result);
}
