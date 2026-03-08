"use client";

import { cn } from "@/lib/utils";
import { Home, Building2, TreePine, Sunset, Factory } from "lucide-react";
import type { PropertyCategory } from "@/types/property";

interface CategoryPillsProps {
  value?: PropertyCategory[];
  onChange: (categories: PropertyCategory[] | undefined) => void;
}

const CATEGORIES: { value: PropertyCategory | "ALL"; label: string; icon: React.ElementType }[] = [
  { value: "ALL", label: "All", icon: Home },
  { value: "RESIDENTIAL", label: "Residential", icon: Home },
  { value: "COMMERCIAL", label: "Commercial", icon: Building2 },
  { value: "LAND", label: "Land", icon: TreePine },
  { value: "SHORTLET", label: "Shortlet", icon: Sunset },
  { value: "INDUSTRIAL", label: "Industrial", icon: Factory },
];

export function CategoryPills({ value = [], onChange }: CategoryPillsProps) {
  const isAllActive = value.length === 0;

  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none pt-3">
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
              "flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all border",
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
            {cat.label}
          </button>
        );
      })}
    </div>
  );
}
