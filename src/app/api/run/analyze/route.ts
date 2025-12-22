import { z } from "zod";
import { sql } from "@/lib/db";
import { callGeminiAnalysis } from "@/lib/providers/geminiAnalysis";
import { upsertInsight } from "@/lib/storage/insightStore";

const RequestSchema = z.object({
  runId: z.string().uuid(),
});

function buildPrompt(params: {
  persona: string;
  stage: string;
  responses: Array<{ query: string; provider: string; model: string; text: string | null }>;
  citations: Array<{ domain: string | null }>
}) {
  const responseLines = params.responses
    .slice(0, 40)
    .map((r, idx) =>
      `${idx + 1}. (${r.provider}/${r.model}) Q: ${r.query}\nA: ${r.text ?? "(no text)"}`
    )
    .join("\n\n");

  const domainCounts = new Map<string, number>();
  for (const c of params.citations) {
    const domain = c.domain ?? "unknown";
    domainCounts.set(domain, (domainCounts.get(domain) ?? 0) + 1);
  }

  const topDomains = Array.from(domainCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([domain, count]) => `${domain}: ${count}`)
    .join("\n");

  return `You are a senior strategy consultant. Analyze AI visibility for Lakewood Ranch.

Persona: ${params.persona}
Stage: ${params.stage}

Top citation domains:\n${topDomains || "(none)"}

Responses (sample):\n${responseLines}

Return JSON matching the required schema. Provide 3-5 charts with labels and series values. Add 3-5 blind spots.`;
}

export async function POST(req: Request) {
  const payload = await req.json();
  const data = RequestSchema.parse(payload);

  const runRows = await sql`
    SELECT id, config_json
    FROM runs
    WHERE id = ${data.runId}
    LIMIT 1;
  `;
  const run = runRows[0];
  if (!run) {
    return Response.json({ error: "Run not found" }, { status: 404 });
  }

  const queries = await sql`
    SELECT id, query_text
    FROM queries
    WHERE run_id = ${data.runId}
    ORDER BY id;
  `;

  const responses = await sql`
    SELECT query_id, provider, model, response_text
    FROM responses
    WHERE run_id = ${data.runId}
    ORDER BY created_at ASC;
  `;

  const citations = await sql`
    SELECT domain
    FROM citations
    WHERE response_id IN (SELECT id FROM responses WHERE run_id = ${data.runId});
  `;

  const queryMap = new Map<string, string>();
  for (const q of queries) {
    queryMap.set(q.id, q.query_text);
  }

  const responseRows = responses.map((r) => ({
    query: queryMap.get(r.query_id) ?? "",
    provider: r.provider,
    model: r.model,
    text: r.response_text,
  }));

  const persona = run.config_json?.personaText ?? "Unknown persona";
  const stage = run.config_json?.triggerStage ?? "unknown";

  const prompt = buildPrompt({
    persona,
    stage,
    responses: responseRows,
    citations,
  });

  const model = process.env.GEMINI_ANALYSIS_MODEL || "models/gemini-3-pro-preview";
  const analysis = await callGeminiAnalysis({ model, prompt });

  await upsertInsight(data.runId, analysis.narrative, analysis.charts);

  return Response.json({
    runId: data.runId,
    analysis,
  });
}
