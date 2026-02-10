/**
 * Threshold Configuration Utilities
 *
 * Helper functions for score thresholds and color coding.
 */

import { getTenantConfig } from "./loader";
import type { ThresholdsConfig } from "./types";

/**
 * Get threshold configuration
 */
export function getThresholds(): ThresholdsConfig {
  return getTenantConfig().thresholds;
}

/**
 * Get the strong threshold value
 */
export function getStrongThreshold(): number {
  return getThresholds().strong;
}

/**
 * Get the moderate threshold value
 */
export function getModerateThreshold(): number {
  return getThresholds().moderate;
}

/**
 * Get the weak threshold value
 */
export function getWeakThreshold(): number {
  return getThresholds().weak;
}

/**
 * Score category based on thresholds
 */
export type ScoreCategory = "strong" | "moderate" | "weak" | "minimal";

/**
 * Categorize a score based on thresholds
 */
export function categorizeScore(score: number): ScoreCategory {
  const thresholds = getThresholds();

  if (score >= thresholds.strong) return "strong";
  if (score >= thresholds.moderate) return "moderate";
  if (score >= thresholds.weak) return "weak";
  return "minimal";
}

/**
 * Default color palette for score categories
 */
const DEFAULT_COLORS: Record<ScoreCategory, string> = {
  strong: "#22c55e", // green-500
  moderate: "#eab308", // yellow-500
  weak: "#f97316", // orange-500
  minimal: "#ef4444", // red-500
};

/**
 * Get color for a score
 *
 * @param score - The score (0-1)
 * @param colors - Optional custom color palette
 * @returns Hex color string
 */
export function getScoreColor(
  score: number,
  colors: Partial<Record<ScoreCategory, string>> = {}
): string {
  const category = categorizeScore(score);
  return colors[category] ?? DEFAULT_COLORS[category];
}

/**
 * Get background color class for heatmap display
 *
 * @param score - The score (0-1)
 * @returns Tailwind background color class
 */
export function getHeatmapColorClass(score: number): string {
  const category = categorizeScore(score);

  switch (category) {
    case "strong":
      return "bg-green-100";
    case "moderate":
      return "bg-yellow-100";
    case "weak":
      return "bg-orange-100";
    case "minimal":
      return "bg-red-100";
  }
}

/**
 * Get text color class for score display
 *
 * @param score - The score (0-1)
 * @returns Tailwind text color class
 */
export function getScoreTextClass(score: number): string {
  const category = categorizeScore(score);

  switch (category) {
    case "strong":
      return "text-green-700";
    case "moderate":
      return "text-yellow-700";
    case "weak":
      return "text-orange-700";
    case "minimal":
      return "text-red-700";
  }
}

/**
 * Get score description
 *
 * @param score - The score (0-1)
 * @returns Human-readable description
 */
export function getScoreDescription(score: number): string {
  const category = categorizeScore(score);

  switch (category) {
    case "strong":
      return "Strong visibility";
    case "moderate":
      return "Moderate visibility";
    case "weak":
      return "Weak visibility";
    case "minimal":
      return "Minimal visibility";
  }
}
