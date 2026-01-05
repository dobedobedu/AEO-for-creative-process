export interface BrandMentionResult {
  mentioned: boolean;
  mentionCount: number;
  positions: number[];
  matchedTerms: string[];
}

export type ComparisonOutcome = "favorable" | "unfavorable" | "neutral" | "none";
export type RecommendationStrength = "strong" | "moderate" | "weak" | "none";
export type Position = "1st" | "2nd" | "3rd" | "later" | "absent";

export interface VisibilityScore {
  score: number; // 0-1
  category: "blind_spot" | "mentioned" | "recommended" | "preferred";
  sentiment: "positive" | "negative" | "neutral";
  mentioned: boolean;
  mentionCount: number;
  firstMentionPosition: number | null;
  position: "1st" | "2nd" | "3rd" | "later" | "absent";
  competitorsMentioned: string[];
  // Stage-specific metrics
  comparisonOutcome: "favorable" | "unfavorable" | "neutral" | "none";
  recommendationStrength: "strong" | "moderate" | "weak" | "none";
}

// Florida master-planned community competitors
const COMPETITORS = [
  "The Villages",
  "Villages",
  "Nocatee",
  "Wellen Park",
  "Ave Maria",
  "Babcock Ranch",
  "Sun City Center",
  "Sarasota",
  "Tampa",
  "Orlando",
  "Jacksonville",
  "On Top of the World",
  "OTOW",
];

const POSITIVE_SIGNALS = [
  "recommend",
  "excellent",
  "great",
  "best",
  "top",
  "ideal",
  "perfect",
  "highly rated",
  "top-rated",
  "outstanding",
  "premier",
  "leading",
];

const NEGATIVE_SIGNALS = [
  "expensive",
  "costly",
  "overpriced",
  "traffic",
  "crowded",
  "issues",
  "problems",
  "drawback",
  "downside",
  "concern",
  "avoid",
  "not recommend",
];

// Comparison outcome signals
const FAVORABLE_COMPARISON = [
  "better than",
  "preferred over",
  "outperforms",
  "superior to",
  "more than",
  "stands out",
  "edge over",
  "advantage over",
  "wins",
  "beats",
  "tops",
  "leads",
];

const UNFAVORABLE_COMPARISON = [
  "falls short",
  "lags behind",
  "not as good as",
  "inferior to",
  "loses to",
  "behind",
  "doesn't compare",
  "pales in comparison",
  "worse than",
  "less than",
];

// Recommendation strength signals
const STRONG_RECOMMENDATION = [
  "highly recommend",
  "strongly recommend",
  "definitely consider",
  "must visit",
  "top choice",
  "best option",
  "can't go wrong",
  "ideal choice",
  "perfect for",
  "excellent choice",
  "strongly suggest",
];

const MODERATE_RECOMMENDATION = [
  "recommend",
  "worth considering",
  "good option",
  "solid choice",
  "consider",
  "check out",
  "look into",
  "worth a look",
];

const WEAK_RECOMMENDATION = [
  "might consider",
  "could look at",
  "one option",
  "depends on",
  "if you",
  "some people",
  "may work",
  "possibly",
];

export function detectBrandMention(
  text: string,
  brand: string,
  aliases: string[] = []
): BrandMentionResult {
  if (!text) {
    return { mentioned: false, mentionCount: 0, positions: [], matchedTerms: [] };
  }

  const terms = [brand, ...aliases];
  const lowerText = text.toLowerCase();
  const positions: number[] = [];
  const matchedTerms: string[] = [];

  for (const term of terms) {
    const lowerTerm = term.toLowerCase();
    let startIndex = 0;
    let pos: number;

    while ((pos = lowerText.indexOf(lowerTerm, startIndex)) !== -1) {
      positions.push(pos);
      if (!matchedTerms.includes(term)) {
        matchedTerms.push(term);
      }
      startIndex = pos + lowerTerm.length;
    }
  }

  positions.sort((a, b) => a - b);

  return {
    mentioned: positions.length > 0,
    mentionCount: positions.length,
    positions,
    matchedTerms,
  };
}

export function scoreBrandVisibility(
  text: string,
  brand: string,
  aliases: string[] = []
): VisibilityScore {
  const mention = detectBrandMention(text, brand, aliases);
  const competitorsMentioned = detectCompetitors(text);

  if (!mention.mentioned) {
    return {
      score: 0,
      category: "blind_spot",
      sentiment: "neutral",
      mentioned: false,
      mentionCount: 0,
      firstMentionPosition: null,
      position: "absent",
      competitorsMentioned,
      comparisonOutcome: "none",
      recommendationStrength: "none",
    };
  }

  const textLength = text.length;
  const firstPosition = mention.positions[0];

  // Position score: earlier mentions score higher
  const positionScore = 1 - (firstPosition / textLength);

  // Frequency score: more mentions = higher score (with diminishing returns)
  const frequencyScore = Math.min(mention.mentionCount / 3, 1);

  // Context score: check if brand appears with recommendation language
  const brandContext = extractBrandContext(text, brand, 100);
  const hasRecommendationContext = POSITIVE_SIGNALS.some(signal =>
    brandContext.toLowerCase().includes(signal)
  );
  const contextScore = hasRecommendationContext ? 0.3 : 0;

  // Combined score
  const rawScore = (positionScore * 0.4) + (frequencyScore * 0.3) + (contextScore * 0.3);
  const score = Math.min(Math.max(rawScore, 0), 1);

  // Determine category
  let category: VisibilityScore["category"];
  if (score >= 0.7) {
    category = "recommended";
  } else if (score >= 0.5) {
    category = "mentioned";
  } else if (score > 0) {
    category = "mentioned";
  } else {
    category = "blind_spot";
  }

  // Determine sentiment
  const sentiment = analyzeSentiment(brandContext);

  // Determine position (1st, 2nd, 3rd, later)
  const position = determinePosition(text, brand, aliases, competitorsMentioned);

  // Determine comparison outcome (for Compare stage)
  const comparisonOutcome = analyzeComparisonOutcome(text, brand, aliases);

  // Determine recommendation strength (for Decide stage)
  const recommendationStrength = analyzeRecommendationStrength(brandContext);

  return {
    score,
    category,
    sentiment,
    mentioned: true,
    mentionCount: mention.mentionCount,
    firstMentionPosition: firstPosition,
    position,
    competitorsMentioned,
    comparisonOutcome,
    recommendationStrength,
  };
}

function extractBrandContext(text: string, brand: string, windowSize: number): string {
  const lowerText = text.toLowerCase();
  const lowerBrand = brand.toLowerCase();
  const pos = lowerText.indexOf(lowerBrand);

  if (pos === -1) return "";

  const start = Math.max(0, pos - windowSize);
  const end = Math.min(text.length, pos + brand.length + windowSize);

  return text.slice(start, end);
}

function analyzeSentiment(context: string): "positive" | "negative" | "neutral" {
  const lowerContext = context.toLowerCase();

  const positiveCount = POSITIVE_SIGNALS.filter(signal =>
    lowerContext.includes(signal)
  ).length;

  const negativeCount = NEGATIVE_SIGNALS.filter(signal =>
    lowerContext.includes(signal)
  ).length;

  if (positiveCount > negativeCount) return "positive";
  if (negativeCount > positiveCount) return "negative";
  return "neutral";
}

function detectCompetitors(text: string): string[] {
  const lowerText = text.toLowerCase();
  const found: string[] = [];

  for (const competitor of COMPETITORS) {
    if (lowerText.includes(competitor.toLowerCase())) {
      // Normalize "Villages" to "The Villages"
      const normalized = competitor === "Villages" ? "The Villages" : competitor;
      if (!found.includes(normalized)) {
        found.push(normalized);
      }
    }
  }

  return found;
}

function determinePosition(
  text: string,
  brand: string,
  aliases: string[],
  competitors: string[]
): "1st" | "2nd" | "3rd" | "later" | "absent" {
  const lowerText = text.toLowerCase();
  const allBrands = [brand, ...aliases];

  // Find first mention position of our brand
  let brandPos = Infinity;
  for (const b of allBrands) {
    const pos = lowerText.indexOf(b.toLowerCase());
    if (pos !== -1 && pos < brandPos) {
      brandPos = pos;
    }
  }

  if (brandPos === Infinity) return "absent";

  // Find first mention positions of competitors
  const competitorPositions: number[] = [];
  for (const comp of competitors) {
    const pos = lowerText.indexOf(comp.toLowerCase());
    if (pos !== -1) {
      competitorPositions.push(pos);
    }
  }

  // Count how many competitors appear before our brand
  const competitorsBefore = competitorPositions.filter(p => p < brandPos).length;

  if (competitorsBefore === 0) return "1st";
  if (competitorsBefore === 1) return "2nd";
  if (competitorsBefore === 2) return "3rd";
  return "later";
}

function analyzeComparisonOutcome(
  text: string,
  brand: string,
  aliases: string[]
): "favorable" | "unfavorable" | "neutral" | "none" {
  const lowerText = text.toLowerCase();
  const allBrands = [brand, ...aliases].map(b => b.toLowerCase());

  // Check if brand is even mentioned
  const brandMentioned = allBrands.some(b => lowerText.includes(b));
  if (!brandMentioned) return "none";

  // Look for comparison patterns near brand mentions
  let favorableCount = 0;
  let unfavorableCount = 0;

  for (const brandTerm of allBrands) {
    const pos = lowerText.indexOf(brandTerm);
    if (pos === -1) continue;

    // Extract context window around brand mention
    const start = Math.max(0, pos - 150);
    const end = Math.min(lowerText.length, pos + brandTerm.length + 150);
    const context = lowerText.slice(start, end);

    // Check for favorable comparison signals
    for (const signal of FAVORABLE_COMPARISON) {
      if (context.includes(signal)) {
        favorableCount++;
      }
    }

    // Check for unfavorable comparison signals
    for (const signal of UNFAVORABLE_COMPARISON) {
      if (context.includes(signal)) {
        unfavorableCount++;
      }
    }
  }

  if (favorableCount > unfavorableCount) return "favorable";
  if (unfavorableCount > favorableCount) return "unfavorable";
  if (favorableCount > 0 || unfavorableCount > 0) return "neutral";
  return "neutral";
}

function analyzeRecommendationStrength(
  brandContext: string
): "strong" | "moderate" | "weak" | "none" {
  const lowerContext = brandContext.toLowerCase();

  // Check for strong recommendation signals
  const hasStrong = STRONG_RECOMMENDATION.some(signal =>
    lowerContext.includes(signal)
  );
  if (hasStrong) return "strong";

  // Check for moderate recommendation signals
  const hasModerate = MODERATE_RECOMMENDATION.some(signal =>
    lowerContext.includes(signal)
  );
  if (hasModerate) return "moderate";

  // Check for weak recommendation signals
  const hasWeak = WEAK_RECOMMENDATION.some(signal =>
    lowerContext.includes(signal)
  );
  if (hasWeak) return "weak";

  return "none";
}
