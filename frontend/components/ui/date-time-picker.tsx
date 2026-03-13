"use client";

import * as React from "react";
import { format } from "date-fns";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, X } from "lucide-react";

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
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <div className="relative">
          <Button
            variant={"outline"}
            className={cn(
              "w-full justify-start text-left font-normal border-border/50 bg-secondary/20 hover:bg-secondary/40 focus:ring-1 focus:ring-primary/50",
              !value && "text-muted-foreground",
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
      <PopoverContent className="w-auto p-0 z-[1000] border-border shadow-xl rounded-xl overflow-hidden" align="start">
        <div className="flex bg-card">
          {/* Calendar Section */}
          <div className="p-3 border-r border-border/50">
            <Calendar
              mode="single"
              selected={date}
              onSelect={setDate}
              className="p-0 border-none"
              classNames={{
                  months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
                  month: "space-y-4 w-full",
                  caption: "flex justify-center pt-1 relative items-center mb-4 text-primary",
                  caption_label: "text-sm font-bold tracking-wide", 
                  nav: "space-x-1 flex items-center absolute right-0 left-0 justify-between px-1",
                  nav_button: "h-7 w-7 bg-secondary/50 rounded-md p-0 opacity-80 hover:opacity-100 flex items-center justify-center text-muted-foreground hover:bg-secondary transition-colors",
                  table: "w-full border-collapse space-y-1",
                  head_row: "flex w-full mb-2",
                  head_cell: "text-muted-foreground rounded-md w-9 font-medium text-[10px] uppercase tracking-wider text-center",
                  row: "flex w-full mt-2 gap-1",
                  cell: "text-center text-sm p-0 relative [&:has([aria-selected])]:bg-transparent",
                  day: cn(
                    "h-9 w-9 p-0 font-medium aria-selected:opacity-100 rounded-md hover:bg-secondary transition-colors"
                  ),
                  day_selected:
                    "bg-primary font-bold text-primary-foreground hover:bg-primary shadow-sm hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
                  day_today: "bg-accent/20 text-accent font-semibold",
                  day_outside: "text-muted-foreground/30 opacity-50 font-normal",
                  day_disabled: "text-muted-foreground opacity-50",
                  day_hidden: "invisible",
              }}
            />
          </div>
          
          {/* Time Picker Section */}
          <div className="flex flex-col min-w-[120px] bg-secondary/10">
            <div className="px-3 py-2 border-b border-border/50 bg-secondary/30 shrink-0">
               <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Time</span>
            </div>
            
            <div className="flex flex-1 overflow-hidden h-[280px]">
               {/* Hours */}
               <div className="flex-1 border-r border-border/50 overflow-y-auto scroller px-1 py-1">
                  {hourOptions.map((h) => (
                    <button
                      key={h}
                      onClick={() => handleHourSelect(h)}
                      className={cn(
                        "w-full py-1.5 px-2 text-sm text-center rounded-md mb-0.5 transition-colors",
                        hours === h 
                          ? "bg-primary text-primary-foreground font-bold shadow-sm"
                          : "text-foreground hover:bg-secondary hover:text-foreground font-medium"
                      )}
                    >
                      {h}
                    </button>
                  ))}
               </div>
               
               {/* Minutes */}
               <div className="flex-1 overflow-y-auto scroller px-1 py-1">
                  {minuteOptions.map((m) => (
                    <button
                      key={m}
                      onClick={() => handleMinuteSelect(m)}
                      className={cn(
                        "w-full py-1.5 px-2 text-sm text-center rounded-md mb-0.5 transition-colors",
                        minutes === m 
                          ? "bg-primary/20 text-primary font-bold"
                          : "text-foreground hover:bg-secondary hover:text-foreground font-medium"
                      )}
                    >
                      {m}
                    </button>
                  ))}
               </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 bg-secondary/30 border-t border-border/50 flex items-center justify-between shrink-0">
           <div className="text-sm font-medium text-muted-foreground">
             {date ? (
               <span className="text-foreground">
                 {format(date, "MMM dd, yyyy")} at {time}
               </span>
             ) : (
               "No date selected"
             )}
           </div>
           <Button 
             size="sm" 
             onClick={handleApply} 
             disabled={!date}
             className="bg-primary hover:bg-primary/90 font-bold px-6 shadow-sm"
           >
             Apply
           </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
