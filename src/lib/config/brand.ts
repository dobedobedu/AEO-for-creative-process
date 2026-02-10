/**
 * Brand Configuration Utilities
 *
 * Helper functions for accessing brand-related configuration.
 */

import { getTenantConfig } from "./loader";
import type { BrandConfig } from "./types";

/**
 * Get the brand configuration
 */
export function getBrand(): BrandConfig {
  return getTenantConfig().brand;
}

/**
 * Get the brand name
 */
export function getBrandName(): string {
  return getBrand().name;
}

/**
 * Get brand aliases
 */
export function getBrandAliases(): string[] {
  return getBrand().aliases;
}

/**
 * Get all brand terms (name + aliases)
 * Useful for text matching operations
 */
export function getBrandTerms(): string[] {
  const brand = getBrand();
  return [brand.name, ...brand.aliases];
}

/**
 * Get the brand domain
 */
export function getBrandDomain(): string | undefined {
  return getBrand().domain;
}

/**
 * Get the brand highlight color
 */
export function getBrandHighlightColor(): string {
  return getBrand().highlightColor;
}

/**
 * Check if text contains any brand terms
 */
export function textContainsBrand(text: string): boolean {
  if (!text) return false;
  const lowerText = text.toLowerCase();
  return getBrandTerms().some((term) => lowerText.includes(term.toLowerCase()));
}

/**
 * Find which brand terms are mentioned in text
 */
export function findBrandMentions(text: string): string[] {
  if (!text) return [];
  const lowerText = text.toLowerCase();
  return getBrandTerms().filter((term) =>
    lowerText.includes(term.toLowerCase())
  );
}
