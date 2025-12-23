export type TriggerStage = "explore" | "consider" | "compare";

export const TRIGGER_GROUPS: Record<TriggerStage, string[]> = {
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
  compare: [
    "Lakewood Ranch vs Sarasota",
    "Lakewood Ranch vs Bradenton",
    "Compare neighborhoods within Lakewood Ranch",
    "Compare builders and build quality",
    "Compare amenities and lifestyle",
    "Compare school ratings",
    "Compare HOA fees and rules",
    "Compare commute times",
  ],
};
