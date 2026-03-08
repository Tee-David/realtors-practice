"use client";

import * as React from "react";
import { format, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear, startOfToday } from "date-fns";
import { Calendar as CalendarIcon, Check } from "lucide-react";
import { DateRange } from "react-day-picker";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface DateRangePickerProps {
  className?: string;
  date?: DateRange;
  onDateChange?: (date: DateRange | undefined) => void;
  align?: "center" | "start" | "end";
}

const PRESETS = [
  { label: "Today", getValue: () => ({ from: startOfToday(), to: startOfToday() }) },
  { label: "Yesterday", getValue: () => ({ from: subDays(startOfToday(), 1), to: subDays(startOfToday(), 1) }) },
  { label: "This week", getValue: () => ({ from: startOfWeek(startOfToday(), { weekStartsOn: 1 }), to: endOfWeek(startOfToday(), { weekStartsOn: 1 }) }) },
  { label: "Last week", getValue: () => ({ from: subDays(startOfWeek(startOfToday(), { weekStartsOn: 1 }), 7), to: subDays(endOfWeek(startOfToday(), { weekStartsOn: 1 }), 7) }) },
  { label: "This month", getValue: () => ({ from: startOfMonth(startOfToday()), to: endOfMonth(startOfToday()) }) },
  { label: "Last month", getValue: () => ({ from: startOfMonth(subDays(startOfToday(), 30)), to: endOfMonth(subDays(startOfToday(), 30)) }) },
  { label: "This year", getValue: () => ({ from: startOfYear(startOfToday()), to: endOfYear(startOfToday()) }) },
  { label: "Last year", getValue: () => ({ from: startOfYear(subDays(startOfToday(), 365)), to: endOfYear(subDays(startOfToday(), 365)) }) },
];

export function DateRangePicker({
  className,
  date,
  onDateChange,
  align = "start",
}: DateRangePickerProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [tempDate, setTempDate] = React.useState<DateRange | undefined>(date);

  // Sync internal state with prop
  React.useEffect(() => {
    setTempDate(date);
  }, [date]);

  const handleApply = () => {
    onDateChange?.(tempDate);
    setIsOpen(false);
  };

  const handleCancel = () => {
    setTempDate(date);
    setIsOpen(false);
  };

  const handlePresetSelect = (preset: { getValue: () => DateRange }) => {
    setTempDate(preset.getValue());
  };

  return (
    <div className={cn("grid gap-2", className)}>
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            id="date"
            variant={"outline"}
            className={cn(
              "w-[260px] justify-start text-left font-normal bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900 transition-all",
              !date && "text-muted-foreground"
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4 text-slate-500" />
            {date?.from ? (
              date.to ? (
                <>
                  {format(date.from, "LLL dd, y")} -{" "}
                  {format(date.to, "LLL dd, y")}
                </>
              ) : (
                format(date.from, "LLL dd, y")
              )
            ) : (
              <span>Pick a date</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align={align}>
          <div className="flex bg-white dark:bg-slate-900 rounded-lg shadow-xl ring-1 ring-slate-200 dark:ring-slate-800">
            {/* Presets Sidebar */}
            <div className="border-r border-slate-200 dark:border-slate-800 p-2 w-[140px] hidden md:block">
              <div className="flex flex-col gap-1">
                {PRESETS.map((preset) => (
                  <Button
                    key={preset.label}
                    variant="ghost"
                    size="sm"
                    className="justify-start font-normal hover:bg-slate-100 dark:hover:bg-slate-800"
                    onClick={() => handlePresetSelect(preset)}
                  >
                    {preset.label}
                  </Button>
                ))}
              </div>
            </div>

            {/* Calendar Area */}
            <div className="p-0">
              <div className="p-3 border-b border-slate-200 dark:border-slate-800">
                <Calendar
                  initialFocus
                  mode="range"
                  defaultMonth={tempDate?.from}
                  selected={tempDate}
                  onSelect={setTempDate}
                  numberOfMonths={2}
                  className="p-0"
                />
              </div>
              
              {/* Footer */}
              <div className="flex items-center justify-between p-3">
                 <div className="text-xs text-muted-foreground">
                    {tempDate?.from ? (
                       <>
                         {format(tempDate.from, "MMM dd")}
                         {tempDate.to ? ` - ${format(tempDate.to, "MMM dd, yyyy")}` : ""}
                       </>
                    ) : (
                        "Select range"
                    )}
                 </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={handleCancel} className="h-8">
                    Cancel
                  </Button>
                  <Button size="sm" onClick={handleApply} className="h-8 bg-emerald-600 hover:bg-emerald-700 text-white">
                    Apply
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
