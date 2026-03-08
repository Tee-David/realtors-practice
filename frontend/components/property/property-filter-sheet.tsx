"use client";

import { X, SlidersHorizontal } from "lucide-react";
import {
  SideSheet,
  SideSheetContent,
  SideSheetClose,
} from "@/components/ui/side-sheet";
import { PropertyFilterSidebar } from "./property-filters";
import type { PropertyFilters } from "@/types/property";

interface PropertyFilterSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: PropertyFilters;
  onChange: (filters: PropertyFilters) => void;
  total?: number;
}

export function PropertyFilterSheet({ open, onOpenChange, filters, onChange, total }: PropertyFilterSheetProps) {
  return (
    <SideSheet open={open} onOpenChange={onOpenChange} side="left" width="340px">
      <SideSheetContent>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <SlidersHorizontal size={18} style={{ color: "var(--primary)" }} />
            <h2 className="font-display font-bold text-base" style={{ color: "var(--foreground)" }}>
              Filters
            </h2>
            {total != null && (
              <span
                className="text-xs px-2 py-0.5 rounded-full font-medium"
                style={{ backgroundColor: "var(--secondary)", color: "var(--muted-foreground)" }}
              >
                {total.toLocaleString()}
              </span>
            )}
          </div>
          <SideSheetClose asChild>
            <button className="p-1.5 rounded-lg transition-colors hover:bg-[var(--secondary)]">
              <X size={18} style={{ color: "var(--muted-foreground)" }} />
            </button>
          </SideSheetClose>
        </div>

        <div className="flex-1 overflow-y-auto -mx-1">
          <PropertyFilterSidebar filters={filters} onChange={onChange} total={total} />
        </div>

        <div className="pt-4 flex gap-2">
          <button
            onClick={() => onChange({ page: 1, limit: 20, sortBy: "createdAt", sortOrder: "desc" })}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium"
            style={{ backgroundColor: "var(--secondary)", color: "var(--foreground)" }}
          >
            Clear all
          </button>
          <SideSheetClose asChild>
            <button
              className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white"
              style={{ backgroundColor: "var(--primary)" }}
            >
              Show {total != null ? total.toLocaleString() : ""} results
            </button>
          </SideSheetClose>
        </div>
      </SideSheetContent>
    </SideSheet>
  );
}
