import { getBrandName, getCompetitorNames } from "@/lib/config";

export type TriggerStage = "explore" | "consider" | "compare";

/**
 * Static trigger groups for explore and consider stages.
 * These are generic and don't reference any specific brand.
 */
const STATIC_TRIGGERS: Record<Exclude<TriggerStage, "compare">, string[]> = {
  explore: [
    "New role or major life transition",
    "Changing needs or priorities",
    "Budget planning for a major decision",
    "First-time buyer research",
    "Replacing a current provider or solution",
    "Quality and trust evaluation",
    "Feature and usability exploration",
    "Risk and reliability concerns",
    "Workflow or process change",
    "Seasonal or timing-driven demand",
  ],
  consider: [
    "Price change or budget pressure",
    "More options becoming available",
    "Discounts, promotions, or incentives",
    "Total cost and long-term value concerns",
    "Implementation or onboarding timeline",
    "Compliance or policy requirements",
    "Support and service quality questions",
    "Performance and outcomes validation",
    "Contract terms and risk trade-offs",
  ],
};

/**
 * Generic compare triggers that don't reference any specific brand or competitor.
 */
const GENERIC_COMPARE_TRIGGERS: string[] = [
  "Compare features and capabilities",
  "Compare pricing and total cost",
  "Compare quality and performance",
  "Compare support and service model",
  "Compare implementation effort",
];

/**
 * Generate compare-stage triggers dynamically from config.
 * Creates "Brand vs Competitor" patterns for each competitor,
 * plus a "Compare options within Brand" trigger,
 * plus generic compare triggers.
 */
function getCompareTriggers(): string[] {
  const brand = getBrandName();
  const competitors = getCompetitorNames();

  return [
    ...competitors.map((c) => `${brand} vs ${c}`),
    `Compare options within ${brand}`,
    ...GENERIC_COMPARE_TRIGGERS,
  ];
}

/**
 * Get trigger groups for all stages.
 * Explore and consider triggers are static/generic.
 * Compare triggers are dynamically generated from tenant config.
 */
export function getTriggerGroups(): Record<TriggerStage, string[]> {
  return {
    ...STATIC_TRIGGERS,
    compare: getCompareTriggers(),
  };
}

