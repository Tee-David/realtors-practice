"use client";

import React from "react";
import { motion } from "framer-motion";
import { PropertyCard } from "@/components/property/property-card";
import { PropertyListCard } from "@/components/property/property-list-card";
import { Skeleton } from "@/components/ui/skeleton";
import { SearchX, List, LayoutGrid, SlidersHorizontal, Bookmark, ChevronDown, Check, X, Loader2 } from "lucide-react";
import { formatNumber, cn } from "@/lib/utils";
import type { Property } from "@/types/property";
import { useCreateSavedSearch } from "@/hooks/use-saved-searches";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface FacetDistribution {
  [key: string]: { [value: string]: number };
}

interface SearchResultsProps {
  hits: Property[];
  totalHits: number;
  query: string;
  facets?: FacetDistribution;
  isLoading?: boolean;
  onPropertyClick?: (id: string) => void;
  onPropertyHover?: (id: string | null) => void;
  onFacetChange?: (facetKey: string, facetValue: string) => void;
  onClear?: () => void;
  activeFilters?: string[];
  sort?: string;
  onSortChange?: (sortValue: string) => void;
  hasMore?: boolean;
  onLoadMore?: () => void;
  compact?: boolean;
}

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.05 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.25 } },
};

export function SearchResults({
  hits,
  totalHits,
  query,
  facets,
  isLoading,
  onPropertyClick,
  onPropertyHover,
  onFacetChange,
  onClear,
  activeFilters = [],
  sort = "newest",
  onSortChange,
  hasMore = false,
  onLoadMore,
  compact = false,
}: SearchResultsProps) {
  const [viewMode, setViewMode] = React.useState<"grid" | "list">("grid");
  const createSavedSearch = useCreateSavedSearch();

  const SORT_OPTIONS = [
    { value: "newest", label: "Newest First" },
    { value: "price:asc", label: "Price: Low to High" },
    { value: "price:desc", label: "Price: High to Low" },
    { value: "quality:desc", label: "Highest Quality" },
  ];

  /**
   * Parse Meilisearch filter strings (e.g. 'listingType = SALE', 'bedrooms = 3')
   * into the structured filters object the SavedSearch API expects.
   */
  const parseFiltersToObject = (filterStrings: string[]): Record<string, unknown> => {
    const result: Record<string, unknown> = {};
    for (const f of filterStrings) {
      const match = f.match(/^(\w+)\s*=\s*(.+)$/);
      if (!match) continue;
      const [, key, rawValue] = match;
      const value = rawValue.replace(/^["']|["']$/g, "").trim();

      switch (key) {
        case "listingType":
        case "category":
        case "categoryName":
        case "propertyType": {
          const normalizedKey = key === "categoryName" ? "category" : key;
          const existing = result[normalizedKey];
          if (Array.isArray(existing)) {
            (existing as string[]).push(value);
          } else if (typeof existing === "string") {
            result[normalizedKey] = [existing, value];
          } else {
            result[normalizedKey] = value;
          }
          break;
        }
        case "bedrooms":
        case "bathrooms":
        case "parking":
          result[key] = parseInt(value, 10);
          break;
        case "minPrice":
        case "maxPrice":
          result[key] = parseFloat(value);
          break;
        case "state":
        case "area":
        case "furnishing":
          result[key] = value;
          break;
        case "serviced":
          result[key] = value === "true";
          break;
        default:
          result[key] = value;
      }
    }
    return result;
  };

  const handleSaveSearch = () => {
    if (createSavedSearch.isPending) return;

    const filters = parseFiltersToObject(activeFilters);
    const name = query || Object.values(filters).flat().join(", ") || "Untitled Search";

    createSavedSearch.mutate({
      name,
      filters,
      naturalQuery: query || undefined,
      notifyInApp: true,
      notifyEmail: false,
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-6 w-48" />
        <div className={cn("grid gap-4", compact ? "grid-cols-1" : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3")}>
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="rounded-2xl overflow-hidden" style={{ backgroundColor: "var(--card)" }}>
              <Skeleton className="aspect-[4/3] w-full" />
              <div className="p-4 space-y-3">
                <Skeleton className="h-4 w-4/5" />
                <Skeleton className="h-5 w-1/2" />
                <Skeleton className="h-3 w-3/5" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Results header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <h2 className="font-display font-bold text-lg" style={{ color: "var(--foreground)" }}>
            <span style={{ color: "var(--primary)" }}>{formatNumber(totalHits)}</span>{" "}
            {totalHits === 1 ? "Result" : "Results"}
          </h2>
          {query && (
            <span className="text-sm" style={{ color: "var(--muted-foreground)" }}>
              for &ldquo;{query}&rdquo;
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          {/* Clear Results Button */}
          {query && onClear && (
            <button
              onClick={onClear}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors hover:bg-black/5 dark:hover:bg-white/5"
              style={{ color: "var(--destructive)" }}
            >
              <X size={15} />
              Clear Results
            </button>
          )}

          {/* Save Search Button */}
          {(query || activeFilters.length > 0) && (
            <button
              onClick={handleSaveSearch}
              disabled={createSavedSearch.isPending}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-black/5 dark:hover:bg-white/5 transition-colors disabled:opacity-50"
              style={{ color: "var(--primary)" }}
            >
              {createSavedSearch.isPending ? <Loader2 size={15} className="animate-spin" /> : <Bookmark size={15} />}
              {createSavedSearch.isPending ? "Saving..." : "Save Search"}
            </button>
          )}

          {/* Sort Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors border shadow-sm hover:bg-black/5 dark:hover:bg-white/5"
                style={{
                  backgroundColor: "var(--card)",
                  borderColor: "var(--border)",
                  color: "var(--foreground)"
                }}
              >
                Sort: {SORT_OPTIONS.find((s) => s.value === sort)?.label}
                <ChevronDown size={14} className="opacity-50" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[180px]">
              {SORT_OPTIONS.map((option) => (
                <DropdownMenuItem
                  key={option.value}
                  onClick={() => onSortChange?.(option.value)}
                  className="flex items-center justify-between cursor-pointer"
                >
                  {option.label}
                  {sort === option.value && <Check size={14} className="opacity-70" />}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* View toggles */}
          <div
            className="flex items-center rounded-lg p-0.5"
            style={{ backgroundColor: "var(--secondary)" }}
          >
            {([
              { mode: "grid" as const, icon: LayoutGrid },
              { mode: "list" as const, icon: List },
            ]).map(({ mode, icon: Icon }) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className="p-1.5 rounded-md transition-colors"
                style={{
                  backgroundColor: viewMode === mode ? "var(--card)" : "transparent",
                  color: viewMode === mode ? "var(--foreground)" : "var(--muted-foreground)",
                }}
              >
                <Icon size={16} />
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Facet pills - Grouped by dimension */}
      {facets && Object.keys(facets).length > 0 && (
        <div className="flex flex-col gap-3">
          {Object.entries(facets).map(([facetKey, facetValues]) => {
            const values = Object.entries(facetValues)
              .sort(([, a], [, b]) => b - a)
              .slice(0, 8); // Show up to 8 values per group

            if (values.length === 0) return null;

            return (
              <div key={facetKey} className="flex items-center gap-2 flex-wrap">
                <div className="flex items-center gap-1.5 mr-2">
                  <SlidersHorizontal size={12} style={{ color: "var(--muted-foreground)" }} />
                  <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--muted-foreground)" }}>
                    {facetKey}:
                  </span>
                </div>
                {values.map(([value, count]) => {
                  const isActive = activeFilters.includes(`${facetKey} = ${value}`);
                  return (
                    <button
                      key={`${facetKey}-${value}`}
                      onClick={() => onFacetChange?.(facetKey, value)}
                      className="px-3 py-1.5 rounded-full text-xs font-medium transition-colors border"
                      style={{
                        backgroundColor: isActive ? "var(--primary)" : "var(--card)",
                        borderColor: isActive ? "var(--primary)" : "var(--border)",
                        color: isActive ? "#fff" : "var(--foreground)",
                      }}
                    >
                      {value} <span className="opacity-60 text-[10px] ml-1">({count})</span>
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}

      {/* Results grid / list */}
      {hits.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <SearchX size={48} strokeWidth={1} style={{ color: "var(--muted-foreground)" }} />
          <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
            No properties match your search
          </p>
        </div>
      ) : (
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="space-y-8"
        >
          <div className={
            viewMode === "grid"
              ? cn("grid gap-4", compact ? "grid-cols-1" : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3")
              : "flex flex-col gap-3"
          }>
            {hits.map((property) => (
              <motion.div key={property.id} variants={itemVariants}>
                {viewMode === "grid" ? (
                  <PropertyCard
                    property={property}
                    onClick={onPropertyClick}
                    onHover={onPropertyHover}
                  />
                ) : (
                  <PropertyListCard
                    property={property}
                    onClick={onPropertyClick}
                    onHover={onPropertyHover}
                  />
                )}
              </motion.div>
            ))}
          </div>
          
          {hasMore && (
            <div className="flex justify-center pt-4 pb-8">
              <button
                onClick={onLoadMore}
                className="px-6 py-2.5 rounded-xl text-sm font-semibold transition-colors border hover:bg-[var(--secondary)]"
                style={{ 
                  backgroundColor: "var(--card)", 
                  borderColor: "var(--border)",
                  color: "var(--foreground)" 
                }}
              >
                Load More Results
              </button>
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
}

