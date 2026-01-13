"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Search, Layers, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import seed from "@/data/visibility-kanban.json";

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

type SeedData = typeof seed;

type Lane = SeedData["lanes"][number];

type Card = Lane["items"][number];

type Category = "all" | "amenity" | "schools" | "nature" | "activities" | "builders" | "villages";

const CATEGORY_TABS: Array<{ id: Category; label: string; laneIds: string[] }> = [
  { id: "all", label: "All", laneIds: [] },
  { id: "amenity", label: "Amenity", laneIds: ["facilities"] },
  { id: "activities", label: "Activities", laneIds: ["activities"] },
  { id: "schools", label: "Schools", laneIds: ["schools"] },
  { id: "nature", label: "Nature", laneIds: ["parks-trails"] },
  { id: "villages", label: "Villages", laneIds: ["villages"] },
  { id: "builders", label: "Builders", laneIds: ["builders"] },
];

const TAB_TONES: Record<Category, { tint: string; dot: string }> = {
  all: { tint: "bg-white/80", dot: "bg-[#1f3b2c]" },
  amenity: { tint: "bg-[#f5fbf4]", dot: "bg-[#2d5a41]" },
  activities: { tint: "bg-[#fff7ef]", dot: "bg-[#a0582c]" },
  schools: { tint: "bg-[#f5f7ff]", dot: "bg-[#3e5fa3]" },
  nature: { tint: "bg-[#f3fbf8]", dot: "bg-[#3b6d57]" },
  villages: { tint: "bg-[#f8f5ff]", dot: "bg-[#6d4fa8]" },
  builders: { tint: "bg-[#fbf7f0]", dot: "bg-[#8a6a39]" },
};


function formatPercent(value?: number) {
  if (!value || Number.isNaN(value)) return "0%";
  return `${Math.round(value * 100)}%`;
}

function matchesQuery(card: Card, query: string) {
  if (!query.trim()) return true;
  const lowered = query.toLowerCase();
  return [card.label, ...(card.tags ?? [])].some((value) => value.toLowerCase().includes(lowered));
}

export default function VisibilityBoard() {
  const [query, setQuery] = useState("");
  const [selectedCard, setSelectedCard] = useState<Card | null>(null);
  const [activeCategory, setActiveCategory] = useState<Category>("all");

  const allCards = useMemo(() => seed.lanes.flatMap((lane) => lane.items), []);

  const filteredCards = useMemo(() => {
    const category = CATEGORY_TABS.find((tab) => tab.id === activeCategory);
    const categoryCards =
      !category || category.id === "all"
        ? allCards
        : seed.lanes
            .filter((lane) => category.laneIds.includes(lane.id))
            .flatMap((lane) => lane.items);

    return categoryCards.filter((card) => matchesQuery(card, query));
  }, [activeCategory, allCards, query]);

  return (
    <div className="relative min-h-screen bg-[var(--paper)] text-[var(--ink)]">
      <div className="pointer-events-none absolute inset-0 opacity-60">
        <div className="absolute -top-32 left-10 h-72 w-72 rounded-full bg-[radial-gradient(circle,#d7c2a9_0%,rgba(215,194,169,0)_70%)]" />
        <div className="absolute top-24 right-0 h-80 w-80 rounded-full bg-[radial-gradient(circle,#cbd8d0_0%,rgba(203,216,208,0)_70%)]" />
        <div className="absolute bottom-10 left-1/3 h-64 w-64 rounded-full bg-[radial-gradient(circle,#e7d1c5_0%,rgba(231,209,197,0)_70%)]" />
      </div>

      <div className="relative mx-auto flex w-full max-w-7xl flex-col gap-8 px-6 pb-16 pt-10">
        <header className="grid gap-6 rounded-3xl border border-[var(--panel-border)] bg-[var(--panel)] p-6 shadow-[0_18px_50px_rgba(31,59,44,0.1)] lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="ghost" asChild className="gap-2 text-sm">
                <Link href="/">
                  <ArrowLeft className="h-4 w-4" />
                  Back to Console
                </Link>
              </Button>
              <Badge className="bg-[var(--forest)]/10 text-[var(--forest)]">Feature Kanban</Badge>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-[var(--ink)]/50">Coverage Kanban</p>
              <h1 className="mt-3 text-3xl font-semibold text-[var(--forest)] font-display">
                Lakewood Ranch Feature Kanban
              </h1>
              <p className="mt-3 max-w-2xl text-sm text-[var(--ink)]/70">
                Filter by category to focus coverage efforts. Each card shows current mention share.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <div className="relative w-full max-w-sm">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--ink)]/40" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Filter cards (builder, village, golf, school...)"
                  className="w-full rounded-full border border-[var(--panel-border)] bg-white px-10 py-2 text-sm text-[var(--ink)] shadow-inner focus:border-[var(--forest)] focus:outline-none"
                />
              </div>
            </div>
          </div>

          <div className="flex flex-col justify-between gap-6">
            <div className="space-y-2 text-xs text-[var(--ink)]/60">
              <div className="flex items-center gap-2">
                <Layers className="h-4 w-4 text-[var(--copper)]" />
                {filteredCards.length} cards
              </div>
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-[var(--forest)]" />
                Last scan: Jan 10, 2026
              </div>
            </div>
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.25em] text-[var(--ink)]/50">
                Legend
              </div>
              <div className="mt-3 flex flex-wrap gap-2 text-xs text-[var(--ink)]/70">
                {seed.columns.map((column) => {
                  const tone = TONE_STYLES[column.tone];
                  const range =
                    column.id === "blind_spot"
                      ? "0–10%"
                      : column.id === "mentioned"
                      ? "11–30%"
                      : column.id === "recommended"
                      ? "31–60%"
                      : "61%+";
                  return (
                    <div
                      key={`legend-${column.id}`}
                      className={`flex items-center gap-2 rounded-full border px-3 py-1 ${tone.border} ${tone.bg}`}
                    >
                      <span className={`text-xs font-semibold ${tone.text}`}>{column.label}</span>
                      <span className="text-[11px] text-[var(--ink)]/55">{range}</span>
                    </div>
                  );
                })}
              </div>
            </div>
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

          <div className={`grid gap-0 rounded-b-2xl ${TAB_TONES[activeCategory].tint} lg:grid-cols-4`}>
            {seed.columns.map((column, columnIndex) => {
              const tone = TONE_STYLES[column.tone];
              const cards = filteredCards.filter((card) => card.status === column.id);
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
                    {cards.map((card) => (
                      <button
                        key={card.id}
                        type="button"
                        onClick={() => setSelectedCard(card)}
                        className="flex items-center justify-between gap-3 rounded-xl border border-[var(--panel-border)] bg-white px-4 py-3 text-left shadow-[0_10px_20px_rgba(31,59,44,0.08)] transition hover:-translate-y-0.5 hover:shadow-[0_14px_24px_rgba(31,59,44,0.12)]"
                      >
                        <span className="text-sm font-semibold text-[var(--ink)]">{card.label}</span>
                        <Badge className="bg-[var(--mist)] text-[var(--ink)]/70">
                          {formatPercent(card.mentionRate)}
                        </Badge>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <Dialog open={!!selectedCard} onOpenChange={(open) => !open && setSelectedCard(null)}>
        <DialogContent className="max-w-2xl bg-[var(--panel)]">
          <DialogHeader>
            <DialogTitle className="font-display text-lg text-[var(--forest)]">
              {selectedCard?.label}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 text-sm text-[var(--ink)]/80">
            <div className="rounded-2xl border border-[var(--panel-border)] bg-white p-4">
              <div className="text-xs uppercase tracking-[0.3em] text-[var(--ink)]/50">Mention rate</div>
              <div className="mt-2 text-2xl font-semibold text-[var(--forest)]">
                {formatPercent(selectedCard?.mentionRate)}
              </div>
              <div className="mt-1 text-xs text-[var(--ink)]/60">
                {selectedCard?.citations ?? 0} citations · last checked {selectedCard?.lastChecked}
              </div>
            </div>
            <div className="rounded-2xl border border-[var(--panel-border)] bg-white p-4">
              <div className="text-xs uppercase tracking-[0.3em] text-[var(--ink)]/50">Example mention</div>
              <p className="mt-2 text-sm text-[var(--ink)]/75">
                Placeholder: sample citation snippets will appear here once the RAG + benchmark
                data is connected.
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
