"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import { SearchBar } from "@/components/search/search-bar";
import { SearchResults } from "@/components/search/search-results";
import { ActiveScrapeTrigger } from "@/components/search/active-scrape-trigger";
import dynamic from "next/dynamic";
import { formatPrice } from "@/lib/utils";

const FullscreenMap = dynamic(
  () => import("@/components/search/fullscreen-map").then((mod) => mod.FullscreenMap),
  { ssr: false, loading: () => <div className="w-full h-full bg-secondary animate-pulse" /> }
);
import { SideSheet, SideSheetContent } from "@/components/ui/side-sheet";
import { BottomSheet, BottomSheetContent, BottomSheetClose } from "@/components/ui/bottom-sheet";
import { PropertyDetailPanel } from "@/components/property/property-detail-panel";
import { useSearch } from "@/hooks/use-search";
import { MapPin, ChevronUp, ChevronDown, Sparkles, X } from "lucide-react";
import type { Property, PropertyCategory } from "@/types/property";

const QUICK_SEARCHES = [
  "3 bed flat in Lekki",
  "Land in Ikoyi",
  "Shortlet in Victoria Island",
  "House under 50m",
  "Commercial in Abuja",
  "2 bedroom apartment in Yaba",
  "Duplex in Ajah with pool",
  "Office space in Ikeja",
  "Warehouse in Oshodi",
  "Furnished flat in Surulere"
];

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<PropertyCategory | "ALL">("ALL");
  const [activeFilters, setActiveFilters] = useState<string[]>([]);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [scrapeLoading, setScrapeLoading] = useState(false);

  const [limit, setLimit] = useState(30);
  const [sort, setSort] = useState("newest");
  const [dynamicPills, setDynamicPills] = useState<string[]>([]);
  const [isMobile, setIsMobile] = useState(false);
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [hasDismissedSplash, setHasDismissedSplash] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Listen for mobile nav filter/search toggle
  useEffect(() => {
    const handleToggleFilters = () => setMobileSheetOpen(true);
    document.addEventListener("toggle-mobile-filters", handleToggleFilters);
    return () => document.removeEventListener("toggle-mobile-filters", handleToggleFilters);
  }, []);

  // When query becomes truthy on mobile, open the sheet automatically
  useEffect(() => {
    if (query && isMobile) {
      setMobileSheetOpen(true);
    }
  }, [query, isMobile]);

  // Pick 5 random pills on mount
  useEffect(() => {
    const shuffled = [...QUICK_SEARCHES].sort(() => 0.5 - Math.random());
    setDynamicPills(shuffled.slice(0, 5));
  }, []);

  const { data: searchData, isLoading } = useSearch({
    q: query,
    limit,
    sort: [sort],
    filters: activeFilters.length > 0 ? activeFilters : undefined,
    facets: ["categoryName", "listingType", "bedrooms", "state"],
  });

  const hits: Property[] = searchData?.hits || [];
  const totalHits = searchData?.estimatedTotalHits || searchData?.nbHits || hits.length;
  const facets = searchData?.facetDistribution || {};
  const parsedInfo = searchData?.parsedQuery || null; // In case the backend sends parsed NL info
  const hasMore = totalHits > hits.length;

  // Properties with coordinates for the map
  const mappableProperties = useMemo(
    () => hits.filter((p) => p.latitude && p.longitude),
    [hits]
  );

  const handleSearch = useCallback((q: string, cat?: PropertyCategory | "ALL") => {
    setQuery(q);
    setHasSearched(true);
    if (isMobile) {
      setMobileSheetOpen(true);
    }
    if (cat) setSelectedCategory(cat);
    setActiveFilters([]); // Reset filters on new search
    setLimit(30); // reset limit
  }, [isMobile]);

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
    <div className="absolute inset-0 z-0 overflow-hidden md:ml-[60px] pt-[76px] md:pt-[56px] pb-[76px] md:pb-0 flex flex-col bg-background">
      <div className="relative flex-1 w-full overflow-hidden">
        
        {/* Full Screen Map */}
        <FullscreenMap
          properties={mappableProperties}
          hoveredId={hoveredId}
          setHoveredId={setHoveredId}
          onPropertyClick={handlePropertyClick}
        />
        
        {/* Top Search Bar Overlay (Only when results are showing) */}
        {(hasSearched || hasDismissedSplash) && (
          <div className="absolute top-4 left-0 right-0 z-10 px-4 md:px-8 pointer-events-none flex justify-center">
             <div className="max-w-3xl w-full pointer-events-auto drop-shadow-xl">
                <SearchBar onSearch={handleSearch} initialQuery={query} initialCategory={selectedCategory} />
             </div>
          </div>
        )}

        {/* Results Panel Container */}
        {(hasSearched || hasDismissedSplash) && (
           <>
             {isMobile ? (
               <BottomSheet open={mobileSheetOpen} onOpenChange={setMobileSheetOpen} height="85vh">
                 <BottomSheetContent>
                   <div className="flex flex-col h-full overflow-hidden pt-6">
                     {/* Sidebar Header */}
                     <div className="p-4 border-b shrink-0 flex items-center justify-between gap-3">
                       <div className="flex items-center gap-3 min-w-0">
                         <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                           <Sparkles size={18} className="text-primary" />
                         </div>
                         <div className="min-w-0">
                           <h2 className="font-bold text-lg leading-tight truncate">{totalHits} results</h2>
                           <p className="text-xs text-muted-foreground truncate">
                             {parsedInfo ? `Showing ${parsedInfo.bedrooms ? `${parsedInfo.bedrooms} bed ` : ""}${parsedInfo.propertyType || 'properties'}` : query}
                           </p>
                         </div>
                       </div>
                       <BottomSheetClose asChild>
                         <button className="p-2 rounded-full hover:bg-secondary/80 transition-colors">
                           <X className="w-5 h-5 text-muted-foreground" />
                         </button>
                       </BottomSheetClose>
                     </div>

                     {/* Scrollable Results List */}
                     <div className="flex-1 overflow-y-auto p-4 scroller space-y-4">
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
                            sort={sort}
                            onSortChange={setSort}
                            hasMore={hasMore}
                            onLoadMore={() => setLimit(l => l + 30)}
                            onClear={() => handleSearch("")}
                            compact={true}
                         />
                         
                         <div className="pt-4 border-t border-border/50 pb-8">
                           <ActiveScrapeTrigger query={query} onTriggerScrape={handleTriggerScrape} isLoading={scrapeLoading} />
                         </div>
                     </div>
                   </div>
                 </BottomSheetContent>
               </BottomSheet>
             ) : (
               <div className="absolute top-[80px] md:top-[90px] left-4 md:left-8 bottom-4 w-full max-w-[400px] z-[11] pointer-events-none transition-all duration-300">
                  <div className="bg-background/95 backdrop-blur-xl w-full h-full rounded-2xl shadow-2xl border pointer-events-auto flex flex-col overflow-hidden">
                     
                     {/* Sidebar Header */}
                     <div className="p-4 border-b shrink-0 bg-card/80 flex items-center gap-3">
                       <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                         <Sparkles size={18} className="text-primary" />
                       </div>
                       <div className="min-w-0">
                         <h2 className="font-bold text-lg leading-tight truncate">{totalHits} results</h2>
                         <p className="text-xs text-muted-foreground truncate">
                           {parsedInfo ? `Showing ${parsedInfo.bedrooms ? `${parsedInfo.bedrooms} bed ` : ""}${parsedInfo.propertyType || 'properties'}` : query}
                         </p>
                       </div>
                     </div>

                     {/* Scrollable Results List */}
                     <div className="flex-1 overflow-y-auto p-4 scroller space-y-4">
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
                            sort={sort}
                            onSortChange={setSort}
                            hasMore={hasMore}
                            onLoadMore={() => setLimit(l => l + 30)}
                            onClear={() => handleSearch("")}
                            compact={true}
                         />
                         
                         <div className="pt-4 border-t border-border/50">
                           <ActiveScrapeTrigger query={query} onTriggerScrape={handleTriggerScrape} isLoading={scrapeLoading} />
                         </div>
                     </div>
                  </div>
               </div>
             )}
           </>
        )}

         {/* Empty State Overlay */}
        {!hasSearched && !hasDismissedSplash && (
           <div 
             className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-background/20 backdrop-blur-sm p-4"
             onClick={(e) => {
               if (e.target === e.currentTarget) setHasDismissedSplash(true);
             }}
           >
              <div className="bg-background/95 backdrop-blur-md px-6 py-8 sm:px-10 sm:py-12 rounded-[2rem] shadow-2xl border pointer-events-auto max-w-md w-full max-h-full overflow-y-auto scroller text-center flex flex-col items-center relative transition-all hover:shadow-primary/5">
                 
                 <button 
                   onClick={() => setHasDismissedSplash(true)}
                   className="absolute top-4 right-4 p-2 rounded-full hover:bg-secondary/80 transition-colors text-muted-foreground hover:text-foreground"
                   aria-label="Dismiss"
                 >
                   <X size={20} />
                 </button>

                 <div className="w-20 h-20 rounded-2xl flex items-center justify-center bg-primary/10 mb-6 mt-2 rotate-3">
                    <MapPin size={36} className="text-primary -rotate-3" />
                 </div>
                 <h2 className="font-display font-bold text-2xl md:text-3xl mb-2 text-foreground tracking-tight">
                    Where to next?
                 </h2>
                 <p className="text-sm text-muted-foreground mb-8 max-w-sm">
                    Search using natural language, explore the map, or dive straight into one of our quick suggestions below.
                 </p>

                 {/* Integrated Search Bar inside Empty State */}
                 <div className="w-full mb-8">
                    <SearchBar onSearch={handleSearch} initialQuery={query} initialCategory={selectedCategory} />
                 </div>

                  {/* Quick search suggestions */}
                 <div className="flex flex-wrap justify-center gap-2.5 w-full">
                    {dynamicPills.map((suggestion) => (
                      <button
                        key={suggestion}
                        onClick={() => handleSearch(suggestion)}
                        className="px-4 py-2 rounded-full text-[13px] md:text-sm font-semibold transition-all hover:-translate-y-0.5 border-2 border-border bg-background hover:bg-primary hover:text-white hover:border-primary text-foreground shadow-sm whitespace-nowrap"
                      >
                        {suggestion}
                      </button>
                    ))}
                 </div>
              </div>
           </div>
        )}

      </div>
      
      {/* Detail Sheet */}
      <SideSheet
        open={!!selectedProperty}
        onOpenChange={(open) => {
          if (!open) setSelectedProperty(null);
        }}
      >
        <SideSheetContent className="w-full sm:max-w-md md:max-w-lg lg:max-w-xl p-0 h-full border-l border-zinc-200 dark:border-white/10 overflow-hidden z-[100]">
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
