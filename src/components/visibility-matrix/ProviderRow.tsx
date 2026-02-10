"use client";

import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import { ChevronDown, ChevronRight, Link2, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Provider } from "./types";
import { ReactNode, useMemo } from "react";
import type { Citation } from "@/lib/parsers/types";

interface ResponseItem {
  query: string;
  response: {
    provider: Provider;
    model: string;
    text: string;
    visibility: {
      score: number;
      mentioned: boolean;
      sentiment: "positive" | "negative" | "neutral";
      position: string;
      competitorsMentioned: string[];
      comparisonOutcome?: string;
      recommendationStrength?: string;
    };
    citations?: Citation[];
    latencyMs: number;
    error?: string;
  };
}

type Stage = string; // Changed to string to support dynamic config

interface ProviderRowProps {
  provider: Provider;
  label: string;
  model: string;
  logo: string;
  responses: ResponseItem[];
  mentionCount: number;
  totalCount: number;
  isExpanded: boolean;
  onToggleExpand: () => void;
  brandTerms?: string[]; // Brand name and aliases to highlight
  stage?: Stage; // To show/hide stage-specific badges
}

/**
 * Highlights brand mentions in text with a distinctive style
 */
function highlightBrandMentions(text: string, brandTerms: string[]): ReactNode {
  if (!brandTerms || brandTerms.length === 0) return text;

  // Sort by length (longest first) to match "Lakewood Ranch" before "Lakewood"
  const sortedTerms = [...brandTerms].sort((a, b) => b.length - a.length);

  // Create regex pattern that matches any brand term (case insensitive)
  const pattern = new RegExp(
    `(${sortedTerms.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`,
    'gi'
  );

  const parts = text.split(pattern);

  return parts.map((part, idx) => {
    const isMatch = sortedTerms.some(term =>
      part.toLowerCase() === term.toLowerCase()
    );

    if (isMatch) {
      return (
        <mark
          key={idx}
          className="bg-brand-highlight text-brand-primary px-1 py-0.5 rounded-sm font-semibold not-italic"
        >
          {part}
        </mark>
      );
    }
    return part;
  });
}

function getSentimentBadgeStyle(sentiment: string) {
  switch (sentiment) {
    case "positive":
      return "bg-brand-highlight text-brand-primary";
    case "negative":
      return "bg-[#fce9e9] text-[#b86f3a]";
    default:
      return "bg-[#efe6d9] text-[#1e1b16]/60";
  }
}

function getMentionBadgeStyle(mentioned: boolean) {
  return mentioned
    ? "bg-brand-highlight text-brand-primary"
    : "bg-[#fce9e9] text-[#b86f3a]";
}

export function ProviderRow({
  label,
  model,
  logo,
  responses,
  mentionCount,
  totalCount,
  isExpanded,
  onToggleExpand,
  brandTerms = [],
  stage,
}: ProviderRowProps) {
  // Sentiment is only relevant for Consider stage
  const showSentiment = stage === "consider";

  // Position is relevant for Explore stage (show best position when mentioned)
  const showPosition = stage === "explore" && mentionCount > 0;

  // Get the best position across all responses (1st > 2nd > 3rd > later)
  const getBestPosition = () => {
    const positionRank: Record<string, number> = { "1st": 1, "2nd": 2, "3rd": 3, "later": 4, "absent": 5 };
    let bestPosition = "absent";
    let bestRank = 5;

    for (const r of responses) {
      const pos = r.response.visibility?.position;
      if (pos && positionRank[pos] < bestRank) {
        bestRank = positionRank[pos];
        bestPosition = pos;
      }
    }
    return bestPosition !== "absent" ? bestPosition : null;
  };

  const bestPosition = getBestPosition();

  // Aggregate sentiment across responses
  const aggregateSentiment = () => {
    if (responses.length === 0) return "neutral";
    const sentiments = responses.map((r) => r.response.visibility?.sentiment || "neutral");
    const positiveCount = sentiments.filter((s) => s === "positive").length;
    const negativeCount = sentiments.filter((s) => s === "negative").length;
    if (positiveCount > negativeCount) return "positive";
    if (negativeCount > positiveCount) return "negative";
    return "neutral";
  };

  // Aggregate citations across all responses for this provider
  const citationSummary = useMemo(() => {
    const domainMap = new Map<string, { count: number; sampleUrl?: string }>();

    for (const r of responses) {
      const citations = r.response.citations ?? [];
      for (const citation of citations) {
        const domain = citation.domain.toLowerCase();
        const existing = domainMap.get(domain);
        if (existing) {
          existing.count++;
        } else {
          domainMap.set(domain, { count: 1, sampleUrl: citation.url });
        }
      }
    }

    const sorted = Array.from(domainMap.entries())
      .map(([domain, data]) => ({
        domain,
        count: data.count,
        sampleUrl: data.sampleUrl,
      }))
      .sort((a, b) => b.count - a.count);

    const totalCitations = responses.reduce(
      (sum, r) => sum + (r.response.citations?.length ?? 0),
      0
    );

    return {
      topDomains: sorted.slice(0, 4),
      totalCitations,
      uniqueSources: domainMap.size,
    };
  }, [responses]);

  const sentiment = aggregateSentiment();
  const firstResponse = responses[0]?.response;

  return (
    <div className="border border-brand-secondary bg-white">
      {/* Collapsed Header */}
      <button
        onClick={onToggleExpand}
        className="w-full p-4 flex items-start gap-4 hover:bg-[#faf9f6] transition-colors text-left"
      >
        {/* Provider Logo */}
        <div className="flex-shrink-0 w-10 h-10 flex items-center justify-center bg-[#faf9f6] border border-brand-secondary">
          <Image
            src={logo}
            alt={label}
            width={24}
            height={24}
            className="object-contain"
          />
        </div>

        {/* Provider Info + Preview */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-black uppercase tracking-wider text-black/60">
              {label}
            </span>
            <span className="text-[9px] text-black/30">{model}</span>
          </div>

          {/* Badges */}
          <div className="flex items-center gap-2 mb-2">
            <Badge className={`text-[8px] uppercase px-1.5 py-0 rounded-none border-0 ${getMentionBadgeStyle(mentionCount > 0)}`}>
              {mentionCount > 0 ? `Mentioned ${mentionCount}×` : "Not Mentioned"}
            </Badge>
            {showPosition && bestPosition && (
              <Badge className="text-[8px] uppercase px-1.5 py-0 rounded-none border-0 bg-brand-primary/10 text-brand-primary">
                Position: {bestPosition}
              </Badge>
            )}
            {showSentiment && (
              <Badge className={`text-[8px] uppercase px-1.5 py-0 rounded-none border-0 ${getSentimentBadgeStyle(sentiment)}`}>
                {sentiment}
              </Badge>
            )}
            <Badge className="text-[8px] uppercase px-1.5 py-0 rounded-none border-0 bg-black/5 text-black/40">
              {totalCount} {totalCount === 1 ? "query" : "queries"}
            </Badge>
          </div>

          {/* Preview - Citations or Text */}
          {citationSummary.totalCitations > 0 ? (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[9px] font-bold uppercase text-black/30 flex items-center gap-1">
                <Link2 className="w-3 h-3" />
                Sources:
              </span>
              {citationSummary.topDomains.map(({ domain, count }) => (
                <span key={domain} className="text-[10px] text-black/50">
                  {domain} ({count})
                </span>
              ))}
              {citationSummary.uniqueSources > 4 && (
                <span className="text-[10px] text-black/30">
                  +{citationSummary.uniqueSources - 4} more
                </span>
              )}
            </div>
          ) : firstResponse ? (
            <p className="text-[11px] leading-[1.6] text-black/60 line-clamp-2 font-serif">
              {highlightBrandMentions(firstResponse.text.slice(0, 200) + "...", brandTerms)}
            </p>
          ) : null}
        </div>

        {/* Expand Icon */}
        <div className="flex-shrink-0 mt-1">
          {isExpanded ? (
            <ChevronDown className="w-4 h-4 text-black/30" />
          ) : (
            <ChevronRight className="w-4 h-4 text-black/30" />
          )}
        </div>
      </button>

      {/* Expanded Content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="border-t border-brand-secondary bg-[#faf9f6]/50 divide-y divide-brand-secondary/50">
              {responses.map((item, idx) => (
                <div key={idx} className="p-4">
                  {/* Query */}
                  <div className="flex items-start gap-2 mb-3">
                    <span className="text-[8px] font-black text-black/20 mt-0.5">
                      Q{idx + 1}
                    </span>
                    <p className="text-[10px] font-bold text-black/70 italic">
                      "{item.query}"
                    </p>
                  </div>

                  {/* Response Badges */}
                  <div className="flex items-center gap-2 mb-2 pl-5">
                    <Badge className={`text-[8px] uppercase px-1.5 py-0 rounded-none border-0 ${getMentionBadgeStyle(item.response.visibility?.mentioned)}`}>
                      {item.response.visibility?.mentioned ? "Mentioned" : "Not Mentioned"}
                    </Badge>
                    {showSentiment && (
                      <Badge className={`text-[8px] uppercase px-1.5 py-0 rounded-none border-0 ${getSentimentBadgeStyle(item.response.visibility?.sentiment || "neutral")}`}>
                        {item.response.visibility?.sentiment || "neutral"}
                      </Badge>
                    )}
                    {item.response.visibility?.position && item.response.visibility.position !== "absent" && (
                      <Badge className="text-[8px] uppercase px-1.5 py-0 rounded-none border-0 bg-brand-primary/10 text-brand-primary">
                        Position: {item.response.visibility.position}
                      </Badge>
                    )}
                  </div>

                  {/* Full Response Text */}
                  <div className="pl-5">
                    <p className="text-[11px] leading-[1.7] text-black/70 font-serif whitespace-pre-wrap">
                      {highlightBrandMentions(item.response.text, brandTerms)}
                    </p>

                    {/* Citations for this response */}
                    {item.response.citations && item.response.citations.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-brand-secondary/50">
                        <div className="flex items-center gap-2 mb-2">
                          <Link2 className="w-3 h-3 text-[#6e7c5b]" />
                          <span className="text-[8px] font-black uppercase text-black/30">
                            Cited Sources ({item.response.citations.length})
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {/* Aggregate by domain for this response */}
                          {(() => {
                            const domainMap = new Map<string, { count: number; sampleUrl?: string }>();
                            for (const c of item.response.citations) {
                              const d = c.domain.toLowerCase();
                              const ex = domainMap.get(d);
                              if (ex) ex.count++;
                              else domainMap.set(d, { count: 1, sampleUrl: c.url });
                            }
                            return Array.from(domainMap.entries())
                              .sort((a, b) => b[1].count - a[1].count)
                              .slice(0, 6)
                              .map(([domain, data]) => (
                                <a
                                  key={domain}
                                  href={data.sampleUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 text-[9px] px-2 py-1 bg-[#faf9f6] border border-brand-secondary text-black/60 hover:bg-[#efe6d9] hover:text-black/80 transition-colors"
                                >
                                  {domain}
                                  {data.count > 1 && (
                                    <span className="text-[#6e7c5b] font-bold">{data.count}×</span>
                                  )}
                                  <ExternalLink className="w-2.5 h-2.5 text-black/20" />
                                </a>
                              ));
                          })()}
                        </div>
                      </div>
                    )}

                    {/* Competitors Mentioned */}
                    {item.response.visibility?.competitorsMentioned?.length > 0 && (
                      <div className="mt-3 flex items-center gap-2">
                        <span className="text-[8px] font-black uppercase text-black/30">
                          Also mentioned:
                        </span>
                        <div className="flex flex-wrap gap-1">
                          {item.response.visibility.competitorsMentioned.slice(0, 5).map((comp) => (
                            <Badge
                              key={comp}
                              className="text-[8px] px-1.5 py-0 rounded-none border-0 bg-black/5 text-black/50"
                            >
                              {comp}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {responses.length === 0 && (
                <div className="p-8 text-center">
                  <p className="text-[11px] italic text-black/30">
                    No responses from {label} for this query set.
                  </p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
