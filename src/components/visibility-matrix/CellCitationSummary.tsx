"use client";

import { useMemo } from "react";
import { Link2, ExternalLink } from "lucide-react";
import type { Citation } from "@/lib/parsers/types";

interface CellCitationSummaryProps {
  citations: Citation[];
  brandDomain?: string; // e.g., "lakewoodranch.com" to highlight if cited
  maxSources?: number;
  isHistorical?: boolean; // true if viewing a historical run (citations not stored in DB)
}

interface DomainCount {
  domain: string;
  count: number;
  isBrand: boolean;
  sampleUrl?: string;
}

export function CellCitationSummary({
  citations,
  brandDomain,
  maxSources = 6,
  isHistorical = false,
}: CellCitationSummaryProps) {
  const { domainCounts, totalCitations, uniqueSources } = useMemo(() => {
    const domainMap = new Map<string, { count: number; sampleUrl?: string }>();

    for (const citation of citations) {
      const domain = citation.domain.toLowerCase();
      const existing = domainMap.get(domain);
      if (existing) {
        existing.count++;
      } else {
        domainMap.set(domain, { count: 1, sampleUrl: citation.url });
      }
    }

    const sorted: DomainCount[] = Array.from(domainMap.entries())
      .map(([domain, data]) => ({
        domain,
        count: data.count,
        isBrand: brandDomain ? domain.includes(brandDomain.toLowerCase()) : false,
        sampleUrl: data.sampleUrl,
      }))
      .sort((a, b) => {
        // Brand domain always first if cited
        if (a.isBrand && !b.isBrand) return -1;
        if (!a.isBrand && b.isBrand) return 1;
        // Then by count
        return b.count - a.count;
      });

    return {
      domainCounts: sorted.slice(0, maxSources),
      totalCitations: citations.length,
      uniqueSources: domainMap.size,
    };
  }, [citations, brandDomain, maxSources]);

  if (totalCitations === 0) {
    return (
      <div className="py-3 px-4 bg-[#faf9f6] border border-dashed border-brand-secondary">
        <div className="flex items-center gap-2 text-black/30">
          <Link2 className="w-3 h-3" />
          <span className="text-[10px] font-medium">
            {isHistorical
              ? "No citations stored for this historical run"
              : "No citations extracted"}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="py-3 px-4 bg-[#faf9f6] border border-brand-secondary">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Link2 className="w-3 h-3 text-[#6e7c5b]" />
          <span className="text-[9px] font-black uppercase tracking-[0.15em] text-black/40">
            Most Cited Sources
          </span>
        </div>
        <span className="text-[9px] text-black/30">
          {totalCitations} citation{totalCitations !== 1 ? "s" : ""} from {uniqueSources} source{uniqueSources !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Domain List */}
      <div className="space-y-1.5">
        {domainCounts.map(({ domain, count, isBrand, sampleUrl }) => (
          <div
            key={domain}
            className={`flex items-center justify-between py-1.5 px-2 rounded-sm ${
              isBrand ? "bg-brand-highlight" : "bg-white"
            }`}
          >
            <div className="flex items-center gap-2 min-w-0">
              {sampleUrl ? (
                <a
                  href={sampleUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`text-[11px] font-medium truncate hover:underline ${
                    isBrand ? "text-brand-primary" : "text-black/70"
                  }`}
                >
                  {domain}
                </a>
              ) : (
                <span className={`text-[11px] font-medium truncate ${
                  isBrand ? "text-brand-primary" : "text-black/70"
                }`}>
                  {domain}
                </span>
              )}
              {sampleUrl && (
                <ExternalLink className="w-2.5 h-2.5 text-black/20 flex-shrink-0" />
              )}
            </div>
            <span className={`text-[10px] font-bold tabular-nums flex-shrink-0 ${
              isBrand ? "text-brand-primary" : "text-black/40"
            }`}>
              {count}×
            </span>
          </div>
        ))}
      </div>

      {/* Show more indicator if truncated */}
      {uniqueSources > maxSources && (
        <div className="mt-2 text-[9px] text-black/30 text-center">
          +{uniqueSources - maxSources} more sources
        </div>
      )}
    </div>
  );
}
