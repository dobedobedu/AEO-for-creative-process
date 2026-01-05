import { query } from "@/lib/db";

type CitationRow = {
  response_id: string;
  url: string | null;
  domain: string | null;
  title: string | null;
  snippet: string | null;
  start_idx: number | null;
  end_idx: number | null;
  source_type: string | null;
};

type ResponseRow = {
  id: string;
  query_id: string;
  provider: string;
  model: string;
  response_text: string | null;
  created_at: string;
  query_text: string;
};

export async function GET(_: Request, context: { params: Promise<{ runId: string }> }) {
  const params = await context.params;
  const runId = params.runId;

  const responses = await query<ResponseRow>`
    SELECT
      r.id,
      r.query_id,
      r.provider,
      r.model,
      r.response_text,
      r.created_at,
      q.query_text
    FROM responses r
    JOIN queries q ON q.id = r.query_id
    WHERE r.run_id = ${runId}
    ORDER BY r.created_at ASC;
  `;

  const citations = await query<CitationRow>`
    SELECT
      c.response_id,
      c.url,
      c.domain,
      c.title,
      c.snippet,
      c.start_idx,
      c.end_idx,
      c.source_type
    FROM citations c
    WHERE c.response_id IN (SELECT id FROM responses WHERE run_id = ${runId})
    ORDER BY c.created_at ASC;
  `;

  const citationsByResponse = new Map<string, CitationRow[]>();
  for (const citation of citations) {
    const list = citationsByResponse.get(citation.response_id) ?? [];
    list.push(citation);
    citationsByResponse.set(citation.response_id, list);
  }

  const hydrated = responses.map((response) => ({
    ...response,
    citations: citationsByResponse.get(response.id) ?? [],
  }));

  return Response.json({ responses: hydrated });
}
