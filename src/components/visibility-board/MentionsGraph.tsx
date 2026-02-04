"use client";

import { motion } from "framer-motion";

export interface MentionDay {
  date: string;
  mentions: number;
  runId?: string;
}

interface MentionsGraphProps {
  data: MentionDay[];
  onHover: (index: number | null) => void;
  hoveredIndex: number | null;
  onSelect?: (runId: string | null, index: number) => void;
  selectedIndex?: number | null;
}

export function MentionsGraph({
  data,
  onHover,
  hoveredIndex,
  onSelect,
  selectedIndex,
}: MentionsGraphProps) {
  if (data.length === 0) {
    return (
      <div className="rounded-xl bg-[#f0ebe2] p-4">
        <div className="flex h-14 items-center justify-center text-xs text-[var(--ink)]/40">
          Loading history...
        </div>
      </div>
    );
  }

  const maxMentions = Math.max(...data.map((d) => d.mentions), 1);

  const formatDateLabel = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  // Show 5 evenly spaced labels
  const labelIndices = [0, 7, 14, 21, 29].filter((i) => i < data.length);

  return (
    <div className="rounded-xl bg-[#f0ebe2] p-4">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[11px] font-medium uppercase tracking-wider text-[var(--ink)]/40">
          Mentions · Last 30 Days
        </span>
        {hoveredIndex !== null && data[hoveredIndex] && (
          <span className="text-xs text-[var(--ink)]/70">
            {formatDateLabel(data[hoveredIndex].date)}:{" "}
            <span className="font-semibold text-[var(--forest)]">
              {data[hoveredIndex].mentions}
            </span>{" "}
            mentions
          </span>
        )}
      </div>

      {/* Bar chart - stacked dashes */}
      <div className="flex h-14 items-end gap-[3px]">
        {data.map((day, i) => {
          // Calculate number of dashes (max 10 dashes)
          const maxDashes = 10;
          const dashCount =
            day.mentions > 0
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
          const isClickable =
            hasRunId || (selectedIndex !== null && selectedIndex !== undefined);

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
                  onSelect?.(null, selectedIndex); // Pass same index to trigger toggle
                }
              }}
            >
              {/* Baseline dash (always visible) */}
              <div
                className={`h-[3px] w-full rounded-full ${
                  isActive ? "bg-transparent" : "bg-[var(--ink)]/10"
                }`}
              />
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
        {labelIndices.map((i) => (
          <span key={data[i]?.date || i}>
            {data[i] ? formatDateLabel(data[i].date) : ""}
          </span>
        ))}
      </div>
    </div>
  );
}
