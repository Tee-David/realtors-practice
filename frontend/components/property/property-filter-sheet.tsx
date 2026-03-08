"use client";

import { useState, useEffect } from "react";
import { X, SlidersHorizontal } from "lucide-react";
import {
  SideSheet,
  SideSheetContent,
  SideSheetClose,
} from "@/components/ui/side-sheet";
import {
  BottomSheet,
  BottomSheetContent,
  BottomSheetClose,
} from "@/components/ui/bottom-sheet";
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
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const content = (
    <>
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
        {isMobile ? (
          <BottomSheetClose asChild>
            <button
              className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white"
              style={{ backgroundColor: "var(--primary)" }}
            >
              Show {total != null ? total.toLocaleString() : ""} results
            </button>
          </BottomSheetClose>
        ) : (
          <SideSheetClose asChild>
            <button
              className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white"
              style={{ backgroundColor: "var(--primary)" }}
            >
              Show {total != null ? total.toLocaleString() : ""} results
            </button>
          </SideSheetClose>
        )}
      </div>
    </>
  );

  if (isMobile) {
    return (
      <BottomSheet open={open} onOpenChange={onOpenChange} height="85vh">
        <BottomSheetContent>
          <div className="flex flex-col h-full">
            {content}
          </div>
        </BottomSheetContent>
      </BottomSheet>
    );
  }

  return (
    <SideSheet open={open} onOpenChange={onOpenChange} side="left" width="340px">
      <SideSheetContent>
        {content}
      </SideSheetContent>
    </SideSheet>
  );
}
