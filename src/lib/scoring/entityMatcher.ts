/**
 * Entity Matcher
 *
 * Matches extracted entity mentions to canonical terms in the registry.
 * Uses fuzzy matching to handle linguistic variations.
 */

import type { EntityMention, EntityCategory } from "./schemas";

export interface EntityTerm {
  id: string;
  category_id: string;
  canonical_name: string;
  aliases: string[];
}

export interface MatchedEntity {
  entityTermId: string | null; // null means unmatched to any registry term
  canonicalName: string;
  categoryId: string;
  rawMention: string;
  sentiment: "positive" | "neutral" | "negative";
  contextSnippet: string;
  matchConfidence: number;
}

/**
 * Normalize text for comparison
 */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/['']/g, "'")
    .replace(/[""]/g, '"')
    .replace(/\s+/g, " ");
}

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1, // insertion
          matrix[i - 1][j] + 1 // deletion
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

/**
 * Calculate similarity score (0-1) between two strings
 */
function similarity(a: string, b: string): number {
  const normalA = normalize(a);
  const normalB = normalize(b);

  if (normalA === normalB) return 1;

  // Check if one contains the other
  if (normalA.includes(normalB) || normalB.includes(normalA)) {
    return 0.9;
  }

  const maxLen = Math.max(normalA.length, normalB.length);
  if (maxLen === 0) return 1;

  const distance = levenshteinDistance(normalA, normalB);
  return 1 - distance / maxLen;
}

/**
 * Find best matching entity term for a raw mention
 */
function findBestMatch(
  mention: string,
  mentionCategory: EntityCategory,
  terms: EntityTerm[]
): { term: EntityTerm; confidence: number } | null {
  const normalizedMention = normalize(mention);
  let bestMatch: EntityTerm | null = null;
  let bestScore = 0;

  // Filter to same category first (with fallback to all if no matches)
  const categoryTerms = terms.filter((t) => t.category_id === mentionCategory);
  const searchTerms = categoryTerms.length > 0 ? categoryTerms : terms;

  for (const term of searchTerms) {
    // Check canonical name
    const canonicalScore = similarity(mention, term.canonical_name);
    if (canonicalScore > bestScore) {
      bestScore = canonicalScore;
      bestMatch = term;
    }

    // Check aliases
    for (const alias of term.aliases) {
      const aliasScore = similarity(mention, alias);
      if (aliasScore > bestScore) {
        bestScore = aliasScore;
        bestMatch = term;
      }
    }

    // Exact substring match gets high score
    const normalCanonical = normalize(term.canonical_name);
    if (
      normalizedMention.includes(normalCanonical) ||
      normalCanonical.includes(normalizedMention)
    ) {
      if (bestScore < 0.85) {
        bestScore = 0.85;
        bestMatch = term;
      }
    }
  }

  // Threshold: only return matches above 0.6 similarity
  if (bestMatch && bestScore >= 0.6) {
    return { term: bestMatch, confidence: bestScore };
  }

  return null;
}

/**
 * Match extracted entities to canonical registry terms
 */
export function matchEntitiesToRegistry(
  extracted: EntityMention[],
  registry: EntityTerm[]
): MatchedEntity[] {
  const matched: MatchedEntity[] = [];

  for (const entity of extracted) {
    const match = findBestMatch(entity.name, entity.category, registry);

    if (match) {
      matched.push({
        entityTermId: match.term.id,
        canonicalName: match.term.canonical_name,
        categoryId: match.term.category_id,
        rawMention: entity.name,
        sentiment: entity.sentiment,
        contextSnippet: entity.contextSnippet,
        matchConfidence: match.confidence,
      });
    } else {
      // No match found - still track for "other" category analysis
      matched.push({
        entityTermId: null, // null means unmatched
        canonicalName: entity.name,
        categoryId: entity.category === "other" ? "other" : entity.category,
        rawMention: entity.name,
        sentiment: entity.sentiment,
        contextSnippet: entity.contextSnippet,
        matchConfidence: 0,
      });
    }
  }

  return matched;
}

/**
 * Load entity registry from database
 */
export async function loadEntityRegistry(
  sql: typeof import("../db").sql
): Promise<EntityTerm[]> {
  const rows = await sql`
    SELECT id::text, category_id, canonical_name, aliases
    FROM matrix_entity_terms
    WHERE active = true
    ORDER BY category_id, display_order
  `;

  return rows.map((row: { id: string; category_id: string; canonical_name: string; aliases: string[] }) => ({
    id: row.id,
    category_id: row.category_id,
    canonical_name: row.canonical_name,
    aliases: Array.isArray(row.aliases) ? row.aliases : [],
  }));
}
