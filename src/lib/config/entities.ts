/**
 * Entity Category Configuration Utilities
 *
 * Helper functions for accessing entity category configuration.
 */

import { getTenantConfig } from "./loader";
import type { EntityCategory } from "./types";

/**
 * Get all entity categories
 */
export function getEntityCategories(): EntityCategory[] {
  return getTenantConfig().entityCategories;
}

/**
 * Get entity category by ID
 */
export function getEntityCategoryById(id: string): EntityCategory | undefined {
  return getEntityCategories().find((c) => c.id === id);
}

/**
 * Get entity category labels
 */
export function getEntityCategoryLabels(): string[] {
  return getEntityCategories().map((c) => c.label);
}

/**
 * Get entity category IDs
 */
export function getEntityCategoryIds(): string[] {
  return getEntityCategories().map((c) => c.id);
}

/**
 * Build entity extraction prompt suffix from categories
 *
 * This generates the instruction text for entity extraction prompts.
 *
 * @returns A string describing what entities to extract
 */
export function buildEntityPromptSuffix(): string {
  const categories = getEntityCategories();

  if (categories.length === 0) {
    return "";
  }

  const categoryDescriptions = categories
    .map((c) => {
      const examplesStr =
        c.examples.length > 0 ? ` (e.g., ${c.examples.join(", ")})` : "";
      return `- ${c.label}${examplesStr}`;
    })
    .join("\n");

  return `

Also extract any specific entities mentioned in the following categories:
${categoryDescriptions}

For each entity found, include its category and the exact text from the response.`;
}

/**
 * Get all example entities from all categories
 *
 * Useful for building prompts or validation
 */
export function getAllEntityExamples(): string[] {
  const examples: string[] = [];
  for (const category of getEntityCategories()) {
    examples.push(...category.examples);
  }
  return examples;
}
