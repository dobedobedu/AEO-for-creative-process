"use client";

import { useState, useRef, useEffect } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface InlineSelectProps {
  value: string;
  options: string[];
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export function InlineSelect({
  value,
  options,
  onChange,
  placeholder = "select...",
  className,
}: InlineSelectProps) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const filteredOptions = options.filter((opt) =>
    opt.toLowerCase().includes(filter.toLowerCase())
  );

  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [open]);

  const handleSelect = (opt: string) => {
    onChange(opt);
    setFilter("");
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex items-center gap-0.5 border-b-2 border-dashed border-[#6e7c5b] px-1 py-0.5 text-[#1f3b2c] font-medium hover:border-[#1f3b2c] hover:bg-[#1f3b2c]/5 transition-colors cursor-pointer min-w-[60px]",
            className
          )}
        >
          <span className={cn(!value && "text-[#1e1b16]/40 italic")}>
            {value || placeholder}
          </span>
          <ChevronDown className="h-3 w-3 text-[#6e7c5b]" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-auto min-w-[160px] max-w-[240px] p-0 border-[#e3dacb] bg-white shadow-lg"
        align="start"
        sideOffset={4}
      >
        <div className="p-2 border-b border-[#e3dacb]">
          <input
            ref={inputRef}
            type="text"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Type to filter..."
            className="w-full px-2 py-1.5 text-xs bg-[#faf9f6] border border-[#e3dacb] rounded focus:outline-none focus:ring-1 focus:ring-[#6e7c5b] text-[#1e1b16]"
          />
        </div>
        <div className="max-h-[200px] overflow-y-auto">
          {filteredOptions.length === 0 ? (
            <div className="px-3 py-2 text-xs text-[#1e1b16]/40 italic">
              No matches
            </div>
          ) : (
            filteredOptions.map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => handleSelect(opt)}
                className={cn(
                  "w-full px-3 py-2 text-xs text-left hover:bg-[#efe6d9] transition-colors",
                  value === opt && "bg-[#1f3b2c]/5 font-medium text-[#1f3b2c]"
                )}
              >
                {opt}
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
