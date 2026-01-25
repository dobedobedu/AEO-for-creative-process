"use client";

import { Skeleton } from "@/components/ui/skeleton";

/**
 * Skeleton placeholder for the Matrix page during initial data load.
 * Matches the actual page layout to give users a preview of content structure.
 */
export function MatrixSkeleton() {
  return (
    <div className="min-h-screen bg-[#f6f1e8]">
      {/* Header Skeleton */}
      <div className="border-b border-[#e3dacb] bg-[var(--panel)]">
        <div className="max-w-6xl mx-auto px-6 py-5 space-y-4">
          {/* Top row: Toggle + Stats */}
          <div className="flex items-center justify-between">
            {/* ViewToggle placeholder */}
            <Skeleton className="h-9 w-48 bg-[#e3dacb]/50" />
            {/* Stats placeholder */}
            <div className="flex items-center gap-4">
              <Skeleton className="h-4 w-20 bg-[#e3dacb]/50" />
              <Skeleton className="h-4 w-32 bg-[#e3dacb]/50" />
            </div>
          </div>
          {/* Title placeholder */}
          <Skeleton className="h-8 w-72 bg-[#e3dacb]/50" />
        </div>
      </div>

      <div className="max-w-6xl mx-auto p-6 space-y-6">
        {/* AI Performance History Card Skeleton */}
        <div className="rounded-none border border-[#e3dacb] bg-white p-8">
          <div className="flex flex-col gap-6 mb-12">
            {/* Top Row: Title + Weighting toggle */}
            <div className="flex items-center justify-between">
              <div className="space-y-2">
                <Skeleton className="h-4 w-44 bg-[#e3dacb]/50" />
                <Skeleton className="h-3 w-56 bg-[#e3dacb]/30" />
              </div>
              <div className="flex items-center gap-3">
                <Skeleton className="h-3 w-16 bg-[#e3dacb]/30" />
                <Skeleton className="h-8 w-32 rounded-full bg-[#e3dacb]/50" />
              </div>
            </div>

            {/* Middle Row: Metric Selector tabs */}
            <div className="flex justify-center">
              <div className="flex gap-8 px-12">
                {[1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className="h-6 w-20 bg-[#e3dacb]/40" />
                ))}
              </div>
            </div>
          </div>

          {/* Chart area + Provider buttons */}
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Chart placeholder */}
            <div className="flex-1 h-[160px]">
              <Skeleton className="h-full w-full bg-[#e3dacb]/30" />
            </div>
            {/* Provider filter buttons */}
            <div className="w-full lg:w-44 flex flex-col gap-2 justify-center">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-10 w-full rounded-xl bg-[#e3dacb]/40" />
              ))}
            </div>
          </div>

          {/* Bottom Row: Time range selector */}
          <div className="flex justify-center mt-8 border-t border-[#e3dacb]/50 pt-6">
            <div className="flex gap-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-6 w-16 bg-[#e3dacb]/40" />
              ))}
            </div>
          </div>

          {/* Legend placeholder */}
          <Skeleton className="h-3 w-96 mx-auto mt-6 bg-[#e3dacb]/20" />
        </div>

        {/* Matrix Grid Skeleton */}
        <div className="mt-8 -mx-6">
          <div className="px-6">
            {/* Tab bar placeholder */}
            <div className="flex gap-1 mb-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-9 w-24 rounded-t bg-[#e3dacb]/40" />
              ))}
            </div>

            {/* Grid header row */}
            <div className="grid grid-cols-5 gap-2 mb-2">
              <Skeleton className="h-10 bg-transparent" /> {/* Empty corner */}
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-10 bg-[#e3dacb]/30" />
              ))}
            </div>

            {/* Grid rows (5 personas x 4 stages) */}
            {[1, 2, 3, 4, 5].map((row) => (
              <div key={row} className="grid grid-cols-5 gap-2 mb-2">
                {/* Persona label */}
                <Skeleton className="h-20 bg-[#e3dacb]/30" />
                {/* Stage cells */}
                {[1, 2, 3, 4].map((col) => (
                  <Skeleton key={col} className="h-20 bg-[#e3dacb]/40" />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
