export type SearchModelConfig = {
  provider: "openai" | "gemini" | "anthropic" | "xai";
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
  const openaiSecondary =
    envValue("OPENAI_SEARCH_MODEL_SECONDARY") ?? envValue("OPENAI_SEARCH_MODEL_FAST") ?? null;

  models.push({ provider: "openai", model: openaiPrimary });
  if (openaiSecondary) {
    models.push({ provider: "openai", model: openaiSecondary });
  }

  const geminiPrimary = envValue("GEMINI_SEARCH_MODEL_PRIMARY") ?? "models/gemini-3-flash-preview";
  const geminiSecondary = envValue("GEMINI_SEARCH_MODEL_SECONDARY") ?? null;

  if (geminiPrimary) models.push({ provider: "gemini", model: geminiPrimary });
  if (geminiSecondary) models.push({ provider: "gemini", model: geminiSecondary });

  const anthropicModel = envValue("ANTHROPIC_MODEL") ?? "claude-haiku-4-5";
  if (anthropicModel) models.push({ provider: "anthropic", model: anthropicModel });

  const xaiModel = envValue("XAI_MODEL") ?? "grok-4-1-fast-reasoning";
  if (xaiModel) models.push({ provider: "xai", model: xaiModel });

  return models;
}
