"use client";

import { useState, useCallback, useMemo } from "react";
import { SearchBar } from "@/components/search/search-bar";
import { SearchResults } from "@/components/search/search-results";
import { ActiveScrapeTrigger } from "@/components/search/active-scrape-trigger";
import { DynamicPropertyMap } from "@/components/property/property-map-dynamic";
import { SideSheet, SideSheetContent } from "@/components/ui/side-sheet";
import { PropertyDetailPanel } from "@/components/property/property-detail-panel";
import { useSearch } from "@/hooks/use-search";
import { MapPin, ChevronUp, ChevronDown } from "lucide-react";
import type { Property, PropertyCategory } from "@/types/property";

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<PropertyCategory | "ALL">("ALL");
  const [activeFilters, setActiveFilters] = useState<string[]>([]);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [mapExpanded, setMapExpanded] = useState(false);
  const [scrapeLoading, setScrapeLoading] = useState(false);

  const { data: searchData, isLoading } = useSearch({
    q: query,
    limit: 30,
    filters: activeFilters.length > 0 ? activeFilters : undefined,
    facets: ["categoryName", "listingType", "bedrooms", "state"],
  });

  const hits: Property[] = searchData?.hits || [];
  const totalHits = searchData?.estimatedTotalHits || searchData?.nbHits || hits.length;
  const facets = searchData?.facetDistribution || {};

  // Properties with coordinates for the map
  const mappableProperties = useMemo(
    () => hits.filter((p) => p.latitude && p.longitude),
    [hits]
  );

  const handleSearch = useCallback((q: string, cat?: PropertyCategory | "ALL") => {
    setQuery(q);
    if (cat) setSelectedCategory(cat);
    setActiveFilters([]); // Reset filters on new search
  }, []);

  const handleFacetChange = useCallback((facetKey: string, facetValue: string) => {
    setActiveFilters((prev) => {
      const filter = `${facetKey} = ${facetValue}`;
      if (prev.includes(filter)) {
        return prev.filter((f) => f !== filter);
      }
      return [...prev, filter];
    });
  }, []);

  const handlePropertyClick = useCallback(
    (id: string) => {
      const property = hits.find((p) => p.id === id);
      if (property) setSelectedProperty(property);
    },
    [hits]
  );

  const handleTriggerScrape = useCallback(async () => {
    setScrapeLoading(true);
    // TODO: wire to actual scrape API when ready
    setTimeout(() => setScrapeLoading(false), 3000);
  }, []);

  return (
    <div className="flex flex-col gap-4 mt-2">
      {/* Search Bar */}
      <SearchBar onSearch={handleSearch} initialQuery={query} initialCategory={selectedCategory} />

      {/* Map (top half — collapsible) */}
      {query && (
        <div className="relative">
          <div
            className="rounded-xl overflow-hidden transition-all duration-300"
            style={{
              height: mapExpanded ? "55vh" : "280px",
              backgroundColor: "var(--secondary)",
            }}
          >
            {mappableProperties.length > 0 ? (
              <DynamicPropertyMap
                properties={mappableProperties}
                hoveredId={hoveredId}
                onMarkerClick={handlePropertyClick}
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center gap-2">
                <MapPin size={32} style={{ color: "var(--muted-foreground)" }} />
                <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
                  {isLoading ? "Loading map..." : "No properties with coordinates to display"}
                </p>
              </div>
            )}
          </div>

          {/* Map expand/collapse toggle */}
          <button
            onClick={() => setMapExpanded(!mapExpanded)}
            className="absolute bottom-3 right-3 flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium backdrop-blur-md transition-colors hover:bg-white/30"
            style={{
              backgroundColor: "rgba(0,0,0,0.5)",
              color: "#fff",
            }}
          >
            {mapExpanded ? (
              <>
                <ChevronDown size={14} />
                Collapse
              </>
            ) : (
              <>
                <ChevronUp size={14} />
                Expand
              </>
            )}
          </button>
        </div>
      )}

      {/* Results (bottom half) */}
      {query && (
        <>
          <SearchResults
            hits={hits}
            totalHits={totalHits}
            query={query}
            facets={facets}
            isLoading={isLoading}
            onPropertyClick={handlePropertyClick}
            onPropertyHover={setHoveredId}
            onFacetChange={handleFacetChange}
            activeFilters={activeFilters}
          />

          {/* Voluntary active scrape trigger — always available when searching */}
          {!isLoading && (
            <ActiveScrapeTrigger
              query={query}
              onTriggerScrape={handleTriggerScrape}
              isLoading={scrapeLoading}
            />
          )}
        </>
      )}

      {/* Empty state when no query */}
      {!query && (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <div
            className="w-20 h-20 rounded-full flex items-center justify-center"
            style={{ backgroundColor: "rgba(0, 1, 252, 0.06)" }}
          >
            <MapPin size={32} style={{ color: "var(--primary)" }} />
          </div>
          <div className="text-center max-w-md">
            <h2 className="font-display font-bold text-lg mb-1" style={{ color: "var(--foreground)" }}>
              Search Properties
            </h2>
            <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
              Use natural language to find properties. Try &ldquo;3 bedroom flat in Lekki under 30
              million&rdquo; or &ldquo;land in Ikoyi for sale&rdquo;.
            </p>
          </div>

          {/* Quick search suggestions */}
          <div className="flex flex-wrap justify-center gap-2 mt-2">
            {[
              "3 bed flat in Lekki",
              "Land in Ikoyi",
              "Shortlet in Victoria Island",
              "House under 50m",
              "Commercial in Abuja",
            ].map((suggestion) => (
              <button
                key={suggestion}
                onClick={() => handleSearch(suggestion)}
                className="px-4 py-2 rounded-full text-xs font-medium transition-colors hover:opacity-80"
                style={{
                  backgroundColor: "var(--secondary)",
                  color: "var(--foreground)",
                }}
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Detail Sheet */}
      <SideSheet
        open={!!selectedProperty}
        onOpenChange={(open) => {
          if (!open) setSelectedProperty(null);
        }}
      >
        <SideSheetContent className="w-full sm:max-w-md md:max-w-lg lg:max-w-xl p-0 h-full border-l border-zinc-200 dark:border-white/10 overflow-hidden">
          {selectedProperty && (
            <PropertyDetailPanel
              property={selectedProperty}
              onClose={() => setSelectedProperty(null)}
            />
          )}
        </SideSheetContent>
      </SideSheet>
    </div>
  );
}
