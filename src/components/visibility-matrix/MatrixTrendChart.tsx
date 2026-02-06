"use client";

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import type { Provider } from "@/lib/benchmark/runner";
import {
  AreaChart as RechartsAreaChart,
  Area,
  CartesianGrid,
  XAxis,
  YAxis,
  ReferenceLine,
} from "recharts";

interface TrendDatum {
  label: string;
  date: string;
  runId: string;
  openai: number | null;
  anthropic: number | null;
  gemini: number | null;
  xai: number | null;
}

interface MatrixTrendChartProps {
  config: ChartConfig;
  data: TrendDatum[];
  selectedRunChartIndex: string | null;
  onChartClick: (data: { activePayload?: Array<{ payload?: { runId?: string } }> }) => void;
  kpiTickInterval: number;
  formatKpiTick: (label: string) => string;
  enabledProviders: Set<Provider>;
  showWeightedArea: boolean;
}

export function MatrixTrendChart({
  config,
  data,
  selectedRunChartIndex,
  onChartClick,
  kpiTickInterval,
  formatKpiTick,
  enabledProviders,
  showWeightedArea,
}: MatrixTrendChartProps) {
  return (
    <ChartContainer config={config} className="h-full w-full cursor-pointer">
      <RechartsAreaChart
        data={data}
        margin={{ left: 8, right: 8, top: 10, bottom: 0 }}
        onClick={onChartClick}
      >
        <CartesianGrid vertical={false} strokeDasharray="4 4" stroke="#efe6d9" />
        <XAxis
          dataKey="date"
          tickLine={false}
          axisLine={false}
          tickMargin={6}
          fontSize={10}
          interval={kpiTickInterval}
          tickFormatter={formatKpiTick}
          padding={{ left: 12, right: 12 }}
        />
        <YAxis
          domain={[0, 100]}
          tickLine={false}
          axisLine={false}
          fontSize={9}
          width={24}
        />
        <ChartTooltip
          cursor={{ stroke: "#d4c9b8", strokeDasharray: "4 4" }}
          content={<ChartTooltipContent />}
        />
        {selectedRunChartIndex && (
          <ReferenceLine
            x={selectedRunChartIndex}
            stroke="#1f3b2c"
            strokeWidth={2}
            strokeDasharray="4 4"
          />
        )}
        {enabledProviders.has("openai") && (
          <Area
            type="monotone"
            dataKey="openai"
            stroke="#1f3b2c"
            fill={showWeightedArea ? "#1f3b2c" : "none"}
            fillOpacity={showWeightedArea ? 0.15 : 0}
            strokeWidth={2}
          />
        )}
        {enabledProviders.has("anthropic") && (
          <Area
            type="monotone"
            dataKey="anthropic"
            stroke="#b86f3a"
            fill={showWeightedArea ? "#b86f3a" : "none"}
            fillOpacity={showWeightedArea ? 0.15 : 0}
            strokeWidth={2}
          />
        )}
        {enabledProviders.has("gemini") && (
          <Area
            type="monotone"
            dataKey="gemini"
            stroke="#6e7c5b"
            fill={showWeightedArea ? "#6e7c5b" : "none"}
            fillOpacity={showWeightedArea ? 0.15 : 0}
            strokeWidth={2}
          />
        )}
        {enabledProviders.has("xai") && (
          <Area
            type="monotone"
            dataKey="xai"
            stroke="#7c6b7c"
            fill={showWeightedArea ? "#7c6b7c" : "none"}
            fillOpacity={showWeightedArea ? 0.15 : 0}
            strokeWidth={2}
          />
        )}
      </RechartsAreaChart>
    </ChartContainer>
  );
}
