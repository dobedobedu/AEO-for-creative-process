/**
 * Prompt Configuration Utilities
 *
 * Loads prompt templates from config/prompts/ and provides interpolation.
 */

import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { getTenantConfig } from "./loader";

// In-memory cache for prompt templates
const promptCache = new Map<string, string>();

/**
 * Get the base prompts directory path
 */
function getPromptsPath(): string {
  return join(process.cwd(), "config", "prompts");
}

/**
 * Load a prompt template from file
 *
 * @param type - The prompt type (query-generation, extraction, chat)
 * @param name - The specific prompt name (e.g., "system", "explore")
 * @returns The raw prompt template string
 */
export function loadPromptTemplate(type: string, name: string): string | null {
  const cacheKey = `${type}/${name}`;

  // Return cached prompt if available
  if (promptCache.has(cacheKey)) {
    return promptCache.get(cacheKey)!;
  }

  const filePath = join(getPromptsPath(), type, `${name}.txt`);

  try {
    if (!existsSync(filePath)) {
      console.warn(`[prompts] Prompt file not found: ${filePath}`);
      return null;
    }

    const content = readFileSync(filePath, "utf-8");
    promptCache.set(cacheKey, content);
    return content;
  } catch (error) {
    console.error(`[prompts] Error loading prompt ${cacheKey}:`, error);
    return null;
  }
}

/**
 * Variable interpolation for prompt templates
 *
 * Replaces {{variable}} placeholders with values from the context object.
 */
export function interpolatePrompt(
  template: string,
  context: Record<string, string | string[] | undefined>
): string {
  return template.replace(/\{\{(\w+(?:\.\w+)?)\}\}/g, (match, key) => {
    // Handle nested keys like "geography.region"
    const keys = key.split(".");
    let value: unknown = context;

    for (const k of keys) {
      if (value && typeof value === "object" && k in value) {
        value = (value as Record<string, unknown>)[k];
      } else {
        value = undefined;
        break;
      }
    }

    if (value === undefined) return match; // Keep original if no replacement
    if (Array.isArray(value)) return value.join(", ");
    return String(value);
  });
}

/**
 * Build default context from tenant config
 */
export function getDefaultPromptContext(): Record<string, string | string[]> {
  const config = getTenantConfig();

  return {
    brand: config.brand.name,
    brand_aliases: config.brand.aliases.join(", "),
    competitors: config.competitors.map((c) => c.name).slice(0, 3).join(", "),
    industry: config.industry,
    geography_region: config.geography?.region ?? "",
    geography_localities: config.geography?.localities?.join(", ") ?? "",
  };
}

/**
 * Get a fully interpolated prompt
 *
 * @param type - The prompt type (query-generation, extraction, chat)
 * @param name - The specific prompt name
 * @param additionalContext - Additional context to merge with defaults
 * @returns The interpolated prompt string, or null if not found
 */
export function getPrompt(
  type: string,
  name: string,
  additionalContext: Record<string, string | string[] | undefined> = {}
): string | null {
  const template = loadPromptTemplate(type, name);
  if (!template) return null;

  const context = {
    ...getDefaultPromptContext(),
    ...additionalContext,
  };

  return interpolatePrompt(template, context);
}

/**
 * Get extraction prompt for a stage
 *
 * @param stage - The buyer journey stage (explore, consider, compare, decide)
 * @returns The interpolated extraction prompt
 */
export function getExtractionPrompt(stage: string): string | null {
  const config = getTenantConfig();

  // Build entity categories string
  const entityCategories = config.entityCategories
    .map((c) => `- ${c.id}: ${c.examples.join(", ")}`)
    .join("\n");

  // Load entity suffix and interpolate
  const suffixTemplate = loadPromptTemplate("extraction", "entity-suffix");
  const entitySuffix = suffixTemplate
    ? interpolatePrompt(suffixTemplate, {
        brand: config.brand.name,
        entity_categories: entityCategories,
      })
    : "";

  // Get stage-specific prompt
  const stagePrompt = getPrompt("extraction", stage, {
    entity_extraction_suffix: entitySuffix,
  });

  return stagePrompt;
}

/**
 * Get query generation system prompt
 *
 * @param params - Parameters for prompt building
 * @returns The interpolated system prompt
 */
export function getQueryGenerationPrompt(params: {
  persona_description: string;
  role_description: string;
  stage: string;
  core_stage: string;
  stage_focus: string;
  brand_policy: string;
  style_directive: string;
  local_context?: string;
}): string | null {
  const config = getTenantConfig();

  const defaultLocalContext = config.geography
    ? `- Region: ${config.geography.region} (${config.geography.localities.join(", ")})\n- Nearby metros: ${config.geography.nearbyMetros?.join(", ") ?? ""}`
    : "";

  return getPrompt("query-generation", "system", {
    ...params,
    local_context: params.local_context ?? defaultLocalContext,
  });
}

/**
 * Get chat system prompt
 *
 * @returns The interpolated chat system prompt
 */
export function getChatSystemPrompt(): string | null {
  return getPrompt("chat", "system");
}

/**
 * Get file search system prompt
 *
 * @returns The interpolated file search system prompt
 */
export function getFileSearchSystemPrompt(): string | null {
  return getPrompt("chat", "file-search-system");
}

/**
 * Clear the prompt cache
 */
export function clearPromptCache(): void {
  promptCache.clear();
}
