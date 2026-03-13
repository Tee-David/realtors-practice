"use client";

import { useCallback, useRef, useEffect } from "react";
import { SearchResultCard } from "./search-result-card";
import { SearchResults } from "./search-results";
import { ActiveScrapeTrigger } from "./active-scrape-trigger";
import { Sparkles, ChevronUp, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Property } from "@/types/property";

interface SearchMapViewProps {
  hits: Property[];
  totalHits: number;
  query: string;
  facets?: Record<string, Record<string, number>>;
  isLoading?: boolean;
  hoveredId: string | null;
  sort: string;
  activeFilters: string[];
  hasMore: boolean;
  parsedInfo?: { bedrooms?: number; propertyType?: string } | null;
  onPropertyClick: (id: string) => void;
  onPropertyHover: (id: string | null) => void;
  onFacetChange: (key: string, value: string) => void;
  onSortChange: (value: string) => void;
  onLoadMore: () => void;
  onClear: () => void;
  onTriggerScrape: () => void;
  scrapeLoading?: boolean;
  /** "split" = 50/50, "panel" = overlay panel on map, "list" = full card view */
  mode?: "split" | "panel" | "list";
  children?: React.ReactNode;
}

export function SearchMapView({
  hits,
  totalHits,
  query,
  facets,
  isLoading,
  hoveredId,
  sort,
  activeFilters,
  hasMore,
  parsedInfo,
  onPropertyClick,
  onPropertyHover,
  onFacetChange,
  onSortChange,
  onLoadMore,
  onClear,
  onTriggerScrape,
  scrapeLoading = false,
  mode = "split",
  children,
}: SearchMapViewProps) {
  const listRef = useRef<HTMLDivElement>(null);

  // Scroll hovered card into view when hovering a map marker
  useEffect(() => {
    if (!hoveredId || !listRef.current) return;
    const el = listRef.current.querySelector(`[data-property-id="${hoveredId}"]`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [hoveredId]);

  if (mode === "list") {
    return (
      <div className="w-full h-full overflow-y-auto p-4 scroller">
        <SearchResults
          hits={hits}
          totalHits={totalHits}
          query={query}
          facets={facets}
          isLoading={isLoading}
          onPropertyClick={onPropertyClick}
          onPropertyHover={onPropertyHover}
          onFacetChange={onFacetChange}
          activeFilters={activeFilters}
          sort={sort}
          onSortChange={onSortChange}
          hasMore={hasMore}
          onLoadMore={onLoadMore}
          onClear={onClear}
        />
      </div>
    );
  }

  // Split or panel mode: map on one side, results on the other
  return (
    <div
      className={cn(
        "w-full h-full flex",
        mode === "split" ? "flex-row" : "relative"
      )}
    >
      {/* Map area */}
      <div className={cn(mode === "split" ? "w-1/2 h-full relative" : "w-full h-full relative")}>
        {children}
      </div>

      {/* Results panel */}
      <div
        className={cn(
          "flex flex-col overflow-hidden",
          mode === "split"
            ? "w-1/2 h-full border-l"
            : "absolute top-[80px] left-4 bottom-4 w-full max-w-[400px] z-[11] rounded-2xl shadow-2xl border"
        )}
        style={{
          backgroundColor: mode === "panel" ? "var(--background)" : "var(--background)",
          borderColor: "var(--border)",
        }}
      >
        {/* Header */}
        <div className="p-4 border-b shrink-0 flex items-center gap-3" style={{ borderColor: "var(--border)" }}>
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
            style={{ backgroundColor: "color-mix(in srgb, var(--primary) 10%, transparent)" }}
          >
            <Sparkles size={18} style={{ color: "var(--primary)" }} />
          </div>
          <div className="min-w-0">
            <h2 className="font-bold text-lg leading-tight truncate" style={{ color: "var(--foreground)" }}>
              {totalHits} results
            </h2>
            <p className="text-xs truncate" style={{ color: "var(--muted-foreground)" }}>
              {parsedInfo
                ? `Showing ${parsedInfo.bedrooms ? `${parsedInfo.bedrooms} bed ` : ""}${parsedInfo.propertyType || "properties"}`
                : query || "All properties"}
            </p>
          </div>
        </div>

        {/* Scrollable result cards */}
        <div ref={listRef} className="flex-1 overflow-y-auto scroller">
          {isLoading ? (
            <div className="p-4 space-y-3">
              {Array.from({ length: 6 }, (_, i) => (
                <div
                  key={i}
                  className="flex gap-3 p-2.5 rounded-xl animate-pulse"
                >
                  <div className="w-[120px] h-[90px] rounded-lg" style={{ backgroundColor: "var(--secondary)" }} />
                  <div className="flex-1 space-y-2 py-1">
                    <div className="h-3 w-4/5 rounded" style={{ backgroundColor: "var(--secondary)" }} />
                    <div className="h-2.5 w-3/5 rounded" style={{ backgroundColor: "var(--secondary)" }} />
                    <div className="h-4 w-2/5 rounded" style={{ backgroundColor: "var(--secondary)" }} />
                  </div>
                </div>
              ))}
            </div>
          ) : hits.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 px-4">
              <p className="text-sm text-center" style={{ color: "var(--muted-foreground)" }}>
                No properties match your search
              </p>
            </div>
          ) : (
            <div className="p-2 space-y-1">
              {hits.map((property) => (
                <div key={property.id} data-property-id={property.id}>
                  <SearchResultCard
                    property={property}
                    isHovered={hoveredId === property.id}
                    onClick={onPropertyClick}
                    onHover={onPropertyHover}
                  />
                </div>
              ))}

              {hasMore && (
                <div className="flex justify-center py-4">
                  <button
                    onClick={onLoadMore}
                    className="px-5 py-2 rounded-xl text-sm font-semibold transition-colors border hover:bg-[var(--secondary)]"
                    style={{
                      backgroundColor: "var(--card)",
                      borderColor: "var(--border)",
                      color: "var(--foreground)",
                    }}
                  >
                    Load More
                  </button>
                </div>
              )}

              <div className="pt-3 pb-4 px-2 border-t" style={{ borderColor: "var(--border)" }}>
                <ActiveScrapeTrigger
                  query={query}
                  onTriggerScrape={onTriggerScrape}
                  isLoading={scrapeLoading}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
