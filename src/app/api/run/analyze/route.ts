import { z } from "zod";
import { query, sql } from "@/lib/db";
import { callGeminiAnalysis } from "@/lib/providers/geminiAnalysis";
import { buildAnalysisInput } from "@/lib/analysis/normalize";
import { upsertInsight, saveAnalyses } from "@/lib/storage/insightStore";
import { getPrompt } from "@/lib/config/prompts";
import { getBrandName } from "@/lib/config";

const RequestSchema = z.object({
  runId: z.string().uuid(),
  responseIds: z.array(z.string().uuid()).optional(),
});

type ResponseRow = {
  id: string;
  query_id: string;
  provider: string;
  model: string;
  response_text: string | null;
};

type QueryRow = {
  id: string;
  query_text: string;
};

type CitationRow = {
  response_id: string | null;
  provider: string | null;
  url: string | null;
  domain: string | null;
  title: string | null;
  source_type: string | null;
};

function buildConsultantPrompt(payload: ReturnType<typeof buildAnalysisInput>) {
  const brand = getBrandName();
  const payloadJson = JSON.stringify(payload);

  // Try loading from template system first
  const templatePrompt = getPrompt("analysis", "consultant", { payload: payloadJson });
  if (templatePrompt) return templatePrompt;

  // Fallback inline prompt if template file is missing
  return `You are a senior strategy consultant. Analyze AI visibility for ${brand}.
Focus on: source authority, top topics, pros/cons, alternatives, recency, evidence quality, and stage-specific insights.

Input JSON:\n${payloadJson}

Return JSON matching the required schema:
- Provide 3-5 charts with labels and series values.
- Copy citation_summary and model_breakdown from the input; do NOT recompute them.
- Provide 3-6 insight_cards (use evidence + recommendations).
- Add 3-5 blind spots.`;
}

function buildHypothesisPrompt(payload: ReturnType<typeof buildAnalysisInput>) {
  const brand = getBrandName();
  const payloadJson = JSON.stringify(payload);

  // Try loading from template system first
  const templatePrompt = getPrompt("analysis", "hypothesis", { payload: payloadJson });
  if (templatePrompt) return templatePrompt;

  // Fallback inline prompt if template file is missing
  return `You analyze LLM search and recommendation behavior across models.
Do NOT mention ${brand} or any specific brand/community. Use generic terms like "the community" or "the target market."

Input JSON:\n${payloadJson}

Return JSON matching the required schema, but focus on falsifiable hypotheses:
- Provide 3-5 hypotheses as insight_cards (type "other").
- Each insight_card should include evidence bullets and how to test the hypothesis.
- Charts can be empty.
- Copy citation_summary and model_breakdown from the input; do NOT recompute them.
- Keep the narrative concise and generic.`;
}

export async function POST(req: Request) {
  const payload = await req.json();
  const data = RequestSchema.parse(payload);
  const responseIds = data.responseIds?.filter(Boolean);

  const runRows = await sql`
    SELECT id, config_json
    FROM runs
    WHERE id = ${data.runId}
    LIMIT 1;
  ` as Array<{ id: string; config_json: Record<string, unknown> | null }>;
  const run = runRows[0];
  if (!run) {
    return Response.json({ error: "Run not found" }, { status: 404 });
  }

  const queries = await query<QueryRow>`
    SELECT id, query_text
    FROM queries
    WHERE run_id = ${data.runId}
    ORDER BY id;
  `;

  const responses =
    responseIds && responseIds.length > 0
      ? await query<ResponseRow>`
          SELECT id, query_id, provider, model, response_text
          FROM responses
          WHERE run_id = ${data.runId}
          AND id = ANY(${sql.array(responseIds, 2950)})
          ORDER BY created_at ASC;
        `
      : await query<ResponseRow>`
          SELECT id, query_id, provider, model, response_text
          FROM responses
          WHERE run_id = ${data.runId}
          ORDER BY created_at ASC;
        `;

  const citations =
    responseIds && responseIds.length > 0
      ? await query<CitationRow>`
          SELECT response_id, provider, url, domain, title, source_type
          FROM citations
          WHERE response_id = ANY(${sql.array(responseIds, 2950)});
        `
      : await query<CitationRow>`
          SELECT response_id, provider, url, domain, title, source_type
          FROM citations
          WHERE response_id IN (SELECT id FROM responses WHERE run_id = ${data.runId});
        `;

  const queryMap = new Map<string, string>();
  for (const q of queries) {
    queryMap.set(q.id, q.query_text);
  }

  const config = (run.config_json ?? {}) as {
    personaText?: string;
    triggerStage?: string;
    triggers?: string[];
  };
  const persona = config.personaText ?? "Unknown persona";
  const stage = config.triggerStage ?? "unknown";
  const triggers = Array.isArray(config.triggers) ? config.triggers : [];

  const analysisInput = buildAnalysisInput({
    persona,
    stage,
    triggers,
    responses,
    citations,
    queries,
  });

  const computedCitationSummary = {
    total_citations: analysisInput.summary.total_citations,
    unique_domains: analysisInput.summary.unique_domains,
    lakewoodranch_citations: analysisInput.summary.lakewoodranch_citations,
    lakewoodranch_share: analysisInput.summary.lakewoodranch_share,
    top_domains: analysisInput.summary.top_domains,
    citations_by_provider: analysisInput.summary.citations_by_provider,
  };

  const computedModelBreakdown = analysisInput.model_breakdown;

  const flashModel =
    process.env.GEMINI_ANALYSIS_MODEL_FLASH || "models/gemini-3-flash-preview";
  const proModel = process.env.GEMINI_ANALYSIS_MODEL || "models/gemini-3-pro-preview";

  const variants = [
    {
      key: "flash_consultant",
      model: flashModel,
      thinkingLevel: "medium" as const,
      analysisKind: "consultant" as const,
      prompt: buildConsultantPrompt(analysisInput),
    },
    {
      key: "flash_hypothesis",
      model: flashModel,
      thinkingLevel: "medium" as const,
      analysisKind: "hypothesis" as const,
      prompt: buildHypothesisPrompt(analysisInput),
    },
    {
      key: "pro_consultant",
      model: proModel,
      thinkingLevel: "high" as const,
      analysisKind: "consultant" as const,
      prompt: buildConsultantPrompt(analysisInput),
    },
    {
      key: "pro_hypothesis",
      model: proModel,
      thinkingLevel: "high" as const,
      analysisKind: "hypothesis" as const,
      prompt: buildHypothesisPrompt(analysisInput),
    },
  ];

  const analyses = [];
  for (const variant of variants) {
    const result = await callGeminiAnalysis({
      model: variant.model,
      prompt: variant.prompt,
      thinkingLevel: variant.thinkingLevel,
      includeThoughts: true,
    });

    const safeResult = {
      ...result,
      citation_summary: computedCitationSummary,
      model_breakdown: computedModelBreakdown,
    };

    analyses.push({
      key: variant.key,
      model: variant.model,
      thinkingLevel: variant.thinkingLevel,
      analysisKind: variant.analysisKind,
      analysis: safeResult,
      thought_summaries: result.thought_summaries,
    });
  }

  // Save all analysis variants to database
  await saveAnalyses(data.runId, analyses);

  // Also save primary insight for backwards compatibility
  const primary = analyses.find((a) => a.key === "pro_consultant") ?? analyses[0];
  if (primary) {
    await upsertInsight(data.runId, primary.analysis.narrative, primary.analysis.charts);
  }

  return Response.json({
    runId: data.runId,
    analyses,
  });
}
