import { getBrandName, getCompetitorNames } from "@/lib/config";

export type TriggerStage = "explore" | "consider" | "compare";

/**
 * Static trigger groups for explore and consider stages.
 * These are generic and don't reference any specific brand.
 */
const STATIC_TRIGGERS: Record<Exclude<TriggerStage, "compare">, string[]> = {
  explore: [
    "New job or relocation",
    "Growing family or new baby",
    "Retirement planning",
    "First-time homebuyer research",
    "Downsizing lifestyle",
    "School district search",
    "Lifestyle amenities exploration",
    "Safety and crime concerns",
    "Commute or remote work change",
    "Seasonal or second-home interest",
  ],
  consider: [
    "Mortgage rate drop",
    "Price reductions in the area",
    "Inventory increase",
    "Builder incentives or promotions",
    "Insurance or HOA cost concerns",
    "New community opening or phase release",
    "Hurricane or storm risk research",
    "Construction quality questions",
    "Resale value and appreciation",
  ],
};

/**
 * Generic compare triggers that don't reference any specific brand or competitor.
 */
const GENERIC_COMPARE_TRIGGERS: string[] = [
  "Compare builders and build quality",
  "Compare amenities and lifestyle",
  "Compare school ratings",
  "Compare HOA fees and rules",
  "Compare commute times",
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


