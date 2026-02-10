import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { InsightModal } from "@/components/visibility-matrix/InsightModal";
import { TEST_BRAND } from "@/__tests__/test-constants";

describe("InsightModal metrics", () => {
  it("shows overall + provider breakdown for explore stage", () => {
    render(
      <InsightModal
        open
        onClose={() => {}}
        persona="move_up"
        stage="explore"
        personaLabel="Move-Up"
        stageLabel="Explore"
        brand={TEST_BRAND}
        results={[
          {
            query: "test query",
            responses: [
              {
                provider: "openai",
                text: `${TEST_BRAND} is mentioned`,
                visibility: { mentioned: true, position: "1st", sentiment: "neutral" },
              },
            ],
          },
        ]}
      />
    );

    // Check for overall metrics section
    expect(screen.getByText(/mention rate/i)).toBeInTheDocument();
    expect(screen.getByText(/top 3 ranking/i)).toBeInTheDocument();

    // Check for provider breakdown section
    expect(screen.getByText(/by provider/i)).toBeInTheDocument();
    expect(screen.getByText(/openai/i)).toBeInTheDocument();
  });

  it("shows overall + provider breakdown for consider stage", () => {
    render(
      <InsightModal
        open
        onClose={() => {}}
        persona="move_up"
        stage="consider"
        personaLabel="Move-Up"
        stageLabel="Consider"
        brand={TEST_BRAND}
        results={[
          {
            query: "test query",
            responses: [
              {
                provider: "gemini",
                text: "Positive sentiment",
                visibility: { mentioned: true, position: "1st", sentiment: "positive" },
              },
            ],
          },
        ]}
      />
    );

    // Check for overall metrics
    expect(screen.getByText(/avg sentiment/i)).toBeInTheDocument();

    // Check for provider breakdown
    expect(screen.getByText(/by provider/i)).toBeInTheDocument();
    expect(screen.getByText(/gemini/i)).toBeInTheDocument();
  });

  it("shows overall + provider breakdown for compare stage", () => {
    render(
      <InsightModal
        open
        onClose={() => {}}
        persona="retiree"
        stage="compare"
        personaLabel="Retiree"
        stageLabel="Compare"
        brand={TEST_BRAND}
        results={[
          {
            query: "test query",
            responses: [
              {
                provider: "anthropic",
                text: "Favorable comparison",
                visibility: {
                  mentioned: true,
                  position: "1st",
                  sentiment: "neutral",
                  comparisonOutcome: "favorable",
                },
              },
            ],
          },
        ]}
      />
    );

    // Check for overall metrics
    expect(screen.getByText(/head-to-head win rate/i)).toBeInTheDocument();

    // Check for provider breakdown
    expect(screen.getByText(/by provider/i)).toBeInTheDocument();
    expect(screen.getByText(/anthropic/i)).toBeInTheDocument();
  });

  it("shows overall + provider breakdown for decide stage", () => {
    render(
      <InsightModal
        open
        onClose={() => {}}
        persona="luxury"
        stage="decide"
        personaLabel="Luxury"
        stageLabel="Decide"
        brand={TEST_BRAND}
        results={[
          {
            query: "test query",
            responses: [
              {
                provider: "xai",
                text: "Strong recommendation",
                visibility: {
                  mentioned: true,
                  position: "1st",
                  sentiment: "positive",
                  recommendationStrength: "strong",
                },
              },
            ],
          },
        ]}
      />
    );

    // Check for overall metrics
    expect(screen.getByText(/recommendation rate/i)).toBeInTheDocument();

    // Check for provider breakdown
    expect(screen.getByText(/by provider/i)).toBeInTheDocument();
    expect(screen.getByText(/xai/i)).toBeInTheDocument();
  });

  it("handles empty results gracefully", () => {
    render(
      <InsightModal
        open
        onClose={() => {}}
        persona="first_time"
        stage="explore"
        personaLabel="First-Time"
        stageLabel="Explore"
        brand={TEST_BRAND}
        results={[]}
      />
    );

    // Should show empty state message
    expect(screen.getByText(/benchmark data unavailable/i)).toBeInTheDocument();
  });

  it("filters out errored responses from metrics", () => {
    render(
      <InsightModal
        open
        onClose={() => {}}
        persona="move_up"
        stage="explore"
        personaLabel="Move-Up"
        stageLabel="Explore"
        brand={TEST_BRAND}
        results={[
          {
            query: "test query",
            responses: [
              {
                provider: "openai",
                text: "Success",
                visibility: { mentioned: true, position: "1st", sentiment: "positive" },
              },
              {
                provider: "gemini",
                error: "timeout",
                text: "",
                visibility: { mentioned: false, position: "absent", sentiment: "neutral" },
              },
            ],
          },
        ]}
      />
    );

    // Should show metrics (only openai counts)
    expect(screen.getByText(/mention rate/i)).toBeInTheDocument();
    // All providers should now be shown (gemini with N/A since all errored)
    const geminiElements = screen.queryAllByText(/gemini/i);
    expect(geminiElements.length).toBe(1); // Shows in provider breakdown with N/A
  });
});
