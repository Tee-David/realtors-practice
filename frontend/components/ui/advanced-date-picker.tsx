"use client";

import * as React from "react";
import { format, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, isSameDay } from "date-fns";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, X, Plus } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

export interface DateRange {
  from: Date | undefined;
  to?: Date | undefined;
}

interface AdvancedDateRangePickerProps {
  value?: DateRange | undefined;
  onChange?: (range: DateRange | undefined) => void;
}

export function AdvancedDateRangePicker({ value, onChange }: AdvancedDateRangePickerProps = {}) {
  const [internalDate, setInternalDate] = React.useState<DateRange | undefined>({
    from: subDays(new Date(), 7),
    to: new Date(),
  });

  const date = value !== undefined ? value : internalDate;
  const setDate = (d: DateRange | undefined) => {
    if (onChange) onChange(d);
    else setInternalDate(d);
  };
  
  const [selectedPreset, setSelectedPreset] = React.useState<string>("Last 7 days");
  const [open, setOpen] = React.useState(false);
  const [enableTime, setEnableTime] = React.useState(false);

  const presets = [
    { label: "This week", getValue: () => ({ from: startOfWeek(new Date(), { weekStartsOn: 1 }), to: endOfWeek(new Date(), { weekStartsOn: 1 }) }) },
    { label: "Next week", getValue: () => { const nextW = new Date(); nextW.setDate(nextW.getDate() + 7); return { from: startOfWeek(nextW, { weekStartsOn: 1 }), to: endOfWeek(nextW, { weekStartsOn: 1 }) } } },
    { label: "Last week", getValue: () => { const lastW = new Date(); lastW.setDate(lastW.getDate() - 7); return { from: startOfWeek(lastW, { weekStartsOn: 1 }), to: endOfWeek(lastW, { weekStartsOn: 1 }) } } },
    { label: "Today", getValue: () => ({ from: new Date(), to: new Date() }) },
    { label: "Last available day", getValue: () => ({ from: subDays(new Date(), 1), to: subDays(new Date(), 1) }) },
    { label: "Last 7 days", getValue: () => ({ from: subDays(new Date(), 7), to: new Date() }) },
    { label: "Last 15 days", getValue: () => ({ from: subDays(new Date(), 15), to: new Date() }) },
    { label: "Last 30 days", getValue: () => ({ from: subDays(new Date(), 30), to: new Date() }) },
    { label: "This month", getValue: () => ({ from: startOfMonth(new Date()), to: endOfMonth(new Date()) }) },
  ];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant={"outline"}
          className={cn(
            "w-full justify-start text-left font-normal",
            !date && "text-muted-foreground"
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {date?.from ? (
            date.to ? (
              <>
                {format(date.from, "LLL dd, y")} - {format(date.to, "LLL dd, y")}
              </>
            ) : (
              format(date.from, "LLL dd, y")
            )
          ) : (
            <span>Pick a date range</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0 z-[9999]" align="start" side="bottom" sideOffset={4} avoidCollisions>
        <div className="flex flex-col sm:flex-row divide-y sm:divide-y-0 sm:divide-x border-b">
           {/* Sidebar Presets */}
           <div className="flex flex-col w-full sm:w-48 py-2">
             <div className="px-3 pb-2 pt-1 border-b mb-2 flex items-center justify-between">
                <span className="text-xs font-semibold text-primary">Date Range</span>
                <Button variant="ghost" size="icon" className="h-6 w-6 rounded text-muted-foreground"><Plus className="w-4 h-4" /></Button>
             </div>
             <div className="flex-1 overflow-y-auto max-h-[300px] px-2 space-y-1">
               {presets.map((preset) => (
                 <button
                   key={preset.label}
                   className={cn(
                     "w-full text-left px-3 py-2 text-sm rounded-md transition-colors",
                     selectedPreset === preset.label
                       ? "bg-primary/10 text-primary font-medium"
                       : "hover:bg-muted text-foreground"
                   )}
                   onClick={() => {
                     setDate(preset.getValue());
                     setSelectedPreset(preset.label);
                   }}
                 >
                   {preset.label}
                 </button>
               ))}
               <button className="w-full text-left px-3 py-2 text-sm rounded-md hover:bg-muted text-foreground flex justify-between items-center group">
                 Custom
                 <ChevronRight className="w-4 h-4 opacity-50 group-hover:opacity-100" />
               </button>
             </div>
             
           </div>

           {/* Calendar Area */}
           <div className="p-4 flex flex-col">
              {/* Top Controls */}
              <div className="flex flex-wrap items-center gap-2 mb-4 justify-between border rounded-md p-1 bg-muted/20">
                 <Select defaultValue="days">
                    <SelectTrigger className="w-[100px] h-8 border-none bg-transparent shadow-none focus:ring-0">
                       <SelectValue placeholder="Days" />
                    </SelectTrigger>
                    <SelectContent>
                       <SelectItem value="days">Days</SelectItem>
                       <SelectItem value="weeks">Weeks</SelectItem>
                       <SelectItem value="months">Months</SelectItem>
                    </SelectContent>
                 </Select>
                 
                 <div className="flex items-center gap-2">
                    <div className="flex items-center border rounded-md px-2 py-1 bg-background shadow-sm h-8">
                       <span className="text-sm font-medium">{date?.from ? format(date.from, "MMM dd, yyyy") : ""}</span>
                       <span className="text-xs text-muted-foreground ml-2">00:00</span>
                    </div>
                    <span className="text-muted-foreground text-sm">to</span>
                    <div className="flex items-center border rounded-md px-2 py-1 bg-background shadow-sm h-8">
                       <span className="text-sm font-medium">{date?.to ? format(date.to, "MMM dd, yyyy") : ""}</span>
                       <span className="text-xs text-muted-foreground ml-2">23:59</span>
                    </div>
                 </div>
                 
                 <Button variant="outline" size="sm" className="h-8 gap-1 ml-4 text-muted-foreground border-dashed">
                    <X className="w-3 h-3" />
                    Exclusion
                 </Button>
              </div>
              
              <div className="flex justify-center flex-1">
                <Calendar
                  mode="range"
                  selected={date as any}
                  onSelect={(d: any) => { setDate(d); setSelectedPreset("Custom"); }}
                  numberOfMonths={1}
                  className="rounded-md border-none p-0"
                  classNames={{
                      months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
                      month: "space-y-4 w-full",
                      caption: "flex justify-center pt-1 relative items-center mb-4",
                      caption_label: "text-sm font-medium hidden", 
                      nav: "space-x-1 flex items-center hidden",
                      table: "w-full border-collapse space-y-1",
                      head_row: "flex w-full mb-2",
                      head_cell: "text-muted-foreground rounded-md w-10 font-medium text-[10px] uppercase tracking-wider text-center",
                      row: "flex w-full mt-2",
                      cell: "relative p-0 text-center text-sm focus-within:relative focus-within:z-20 [&:has([aria-selected])]:bg-primary/10 first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md",
                      day: cn(
                        "h-10 w-10 p-0 font-normal aria-selected:opacity-100 rounded-md hover:bg-muted transition-colors"
                      ),
                      day_selected:
                        "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground rounded-md",
                      day_today: "bg-accent text-accent-foreground",
                      day_outside: "text-muted-foreground opacity-50",
                      day_disabled: "text-muted-foreground opacity-50",
                      day_range_middle:
                        "aria-selected:bg-primary/20 aria-selected:text-primary rounded-none",
                      day_hidden: "invisible",
                  }}
                  components={{
                     MonthCaption: ({ displayMonth }: any) => {
                        return (
                           <div className="flex justify-between items-center w-full px-2">
                              <Button variant="outline" size="icon" className="h-7 w-7 rounded-sm opacity-50 hover:opacity-100"><ChevronLeft className="w-4 h-4" /></Button>
                              <div className="flex gap-2">
                                 <Select defaultValue={format(displayMonth, "MMMM")}>
                                    <SelectTrigger className="h-8 border-none bg-muted/30 shadow-none font-medium text-sm w-[110px]">
                                       <SelectValue placeholder={format(displayMonth, "MMMM")} />
                                    </SelectTrigger>
                                    <SelectContent>
                                       {Array.from({length: 12}).map((_, i) => (
                                          <SelectItem key={i} value={format(new Date(2024, i, 1), "MMMM")}>{format(new Date(2024, i, 1), "MMMM")}</SelectItem>
                                       ))}
                                    </SelectContent>
                                 </Select>
                                 <Select defaultValue={format(displayMonth, "yyyy")}>
                                    <SelectTrigger className="h-8 border-none bg-muted/30 shadow-none font-medium text-sm w-[80px]">
                                       <SelectValue placeholder={format(displayMonth, "yyyy")} />
                                    </SelectTrigger>
                                    <SelectContent>
                                       {[2022, 2023, 2024, 2025, 2026].map((y) => (
                                          <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
                                       ))}
                                    </SelectContent>
                                 </Select>
                              </div>
                              <Button variant="outline" size="icon" className="h-7 w-7 rounded-sm opacity-50 hover:opacity-100"><ChevronRight className="w-4 h-4" /></Button>
                           </div>
                        )
                     }
                  }}
                />
              </div>
           </div>
        </div>

        {/* Footer */}
        <div className="p-3 bg-muted/10 flex items-center justify-between border-t border-t-border/50">
           <div className="flex items-center space-x-2">
              <Switch id="set-time" checked={enableTime} onCheckedChange={setEnableTime} />
              <Label htmlFor="set-time" className="text-sm text-foreground/80 font-medium">Set Time</Label>
           </div>
           
           <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
              <Button size="sm" onClick={() => setOpen(false)} className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold px-6">Apply</Button>
           </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
