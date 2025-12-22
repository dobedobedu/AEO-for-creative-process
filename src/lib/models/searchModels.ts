export type SearchModelConfig = {
  provider: "openai" | "gemini";
  model: string;
};

function envValue(key: string): string | null {
  const value = process.env[key];
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

export function getDefaultSearchModels(): SearchModelConfig[] {
  const models: SearchModelConfig[] = [];

  const openaiPrimary = envValue("OPENAI_SEARCH_MODEL_PRIMARY") ?? "gpt-5.2";
  const openaiFast = envValue("OPENAI_SEARCH_MODEL_FAST") ?? "gpt-5-mini";

  models.push({ provider: "openai", model: openaiPrimary });
  models.push({ provider: "openai", model: openaiFast });

  const geminiPrimary = envValue("GEMINI_SEARCH_MODEL_PRIMARY") ?? "models/gemini-3-flash-preview";
  const geminiSecondary = envValue("GEMINI_SEARCH_MODEL_SECONDARY") ?? null;

  if (geminiPrimary) models.push({ provider: "gemini", model: geminiPrimary });
  if (geminiSecondary) models.push({ provider: "gemini", model: geminiSecondary });

  return models;
}
