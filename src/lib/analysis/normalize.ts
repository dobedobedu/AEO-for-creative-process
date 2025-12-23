export type AnalysisQueryRow = {
  id: string;
  query_text: string;
};

export type AnalysisResponseRow = {
  id: string;
  query_id: string;
  provider: string;
  model: string;
  response_text: string | null;
};

export type AnalysisCitationRow = {
  response_id: string | null;
  provider: string | null;
  url: string | null;
  domain: string | null;
  title: string | null;
  source_type: string | null;
};

export type AnalysisInput = {
  persona: string;
  stage: string;
  triggers: string[];
  summary: {
    total_responses: number;
    total_citations: number;
    unique_domains: number;
    lakewoodranch_citations: number;
    lakewoodranch_share: number;
    top_domains: Array<{ domain: string; count: number }>;
    citations_by_provider: Array<{ provider: string; count: number; unique_domains: number }>;
  };
  model_breakdown: Array<{
    provider: string;
    model: string;
    response_count: number;
    citation_count: number;
    unique_domains: number;
    top_domains: Array<{ domain: string; count: number }>;
  }>;
  responses: Array<{
    query: string;
    provider: string;
    model: string;
    text: string | null;
  }>;
  citations: Array<{
    response_id: string | null;
    provider: string | null;
    url: string | null;
    domain: string | null;
    title: string | null;
    source_type: string | null;
  }>;
};

const LAKEWOOD_KEY = "lakewoodranch";

function truncateText(text: string | null, max = 900): string | null {
  if (!text) return text;
  if (text.length <= max) return text;
  return `${text.slice(0, max)}…`;
}

function toDomainKey(domain: string | null): string | null {
  if (!domain) return null;
  return domain.trim().toLowerCase();
}

function countDomains(citations: AnalysisCitationRow[]) {
  const counts = new Map<string, number>();
  for (const c of citations) {
    const key = toDomainKey(c.domain) ?? "unknown";
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

function topDomainList(counts: Map<string, number>, limit = 8) {
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([domain, count]) => ({ domain, count }));
}

export function buildAnalysisInput(params: {
  persona: string;
  stage: string;
  triggers?: string[];
  queries: AnalysisQueryRow[];
  responses: AnalysisResponseRow[];
  citations: AnalysisCitationRow[];
  responseLimit?: number;
  citationLimit?: number;
}): AnalysisInput {
  const responseLimit = params.responseLimit ?? 50;
  const citationLimit = params.citationLimit ?? 250;

  const queryMap = new Map(params.queries.map((q) => [q.id, q.query_text]));

  const responses = params.responses.map((r) => ({
    query: queryMap.get(r.query_id) ?? "",
    provider: r.provider,
    model: r.model,
    text: truncateText(r.response_text),
  }));

  const citations = params.citations.slice(0, citationLimit).map((c) => ({
    response_id: c.response_id,
    provider: c.provider,
    url: c.url,
    domain: c.domain,
    title: c.title,
    source_type: c.source_type,
  }));

  const responseInfo = new Map<string, { provider: string; model: string }>();
  for (const r of params.responses) {
    responseInfo.set(r.id, { provider: r.provider, model: r.model });
  }

  const domainCounts = countDomains(params.citations);
  const uniqueDomains = Array.from(domainCounts.keys()).filter((d) => d !== "unknown").length;

  let lakewoodCitations = 0;
  for (const c of params.citations) {
    const url = (c.url ?? "").toLowerCase();
    const domain = (c.domain ?? "").toLowerCase();
    if (url.includes(LAKEWOOD_KEY) || domain.includes(LAKEWOOD_KEY)) {
      lakewoodCitations += 1;
    }
  }

  const providerCounts = new Map<string, { count: number; domains: Set<string> }>();
  for (const c of params.citations) {
    const provider = c.provider ?? "unknown";
    const entry = providerCounts.get(provider) ?? { count: 0, domains: new Set<string>() };
    entry.count += 1;
    const domain = toDomainKey(c.domain);
    if (domain) entry.domains.add(domain);
    providerCounts.set(provider, entry);
  }

  const citationsByProvider = Array.from(providerCounts.entries()).map(([provider, data]) => ({
    provider,
    count: data.count,
    unique_domains: data.domains.size,
  }));

  const modelStats = new Map<
    string,
    {
      provider: string;
      model: string;
      response_count: number;
      citation_count: number;
      domainCounts: Map<string, number>;
      domains: Set<string>;
    }
  >();

  for (const r of params.responses) {
    const key = `${r.provider}:${r.model}`;
    const entry =
      modelStats.get(key) ?? {
        provider: r.provider,
        model: r.model,
        response_count: 0,
        citation_count: 0,
        domainCounts: new Map<string, number>(),
        domains: new Set<string>(),
      };
    entry.response_count += 1;
    modelStats.set(key, entry);
  }

  for (const c of params.citations) {
    const info = c.response_id ? responseInfo.get(c.response_id) : null;
    const provider = info?.provider ?? c.provider ?? "unknown";
    const model = info?.model ?? "unknown";
    const key = `${provider}:${model}`;
    const entry =
      modelStats.get(key) ?? {
        provider,
        model,
        response_count: 0,
        citation_count: 0,
        domainCounts: new Map<string, number>(),
        domains: new Set<string>(),
      };
    entry.citation_count += 1;
    const domain = toDomainKey(c.domain) ?? "unknown";
    entry.domainCounts.set(domain, (entry.domainCounts.get(domain) ?? 0) + 1);
    if (domain !== "unknown") entry.domains.add(domain);
    modelStats.set(key, entry);
  }

  const model_breakdown = Array.from(modelStats.values()).map((entry) => ({
    provider: entry.provider,
    model: entry.model,
    response_count: entry.response_count,
    citation_count: entry.citation_count,
    unique_domains: entry.domains.size,
    top_domains: topDomainList(entry.domainCounts, 6),
  }));

  return {
    persona: params.persona,
    stage: params.stage,
    triggers: params.triggers ?? [],
    summary: {
      total_responses: params.responses.length,
      total_citations: params.citations.length,
      unique_domains: uniqueDomains,
      lakewoodranch_citations: lakewoodCitations,
      lakewoodranch_share:
        params.citations.length > 0 ? Number((lakewoodCitations / params.citations.length).toFixed(4)) : 0,
      top_domains: topDomainList(domainCounts, 10),
      citations_by_provider: citationsByProvider,
    },
    model_breakdown,
    responses: responses.slice(0, responseLimit),
    citations,
  };
}
