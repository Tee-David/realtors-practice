"use client";

import * as React from "react";
import { format } from "date-fns";
import { Calendar as CalendarIcon, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface DateTimePickerProps {
  value?: Date;
  onChange?: (date: Date | undefined) => void;
  placeholder?: string;
  className?: string;
}

export function DateTimePicker({ value, onChange, placeholder = "Pick a date", className }: DateTimePickerProps) {
  const [open, setOpen] = React.useState(false);

  // Separate date Date and time string so we can manage them easily
  const [date, setDate] = React.useState<Date | undefined>(value);
  const [time, setTime] = React.useState<string>(
    value ? format(value, "HH:mm") : "12:00"
  );
  
  const [hours, minutes] = time.split(':');
  
  // Update internal state when value prop changes
  React.useEffect(() => {
    if (value) {
      setDate(value);
      setTime(format(value, "HH:mm"));
    } else {
      setDate(undefined);
    }
  }, [value]);

  const handleApply = () => {
    if (date) {
      const [h, m] = time.split(':');
      const newDate = new Date(date);
      newDate.setHours(parseInt(h, 10), parseInt(m, 10), 0, 0);
      onChange?.(newDate);
    } else {
      onChange?.(undefined);
    }
    setOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    setDate(undefined);
    onChange?.(undefined);
  };
  
  const handleHourSelect = (h: string) => {
    setTime(`${h.padStart(2, '0')}:${minutes}`);
  };
  
  const handleMinuteSelect = (m: string) => {
    setTime(`${hours}:${m.padStart(2, '0')}`);
  };

  // Generate hours (00-23)
  const hourOptions = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, '0'));
  
  // Generate minutes (00-59 by 5s)
  const minuteOptions = Array.from({ length: 12 }, (_, i) => (i * 5).toString().padStart(2, '0'));

  return (
    <Popover open={open} onOpenChange={setOpen} modal={false}>
      <PopoverTrigger asChild>
        <div className="relative">
          <Button
            variant={"outline"}
            className={cn(
              "w-full justify-start text-left font-normal border-border/50 bg-secondary/20 hover:bg-secondary/30 focus:ring-1 focus:ring-primary/50",
              !value && "text-muted-foreground hover:text-foreground",
              className
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {value ? format(value, "PPp") : <span>{placeholder}</span>}
          </Button>
          {value && (
            <button
              onClick={handleClear}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-red-400 z-10 rounded-md hover:bg-red-400/10 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </PopoverTrigger>
      <PopoverContent
        className="w-auto max-w-[320px] p-0 !z-[9999] pointer-events-auto border-border shadow-xl rounded-xl overflow-hidden"
        align="start"
        sideOffset={4}
        style={{ zIndex: 9999 }}
        onPointerDownOutside={(e) => {
          // Prevent closing when interacting with elements inside sheets/overlays
          const target = e.target as HTMLElement;
          if (target?.closest?.("[data-slot='popover-content']")) {
            e.preventDefault();
          }
        }}
      >
        <div className="flex flex-col bg-card" onPointerDown={(e) => e.stopPropagation()}>
          {/* Calendar Section */}
          <div className="p-3">
            <Calendar
              mode="single"
              selected={date}
              onSelect={setDate}
              className="p-0 border-none"
              classNames={{
                  months: "flex flex-col space-y-3",
                  month: "space-y-3 w-full",
                  caption: "flex justify-center pt-1 relative items-center mb-2 text-primary",
                  caption_label: "text-sm font-bold tracking-wide",
                  nav: "space-x-1 flex items-center absolute right-0 left-0 justify-between px-1",
                  nav_button: "h-7 w-7 bg-secondary/50 rounded-md p-0 opacity-80 hover:opacity-100 flex items-center justify-center text-muted-foreground hover:bg-secondary transition-colors",
                  table: "w-full border-collapse",
                  head_row: "flex w-full mb-1",
                  head_cell: "text-muted-foreground rounded-md w-8 font-medium text-[10px] uppercase tracking-wider text-center",
                  row: "flex w-full mt-1 gap-0.5",
                  cell: "text-center text-sm p-0 relative [&:has([aria-selected])]:bg-transparent",
                  day: cn(
                    "h-8 w-8 p-0 text-xs font-medium aria-selected:opacity-100 rounded-md hover:bg-secondary transition-colors"
                  ),
                  day_selected:
                    "bg-primary font-bold text-primary-foreground hover:bg-primary shadow-sm hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
                  day_today: "font-semibold text-foreground ring-1 ring-primary/40",
                  day_outside: "text-muted-foreground/30 opacity-50 font-normal",
                  day_disabled: "text-muted-foreground opacity-50",
                  day_hidden: "invisible",
              }}
            />
          </div>

          {/* Compact Time Picker — inline below calendar */}
          <div className="px-3 pb-2 border-t border-border/50 pt-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5 block">Time</span>
            <div className="flex items-center gap-2">
              {/* Hours dropdown */}
              <select
                value={hours}
                onChange={(e) => handleHourSelect(e.target.value)}
                className="flex-1 h-8 rounded-md border border-border/50 bg-secondary/20 px-2 text-sm font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 appearance-none text-center"
              >
                {hourOptions.map((h) => (
                  <option key={h} value={h}>{h}</option>
                ))}
              </select>
              <span className="text-sm font-bold text-muted-foreground">:</span>
              {/* Minutes dropdown */}
              <select
                value={minutes}
                onChange={(e) => handleMinuteSelect(e.target.value)}
                className="flex-1 h-8 rounded-md border border-border/50 bg-secondary/20 px-2 text-sm font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 appearance-none text-center"
              >
                {minuteOptions.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-3 py-2 bg-secondary/30 border-t border-border/50 flex items-center justify-between shrink-0">
           <div className="text-xs font-medium text-muted-foreground">
             {date ? (
               <span className="text-foreground">
                 {format(date, "MMM dd")} at {time}
               </span>
             ) : (
               "No date selected"
             )}
           </div>
           <Button
             size="sm"
             onClick={handleApply}
             disabled={!date}
             className="bg-primary hover:bg-primary/90 font-bold px-4 h-7 text-xs shadow-sm"
           >
             Apply
           </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
