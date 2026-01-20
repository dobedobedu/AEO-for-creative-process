"use client";

type ViewMode = "summary" | "intents" | "queries" | "answers";

interface ViewModeToggleProps {
  mode: ViewMode;
  onModeChange: (mode: ViewMode) => void;
}

export function ViewModeToggle({ mode, onModeChange }: ViewModeToggleProps) {
  return (
    <div className="flex items-center gap-1 w-full max-w-[1600px] mx-auto px-8">
      {(["summary", "intents", "queries", "answers"] as const).map((m) => (
        <button
          key={m}
          onClick={() => onModeChange(m)}
          className={`
            px-8 py-3 text-[11px] font-black uppercase tracking-[0.2em] transition-all relative rounded-t-xl
            ${mode === m
              ? "bg-[#faf9f6] text-black border-t border-l border-r border-[#e3dacb] -mb-[1px] z-10"
              : "bg-transparent text-black/30 hover:text-black/50 hover:bg-black/5"
            }
          `}
        >
          {m}
        </button>
      ))}
    </div>
  );
}
