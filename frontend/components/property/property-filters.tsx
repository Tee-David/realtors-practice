"use client";

import { useState, useCallback } from "react";
import { Search, X, SlidersHorizontal, ChevronDown } from "lucide-react";
import type { PropertyFilters } from "@/types/property";

interface PropertyFilterSidebarProps {
  filters: PropertyFilters;
  onChange: (filters: PropertyFilters) => void;
  total?: number;
}

const LISTING_TYPES = [
  { value: "", label: "All" },
  { value: "SALE", label: "For Sale" },
  { value: "RENT", label: "For Rent" },
  { value: "LEASE", label: "Lease" },
  { value: "SHORTLET", label: "Shortlet" },
];

const CATEGORIES = [
  { value: "", label: "All" },
  { value: "RESIDENTIAL", label: "Residential" },
  { value: "COMMERCIAL", label: "Commercial" },
  { value: "LAND", label: "Land" },
  { value: "SHORTLET", label: "Shortlet" },
  { value: "INDUSTRIAL", label: "Industrial" },
];

const BEDROOM_OPTIONS = [
  { value: "", label: "Any" },
  { value: "1", label: "1+" },
  { value: "2", label: "2+" },
  { value: "3", label: "3+" },
  { value: "4", label: "4+" },
  { value: "5", label: "5+" },
];

const PRICE_RANGES = [
  { label: "Any", min: undefined, max: undefined },
  { label: "Under ₦5M", min: undefined, max: 5_000_000 },
  { label: "₦5M - ₦20M", min: 5_000_000, max: 20_000_000 },
  { label: "₦20M - ₦50M", min: 20_000_000, max: 50_000_000 },
  { label: "₦50M - ₦100M", min: 50_000_000, max: 100_000_000 },
  { label: "₦100M - ₦500M", min: 100_000_000, max: 500_000_000 },
  { label: "Over ₦500M", min: 500_000_000, max: undefined },
];

const LAGOS_AREAS = [
  "Lekki", "Victoria Island", "Ikoyi", "Ajah", "Ikeja", "Yaba", "Surulere",
  "Gbagada", "Maryland", "Magodo", "Ogba", "Ojodu", "Ilupeju",
  "Banana Island", "Eko Atlantic", "Chevron", "Sangotedo",
];

function FilterSection({ title, children, defaultOpen = true }: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b" style={{ borderColor: "var(--border)" }}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center justify-between w-full py-3 text-xs font-semibold uppercase tracking-wider"
        style={{ color: "var(--muted-foreground)" }}
      >
        {title}
        <ChevronDown
          size={14}
          className="transition-transform"
          style={{ transform: open ? "rotate(180deg)" : "rotate(0)" }}
        />
      </button>
      {open && <div className="pb-4">{children}</div>}
    </div>
  );
}

function PillGroup({ options, value, onChange }: {
  options: { value: string; label: string }[];
  value: string[];
  onChange: (val: string[]) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((opt) => {
        if (opt.value === "") return null; // Skip "All" in multi-select pill groups
        const active = value.includes(opt.value);
        return (
          <button
            key={opt.value}
            onClick={() => {
              const newValue = active
                ? value.filter((v) => v !== opt.value)
                : [...value, opt.value];
              onChange(newValue);
            }}
            className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
            style={{
              backgroundColor: active ? "var(--primary)" : "var(--secondary)",
              color: active ? "var(--primary-foreground)" : "var(--foreground)",
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

export function PropertyFilterSidebar({ filters, onChange, total }: PropertyFilterSidebarProps) {
  const update = useCallback(
    (partial: Partial<PropertyFilters>) => {
      onChange({ ...filters, ...partial, page: 1 });
    },
    [filters, onChange]
  );

  const clearAll = useCallback(() => {
    onChange({ page: 1, limit: 20, sortBy: "createdAt", sortOrder: "desc" });
  }, [onChange]);

  const hasFilters = !!(
    (filters.listingType && filters.listingType.length > 0) ||
    (filters.category && filters.category.length > 0) ||
    (filters.area && filters.area.length > 0) ||
    filters.minPrice || filters.maxPrice ||
    filters.minBedrooms || filters.search || filters.state
  );

  return (
    <div
      className="rounded-2xl p-5 space-y-1 h-fit sticky top-6"
      style={{ backgroundColor: "var(--card)" }}
    >
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b" style={{ borderColor: "var(--border)" }}>
        <div className="flex items-center gap-2">
          <SlidersHorizontal size={16} style={{ color: "var(--primary)" }} />
          <h2 className="font-display font-semibold text-sm" style={{ color: "var(--foreground)" }}>
            Filters
          </h2>
          {total != null && (
            <span
              className="text-xs px-2 py-0.5 rounded-full font-medium"
              style={{ backgroundColor: "var(--secondary)", color: "var(--muted-foreground)" }}
            >
              {total}
            </span>
          )}
        </div>
        {hasFilters && (
          <button
            onClick={clearAll}
            className="flex items-center gap-1 text-xs font-medium transition-colors hover:opacity-80"
            style={{ color: "var(--destructive)" }}
          >
            <X size={12} />
            Clear
          </button>
        )}
      </div>

      {/* Search */}
      <div className="py-3 border-b" style={{ borderColor: "var(--border)" }}>
        <div
          className="flex items-center gap-2 px-3 py-2 rounded-lg"
          style={{ backgroundColor: "var(--secondary)" }}
        >
          <Search size={14} style={{ color: "var(--muted-foreground)" }} />
          <input
            type="text"
            placeholder="Search properties..."
            value={filters.search || ""}
            onChange={(e) => update({ search: e.target.value || undefined })}
            className="bg-transparent text-sm w-full outline-none placeholder:text-[var(--muted-foreground)]"
            style={{ color: "var(--foreground)" }}
          />
        </div>
      </div>

      {/* Listing Type */}
      <FilterSection title="Listing Type">
        <PillGroup
          options={LISTING_TYPES}
          value={filters.listingType || []}
          onChange={(v) => update({ listingType: v as any })}
        />
      </FilterSection>

      {/* Category */}
      <FilterSection title="Category">
        <PillGroup
          options={CATEGORIES}
          value={filters.category || []}
          onChange={(v) => update({ category: v as any })}
        />
      </FilterSection>

      {/* Price Range */}
      <FilterSection title="Price Range">
        <div className="space-y-1.5">
          {PRICE_RANGES.map((range) => {
            const active = filters.minPrice === range.min && filters.maxPrice === range.max;
            return (
              <button
                key={range.label}
                onClick={() => update({ minPrice: range.min, maxPrice: range.max })}
                className="block w-full text-left px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                style={{
                  backgroundColor: active ? "var(--primary)" : "transparent",
                  color: active ? "var(--primary-foreground)" : "var(--foreground)",
                }}
              >
                {range.label}
              </button>
            );
          })}
        </div>
      </FilterSection>

      {/* Bedrooms */}
      <FilterSection title="Bedrooms">
        <PillGroup
          options={BEDROOM_OPTIONS.filter(o => o.value !== "")}
          value={filters.minBedrooms ? [filters.minBedrooms.toString()] : []}
          onChange={(v) => update({ minBedrooms: v.length > 0 ? parseInt(v[0]) : undefined })}
        />
      </FilterSection>

      {/* Area */}
      <FilterSection title="Area" defaultOpen={false}>
        <div className="space-y-1 max-h-48 overflow-y-auto">
          <button
            onClick={() => update({ area: undefined })}
            className="block w-full text-left px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
            style={{
              backgroundColor: !filters.area ? "var(--primary)" : "transparent",
              color: !filters.area ? "var(--primary-foreground)" : "var(--foreground)",
            }}
          >
            All Areas
          </button>
          {LAGOS_AREAS.map((a) => {
            const active = filters.area?.includes(a);
            return (
              <button
                key={a}
                onClick={() => {
                  const area = filters.area || [];
                  const newArea = active
                    ? area.filter((v) => v !== a)
                    : [...area, a];
                  update({ area: newArea.length > 0 ? newArea : undefined });
                }}
                className="block w-full text-left px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                style={{
                  backgroundColor: active ? "var(--primary)" : "transparent",
                  color: active ? "var(--primary-foreground)" : "var(--foreground)",
                }}
              >
                {a}
              </button>
            );
          })}
        </div>
      </FilterSection>
    </div>
  );
}
