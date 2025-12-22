export type Citation = {
  url: string;
  domain: string;
  title?: string;
  snippet?: string;
  startIndex?: number;
  endIndex?: number;
  sourceType: "url_citation" | "grounding_chunk";
  query?: string;
  raw?: unknown;
};

export type ParsedResponse = {
  text: string;
  citations: Citation[];
  searchQueries: string[];
};
