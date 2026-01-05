"use client";

import { useEffect, useState, useMemo } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ChevronRight,
  Eye,
  EyeOff,
  Star,
  Trophy,
  TrendingUp,
  TrendingDown,
  Minus,
  ArrowLeft,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";

type VisibilityStatus = "blind_spot" | "mentioned" | "recommended" | "preferred";

type QueryCard = {
  id: string;
  queryText: string;
  persona: string;
  stage: string;
  status: VisibilityStatus;
  providers: {
    provider: string;
    mentioned: boolean;
    citationCount: number;
    lakewoodMentioned: boolean;
  }[];
  totalCitations: number;
  lakewoodCitations: number;
  trend: "up" | "down" | "stable";
  responses: {
    provider: string;
    model: string;
    responseText: string;
    citations: { url: string; domain: string; title: string }[];
  }[];
};

type RunData = {
  run: {
    id: string;
    status: string;
    config_json: {
      personaText?: string;
      triggerStage?: string;
    };
    created_at: string;
  };
  queries: { id: string; query_text: string }[];
  responses: { query_id: string; provider: string; model: string; count: number }[];
};

type ResponseWithCitations = {
  id: string;
  query_id: string;
  provider: string;
  model: string;
  response_text: string | null;
  created_at: string;
  query_text: string;
  citations: Array<{
    url: string | null;
    domain: string | null;
    title: string | null;
  }>;
};

type ResponsesData = {
  responses: ResponseWithCitations[];
};

const STATUS_CONFIG: Record<
  VisibilityStatus,
  { label: string; color: string; bgColor: string; icon: React.ReactNode; description: string }
> = {
  blind_spot: {
    label: "Blind Spot",
    color: "text-red-700",
    bgColor: "bg-red-50 border-red-200",
    icon: <EyeOff className="h-4 w-4" />,
    description: "AI doesn't mention your brand",
  },
  mentioned: {
    label: "Mentioned",
    color: "text-amber-700",
    bgColor: "bg-amber-50 border-amber-200",
    icon: <Eye className="h-4 w-4" />,
    description: "You appear in citations",
  },
  recommended: {
    label: "Recommended",
    color: "text-emerald-700",
    bgColor: "bg-emerald-50 border-emerald-200",
    icon: <Star className="h-4 w-4" />,
    description: "AI recommends you",
  },
  preferred: {
    label: "Preferred",
    color: "text-blue-700",
    bgColor: "bg-blue-50 border-blue-200",
    icon: <Trophy className="h-4 w-4" />,
    description: "Top recommendation",
  },
};

const PROVIDER_LOGOS: Record<string, string> = {
  openai: "/OpenAI-black-monoblossom.svg",
  gemini: "/gemini-color.svg",
  anthropic: "/claude-color.svg",
  xai: "/Grok_Logomark_Dark.svg",
};

function ProviderHeatmap({ providers }: { providers: QueryCard["providers"] }) {
  const allProviders = ["openai", "gemini", "anthropic", "xai"];
  
  return (
    <div className="flex gap-1">
      {allProviders.map((p) => {
        const data = providers.find((pr) => pr.provider === p);
        const intensity = data?.lakewoodMentioned
          ? "bg-emerald-500"
          : data?.mentioned
          ? "bg-amber-400"
          : "bg-gray-200";
        return (
          <div
            key={p}
            className={`w-6 h-6 rounded ${intensity} flex items-center justify-center`}
            title={`${p}: ${data?.citationCount ?? 0} citations`}
          >
            <Image
              src={PROVIDER_LOGOS[p]}
              alt={p}
              width={14}
              height={14}
              className="opacity-70"
            />
          </div>
        );
      })}
    </div>
  );
}

function TrendIndicator({ trend }: { trend: QueryCard["trend"] }) {
  if (trend === "up") return <TrendingUp className="h-4 w-4 text-emerald-600" />;
  if (trend === "down") return <TrendingDown className="h-4 w-4 text-red-600" />;
  return <Minus className="h-4 w-4 text-gray-400" />;
}

function VisibilityCard({
  card,
  onClick,
}: {
  card: QueryCard;
  onClick: () => void;
}) {
  const config = STATUS_CONFIG[card.status];
  const visibilityScore = card.totalCitations > 0 
    ? Math.round((card.lakewoodCitations / card.totalCitations) * 100)
    : 0;

  return (
    <div
      onClick={onClick}
      className={`
        p-4 rounded-xl border-2 cursor-pointer transition-all
        hover:shadow-lg hover:scale-[1.02]
        ${config.bgColor}
      `}
    >
      <div className="flex items-start justify-between mb-3">
        <Badge variant="outline" className={`text-[10px] ${config.color}`}>
          {card.stage}
        </Badge>
        <TrendIndicator trend={card.trend} />
      </div>
      
      <p className="text-sm font-medium text-gray-900 mb-3 line-clamp-2">
        {card.queryText}
      </p>
      
      <div className="flex items-center justify-between">
        <ProviderHeatmap providers={card.providers} />
        
        <div className="text-right">
          <div className="text-lg font-bold text-gray-900">{visibilityScore}%</div>
          <div className="text-[10px] text-gray-500">share of voice</div>
        </div>
      </div>
      
      <div className="mt-3 pt-3 border-t border-gray-200/50">
        <div className="flex items-center justify-between text-xs text-gray-600">
          <span>{card.persona}</span>
          <span>{card.totalCitations} citations</span>
        </div>
      </div>
    </div>
  );
}

function QueryDetailPanel({
  card,
}: {
  card: QueryCard;
  onClose: () => void;
}) {
  const config = STATUS_CONFIG[card.status];
  
  return (
    <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto bg-[var(--panel)]">
      <DialogHeader>
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${config.bgColor}`}>
            {config.icon}
          </div>
          <div>
            <DialogTitle className="font-display text-lg text-[var(--forest)]">
              {card.queryText}
            </DialogTitle>
            <p className="text-sm text-gray-500 mt-1">
              {card.persona} · {card.stage}
            </p>
          </div>
        </div>
      </DialogHeader>

      {/* Visibility Score Bar - CrUX Style */}
      <div className="mt-6">
        <div className="text-xs uppercase tracking-wider text-gray-500 mb-2">
          Visibility Distribution
        </div>
        <div className="h-8 rounded-lg overflow-hidden flex">
          {card.providers.map((p) => {
            const width = card.totalCitations > 0 
              ? (p.citationCount / card.totalCitations) * 100 
              : 25;
            const color = p.lakewoodMentioned
              ? "bg-emerald-500"
              : p.mentioned
              ? "bg-amber-400"
              : "bg-gray-300";
            return (
              <div
                key={p.provider}
                className={`${color} flex items-center justify-center transition-all`}
                style={{ width: `${Math.max(width, 5)}%` }}
              >
                <Image
                  src={PROVIDER_LOGOS[p.provider]}
                  alt={p.provider}
                  width={16}
                  height={16}
                  className="opacity-80"
                />
              </div>
            );
          })}
        </div>
        <div className="flex justify-between mt-2 text-xs text-gray-500">
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded bg-emerald-500"></span> Brand mentioned
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded bg-amber-400"></span> Cited
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded bg-gray-300"></span> Not present
          </span>
        </div>
      </div>

      {/* Provider Responses Grid */}
      <div className="mt-6">
        <div className="text-xs uppercase tracking-wider text-gray-500 mb-3">
          AI Responses by Provider
        </div>
        <div className="grid grid-cols-2 gap-4">
          {card.responses.map((response, i) => (
            <Card key={i} className="border border-gray-200">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <Image
                    src={PROVIDER_LOGOS[response.provider] || "/OpenAI-black-monoblossom.svg"}
                    alt={response.provider}
                    width={20}
                    height={20}
                  />
                  <span className="text-sm font-medium">{response.provider}</span>
                  <Badge variant="outline" className="text-[10px] ml-auto">
                    {response.model}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-gray-700 line-clamp-6 whitespace-pre-line">
                  {response.responseText || "(No response)"}
                </p>
                {response.citations.length > 0 && (
                  <div className="mt-3 pt-3 border-t">
                    <div className="text-[10px] uppercase text-gray-500 mb-2">
                      Citations ({response.citations.length})
                    </div>
                    <div className="space-y-1">
                      {response.citations.slice(0, 3).map((c, j) => (
                        <div key={j} className="text-[10px] text-gray-600 truncate">
                          {c.domain || c.url}
                        </div>
                      ))}
                      {response.citations.length > 3 && (
                        <div className="text-[10px] text-gray-400">
                          +{response.citations.length - 3} more
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Recommended Actions */}
      <div className="mt-6 p-4 rounded-xl bg-[var(--mist)] border border-[var(--panel-border)]">
        <div className="text-xs uppercase tracking-wider text-[var(--olive)] mb-3">
          Recommended Actions
        </div>
        <ul className="space-y-2 text-sm text-gray-700">
          {card.status === "blind_spot" && (
            <>
              <li className="flex items-start gap-2">
                <ChevronRight className="h-4 w-4 mt-0.5 text-[var(--copper)]" />
                Create authoritative content addressing this query
              </li>
              <li className="flex items-start gap-2">
                <ChevronRight className="h-4 w-4 mt-0.5 text-[var(--copper)]" />
                Identify which competitors are being recommended
              </li>
            </>
          )}
          {card.status === "mentioned" && (
            <>
              <li className="flex items-start gap-2">
                <ChevronRight className="h-4 w-4 mt-0.5 text-[var(--copper)]" />
                Strengthen content to move from citation to recommendation
              </li>
              <li className="flex items-start gap-2">
                <ChevronRight className="h-4 w-4 mt-0.5 text-[var(--copper)]" />
                Add structured data to improve AI understanding
              </li>
            </>
          )}
          {card.status === "recommended" && (
            <>
              <li className="flex items-start gap-2">
                <ChevronRight className="h-4 w-4 mt-0.5 text-[var(--copper)]" />
                Monitor competitor content strategies
              </li>
              <li className="flex items-start gap-2">
                <ChevronRight className="h-4 w-4 mt-0.5 text-[var(--copper)]" />
                Expand content to adjacent queries
              </li>
            </>
          )}
          {card.status === "preferred" && (
            <>
              <li className="flex items-start gap-2">
                <ChevronRight className="h-4 w-4 mt-0.5 text-[var(--copper)]" />
                Defend position with regular content updates
              </li>
              <li className="flex items-start gap-2">
                <ChevronRight className="h-4 w-4 mt-0.5 text-[var(--copper)]" />
                Expand to capture related long-tail queries
              </li>
            </>
          )}
        </ul>
      </div>
    </DialogContent>
  );
}

function KanbanColumn({
  status,
  cards,
  onCardClick,
}: {
  status: VisibilityStatus;
  cards: QueryCard[];
  onCardClick: (card: QueryCard) => void;
}) {
  const config = STATUS_CONFIG[status];
  
  return (
    <div className="flex-1 min-w-[280px]">
      <div className={`p-3 rounded-t-xl ${config.bgColor} border-b-2`}>
        <div className="flex items-center gap-2">
          <span className={config.color}>{config.icon}</span>
          <span className={`font-display text-sm ${config.color}`}>
            {config.label}
          </span>
          <Badge variant="secondary" className="ml-auto text-xs">
            {cards.length}
          </Badge>
        </div>
        <p className="text-xs text-gray-500 mt-1">{config.description}</p>
      </div>
      
      <div className="p-3 space-y-3 bg-gray-50/50 min-h-[400px] rounded-b-xl border border-t-0 border-gray-200">
        {cards.map((card) => (
          <VisibilityCard
            key={card.id}
            card={card}
            onClick={() => onCardClick(card)}
          />
        ))}
        {cards.length === 0 && (
          <div className="text-center py-8 text-gray-400 text-sm">
            No queries in this status
          </div>
        )}
      </div>
    </div>
  );
}

export default function VisibilityBoard() {
  const [cards, setCards] = useState<QueryCard[]>([]);
  const [selectedCard, setSelectedCard] = useState<QueryCard | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedPersona, setSelectedPersona] = useState<string | null>(null);
  const [personas, setPersonas] = useState<string[]>([]);

  useEffect(() => {
    async function loadData() {
      try {
        const runsRes = await fetch("/api/runs");
        if (!runsRes.ok) return;
        const runsData = await runsRes.json();
        
        if (!runsData.runs || runsData.runs.length === 0) {
          setLoading(false);
          return;
        }

        const latestRun = runsData.runs[0];
        const runRes = await fetch(`/api/run/${latestRun.id}`);
        if (!runRes.ok) return;
        const runData: RunData = await runRes.json();

        const responsesRes = await fetch(`/api/run/${latestRun.id}/responses`);
        if (!responsesRes.ok) return;
        const responsesData: ResponsesData = await responsesRes.json();

        const lwrRegex = /(lakewood\s*ranch|\blakewood\b|\blwr\b)/i;
        const queryCards: QueryCard[] = [];
        const personaSet = new Set<string>();

        for (const query of runData.queries) {
          const queryResponses = responsesData.responses.filter(
            (r: ResponseWithCitations) => r.query_id === query.id
          );

          const providers: QueryCard["providers"] = [];
          let totalCitations = 0;
          let lakewoodCitations = 0;
          let lakewoodMentionedInText = false;

          const responseDetails: QueryCard["responses"] = [];

          for (const response of queryResponses) {
            const mentioned = response.citations?.length > 0;
            const lwrInCitations = response.citations?.some(
              (c: { domain: string | null; url: string | null }) =>
                c.domain?.toLowerCase().includes("lakewoodranch") ||
                c.url?.toLowerCase().includes("lakewoodranch")
            );
            const lwrInText = lwrRegex.test(response.response_text || "");

            totalCitations += response.citations?.length || 0;
            if (lwrInCitations) lakewoodCitations += 1;
            if (lwrInText) lakewoodMentionedInText = true;

            providers.push({
              provider: response.provider,
              mentioned,
              citationCount: response.citations?.length || 0,
              lakewoodMentioned: lwrInCitations || lwrInText,
            });

            responseDetails.push({
              provider: response.provider,
              model: response.model,
              responseText: response.response_text || "",
              citations: response.citations.map(c => ({
                url: c.url || "unknown",
                domain: c.domain || "unknown",
                title: c.title || "unknown",
              })),
            });
          }

          let status: VisibilityStatus = "blind_spot";
          if (lakewoodMentionedInText && lakewoodCitations > totalCitations * 0.3) {
            status = "preferred";
          } else if (lakewoodMentionedInText || lakewoodCitations > 0) {
            status = "recommended";
          } else if (totalCitations > 0) {
            status = "mentioned";
          }

          const persona = runData.run.config_json?.personaText?.slice(0, 30) || "Default";
          personaSet.add(persona);

          queryCards.push({
            id: query.id,
            queryText: query.query_text,
            persona,
            stage: runData.run.config_json?.triggerStage || "explore",
            status,
            providers,
            totalCitations,
            lakewoodCitations,
            trend: "stable",
            responses: responseDetails,
          });
        }

        setCards(queryCards);
        setPersonas(Array.from(personaSet));
      } catch (err) {
        console.error("Failed to load visibility data:", err);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  const filteredCards = useMemo(() => {
    if (!selectedPersona) return cards;
    return cards.filter((c) => c.persona === selectedPersona);
  }, [cards, selectedPersona]);

  const columnData = useMemo(() => {
    return {
      blind_spot: filteredCards.filter((c) => c.status === "blind_spot"),
      mentioned: filteredCards.filter((c) => c.status === "mentioned"),
      recommended: filteredCards.filter((c) => c.status === "recommended"),
      preferred: filteredCards.filter((c) => c.status === "preferred"),
    };
  }, [filteredCards]);

  const stats = useMemo(() => {
    const total = filteredCards.length;
    return {
      total,
      blindSpot: columnData.blind_spot.length,
      mentioned: columnData.mentioned.length,
      recommended: columnData.recommended.length,
      preferred: columnData.preferred.length,
      visibilityRate: total > 0 
        ? Math.round(((columnData.recommended.length + columnData.preferred.length) / total) * 100)
        : 0,
    };
  }, [filteredCards, columnData]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--paper)] flex items-center justify-center">
        <div className="text-[var(--ink)]/60">Loading visibility data...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--paper)] text-[var(--ink)]">
      <div className="mx-auto max-w-[1600px] px-6 py-8">
        {/* Header */}
        <header className="mb-8">
          <div className="flex items-center gap-4 mb-4">
            <Link href="/">
              <Button variant="ghost" size="sm" className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                Dashboard
              </Button>
            </Link>
          </div>
          <div className="flex items-end justify-between">
            <div>
              <div className="text-xs uppercase tracking-[0.3em] text-[var(--olive)]">
                AI Visibility Baseline
              </div>
              <h1 className="font-display text-3xl text-[var(--forest)]">
                Visibility Board
              </h1>
              <p className="text-sm text-[var(--ink)]/70 mt-1">
                Track your brand&apos;s presence across AI search providers
              </p>
            </div>
            
            {/* Stats Summary - CrUX Style */}
            <div className="flex gap-6">
              <div className="text-center">
                <div className="text-3xl font-bold text-[var(--forest)]">
                  {stats.visibilityRate}%
                </div>
                <div className="text-xs text-gray-500">Visibility Rate</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-emerald-600">
                  {stats.preferred + stats.recommended}
                </div>
                <div className="text-xs text-gray-500">Recommended</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-red-600">
                  {stats.blindSpot}
                </div>
                <div className="text-xs text-gray-500">Blind Spots</div>
              </div>
            </div>
          </div>
        </header>

        {/* Persona Filter */}
        {personas.length > 1 && (
          <div className="mb-6 flex gap-2">
            <Button
              variant={selectedPersona === null ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedPersona(null)}
            >
              All Personas
            </Button>
            {personas.map((p) => (
              <Button
                key={p}
                variant={selectedPersona === p ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedPersona(p)}
              >
                {p}
              </Button>
            ))}
          </div>
        )}

        {/* Overall Visibility Bar - CrUX Style */}
        <Card className="mb-8 border-[var(--panel-border)] bg-[var(--panel)]">
          <CardContent className="pt-6">
            <div className="text-xs uppercase tracking-wider text-gray-500 mb-3">
              Overall Visibility Distribution
            </div>
            <div className="h-10 rounded-lg overflow-hidden flex">
              <div
                className="bg-red-400 flex items-center justify-center text-white text-xs font-medium transition-all"
                style={{ width: `${(stats.blindSpot / stats.total) * 100 || 0}%` }}
              >
                {stats.blindSpot > 0 && stats.blindSpot}
              </div>
              <div
                className="bg-amber-400 flex items-center justify-center text-white text-xs font-medium transition-all"
                style={{ width: `${(stats.mentioned / stats.total) * 100 || 0}%` }}
              >
                {stats.mentioned > 0 && stats.mentioned}
              </div>
              <div
                className="bg-emerald-400 flex items-center justify-center text-white text-xs font-medium transition-all"
                style={{ width: `${(stats.recommended / stats.total) * 100 || 0}%` }}
              >
                {stats.recommended > 0 && stats.recommended}
              </div>
              <div
                className="bg-blue-500 flex items-center justify-center text-white text-xs font-medium transition-all"
                style={{ width: `${(stats.preferred / stats.total) * 100 || 0}%` }}
              >
                {stats.preferred > 0 && stats.preferred}
              </div>
            </div>
            <div className="flex justify-between mt-3 text-xs">
              <span className="flex items-center gap-2">
                <span className="w-3 h-3 rounded bg-red-400"></span>
                Blind Spot ({stats.blindSpot})
              </span>
              <span className="flex items-center gap-2">
                <span className="w-3 h-3 rounded bg-amber-400"></span>
                Mentioned ({stats.mentioned})
              </span>
              <span className="flex items-center gap-2">
                <span className="w-3 h-3 rounded bg-emerald-400"></span>
                Recommended ({stats.recommended})
              </span>
              <span className="flex items-center gap-2">
                <span className="w-3 h-3 rounded bg-blue-500"></span>
                Preferred ({stats.preferred})
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Kanban Board */}
        <div className="flex gap-4 overflow-x-auto pb-4">
          <KanbanColumn
            status="blind_spot"
            cards={columnData.blind_spot}
            onCardClick={setSelectedCard}
          />
          <KanbanColumn
            status="mentioned"
            cards={columnData.mentioned}
            onCardClick={setSelectedCard}
          />
          <KanbanColumn
            status="recommended"
            cards={columnData.recommended}
            onCardClick={setSelectedCard}
          />
          <KanbanColumn
            status="preferred"
            cards={columnData.preferred}
            onCardClick={setSelectedCard}
          />
        </div>

        {/* Query Detail Dialog */}
        <Dialog open={!!selectedCard} onOpenChange={() => setSelectedCard(null)}>
          {selectedCard && (
            <QueryDetailPanel
              card={selectedCard}
              onClose={() => setSelectedCard(null)}
            />
          )}
        </Dialog>
      </div>
    </div>
  );
}
