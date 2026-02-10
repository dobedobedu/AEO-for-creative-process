"use client";

import { useMemo } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface WeekNavigatorProps {
  selectedDate: string;
  onDateSelect: (date: string) => void;
  availableDates: string[]; // Dates that have data
  currentWeekStart?: Date;
  onWeekChange?: (newStart: Date) => void;
}

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  // Adjust so Monday is 0
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatShortDate(date: Date): string {
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatISODate(date: Date): string {
  return date.toISOString().split("T")[0];
}

export function WeekNavigator({
  selectedDate,
  onDateSelect,
  availableDates,
  currentWeekStart: externalWeekStart,
  onWeekChange,
}: WeekNavigatorProps) {
  // Calculate week start from selected date if not provided externally
  const weekStart = useMemo(() => {
    if (externalWeekStart) return externalWeekStart;
    return getWeekStart(new Date(selectedDate));
  }, [selectedDate, externalWeekStart]);

  // Generate array of dates for the current week
  const weekDates = useMemo(() => {
    const dates: Date[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(weekStart);
      d.setDate(weekStart.getDate() + i);
      dates.push(d);
    }
    return dates;
  }, [weekStart]);

  const availableDateSet = useMemo(() => new Set(availableDates), [availableDates]);

  const handlePrevWeek = () => {
    const newStart = new Date(weekStart);
    newStart.setDate(weekStart.getDate() - 7);
    if (onWeekChange) {
      onWeekChange(newStart);
    }
    // Select the last available date in the new week, or the first day
    const newWeekDates: string[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(newStart);
      d.setDate(newStart.getDate() + i);
      newWeekDates.push(formatISODate(d));
    }
    const availableInWeek = newWeekDates.filter((d) => availableDateSet.has(d));
    if (availableInWeek.length > 0) {
      onDateSelect(availableInWeek[availableInWeek.length - 1]);
    }
  };

  const handleNextWeek = () => {
    const newStart = new Date(weekStart);
    newStart.setDate(weekStart.getDate() + 7);
    if (onWeekChange) {
      onWeekChange(newStart);
    }
    // Select the first available date in the new week
    const newWeekDates: string[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(newStart);
      d.setDate(newStart.getDate() + i);
      newWeekDates.push(formatISODate(d));
    }
    const availableInWeek = newWeekDates.filter((d) => availableDateSet.has(d));
    if (availableInWeek.length > 0) {
      onDateSelect(availableInWeek[0]);
    }
  };

  return (
    <div className="border-b border-brand-secondary bg-white px-6 py-4">
      <div className="flex items-center justify-center gap-2">
        {/* Previous Week Button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={handlePrevWeek}
          className="h-8 px-2 text-[10px] font-black uppercase tracking-wider text-black/40 hover:text-black hover:bg-black/5 rounded-none"
        >
          <ChevronLeft className="w-4 h-4 mr-1" />
          Week
        </Button>

        {/* Day Tabs */}
        <div className="flex gap-1">
          {weekDates.map((date, idx) => {
            const isoDate = formatISODate(date);
            const hasData = availableDateSet.has(isoDate);
            const isSelected = isoDate === selectedDate;
            const isToday = isoDate === formatISODate(new Date());

            return (
              <button
                key={isoDate}
                onClick={() => hasData && onDateSelect(isoDate)}
                disabled={!hasData}
                className={`
                  flex flex-col items-center px-3 py-2 min-w-[60px] transition-all
                  ${isSelected
                    ? "bg-brand-primary text-white"
                    : hasData
                      ? "bg-[#faf9f6] text-black hover:bg-[#efe6d9]"
                      : "bg-transparent text-black/20 cursor-not-allowed"
                  }
                `}
              >
                <span className="text-[10px] font-black uppercase tracking-wider">
                  {DAYS[idx]}
                </span>
                <span className={`text-[9px] mt-0.5 ${isSelected ? "text-white/70" : "text-black/40"}`}>
                  {formatShortDate(date)}
                </span>
                {hasData && !isSelected && (
                  <div className="w-1 h-1 rounded-full bg-[#6e7c5b] mt-1" />
                )}
                {isToday && !isSelected && (
                  <div className="w-1 h-1 rounded-full bg-[#b86f3a] mt-1" />
                )}
              </button>
            );
          })}
        </div>

        {/* Next Week Button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={handleNextWeek}
          className="h-8 px-2 text-[10px] font-black uppercase tracking-wider text-black/40 hover:text-black hover:bg-black/5 rounded-none"
        >
          Week
          <ChevronRight className="w-4 h-4 ml-1" />
        </Button>
      </div>
    </div>
  );
}
