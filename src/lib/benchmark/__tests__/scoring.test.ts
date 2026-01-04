import { describe, expect, it } from "vitest";
import {
  detectBrandMention,
  scoreBrandVisibility,
  type BrandMentionResult,
} from "../scoring";

describe("detectBrandMention", () => {
  const brand = "Lakewood Ranch";

  it("detects exact brand mention", () => {
    const text = "Lakewood Ranch is a master-planned community in Florida.";
    const result = detectBrandMention(text, brand);
    expect(result.mentioned).toBe(true);
    expect(result.mentionCount).toBe(1);
    expect(result.positions).toEqual([0]);
  });

  it("detects multiple mentions", () => {
    const text = "Lakewood Ranch offers amenities. Many prefer Lakewood Ranch over The Villages.";
    const result = detectBrandMention(text, brand);
    expect(result.mentioned).toBe(true);
    expect(result.mentionCount).toBe(2);
    expect(result.positions).toHaveLength(2);
  });

  it("detects case-insensitive mentions", () => {
    const text = "lakewood ranch is popular. LAKEWOOD RANCH has golf courses.";
    const result = detectBrandMention(text, brand);
    expect(result.mentioned).toBe(true);
    expect(result.mentionCount).toBe(2);
  });

  it("returns false when brand not mentioned", () => {
    const text = "The Villages is the largest retirement community in Florida.";
    const result = detectBrandMention(text, brand);
    expect(result.mentioned).toBe(false);
    expect(result.mentionCount).toBe(0);
    expect(result.positions).toEqual([]);
  });

  it("handles empty text", () => {
    const result = detectBrandMention("", brand);
    expect(result.mentioned).toBe(false);
    expect(result.mentionCount).toBe(0);
  });

  it("detects partial brand names with aliases", () => {
    const text = "LWR is a popular choice for families.";
    const result = detectBrandMention(text, brand, ["LWR"]);
    expect(result.mentioned).toBe(true);
    expect(result.matchedTerms).toContain("LWR");
  });
});

describe("scoreBrandVisibility", () => {
  const brand = "Lakewood Ranch";

  it("scores high when brand is first recommendation", () => {
    const text = "For families in Florida, I recommend Lakewood Ranch. It offers great schools and amenities.";
    const score = scoreBrandVisibility(text, brand);
    expect(score.score).toBeGreaterThan(0);
    expect(score.mentioned).toBe(true);
    expect(score.sentiment).toBe("positive");
  });

  it("scores medium when brand is mentioned but not primary", () => {
    const text = "The best communities in Florida include The Villages, Nocatee, and Lakewood Ranch.";
    const score = scoreBrandVisibility(text, brand);
    expect(score.score).toBeGreaterThan(0);
    expect(score.mentionCount).toBe(1);
    expect(score.category).toBe("mentioned");
  });

  it("scores zero when brand is not mentioned", () => {
    const text = "The Villages is the top retirement destination in Florida.";
    const score = scoreBrandVisibility(text, brand);
    expect(score.score).toBe(0);
    expect(score.category).toBe("blind_spot");
  });

  it("detects positive sentiment", () => {
    const text = "Lakewood Ranch is excellent for families with top-rated schools.";
    const score = scoreBrandVisibility(text, brand);
    expect(score.sentiment).toBe("positive");
  });

  it("detects negative sentiment", () => {
    const text = "Lakewood Ranch has expensive HOA fees and traffic issues.";
    const score = scoreBrandVisibility(text, brand);
    expect(score.sentiment).toBe("negative");
  });

  it("detects neutral sentiment", () => {
    const text = "Lakewood Ranch is located in Sarasota County.";
    const score = scoreBrandVisibility(text, brand);
    expect(score.sentiment).toBe("neutral");
  });
});
