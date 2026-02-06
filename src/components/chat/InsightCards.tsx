"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { InlineSelect } from "./InlineSelect";
import { Users, BookOpen, FileText, Zap } from "lucide-react";
import type { ChatContext } from "@/lib/chat/types";

interface InsightCardsProps {
  context: ChatContext;
  topCompetitors: string[];
  personas: string[];
  onSubmit: (prompt: string) => void;
  layout?: "horizontal" | "vertical";
}

const STAGES = ["explore", "consider", "compare", "decide"];
const STAGE_LABELS: Record<string, string> = {
  explore: "Explore",
  consider: "Consider",
  compare: "Compare",
  decide: "Decide",
};

interface CardConfig {
  id: string;
  icon: React.ReactNode;
  header: string;
  buildPrompt: (values: Record<string, string>) => string;
  oneClickLabel: string;
  oneClickPrompt: (context: ChatContext, topCompetitor: string | undefined) => string;
  fields: Array<{
    key: string;
    placeholder: string;
    getOptions: (props: InsightCardsProps) => string[];
    getDefault: (props: InsightCardsProps) => string;
  }>;
}

const CARD_CONFIGS: CardConfig[] = [
  {
    id: "narrative",
    icon: <Users className="h-4 w-4" />,
    header: "Who owns the story?",
    buildPrompt: (values) =>
      `Why does ${values.competitor} win over us in the ${values.stage} stage?`,
    oneClickLabel: "Show me who's winning",
    oneClickPrompt: (context, topCompetitor) => {
      const competitor = topCompetitor || "competitors";
      const stage = context.stage || "explore";
      return `Why does ${competitor} win over us in the ${stage} stage?`;
    },
    fields: [
      {
        key: "competitor",
        placeholder: "competitor",
        getOptions: (props) =>
          props.topCompetitors.length > 0
            ? props.topCompetitors
            : ["competitors"],
        getDefault: (props) => props.topCompetitors[0] || "",
      },
      {
        key: "stage",
        placeholder: "stage",
        getOptions: () => STAGES,
        getDefault: (props) => props.context.stage || "explore",
      },
    ],
  },
  {
    id: "authority",
    icon: <BookOpen className="h-4 w-4" />,
    header: "Why AI trusts them",
    buildPrompt: (values) =>
      `What sources is AI citing for ${values.topic}?`,
    oneClickLabel: "Show citation gaps",
    oneClickPrompt: (context) => {
      const topic = context.stage
        ? `${STAGE_LABELS[context.stage] || context.stage} stage queries`
        : "our industry";
      return `What sources is AI citing for ${topic}?`;
    },
    fields: [
      {
        key: "topic",
        placeholder: "topic",
        getOptions: (props) => {
          const topics = STAGES.map((s) => `${STAGE_LABELS[s]} stage queries`);
          if (props.context.persona) {
            topics.unshift(`${props.context.persona} audience`);
          }
          topics.push("our industry", "product comparisons", "buying decisions");
          return topics;
        },
        getDefault: (props) =>
          props.context.stage
            ? `${STAGE_LABELS[props.context.stage] || props.context.stage} stage queries`
            : "our industry",
      },
    ],
  },
  {
    id: "action",
    icon: <FileText className="h-4 w-4" />,
    header: "What to publish next",
    buildPrompt: (values) =>
      `What content should I create for ${values.persona} in the ${values.stage} stage?`,
    oneClickLabel: "Give me an action",
    oneClickPrompt: (context) => {
      const persona = context.persona || "our target audience";
      const stage = context.stage || "explore";
      return `What content should I create for ${persona} in the ${stage} stage?`;
    },
    fields: [
      {
        key: "persona",
        placeholder: "persona",
        getOptions: (props) =>
          props.personas.length > 0
            ? props.personas
            : ["our target audience"],
        getDefault: (props) => props.context.persona || "",
      },
      {
        key: "stage",
        placeholder: "stage",
        getOptions: () => STAGES,
        getDefault: (props) => props.context.stage || "explore",
      },
    ],
  },
];

function InsightCard({
  config,
  props,
  topCompetitor,
  compact = false,
}: {
  config: CardConfig;
  props: InsightCardsProps;
  topCompetitor: string | undefined;
  compact?: boolean;
}) {
  // Initialize field values with defaults
  const [values, setValues] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const field of config.fields) {
      initial[field.key] = field.getDefault(props);
    }
    return initial;
  });

  const handleFieldChange = (key: string, value: string) => {
    setValues((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = () => {
    const prompt = config.buildPrompt(values);
    props.onSubmit(prompt);
  };

  const handleOneClick = () => {
    const prompt = config.oneClickPrompt(props.context, topCompetitor);
    props.onSubmit(prompt);
  };

  // Check if we have context to enable one-click (persona or stage specific)
  const hasContext = props.context.persona || props.context.stage;

  // Compact mode for vertical layout in modals
  if (compact) {
    return (
      <button
        type="button"
        onClick={hasContext ? handleOneClick : handleSubmit}
        className="w-full text-left px-4 py-3 bg-white border border-[#e3dacb] hover:bg-[#efe6d9] hover:border-[#1f3b2c]/30 transition-colors group"
      >
        <div className="flex items-center gap-3">
          <div className="text-[#1f3b2c]/60 group-hover:text-[#1f3b2c]">
            {config.icon}
          </div>
          <div className="flex-1 min-w-0">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#1e1b16]/50">
              {config.header}
            </span>
            <p className="text-xs text-[#1e1b16] truncate mt-0.5">
              {hasContext
                ? config.oneClickPrompt(props.context, topCompetitor)
                : config.buildPrompt(values)}
            </p>
          </div>
          <Zap className="h-3 w-3 text-[#6e7c5b] opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
      </button>
    );
  }

  return (
    <Card className="bg-white border-[#e3dacb] shadow-sm hover:shadow-md transition-shadow rounded-lg py-4">
      <CardContent className="p-4 space-y-3">
        {/* Header */}
        <div className="flex items-center gap-2 text-[#1f3b2c]">
          {config.icon}
          <span className="text-xs font-bold uppercase tracking-wider">
            {config.header}
          </span>
        </div>

        {/* Template with inline selects */}
        <div className="text-sm text-[#1e1b16] leading-relaxed">
          {config.id === "narrative" && (
            <>
              Why does{" "}
              <InlineSelect
                value={values.competitor}
                options={config.fields[0].getOptions(props)}
                onChange={(v) => handleFieldChange("competitor", v)}
                placeholder="competitor"
              />{" "}
              win over us in{" "}
              <InlineSelect
                value={values.stage}
                options={config.fields[1].getOptions(props)}
                onChange={(v) => handleFieldChange("stage", v)}
                placeholder="stage"
              />
              ?
            </>
          )}
          {config.id === "authority" && (
            <>
              What sources is AI citing for{" "}
              <InlineSelect
                value={values.topic}
                options={config.fields[0].getOptions(props)}
                onChange={(v) => handleFieldChange("topic", v)}
                placeholder="topic"
              />
              ?
            </>
          )}
          {config.id === "action" && (
            <>
              What content should I create for{" "}
              <InlineSelect
                value={values.persona}
                options={config.fields[0].getOptions(props)}
                onChange={(v) => handleFieldChange("persona", v)}
                placeholder="persona"
              />{" "}
              in{" "}
              <InlineSelect
                value={values.stage}
                options={config.fields[1].getOptions(props)}
                onChange={(v) => handleFieldChange("stage", v)}
                placeholder="stage"
              />
              ?
            </>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-1">
          {hasContext ? (
            <Button
              size="sm"
              onClick={handleOneClick}
              className="flex-1 bg-[#1f3b2c] hover:bg-[#2a4d3a] text-white text-xs h-8"
            >
              <Zap className="h-3 w-3 mr-1.5" />
              {config.oneClickLabel}
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={handleSubmit}
              className="flex-1 bg-[#1f3b2c] hover:bg-[#2a4d3a] text-white text-xs h-8"
            >
              Ask this
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function InsightCards({
  context,
  topCompetitors,
  personas,
  onSubmit,
  layout = "horizontal",
}: InsightCardsProps) {
  const topCompetitor = topCompetitors[0];
  const props = { context, topCompetitors, personas, onSubmit };

  return (
    <div className="space-y-3">
      <p className="text-center text-[10px] text-[#1e1b16]/40 uppercase tracking-wider font-medium">
        Choose an insight lens
      </p>
      <div className={layout === "vertical"
        ? "flex flex-col gap-2"
        : "grid grid-cols-1 md:grid-cols-3 gap-4"
      }>
        {CARD_CONFIGS.map((config) => (
          <InsightCard
            key={config.id}
            config={config}
            props={props}
            topCompetitor={topCompetitor}
            compact={layout === "vertical"}
          />
        ))}
      </div>
    </div>
  );
}
