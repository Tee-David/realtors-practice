"use client";

import * as React from "react";
import { format, startOfToday, subDays, startOfWeek, endOfWeek, startOfMonth, startOfYear } from "date-fns";
import { Calendar as CalendarIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface DatePickerProps {
  className?: string;
  date?: Date;
  onDateChange?: (date: Date | undefined) => void;
  align?: "center" | "start" | "end";
}

const PRESETS = [
  { label: "Today", getValue: () => startOfToday() },
  { label: "Yesterday", getValue: () => subDays(startOfToday(), 1) },
  { label: "Tomorrow", getValue: () => subDays(startOfToday(), -1) },
  { label: "Next week", getValue: () => subDays(startOfToday(), -7) },
];

export function DatePicker({
  className,
  date,
  onDateChange,
  align = "start",
}: DatePickerProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [tempDate, setTempDate] = React.useState<Date | undefined>(date);

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

  const handlePresetSelect = (preset: { getValue: () => Date }) => {
    setTempDate(preset.getValue());
  };

  return (
    <div className={cn("grid gap-2", className)}>
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            variant={"outline"}
            className={cn(
              "w-[240px] justify-start text-left font-normal bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900",
              !date && "text-muted-foreground",
              className
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4 text-slate-500" />
            {date ? format(date, "PPP") : <span>Pick a date</span>}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align={align}>
          <div className="flex bg-white dark:bg-slate-900 rounded-lg shadow-xl ring-1 ring-slate-200 dark:ring-slate-800">
             {/* Presets Sidebar - Optional for single date but nice to have */}
            <div className="border-r border-slate-200 dark:border-slate-800 p-2 w-[120px] hidden md:block">
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

            <div className="p-0">
              <div className="p-3 border-b border-slate-200 dark:border-slate-800">
                <Calendar
                  mode="single"
                  selected={tempDate}
                  onSelect={setTempDate}
                  initialFocus
                  className="p-0"
                />
              </div>
              <div className="flex items-center justify-between p-3">
                 <div className="text-xs text-muted-foreground px-2">
                    {tempDate ? format(tempDate, "PPP") : "Select date"}
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
