import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";
import {
  MetricsConfig,
  MetricsConfigSchema,
  StageMetricsConfig,
  MetricDefinition,
} from "./types";
import type { Stage } from "../intents/types";

const DATA_DIR = join(process.cwd(), "data", "config");
const CONFIG_PATH = join(DATA_DIR, "metrics.json");

function ensureDataDir(): void {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }
}

export function loadMetricsConfig(): MetricsConfig {
  ensureDataDir();

  if (!existsSync(CONFIG_PATH)) {
    return getDefaultMetricsConfig();
  }

  const raw = readFileSync(CONFIG_PATH, "utf-8");
  const parsed = JSON.parse(raw);
  return MetricsConfigSchema.parse(parsed);
}

export function saveMetricsConfig(config: MetricsConfig): void {
  ensureDataDir();
  const validated = MetricsConfigSchema.parse(config);
  writeFileSync(CONFIG_PATH, JSON.stringify(validated, null, 2), "utf-8");
}

export function getStageMetrics(config: MetricsConfig, stage: Stage): StageMetricsConfig {
  // Cast stage to a valid key for stageMetrics
  const key = stage as keyof typeof config.stageMetrics;
  return config.stageMetrics[key];
}

export function getPrimaryMetric(config: MetricsConfig, stage: Stage): string {
  // Cast stage to a valid key for stageMetrics
  const key = stage as keyof typeof config.stageMetrics;
  return config.stageMetrics[key].primary;
}

export function getMetricDefinition(
  config: MetricsConfig,
  metricKey: string
): MetricDefinition | undefined {
  return config.availableMetrics[metricKey];
}

export function updateStagePrimaryMetric(
  config: MetricsConfig,
  stage: Stage,
  metricKey: string
): MetricsConfig {
  if (!config.availableMetrics[metricKey]) {
    throw new Error(`Unknown metric: ${metricKey}`);
  }

  // Cast stage to a valid key for stageMetrics
  const key = stage as keyof typeof config.stageMetrics;
  const oldValue = config.stageMetrics[key].primary;
  if (oldValue === metricKey) {
    return config;
  }

  const newVersion = config.version + 1;
  const now = new Date();

  return {
    ...config,
    version: newVersion,
    updatedAt: now.toISOString(),
    stageMetrics: {
      ...config.stageMetrics,
      [key]: {
        ...config.stageMetrics[key],
        primary: metricKey,
      },
    },
    history: [
      ...config.history,
      {
        version: newVersion,
        date: now.toISOString().split("T")[0],
        changes: [
          {
            stage,
            field: "primary",
            oldValue,
            newValue: metricKey,
          },
        ],
      },
    ],
  };
}

export function updateStageSecondaryMetrics(
  config: MetricsConfig,
  stage: Stage,
  metricKeys: string[]
): MetricsConfig {
  for (const key of metricKeys) {
    if (!config.availableMetrics[key]) {
      throw new Error(`Unknown metric: ${key}`);
    }
  }

  // Cast stage to a valid key for stageMetrics
  const key = stage as keyof typeof config.stageMetrics;
  const oldValue = config.stageMetrics[key].secondary;
  const newVersion = config.version + 1;
  const now = new Date();

  return {
    ...config,
    version: newVersion,
    updatedAt: now.toISOString(),
    stageMetrics: {
      ...config.stageMetrics,
      [key]: {
        ...config.stageMetrics[key],
        secondary: metricKeys,
      },
    },
    history: [
      ...config.history,
      {
        version: newVersion,
        date: now.toISOString().split("T")[0],
        changes: [
          {
            stage,
            field: "secondary",
            oldValue,
            newValue: metricKeys,
          },
        ],
      },
    ],
  };
}

export function getDefaultMetricsConfig(): MetricsConfig {
  return {
    version: 1,
    updatedAt: new Date().toISOString(),
    stageMetrics: {
      explore: {
        primary: "discoveryRate",
        secondary: ["topThreeRate"],
        context: ["competitorCooccurrence"],
      },
      consider: {
        primary: "sentimentScore",
        secondary: ["attributeCoverage"],
        context: ["concernsRaised"],
      },
      compare: {
        primary: "winRate",
        secondary: ["attributeWins", "attributeLosses"],
        context: ["commonMatchups"],
      },
      decide: {
        primary: "recommendationRate",
        secondary: ["recommendationStrength"],
        context: ["qualifiers"],
      },
    },
    availableMetrics: {
      discoveryRate: {
        label: "Discovery Rate",
        type: "percentage",
        description: "% of responses where brand appears",
      },
      topThreeRate: {
        label: "Top 3 Rate",
        type: "percentage",
        description: "% where brand is in first 3 mentioned",
      },
      competitorCooccurrence: {
        label: "Competitor Co-occurrence",
        type: "count",
        description: "Which competitors appear alongside brand",
      },
      sentimentScore: {
        label: "Sentiment",
        type: "score",
        description: "How positively portrayed (-1 to +1)",
        range: [-1, 1],
      },
      attributeCoverage: {
        label: "Attribute Coverage",
        type: "count",
        description: "Which brand strengths are mentioned",
      },
      concernsRaised: {
        label: "Concerns Raised",
        type: "count",
        description: "What negatives are surfaced",
      },
      winRate: {
        label: "Win Rate",
        type: "percentage",
        description: "% of comparisons where brand is favored",
      },
      attributeWins: {
        label: "Attribute Wins",
        type: "count",
        description: "What attributes brand wins on",
      },
      attributeLosses: {
        label: "Attribute Losses",
        type: "count",
        description: "What attributes brand loses on",
      },
      commonMatchups: {
        label: "Common Matchups",
        type: "count",
        description: "Who brand is compared against most",
      },
      recommendationRate: {
        label: "Recommendation Rate",
        type: "percentage",
        description: "% where brand is recommended",
      },
      recommendationStrength: {
        label: "Recommendation Strength",
        type: "enum",
        description: "How strongly brand is recommended",
        values: [
          "not_mentioned",
          "mentioned",
          "suggested",
          "recommended",
          "strongly_recommended",
        ],
      },
      qualifiers: {
        label: "Qualifiers",
        type: "count",
        description: "Conditional recommendations (e.g., 'if budget allows')",
      },
    },
    history: [],
  };
}
