import { describe, expect, it } from "vitest";
import {
  detectBrandMention,
  scoreBrandVisibility,
} from "../scoring";
import { TEST_BRAND } from "@/__tests__/test-constants";

describe("detectBrandMention", () => {
  it("detects exact brand mention", () => {
    const text = `${TEST_BRAND} is a master-planned community in Florida.`;
    const result = detectBrandMention(text, TEST_BRAND);
    expect(result.mentioned).toBe(true);
    expect(result.mentionCount).toBe(1);
    expect(result.positions).toEqual([0]);
  });

  it("detects multiple mentions", () => {
    const text = `${TEST_BRAND} offers amenities. Many prefer ${TEST_BRAND} over others.`;
    const result = detectBrandMention(text, TEST_BRAND);
    expect(result.mentioned).toBe(true);
    expect(result.mentionCount).toBe(2);
    expect(result.positions).toHaveLength(2);
  });

  it("detects case-insensitive mentions", () => {
    const lower = TEST_BRAND.toLowerCase();
    const upper = TEST_BRAND.toUpperCase();
    const text = `${lower} is popular. ${upper} has golf courses.`;
    const result = detectBrandMention(text, TEST_BRAND);
    expect(result.mentioned).toBe(true);
    expect(result.mentionCount).toBe(2);
  });

  it("returns false when brand not mentioned", () => {
    const text = "The Villages is the largest retirement community in Florida.";
    const result = detectBrandMention(text, TEST_BRAND);
    expect(result.mentioned).toBe(false);
    expect(result.mentionCount).toBe(0);
    expect(result.positions).toEqual([]);
  });

  it("handles empty text", () => {
    const result = detectBrandMention("", TEST_BRAND);
    expect(result.mentioned).toBe(false);
    expect(result.mentionCount).toBe(0);
  });

  it("detects partial brand names with aliases", () => {
    const text = "TBC is a popular choice for families.";
    const result = detectBrandMention(text, TEST_BRAND, ["TBC"]);
    expect(result.mentioned).toBe(true);
    expect(result.matchedTerms).toContain("TBC");
  });
});

describe("scoreBrandVisibility", () => {
  it("scores high when brand is first recommendation", () => {
    const text = `For families in Florida, I recommend ${TEST_BRAND}. It offers great schools and amenities.`;
    const score = scoreBrandVisibility(text, TEST_BRAND);
    expect(score.score).toBeGreaterThan(0);
    expect(score.mentioned).toBe(true);
    expect(score.sentiment).toBe("positive");
  });

  it("scores medium when brand is mentioned but not primary", () => {
    const text = `The best communities in Florida include The Villages, Nocatee, and ${TEST_BRAND}.`;
    const score = scoreBrandVisibility(text, TEST_BRAND);
    expect(score.score).toBeGreaterThan(0);
    expect(score.mentionCount).toBe(1);
    expect(score.category).toBe("mentioned");
  });

  it("scores zero when brand is not mentioned", () => {
    const text = "The Villages is the top retirement destination in Florida.";
    const score = scoreBrandVisibility(text, TEST_BRAND);
    expect(score.score).toBe(0);
    expect(score.category).toBe("blind_spot");
  });

  it("detects positive sentiment", () => {
    const text = `${TEST_BRAND} is excellent for families with top-rated schools.`;
    const score = scoreBrandVisibility(text, TEST_BRAND);
    expect(score.sentiment).toBe("positive");
  });

  it("detects negative sentiment", () => {
    const text = `${TEST_BRAND} has expensive HOA fees and traffic issues.`;
    const score = scoreBrandVisibility(text, TEST_BRAND);
    expect(score.sentiment).toBe("negative");
  });

  it("detects neutral sentiment", () => {
    const text = `${TEST_BRAND} is located in Sarasota County.`;
    const score = scoreBrandVisibility(text, TEST_BRAND);
    expect(score.sentiment).toBe("neutral");
  });
});
