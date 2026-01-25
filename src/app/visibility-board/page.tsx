"use client";

import { useMemo, useState, useEffect, useCallback, useRef } from "react";
import { Search, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ViewToggle } from "@/components/ui/view-toggle";

// Types for mentions history
interface MentionDay {
  date: string;
  mentions: number;
  runId?: string;
}

const TONE_STYLES: Record<string, { border: string; bg: string; text: string; glow: string }> = {
  rose: {
    border: "border-[#e5b1ad]",
    bg: "bg-[#fdf3f2]",
    text: "text-[#9c3d38]",
    glow: "shadow-[0_18px_40px_rgba(189,96,90,0.15)]",
  },
  amber: {
    border: "border-[#e9c993]",
    bg: "bg-[#fff7e7]",
    text: "text-[#9b6a2c]",
    glow: "shadow-[0_18px_40px_rgba(205,160,80,0.18)]",
  },
  emerald: {
    border: "border-[#a6cfb1]",
    bg: "bg-[#eef8f1]",
    text: "text-[#2f6b43]",
    glow: "shadow-[0_18px_40px_rgba(73,140,102,0.18)]",
  },
  indigo: {
    border: "border-[#b7c3e4]",
    bg: "bg-[#f2f4ff]",
    text: "text-[#435b9b]",
    glow: "shadow-[0_18px_40px_rgba(89,111,176,0.18)]",
  },
};

// Status columns with updated thresholds (80/60/40)
const COLUMNS = [
  { id: "preferred", label: "Preferred", description: "≥ 80% mentions", tone: "indigo" },
  { id: "recommended", label: "Recommended", description: "60–79%", tone: "emerald" },
  { id: "mentioned", label: "Mentioned", description: "40–59%", tone: "amber" },
  { id: "blind_spot", label: "Blind Spot", description: "< 40%", tone: "rose" },
] as const;

// API response types
interface KanbanItem {
  id: string;
  label: string;
  status: string;
  mentionRate: number;
  mentionCount: number;
  totalResponses: number;
  avgSentiment: number | null;
  byProvider: Record<string, { mentions: number; total: number; rate: number }>;
}

interface KanbanLane {
  id: string;
  label: string;
  description: string | null;
  items: KanbanItem[];
}

interface KanbanRun {
  id: string;
  status: string;
  completed_at: string | null;
  created_at: string;
  brand: string | null;
  timestamp: string | null;
}

interface KanbanData {
  runId: string;
  run: KanbanRun | null;
  lanes: KanbanLane[];
  thresholds: {
    preferred: number;
    recommended: number;
    mentioned: number;
    blind_spot: number;
  };
  mentionsHistory?: MentionDay[];
}

// Mentions Graph Component
function MentionsGraph({
  data,
  onHover,
  hoveredIndex,
  onSelect,
  selectedIndex
}: {
  data: MentionDay[];
  onHover: (index: number | null) => void;
  hoveredIndex: number | null;
  onSelect?: (runId: string | null, index: number) => void;
  selectedIndex?: number | null;
}) {
  if (data.length === 0) {
    return (
      <div className="rounded-xl bg-[#f0ebe2] p-4">
        <div className="flex h-14 items-center justify-center text-xs text-[var(--ink)]/40">
          Loading history...
        </div>
      </div>
    );
  }

  const maxMentions = Math.max(...data.map(d => d.mentions), 1);

  const formatDateLabel = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  // Show 5 evenly spaced labels
  const labelIndices = [0, 7, 14, 21, 29].filter(i => i < data.length);

  return (
    <div className="rounded-xl bg-[#f0ebe2] p-4">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[11px] font-medium uppercase tracking-wider text-[var(--ink)]/40">
          Mentions · Last 30 Days
        </span>
        {hoveredIndex !== null && data[hoveredIndex] && (
          <span className="text-xs text-[var(--ink)]/70">
            {formatDateLabel(data[hoveredIndex].date)}: <span className="font-semibold text-[var(--forest)]">{data[hoveredIndex].mentions}</span> mentions
          </span>
        )}
      </div>

      {/* Bar chart - stacked dashes */}
      <div className="flex h-14 items-end gap-[3px]">
        {data.map((day, i) => {
          // Calculate number of dashes (max 10 dashes)
          const maxDashes = 10;
          const dashCount = day.mentions > 0
            ? Math.max(Math.round((day.mentions / maxMentions) * maxDashes), 1)
            : 0;
          const isHovered = hoveredIndex === i;
          const isSelected = selectedIndex === i;
          const isActive = day.mentions > 0;
          const hasRunId = !!day.runId;

          // Calculate opacity based on selection state
          const getOpacity = () => {
            if (selectedIndex !== null) {
              return isSelected ? 1 : 0.25;
            }
            return isHovered ? 1 : 0.45;
          };

          // Allow clicking on bars with data, or clicking anywhere if something is selected (to deselect)
          const isClickable = hasRunId || (selectedIndex !== null && selectedIndex !== undefined);

          return (
            <div
              key={day.date}
              className={`flex flex-1 flex-col-reverse gap-[2px] ${
                isClickable ? "cursor-pointer" : "cursor-default"
              }`}
              onMouseEnter={() => onHover(i)}
              onMouseLeave={() => onHover(null)}
              onClick={() => {
                if (hasRunId) {
                  onSelect?.(day.runId!, i);
                } else if (selectedIndex !== null && selectedIndex !== undefined) {
                  // Clicking on empty bar when something is selected → deselect
                  onSelect?.(null, selectedIndex);  // Pass same index to trigger toggle
                }
              }}
            >
              {/* Baseline dash (always visible) */}
              <div className={`h-[3px] w-full rounded-full ${isActive ? "bg-transparent" : "bg-[var(--ink)]/10"}`} />
              {/* Stacked dashes - animated opacity */}
              {Array.from({ length: dashCount }).map((_, dashIndex) => (
                <motion.div
                  key={dashIndex}
                  className="h-[3px] w-full rounded-full bg-[var(--forest)]"
                  animate={{ opacity: getOpacity() }}
                  transition={{ duration: 0.2, ease: "easeOut" }}
                />
              ))}
            </div>
          );
        })}
      </div>

      {/* Date labels */}
      <div className="mt-2 flex justify-between text-[10px] text-[var(--ink)]/35">
        {labelIndices.map(i => (
          <span key={data[i]?.date || i}>{data[i] ? formatDateLabel(data[i].date) : ""}</span>
        ))}
      </div>
    </div>
  );
}

type Category = "all" | "amenities" | "activities" | "schools" | "nature" | "villages" | "builders" | "location" | "accolades";

const CATEGORY_TABS: Array<{ id: Category; label: string }> = [
  { id: "all", label: "All" },
  { id: "amenities", label: "Amenities" },
  { id: "activities", label: "Activities" },
  { id: "schools", label: "Schools" },
  { id: "nature", label: "Nature" },
  { id: "villages", label: "Villages" },
  { id: "builders", label: "Builders" },
  { id: "location", label: "Location" },
  { id: "accolades", label: "Accolades" },
];

// Vibrant oatmeal tones for category tabs
const TAB_TONES: Record<Category, { tint: string; dot: string }> = {
  all:        { tint: "bg-[#efe8db]", dot: "bg-[#8b7355]" },
  amenities:  { tint: "bg-[#f2ebde]", dot: "bg-[#9a7f5f]" },
  activities: { tint: "bg-[#ede5d7]", dot: "bg-[#a68a68]" },
  schools:    { tint: "bg-[#f0e9dc]", dot: "bg-[#8f7452]" },
  nature:     { tint: "bg-[#ebe3d4]", dot: "bg-[#9c8263]" },
  villages:   { tint: "bg-[#eee7da]", dot: "bg-[#876e4e]" },
  builders:   { tint: "bg-[#e9e1d2]", dot: "bg-[#b0926c]" },
  location:   { tint: "bg-[#ece4d6]", dot: "bg-[#947858]" },
  accolades:  { tint: "bg-[#f1eadd]", dot: "bg-[#83694b]" },
};

// Card background colors by status
const CARD_BG: Record<string, string> = {
  preferred: "bg-[#e8f0fc]",    // soft blue
  recommended: "bg-[#e6f4ea]",  // soft green
  mentioned: "bg-[#f0eafa]",    // soft lavender
  blind_spot: "bg-[#fceaea]",   // soft red/rose
};

function formatPercent(value?: number) {
  if (value === undefined || value === null || Number.isNaN(value)) return "0%";
  return `${Math.round(value * 100)}%`;
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function matchesQuery(item: KanbanItem, query: string) {
  if (!query.trim()) return true;
  const lowered = query.toLowerCase();
  return item.label.toLowerCase().includes(lowered);
}

function getSentimentLabel(score: number | null): string {
  if (score === null) return "No data";
  if (score >= 0.3) return "Positive";
  if (score <= -0.3) return "Negative";
  return "Neutral";
}

export default function VisibilityBoard() {
  const [query, setQuery] = useState("");
  const [selectedItem, setSelectedItem] = useState<KanbanItem | null>(null);
  const [activeCategory, setActiveCategory] = useState<Category>("all");
  const [data, setData] = useState<KanbanData | null>(null);
  const [loading, setLoading] = useState(true);
  const [kanbanLoading, setKanbanLoading] = useState(false);  // Separate loading for Kanban only
  const [error, setError] = useState<string | null>(null);
  const [hoveredBarIndex, setHoveredBarIndex] = useState<number | null>(null);
  const [mentionsHistory, setMentionsHistory] = useState<MentionDay[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [selectedBarIndex, setSelectedBarIndex] = useState<number | null>(null);
  const [initialData, setInitialData] = useState<KanbanData | null>(null);  // Cache initial (latest) run data
  const initialLoadDone = useRef(false);

  const handleBarHover = useCallback((index: number | null) => {
    setHoveredBarIndex(index);
  }, []);

  const handleBarSelect = useCallback((runId: string | null, index: number | null) => {
    // Toggle behavior: if clicking the same bar, deselect
    if (index === selectedBarIndex) {
      setSelectedRunId(null);
      setSelectedBarIndex(null);
      // Restore cached initial data (latest run)
      if (initialData) {
        setData(initialData);
      }
    } else {
      setSelectedRunId(runId);
      setSelectedBarIndex(index);
    }
  }, [selectedBarIndex, initialData]);

  const handleBackToNow = useCallback(() => {
    setSelectedRunId(null);
    setSelectedBarIndex(null);
    // Restore cached initial data (no refetch needed)
    if (initialData) {
      setData(initialData);
    }
  }, [initialData]);

  // Effect 1: Initial load (latest run + mentionsHistory)
  useEffect(() => {
    async function initialFetch() {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch("/api/kanban");
        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.error || "Failed to fetch data");
        }
        const json = await res.json();
        setData(json);
        setInitialData(json);  // Cache initial (latest) run data
        if (json.mentionsHistory) {
          setMentionsHistory(json.mentionsHistory);
        }
        initialLoadDone.current = true;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    }
    initialFetch();
  }, []);

  // Effect 2: Refetch only Kanban when specific date selected (skip if null - use initial data)
  useEffect(() => {
    if (!initialLoadDone.current) return;  // Wait for initial load
    if (selectedRunId === null) return;  // Initial data already restored in handleBackToNow

    async function fetchKanban() {
      setKanbanLoading(true);
      try {
        const res = await fetch(`/api/kanban?runId=${selectedRunId}`);
        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.error || "Failed to fetch data");
        }
        const json = await res.json();
        // Keep mentionsHistory from initial load, only update lanes and run
        setData(prev => ({
          ...prev!,
          lanes: json.lanes,
          run: json.run,
          runId: json.runId,
        }));
      } catch (err) {
        console.error("Error fetching run data:", err);
      } finally {
        setKanbanLoading(false);
      }
    }
    fetchKanban();
  }, [selectedRunId]);

  // Flatten all items from lanes
  const allItems = useMemo(() => {
    if (!data) return [];
    return data.lanes.flatMap((lane) => lane.items);
  }, [data]);

  // Filter items by category and search query
  const filteredItems = useMemo(() => {
    let items = allItems;

    // Filter by category
    if (activeCategory !== "all" && data) {
      const lane = data.lanes.find((l) => l.id === activeCategory);
      items = lane ? lane.items : [];
    }

    // Filter by search query
    return items.filter((item) => matchesQuery(item, query));
  }, [activeCategory, allItems, query, data]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--paper)]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-[var(--forest)]" />
          <span className="text-sm text-[var(--ink)]/60">Loading Kanban data...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--paper)]">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="text-lg font-semibold text-[var(--ink)]">Failed to load data</div>
          <p className="text-sm text-[var(--ink)]/60">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-2 rounded-full border border-[var(--panel-border)] bg-white px-4 py-2 text-sm font-medium hover:bg-[var(--mist)]"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-[var(--paper)] text-[var(--ink)]">
      <div className="pointer-events-none absolute inset-0 opacity-60">
        <div className="absolute -top-32 left-10 h-72 w-72 rounded-full bg-[radial-gradient(circle,#d7c2a9_0%,rgba(215,194,169,0)_70%)]" />
        <div className="absolute top-24 right-0 h-80 w-80 rounded-full bg-[radial-gradient(circle,#cbd8d0_0%,rgba(203,216,208,0)_70%)]" />
        <div className="absolute bottom-10 left-1/3 h-64 w-64 rounded-full bg-[radial-gradient(circle,#e7d1c5_0%,rgba(231,209,197,0)_70%)]" />
      </div>

      <div className="relative mx-auto flex w-full max-w-7xl flex-col gap-8 px-6 pb-16 pt-10">
        <header className="space-y-5 rounded-3xl border border-[var(--panel-border)] bg-[var(--panel)] p-6 shadow-[0_18px_50px_rgba(31,59,44,0.1)]">
          {/* Top row: Toggle + Stats */}
          <div className="flex items-center justify-between">
            <ViewToggle />
            <div className="flex items-center gap-4 text-sm text-[var(--ink)]/60">
              {selectedRunId ? (
                <>
                  <span className="text-[var(--ink)]/60">
                    Viewing: <span className="font-medium text-[var(--ink)]">{formatDate(data?.run?.completed_at || data?.run?.created_at)}</span>
                  </span>
                  <button
                    onClick={handleBackToNow}
                    className="rounded-full bg-[var(--coral)] px-3 py-1 text-xs font-medium text-white transition hover:bg-[var(--coral)]/90"
                  >
                    Back to Now
                  </button>
                </>
              ) : (
                <>
                  <span><span className="font-semibold text-[var(--ink)]">{allItems.length}</span> entities</span>
                  <span className="text-[var(--ink)]/30">·</span>
                  <span>Last scan <span className="font-medium text-[var(--ink)]">{formatDate(data?.run?.completed_at || data?.run?.created_at)}</span></span>
                </>
              )}
            </div>
          </div>

          {/* Title */}
          <h1 className="text-2xl font-semibold text-[var(--forest)] font-display">
            Lakewood Ranch Feature Visibility
          </h1>

          {/* Mentions Graph */}
          <MentionsGraph
            data={mentionsHistory}
            onHover={handleBarHover}
            hoveredIndex={hoveredBarIndex}
            onSelect={handleBarSelect}
            selectedIndex={selectedBarIndex}
          />

          {/* Search */}
          <div className="relative max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--ink)]/40" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search a selling point..."
              className="w-full rounded-full border border-[var(--panel-border)] bg-white px-10 py-2.5 text-sm text-[var(--ink)] shadow-inner focus:border-[var(--forest)] focus:outline-none"
            />
          </div>
        </header>

        <div className="overflow-hidden rounded-2xl border border-[var(--panel-border)] bg-white/80">
          <div className="flex flex-wrap gap-2 border-b border-[var(--panel-border)] px-3 pt-3">
            {CATEGORY_TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveCategory(tab.id)}
                className={`relative -mb-px flex items-center gap-2 rounded-t-xl border px-3 py-1.5 text-xs font-semibold transition ${
                  activeCategory === tab.id
                    ? `z-10 border-[var(--panel-border)] border-b-transparent text-[var(--ink)] shadow-[0_-8px_16px_rgba(31,59,44,0.08)] ${TAB_TONES[tab.id].tint}`
                    : "border-[var(--panel-border)] bg-transparent text-[var(--ink)]/50 hover:bg-white/60"
                }`}
              >
                <span
                  className={`h-2.5 w-2.5 rounded-full border border-[var(--panel-border)] ${
                    activeCategory === tab.id ? TAB_TONES[tab.id].dot : "bg-white/70"
                  }`}
                />
                {tab.label}
              </button>
            ))}
          </div>

          <motion.div
            className={`grid gap-0 rounded-b-2xl ${TAB_TONES[activeCategory].tint} lg:grid-cols-4`}
            animate={{ opacity: kanbanLoading ? 0.5 : 1 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            style={{ pointerEvents: kanbanLoading ? "none" : "auto" }}
          >
            {COLUMNS.map((column, columnIndex) => {
              const tone = TONE_STYLES[column.tone];
              const cards = filteredItems.filter((item) => item.status === column.id);
              return (
                <div
                  key={column.id}
                  className={`flex min-h-[320px] flex-col gap-4 px-5 py-4 ${
                    columnIndex === 0 ? "" : "border-l border-[var(--panel-border)]"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className={`text-sm font-semibold ${tone.text}`}>{column.label}</h3>
                      <span className="text-[11px] text-[var(--ink)]/45">{column.description}</span>
                    </div>
                    <span className={`rounded-full border px-2 py-1 text-[11px] font-semibold ${tone.border} ${tone.bg} ${tone.text}`}>
                      {cards.length}
                    </span>
                  </div>

                  <div className="flex flex-1 flex-col gap-3">
                    {cards.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setSelectedItem(item)}
                        className={`flex items-center justify-between gap-3 rounded-xl border border-[var(--panel-border)] px-4 py-3 text-left shadow-[0_10px_20px_rgba(31,59,44,0.08)] transition hover:-translate-y-0.5 hover:shadow-[0_14px_24px_rgba(31,59,44,0.12)] ${CARD_BG[item.status] || "bg-white"}`}
                      >
                        <span className="text-sm font-semibold text-[#4a4035]">{item.label}</span>
                        <Badge className="bg-white/60 text-[#5c4d3d] font-medium">
                          {formatPercent(item.mentionRate)}
                        </Badge>
                      </button>
                    ))}
                    {cards.length === 0 && (
                      <div className="flex flex-1 items-center justify-center text-xs text-[var(--ink)]/40">
                        No entities in this status
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </motion.div>
        </div>
      </div>

      <Dialog open={!!selectedItem} onOpenChange={(open) => !open && setSelectedItem(null)}>
        <DialogContent className="max-w-2xl bg-[var(--panel)]">
          <DialogHeader>
            <DialogTitle className="font-display text-lg text-[var(--forest)]">
              {selectedItem?.label}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 text-sm text-[var(--ink)]/80">
            <div className="rounded-2xl border border-[var(--panel-border)] bg-white p-4">
              <div className="text-xs uppercase tracking-[0.3em] text-[var(--ink)]/50">Mention rate</div>
              <div className="mt-2 text-2xl font-semibold text-[var(--forest)]">
                {formatPercent(selectedItem?.mentionRate)}
              </div>
              <div className="mt-1 text-xs text-[var(--ink)]/60">
                {selectedItem?.mentionCount ?? 0} mentions across {selectedItem?.totalResponses ?? 0} responses
              </div>
            </div>
            <div className="rounded-2xl border border-[var(--panel-border)] bg-white p-4">
              <div className="text-xs uppercase tracking-[0.3em] text-[var(--ink)]/50">Sentiment</div>
              <div className="mt-2 text-lg font-semibold text-[var(--ink)]">
                {getSentimentLabel(selectedItem?.avgSentiment ?? null)}
              </div>
              {selectedItem?.avgSentiment !== null && selectedItem?.avgSentiment !== undefined && (
                <div className="mt-1 text-xs text-[var(--ink)]/60">
                  Score: {selectedItem.avgSentiment.toFixed(2)} (range: -1 to +1)
                </div>
              )}
            </div>
            {selectedItem?.byProvider && Object.keys(selectedItem.byProvider).length > 0 && (
              <div className="rounded-2xl border border-[var(--panel-border)] bg-white p-4">
                <div className="text-xs uppercase tracking-[0.3em] text-[var(--ink)]/50">By Provider</div>
                <div className="mt-3 space-y-2">
                  {Object.entries(selectedItem.byProvider).map(([provider, stats]) => (
                    <div key={provider} className="flex items-center justify-between text-sm">
                      <span className="capitalize text-[var(--ink)]/70">{provider}</span>
                      <span className="font-medium">
                        {formatPercent(stats.rate)} ({stats.mentions}/{stats.total})
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
