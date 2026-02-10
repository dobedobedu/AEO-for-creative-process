/**
 * Competitor Configuration Utilities
 *
 * Helper functions for accessing competitor-related configuration.
 */

import { getTenantConfig } from "./loader";
import type { Competitor } from "./types";

/**
 * Get all competitors
 */
export function getCompetitors(): Competitor[] {
  return getTenantConfig().competitors;
}

/**
 * Get primary competitors only
 */
export function getPrimaryCompetitors(): Competitor[] {
  return getCompetitors().filter((c) => c.isPrimary);
}

/**
 * Get all competitor names (for simple string matching)
 */
export function getCompetitorNames(): string[] {
  return getCompetitors().map((c) => c.name);
}

/**
 * Get all competitor terms (names + aliases) for text matching
 */
export function getCompetitorTerms(): string[] {
  const terms: string[] = [];
  for (const competitor of getCompetitors()) {
    terms.push(competitor.name);
    terms.push(...competitor.aliases);
  }
  return terms;
}

/**
 * Build a lookup map from competitor term to canonical name
 */
export function getCompetitorLookup(): Map<string, string> {
  const lookup = new Map<string, string>();
  for (const competitor of getCompetitors()) {
    // Map the canonical name to itself
    lookup.set(competitor.name.toLowerCase(), competitor.name);
    // Map each alias to the canonical name
    for (const alias of competitor.aliases) {
      lookup.set(alias.toLowerCase(), competitor.name);
    }
  }
  return lookup;
}

/**
 * Match a text term to a canonical competitor name
 *
 * @param term - The term to match (e.g., "Villages")
 * @returns The canonical competitor name (e.g., "The Villages") or null if not found
 */
export function matchCompetitor(term: string): string | null {
  const lookup = getCompetitorLookup();
  return lookup.get(term.toLowerCase()) ?? null;
}

/**
 * Find all competitors mentioned in text
 *
 * @param text - The text to search
 * @returns Array of canonical competitor names found in the text
 */
export function findCompetitorMentions(text: string): string[] {
  if (!text) return [];

  const lowerText = text.toLowerCase();
  const found = new Set<string>();
  const lookup = getCompetitorLookup();

  // Check each competitor term
  for (const [term, canonicalName] of lookup) {
    if (lowerText.includes(term)) {
      found.add(canonicalName);
    }
  }

  return Array.from(found);
}

/**
 * Check if text mentions any competitors
 */
export function textContainsCompetitor(text: string): boolean {
  return findCompetitorMentions(text).length > 0;
}

/**
 * Get competitor by name (exact match)
 */
export function getCompetitorByName(name: string): Competitor | undefined {
  return getCompetitors().find(
    (c) => c.name.toLowerCase() === name.toLowerCase()
  );
}
