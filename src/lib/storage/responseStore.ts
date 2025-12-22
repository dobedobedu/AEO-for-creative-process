import { sql } from "@/lib/db";
import type { Citation } from "@/lib/parsers/types";

export type ResponseInsert = {
  runId: string;
  queryId: string;
  provider: string;
  model: string;
  providerResponseId?: string | null;
  responseText?: string | null;
  outputJson?: unknown;
  annotationsJson?: unknown;
  groundingMetadataJson?: unknown;
};

export async function insertResponse(data: ResponseInsert): Promise<string> {
  const result = await sql<
    { id: string }[]
  >`
    INSERT INTO responses (
      run_id,
      query_id,
      provider,
      model,
      provider_response_id,
      response_text,
      output_json,
      annotations_json,
      grounding_metadata_json
    )
    VALUES (
      ${data.runId},
      ${data.queryId},
      ${data.provider},
      ${data.model},
      ${data.providerResponseId ?? null},
      ${data.responseText ?? null},
      ${data.outputJson ?? null},
      ${data.annotationsJson ?? null},
      ${data.groundingMetadataJson ?? null}
    )
    RETURNING id;
  `;

  return result[0]?.id ?? "";
}

export type WebSearchCallInsert = {
  responseId: string;
  action?: string | null;
  query?: string | null;
  domains?: unknown;
  status?: string | null;
  rawCallJson?: unknown;
};

export async function insertWebSearchCall(data: WebSearchCallInsert): Promise<void> {
  await sql`
    INSERT INTO web_search_calls (
      response_id,
      action,
      query,
      domains,
      status,
      raw_call_json
    )
    VALUES (
      ${data.responseId},
      ${data.action ?? null},
      ${data.query ?? null},
      ${data.domains ?? null},
      ${data.status ?? null},
      ${data.rawCallJson ?? null}
    );
  `;
}

export async function insertCitations(responseId: string, provider: string, citations: Citation[]): Promise<void> {
  if (citations.length === 0) return;

  const rows = citations.map((c) => [
    responseId,
    provider,
    c.url,
    c.domain,
    c.title ?? null,
    c.snippet ?? null,
    c.startIndex ?? null,
    c.endIndex ?? null,
    c.sourceType,
    c.query ?? null,
    c.raw ?? null,
  ]);

  await sql`
    INSERT INTO citations (
      response_id,
      provider,
      url,
      domain,
      title,
      snippet,
      start_idx,
      end_idx,
      source_type,
      query,
      raw_json
    )
    VALUES ${sql(rows)};
  `;
}
