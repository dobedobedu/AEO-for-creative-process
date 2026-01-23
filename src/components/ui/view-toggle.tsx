"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type View = "matrix" | "kanban";

interface ViewToggleProps {
  className?: string;
}

export function ViewToggle({ className = "" }: ViewToggleProps) {
  const pathname = usePathname();
  const activeView: View = pathname?.includes("visibility-board") ? "kanban" : "matrix";

  return (
    <div
      className={`inline-flex rounded-full border border-[var(--panel-border)] bg-white p-1 shadow-sm ${className}`}
    >
      <Link
        href="/visibility-matrix"
        className={`flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium transition-all ${
          activeView === "matrix"
            ? "bg-[var(--forest)] text-white shadow-sm"
            : "text-[var(--ink)]/60 hover:text-[var(--ink)] hover:bg-[var(--mist)]"
        }`}
      >
        <span
          className={`h-2 w-2 rounded-full ${
            activeView === "matrix" ? "bg-white" : "bg-[var(--ink)]/30"
          }`}
        />
        Matrix
      </Link>
      <Link
        href="/visibility-board"
        className={`flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium transition-all ${
          activeView === "kanban"
            ? "bg-[var(--forest)] text-white shadow-sm"
            : "text-[var(--ink)]/60 hover:text-[var(--ink)] hover:bg-[var(--mist)]"
        }`}
      >
        <span
          className={`h-2 w-2 rounded-full ${
            activeView === "kanban" ? "bg-white" : "bg-[var(--ink)]/30"
          }`}
        />
        Kanban
      </Link>
    </div>
  );
}
