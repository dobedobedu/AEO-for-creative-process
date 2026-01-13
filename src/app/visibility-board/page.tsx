"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Sparkles,
  Search,
  Wand2,
  Layers,
  ShieldCheck,
  ListChecks,
} from "lucide-react";
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

  const filteredLanes = useMemo(() => {
    return seed.lanes.map((lane) => ({
      ...lane,
      items: lane.items.filter((card) => matchesQuery(card, query)),
    }));
  }, [query]);

  return (
    <div className="relative min-h-screen bg-[var(--paper)] text-[var(--ink)]">
      <div className="pointer-events-none absolute inset-0 opacity-60">
        <div className="absolute -top-32 left-10 h-72 w-72 rounded-full bg-[radial-gradient(circle,#d7c2a9_0%,rgba(215,194,169,0)_70%)]" />
        <div className="absolute top-24 right-0 h-80 w-80 rounded-full bg-[radial-gradient(circle,#cbd8d0_0%,rgba(203,216,208,0)_70%)]" />
        <div className="absolute bottom-10 left-1/3 h-64 w-64 rounded-full bg-[radial-gradient(circle,#e7d1c5_0%,rgba(231,209,197,0)_70%)]" />
      </div>

      <div className="relative mx-auto flex w-full max-w-7xl flex-col gap-10 px-6 pb-16 pt-10">
        <header className="grid gap-6 rounded-3xl border border-[var(--panel-border)] bg-[var(--panel)] p-6 shadow-[0_18px_50px_rgba(31,59,44,0.1)] lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="ghost" asChild className="gap-2 text-sm">
                <Link href="/">
                  <ArrowLeft className="h-4 w-4" />
                  Back to Console
                </Link>
              </Button>
              <Badge className="bg-[var(--forest)]/10 text-[var(--forest)]">Visibility Rows</Badge>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-[var(--ink)]/50">Coverage Kanban</p>
              <h1 className="mt-3 text-3xl font-semibold text-[var(--forest)] font-display">
                Lakewood Ranch Feature Kanban
              </h1>
              <p className="mt-3 max-w-2xl text-sm text-[var(--ink)]/70">
                Builders, villages, facilities, activities, schools, and parks each get their own
                lane. Move cards forward as AI coverage improves.
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
              <div className="flex items-center gap-3">
                <Button variant="outline" className="gap-2 border-[var(--panel-border)]">
                  <Wand2 className="h-4 w-4" />
                  Simulate Agent Moves
                </Button>
                <Button className="gap-2 bg-[var(--forest)] text-white hover:bg-[#244837]">
                  <Sparkles className="h-4 w-4" />
                  Run Coverage Scan
                </Button>
              </div>
            </div>
          </div>

          <div className="flex flex-col justify-between gap-6">
            <div className="space-y-2 text-xs text-[var(--ink)]/60">
              <div className="flex items-center gap-2">
                <Layers className="h-4 w-4 text-[var(--copper)]" />
                {seed.lanes.length} lanes
              </div>
              <div className="flex items-center gap-2">
                <ListChecks className="h-4 w-4 text-[var(--olive)]" />
                {seed.columns.length} visibility tiers
              </div>
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-[var(--forest)]" />
                Last scan: Jan 10, 2026
              </div>
            </div>
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.25em] text-[var(--ink)]/50">
                Visibility Legend
              </div>
              <div className="mt-3 grid gap-2 text-xs text-[var(--ink)]/70">
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
                      className={`flex items-center justify-between rounded-full border px-3 py-1.5 ${tone.border} ${tone.bg}`}
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

        <div className="space-y-8">
          {filteredLanes.map((lane) => (
            <section key={lane.id} className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold text-[var(--forest)] font-display">{lane.label}</h2>
                  <p className="text-xs text-[var(--ink)]/50">{lane.items.length} cards</p>
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-4">
                {seed.columns.map((column) => {
                  const tone = TONE_STYLES[column.tone];
                  const cards = lane.items.filter((card) => card.status === column.id);
                  return (
                    <div
                      key={`${lane.id}-${column.id}`}
                      className={`flex min-h-[220px] flex-col gap-4 rounded-2xl border p-4 ${tone.border} ${tone.bg} ${tone.glow}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h3 className={`text-sm font-semibold ${tone.text}`}>{column.label}</h3>
                          <p className="text-[11px] text-[var(--ink)]/55">{column.description}</p>
                        </div>
                        <span className="rounded-full bg-white px-2 py-1 text-[11px] font-semibold text-[var(--ink)]/70">
                          {cards.length}
                        </span>
                      </div>

                      <div className="flex flex-1 flex-col gap-3">
                        {cards.map((card) => (
                          <button
                            key={card.id}
                            type="button"
                            onClick={() => setSelectedCard(card)}
                            className="flex items-center justify-between gap-3 rounded-2xl border border-white/60 bg-white/85 px-4 py-3 text-left shadow-[0_12px_24px_rgba(31,59,44,0.08)] transition hover:-translate-y-1 hover:shadow-[0_18px_30px_rgba(31,59,44,0.12)]"
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
            </section>
          ))}
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
