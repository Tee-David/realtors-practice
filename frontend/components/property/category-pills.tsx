"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Home, Building2, TreePine, Sunset, Factory, Building, Key, Briefcase, Store, Warehouse, ChevronLeft, ChevronRight } from "lucide-react";
import type { PropertyCategory } from "@/types/property";

interface CategoryPillsProps {
  value?: PropertyCategory[];
  onChange: (categories: PropertyCategory[] | undefined) => void;
}

const CATEGORIES: { value: PropertyCategory | "ALL" | string; label: string; icon: React.ElementType }[] = [
  { value: "ALL", label: "All", icon: Home },
  { value: "RESIDENTIAL", label: "Residential", icon: Home },
  { value: "COMMERCIAL", label: "Commercial", icon: Building2 },
  { value: "LAND", label: "Land", icon: TreePine },
  { value: "SHORTLET", label: "Shortlet", icon: Sunset },
  { value: "APARTMENT", label: "Apartment", icon: Building },
  { value: "VILLA", label: "Villa", icon: Home },
  { value: "BUNGALOW", label: "Bungalow", icon: Home },
  { value: "TERRACE", label: "Terrace", icon: Building2 },
  { value: "PENTHOUSE", label: "Penthouse", icon: Key },
  { value: "DUPLEX", label: "Duplex", icon: Building },
  { value: "MANSION", label: "Mansion", icon: Home },
  { value: "STUDIO", label: "Studio", icon: Key },
  { value: "OFFICE", label: "Office", icon: Briefcase },
  { value: "SHOP", label: "Shop", icon: Store },
  { value: "WAREHOUSE", label: "Warehouse", icon: Warehouse },
];

export function CategoryPills({ value = [], onChange }: CategoryPillsProps) {
  const isAllActive = value.length === 0;
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const checkScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 4);
  }, []);

  useEffect(() => {
    checkScroll();
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener("scroll", checkScroll, { passive: true });
    window.addEventListener("resize", checkScroll);
    return () => {
      el.removeEventListener("scroll", checkScroll);
      window.removeEventListener("resize", checkScroll);
    };
  }, [checkScroll]);

  const scroll = (dir: "left" | "right") => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: dir === "left" ? -200 : 200, behavior: "smooth" });
  };

  return (
    <div className="relative flex items-center pt-3 w-full">
      {/* Left arrow */}
      {canScrollLeft && (
        <button
          onClick={() => scroll("left")}
          className="absolute left-0 z-10 w-8 h-8 flex items-center justify-center rounded-full border shadow-md transition-colors"
          style={{ backgroundColor: "var(--card)", borderColor: "var(--border)", color: "var(--foreground)" }}
        >
          <ChevronLeft size={16} />
        </button>
      )}

      {/* Scrollable pills */}
      <div
        ref={scrollRef}
        className={cn(
          "flex items-center gap-2 overflow-x-auto pb-2 w-full scroll-smooth",
          canScrollLeft ? "pl-9" : "pl-0",
          canScrollRight ? "pr-9" : "pr-0"
        )}
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        <div className="flex items-center gap-2 w-max">
          {CATEGORIES.map((cat) => {
            const isActive = cat.value === "ALL" ? isAllActive : value.includes(cat.value as PropertyCategory);
            const Icon = cat.icon;
            return (
              <button
                key={cat.value}
                onClick={() => {
                  if (cat.value === "ALL") {
                    onChange(undefined);
                    return;
                  }
                  const category = cat.value as PropertyCategory;
                  const nextValue = value.includes(category)
                    ? value.filter((v) => v !== category)
                    : [...value, category];
                  onChange(nextValue.length > 0 ? nextValue : undefined);
                }}
                className={cn(
                  "flex items-center justify-center gap-2 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all border shrink-0",
                  isActive
                    ? "border-transparent"
                    : "border-[var(--border)] hover:border-[var(--primary)]"
                )}
                style={{
                  backgroundColor: isActive ? "var(--primary)" : "var(--card)",
                  color: isActive ? "var(--primary-foreground)" : "var(--foreground)",
                }}
              >
                <Icon size={16} />
                <span>{cat.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Right arrow */}
      {canScrollRight && (
        <button
          onClick={() => scroll("right")}
          className="absolute right-0 z-10 w-8 h-8 flex items-center justify-center rounded-full border shadow-md transition-colors"
          style={{ backgroundColor: "var(--card)", borderColor: "var(--border)", color: "var(--foreground)" }}
        >
          <ChevronRight size={16} />
        </button>
      )}
    </div>
  );
}
