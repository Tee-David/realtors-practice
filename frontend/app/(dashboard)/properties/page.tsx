"use client";

import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { formatDistanceToNowStrict } from "date-fns";
import { PropertyGrid } from "@/components/property/property-grid";
import { PropertyListCard } from "@/components/property/property-list-card";
import { CategoryPills } from "@/components/property/category-pills";
import { DynamicPropertyMap } from "@/components/property/property-map-dynamic";
import { PropertyDetailPanel } from "@/components/property/property-detail-panel";
import { PropertyFilterSheet } from "@/components/property/property-filter-sheet";
import { Pagination } from "@/components/property/pagination";
import TextType from "@/components/ui/TextType";
import { useProperties } from "@/hooks/useProperties";
import { MOCK_PROPERTIES } from "@/lib/mock-data";
import {
  LayoutGrid,
  List,
  Map,
  SlidersHorizontal,
  Search,
  ChevronDown,
  X,
  Building2,
  Clock,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { AIInsightPlaceholder } from "@/components/ai/ai-placeholder";
import {
  SideSheet,
  SideSheetContent,
} from "@/components/ui/side-sheet";
import type { PropertyFilters, Property } from "@/types/property";
import ModernLoader from "@/components/ui/modern-loader";
import { Skeleton } from "@/components/ui/skeleton";

const DEFAULT_FILTERS: PropertyFilters = {
  page: 1,
  limit: 24,
  sortBy: "createdAt",
  sortOrder: "desc",
};

const SORT_OPTIONS = [
  { value: "createdAt", label: "Newest" },
  { value: "price", label: "Price" },
  { value: "qualityScore", label: "Quality" },
  { value: "bedrooms", label: "Bedrooms" },
];

const DESKTOP_GRID_OPTIONS = [2, 3, 4, 5, 6] as const;
const MOBILE_GRID_OPTIONS = [1, 2, 3] as const;
const PER_PAGE_OPTIONS = [12, 24, 48, 96] as const;

const SEARCH_EXAMPLES = [
  "3 bedroom flat in Lekki under 5M",
  "Detached duplex in Ikoyi with pool",
  "2 bed apartment in Abuja under 3M",
  "Land for sale in Ajah below 20M",
  "Furnished studio in Victoria Island",
];

/** Pluralize a word: "property" -> "properties", with correct singular */
function pluralize(count: number, singular: string, plural?: string): string {
  return count === 1 ? singular : (plural || singular + "s");
}

export default function PropertiesPage() {
  const [filters, setFilters] = useState<PropertyFilters>(DEFAULT_FILTERS);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [gridCols, setGridCols] = useState(3);
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(null);
  const [hoveredPropertyId, setHoveredPropertyId] = useState<string | null>(null);
  const [showMap, setShowMap] = useState(true);
  const [mobileMapExpanded, setMobileMapExpanded] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [hasToggledMap, setHasToggledMap] = useState(false);

  // Initialize for mobile
  useEffect(() => {
    const isMobile = window.innerWidth < 640;
    if (isMobile) {
      setGridCols(2);
      setShowMap(false);
    }
    
    // Listen for mobile nav filter toggle
    const handleToggleFilters = () => setFilterSheetOpen(true);
    document.addEventListener("toggle-mobile-filters", handleToggleFilters);
    return () => document.removeEventListener("toggle-mobile-filters", handleToggleFilters);
  }, []);

  const { data, isLoading, dataUpdatedAt, isFetching, refetch } = useProperties(filters);

  // Re-render every 30s so the "Updated X ago" text stays fresh
  const [, setTick] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(interval);
  }, []);

  const STALE_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes
  const isStale = dataUpdatedAt > 0 && Date.now() - dataUpdatedAt > STALE_THRESHOLD_MS;

  const apiProperties = data?.data || [];
  const useMock = process.env.NODE_ENV === "development" && apiProperties.length === 0;
  const properties = useMock ? MOCK_PROPERTIES : apiProperties;
  const total = data?.meta?.total || (useMock ? MOCK_PROPERTIES.length : 0);
  const totalPages = data?.meta?.totalPages || 1;

  const selectedProperty = useMemo(
    () => properties.find((p: Property) => p.id === selectedPropertyId) || null,
    [properties, selectedPropertyId]
  );

  const handleFilterChange = useCallback((newFilters: PropertyFilters) => {
    setFilters(newFilters);
  }, []);

  const handleCardClick = useCallback((id: string) => {
    setSelectedPropertyId(id);
  }, []);

  const handleMarkerClick = useCallback((id: string) => {
    setSelectedPropertyId(id);
  }, []);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.listingType && filters.listingType.length > 0) count++;
    if (filters.category && filters.category.length > 0) count++;
    if (filters.minPrice || filters.maxPrice) count++;
    if (filters.minBedrooms) count++;
    if (filters.area && filters.area.length > 0) count++;
    if (filters.search) count++;
    if (filters.state) count++;
    return count;
  }, [filters]);

  return (
    <div className="space-y-4">
      {/* Category pills */}
      <CategoryPills
        value={filters.category}
        onChange={(category) => handleFilterChange({ ...filters, category, page: 1 })}
      />

      {/* Stale data indicator */}
      {dataUpdatedAt > 0 && (
        <div className="flex items-center gap-2 text-xs" style={{ color: isStale ? "var(--accent)" : "var(--muted-foreground)" }}>
          <Clock size={12} />
          <span>
            Updated {formatDistanceToNowStrict(new Date(dataUpdatedAt), { addSuffix: true })}
          </span>
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="inline-flex items-center justify-center rounded-md p-1 transition-colors hover:opacity-70 disabled:opacity-40"
            style={{ color: isStale ? "var(--accent)" : "var(--muted-foreground)" }}
            title="Refresh data"
          >
            <RefreshCw size={12} className={isFetching ? "animate-spin" : ""} />
          </button>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 w-full">
        {/* Top/Left Row: Filter and Search */}
        <div className="flex items-center gap-2 flex-1 w-full">
          <button
            data-tour="filter-panel"
            onClick={() => setFilterSheetOpen(true)}
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium border transition-colors shrink-0"
            style={{
              backgroundColor: activeFilterCount > 0 ? "var(--primary)" : "var(--card)",
              color: activeFilterCount > 0 ? "var(--primary-foreground)" : "var(--foreground)",
              borderColor: activeFilterCount > 0 ? "var(--primary)" : "var(--border)",
            }}
          >
            <SlidersHorizontal size={16} />
            <span className="hidden sm:inline">Filters</span>
            {activeFilterCount > 0 && (
              <span
                className="w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center"
                style={{
                  backgroundColor: "var(--primary-foreground)",
                  color: "var(--primary)",
                }}
              >
                {activeFilterCount}
              </span>
            )}
          </button>

          <div
            data-tour="search-bar"
            className="flex items-center gap-2 px-3 py-2 rounded-xl flex-1 min-w-[180px] relative"
            style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}
          >
            <Search size={16} className="shrink-0" style={{ color: "var(--muted-foreground)" }} />
            <div className="relative flex-1 min-w-0">
              <input
                ref={searchInputRef}
                type="text"
                value={filters.search || ""}
                onChange={(e) => handleFilterChange({ ...filters, search: e.target.value || undefined, page: 1 })}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setSearchFocused(false)}
                className="bg-transparent text-xs sm:text-sm w-full outline-none relative z-10"
                style={{ color: "var(--foreground)" }}
              />
              {!filters.search && !searchFocused && (
                <div className="absolute inset-0 flex items-center pointer-events-none overflow-hidden">
                  <TextType
                    text={SEARCH_EXAMPLES}
                    typingSpeed={45}
                    deletingSpeed={30}
                    pauseDuration={5000}
                    showCursor={false}
                    loop={true}
                    className="text-xs sm:text-sm truncate"
                    style={{ color: "var(--muted-foreground)" }}
                  />
                </div>
              )}
            </div>
            {filters.search && (
              <button onClick={() => handleFilterChange({ ...filters, search: undefined, page: 1 })}>
                <X size={14} style={{ color: "var(--muted-foreground)" }} />
              </button>
            )}
          </div>
        </div>

        {/* Right/Bottom Row: Sorting and View Toggles */}
        <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0 scrollbar-none justify-between sm:justify-end">
          <span className="text-sm font-medium hidden lg:block shrink-0 px-2" style={{ color: "var(--muted-foreground)" }}>
            {total > 0 ? `${total.toLocaleString()} ${pluralize(total, "property", "properties")}` : ""}
          </span>

          <div className="relative shrink-0">
            <select
              value={filters.sortBy}
              onChange={(e) => handleFilterChange({ ...filters, sortBy: e.target.value, page: 1 })}
              className="text-[11px] sm:text-xs px-2 sm:px-3 py-2 pr-6 sm:pr-7 rounded-xl border outline-none font-medium appearance-none cursor-pointer"
              style={{
                backgroundColor: "var(--card)",
                color: "var(--foreground)",
                borderColor: "var(--border)",
              }}
            >
              {SORT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <ChevronDown
              size={10}
              className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none"
              style={{ color: "var(--muted-foreground)" }}
            />
          </div>

          <button
            onClick={() =>
              handleFilterChange({
                ...filters,
                sortOrder: filters.sortOrder === "asc" ? "desc" : "asc",
              })
            }
            className="text-[10px] sm:text-xs px-2 sm:px-3 py-2 rounded-xl font-medium border shrink-0"
            style={{
              backgroundColor: "var(--card)",
              color: "var(--foreground)",
              borderColor: "var(--border)",
            }}
          >
            {filters.sortOrder === "asc" ? "Asc" : "Desc"}
          </button>

          <div
            data-tour="view-toggle"
            className="flex rounded-xl overflow-hidden border shrink-0"
            style={{ borderColor: "var(--border)" }}
          >
            <button
              onClick={() => setViewMode("grid")}
              className="p-1.5 sm:p-2 transition-colors"
              style={{
                backgroundColor: viewMode === "grid" ? "var(--primary)" : "var(--card)",
                color: viewMode === "grid" ? "var(--primary-foreground)" : "var(--muted-foreground)",
              }}
            >
              <LayoutGrid size={15} className="sm:size-4" />
            </button>
            <button
              onClick={() => setViewMode("list")}
              className="p-1.5 sm:p-2 transition-colors"
              style={{
                backgroundColor: viewMode === "list" ? "var(--primary)" : "var(--card)",
                color: viewMode === "list" ? "var(--primary-foreground)" : "var(--muted-foreground)",
              }}
            >
              <List size={15} className="sm:size-4" />
            </button>
          </div>

        {/* Grid column selector — Desktop */}
        {viewMode === "grid" && (
          <div
            className="hidden sm:flex items-center rounded-xl overflow-hidden border"
            style={{ borderColor: "var(--border)" }}
          >
            {DESKTOP_GRID_OPTIONS.map((n) => (
              <button
                key={n}
                onClick={() => setGridCols(n)}
                className="px-2.5 py-2 text-[10px] font-bold transition-colors"
                style={{
                  backgroundColor: gridCols === n ? "var(--primary)" : "var(--card)",
                  color: gridCols === n ? "var(--primary-foreground)" : "var(--muted-foreground)",
                }}
                title={`${n} columns`}
              >
                {n}
              </button>
            ))}
          </div>
        )}

        {/* Grid column selector — Mobile */}
        {viewMode === "grid" && (
          <div
            className="flex sm:hidden items-center rounded-xl overflow-hidden border shrink-0"
            style={{ borderColor: "var(--border)" }}
          >
            {MOBILE_GRID_OPTIONS.map((n) => (
              <button
                key={n}
                onClick={() => setGridCols(n)}
                className="px-2.5 py-2 text-[10px] font-bold transition-colors"
                style={{
                  backgroundColor: gridCols === n ? "var(--primary)" : "var(--card)",
                  color: gridCols === n ? "var(--primary-foreground)" : "var(--muted-foreground)",
                }}
                title={`${n} columns`}
              >
                {n}
              </button>
            ))}
          </div>
        )}

        {/* Map toggle */}
        <motion.button
          onClick={() => {
            setShowMap(!showMap);
            setHasToggledMap(true);
          }}
          initial={false}
          animate={(!hasToggledMap && !showMap) ? {
            scale: [1, 1.1, 1],
            transition: {
              duration: 0.5,
              repeat: Infinity,
              repeatDelay: 2.5,
              ease: "easeInOut"
            }
          } : { scale: 1 }}
          className="p-1.5 sm:p-2 rounded-xl border transition-colors shrink-0"
          style={{
            backgroundColor: showMap ? "var(--primary)" : "var(--card)",
            color: showMap ? "var(--primary-foreground)" : "var(--muted-foreground)",
            borderColor: showMap ? "var(--primary)" : "var(--border)",
          }}
          title={showMap ? "Hide map" : "Show map"}
        >
          <Map size={15} className="sm:size-4" />
        </motion.button>
      </div>
      </div>

      {/* Mobile map — right after toolbar so it's immediately visible */}
      {showMap && (
        <div
          className={`md:hidden rounded-xl overflow-hidden transition-all duration-300 relative ${
            mobileMapExpanded ? "fixed inset-0 z-50 rounded-none" : ""
          }`}
          style={{ height: mobileMapExpanded ? "100vh" : "50vh" }}
        >
          <DynamicPropertyMap
            properties={properties}
            hoveredId={hoveredPropertyId}
            onMarkerClick={handleMarkerClick}
          />
          <button
            onClick={() => setMobileMapExpanded(!mobileMapExpanded)}
            className="absolute top-3 right-3 z-10 flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold shadow-lg backdrop-blur-md"
            style={{
              backgroundColor: "var(--card)",
              color: "var(--foreground)",
              border: "1px solid var(--border)",
            }}
          >
            {mobileMapExpanded ? (
              <>
                <X size={14} />
                Close
              </>
            ) : (
              <>
                <Map size={14} />
                Expand
              </>
            )}
          </button>
        </div>
      )}

      {/* AI Insights */}
      <div className="flex flex-wrap gap-2">
        <AIInsightPlaceholder label="AI smart ranking by investment value" icon={Sparkles} />
        <AIInsightPlaceholder label="Duplicate detection across sources" />
        <AIInsightPlaceholder label="Price anomaly warnings" />
      </div>

      {/* Main content: Cards + Map split */}
      <div className="flex gap-4">
        {/* Cards panel — only constrain height on desktop when side-by-side map is shown */}
        <div className={`flex-1 min-w-0 ${showMap ? "md:overflow-y-auto md:max-h-[calc(100vh-180px)] scrollbar-none" : ""}`}>
          {viewMode === "grid" ? (
            <PropertyGrid
              properties={properties}
              isLoading={isLoading}
              selectedId={selectedPropertyId}
              onHover={setHoveredPropertyId}
              onClick={handleCardClick}
              columns={gridCols}
              emptyMessage="No properties match your filters. Try adjusting your search criteria."
            />
          ) : (
            <div className="space-y-3">
              {isLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="flex gap-4 p-4 rounded-xl border" style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}>
                      <Skeleton className="w-28 h-20 rounded-lg shrink-0" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-3/4" />
                        <Skeleton className="h-5 w-1/3" />
                        <Skeleton className="h-3 w-1/2" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : properties.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 gap-3">
                  <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-1" style={{ backgroundColor: "rgba(0,1,252,0.08)" }}>
                    <Building2 size={32} style={{ color: "var(--primary)", opacity: 0.5 }} />
                  </div>
                  <p className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
                    No properties yet
                  </p>
                  <p className="text-xs text-center max-w-xs" style={{ color: "var(--muted-foreground)" }}>
                    {filters.search || activeFilterCount > 0
                      ? "No properties match your current filters. Try adjusting your search criteria."
                      : "Start scraping property listings to see them here."}
                  </p>
                  {!filters.search && activeFilterCount === 0 && (
                    <a
                      href="/scraper"
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold mt-1 transition-colors hover:opacity-90"
                      style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}
                    >
                      Start Scraping
                    </a>
                  )}
                </div>
              ) : (
                properties.map((property: Property) => (
                  <PropertyListCard
                    key={property.id}
                    property={property}
                    isActive={selectedPropertyId === property.id}
                    onHover={setHoveredPropertyId}
                    onClick={handleCardClick}
                  />
                ))
              )}
            </div>
          )}

          {/* Pagination + per-page selector */}
          <div className="flex items-center justify-between flex-wrap gap-3 pt-4">
            <div className="flex items-center gap-2">
              <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>Show</span>
              <select
                value={filters.limit || 24}
                onChange={(e) => handleFilterChange({ ...filters, limit: Number(e.target.value), page: 1 })}
                className="text-xs px-2 py-1 rounded-lg border outline-none font-medium appearance-none cursor-pointer"
                style={{
                  backgroundColor: "var(--card)",
                  color: "var(--foreground)",
                  borderColor: "var(--border)",
                }}
              >
                {PER_PAGE_OPTIONS.map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
              <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>per page</span>
            </div>

            <Pagination
              page={filters.page || 1}
              totalPages={totalPages}
              onPageChange={(p) => handleFilterChange({ ...filters, page: p })}
            />
          </div>
        </div>

        {/* Map panel — responsive, full height, toggleable */}
        {showMap && (
          <div className="hidden md:block w-[38%] lg:w-[42%] shrink-0">
            <div
              className="sticky top-0 rounded-xl overflow-hidden"
              style={{ height: "calc(100vh - 180px)" }}
            >
              <DynamicPropertyMap
                properties={properties}
                hoveredId={hoveredPropertyId}
                onMarkerClick={handleMarkerClick}
              />
            </div>
          </div>
        )}
      </div>

      {/* Left side-sheet: Filters */}
      <PropertyFilterSheet
        open={filterSheetOpen}
        onOpenChange={setFilterSheetOpen}
        filters={filters}
        onChange={handleFilterChange}
        total={total}
      />

      {/* Right side-sheet: Property detail */}
      <SideSheet
        open={!!selectedProperty}
        onOpenChange={(open) => { if (!open) setSelectedPropertyId(null); }}
        side="right"
        width="420px"
      >
        <SideSheetContent>
          {selectedProperty && (
            <PropertyDetailPanel
              property={selectedProperty}
              onClose={() => setSelectedPropertyId(null)}
            />
          )}
        </SideSheetContent>
      </SideSheet>
    </div>
  );
}
