"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useProperty, useProperties } from "@/hooks/useProperties";
import { formatPrice, formatNumber, pluralize, cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowLeft, MapPin, BedDouble, Bath, Maximize2, Star, Building, Building2,
  X, Plus, ChevronRight, Layers, Car, Droplets, Check, Minus, ExternalLink,
  Tag, Calendar, Shield, TrendingUp, Home,
} from "lucide-react";
import Link from "next/link";
import type { Property } from "@/types/property";
import ModernLoader from "@/components/ui/modern-loader";

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const CATEGORY_COLORS: Record<string, string> = {
  RESIDENTIAL: "#3b82f6",
  LAND: "#10b981",
  SHORTLET: "#f97316",
  COMMERCIAL: "#8b5cf6",
  INDUSTRIAL: "#64748b",
};

const LISTING_TYPE_LABELS: Record<string, string> = {
  SALE: "For Sale",
  RENT: "For Rent",
  LEASE: "For Lease",
  SHORTLET: "Shortlet",
};

/* ------------------------------------------------------------------ */
/*  Property Fetcher Hook                                              */
/* ------------------------------------------------------------------ */

function useCompareProperty(id: string | null) {
  const { data, isLoading } = useProperty(id || "");
  return { property: data || null, isLoading: !!id && isLoading };
}

/* ------------------------------------------------------------------ */
/*  Compare Row                                                        */
/* ------------------------------------------------------------------ */

function CompareRow({
  label,
  icon: Icon,
  values,
  highlight,
}: {
  label: string;
  icon?: React.ComponentType<any>;
  values: (React.ReactNode | undefined | null)[];
  highlight?: "highest" | "lowest" | "none";
}) {
  return (
    <div
      className="grid items-center py-3.5"
      style={{
        gridTemplateColumns: `180px repeat(${values.length}, 1fr)`,
        borderBottom: "1px solid var(--border)",
      }}
    >
      <div className="flex items-center gap-2 px-4">
        {Icon && <Icon size={14} style={{ color: "var(--muted-foreground)" }} />}
        <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--muted-foreground)" }}>
          {label}
        </span>
      </div>
      {values.map((val, i) => (
        <div key={i} className="px-4 text-sm font-medium" style={{ color: val ? "var(--foreground)" : "var(--muted-foreground)" }}>
          {val || "—"}
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Property Column Card                                               */
/* ------------------------------------------------------------------ */

function PropertyColumnCard({
  property,
  onRemove,
}: {
  property: Property;
  onRemove: () => void;
}) {
  const image = Array.isArray(property.images) && property.images.length > 0
    ? property.images[0]
    : null;
  const location = property.locationText || [property.area, property.lga, property.state].filter(Boolean).join(", ");
  const categoryColor = CATEGORY_COLORS[property.category] || "#64748b";

  return (
    <div className="px-4 relative group">
      {/* Remove button */}
      <button
        onClick={onRemove}
        className="absolute -top-2 -right-0 z-10 w-6 h-6 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
        style={{ backgroundColor: "var(--destructive)", color: "white" }}
      >
        <X size={12} />
      </button>

      {/* Image */}
      <div className="aspect-[4/3] rounded-xl overflow-hidden mb-3" style={{ backgroundColor: "var(--secondary)" }}>
        {image ? (
          <img src={image} alt={property.title} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Building2 size={32} style={{ color: "var(--muted-foreground)" }} />
          </div>
        )}
      </div>

      {/* Quick stats */}
      <div className="flex items-center gap-3 text-xs mb-2" style={{ color: "var(--muted-foreground)" }}>
        {property.bedrooms != null && (
          <span className="flex items-center gap-1">
            <BedDouble size={13} />
            <strong style={{ color: "var(--foreground)" }}>{property.bedrooms}</strong>
          </span>
        )}
        {property.bathrooms != null && (
          <span className="flex items-center gap-1">
            <Bath size={13} />
            <strong style={{ color: "var(--foreground)" }}>{property.bathrooms}</strong>
          </span>
        )}
        {(property.landSizeSqm || property.buildingSizeSqm) && (
          <span className="flex items-center gap-1">
            <Maximize2 size={12} />
            <strong style={{ color: "var(--foreground)" }}>
              {formatNumber(Math.round(property.landSizeSqm || property.buildingSizeSqm || 0))}
            </strong>
          </span>
        )}
      </div>

      {/* Title + location */}
      <Link
        href={`/properties/${property.id}`}
        className="font-display font-semibold text-sm leading-snug line-clamp-2 hover:underline"
        style={{ color: "var(--foreground)" }}
      >
        {property.title}
      </Link>
      {location && (
        <div className="flex items-center gap-1 mt-1">
          <MapPin size={11} style={{ color: "var(--muted-foreground)" }} />
          <span className="text-xs truncate" style={{ color: "var(--muted-foreground)" }}>{location}</span>
        </div>
      )}

      {/* Price */}
      <div className="mt-2 flex items-baseline gap-1.5">
        <span className="font-display font-bold text-base" style={{ color: "var(--accent)" }}>
          {formatPrice(property.price)}
        </span>
        {property.rentFrequency && (
          <span className="text-[10px]" style={{ color: "var(--muted-foreground)" }}>
            /{property.rentFrequency}
          </span>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Empty Slot                                                         */
/* ------------------------------------------------------------------ */

function EmptySlot({ onClick }: { onClick: () => void }) {
  return (
    <div className="px-4">
      <button
        onClick={onClick}
        className="w-full aspect-[4/3] rounded-xl flex flex-col items-center justify-center gap-2 transition-colors"
        style={{
          border: "2px dashed var(--border)",
          backgroundColor: "var(--secondary)",
        }}
      >
        <Plus size={24} style={{ color: "var(--muted-foreground)" }} />
        <span className="text-xs font-medium" style={{ color: "var(--muted-foreground)" }}>
          Add property
        </span>
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Skeleton                                                           */
/* ------------------------------------------------------------------ */

function CompareColumnSkeleton() {
  return (
    <div className="px-4">
      <Skeleton className="aspect-[4/3] rounded-xl mb-3" />
      <Skeleton className="h-3 w-24 mb-2" />
      <Skeleton className="h-5 w-full mb-1" />
      <Skeleton className="h-3 w-3/4 mb-2" />
      <Skeleton className="h-5 w-20" />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Add Property Modal                                                 */
/* ------------------------------------------------------------------ */

function AddPropertyModal({
  open,
  onClose,
  onSelect,
  excludeIds,
}: {
  open: boolean;
  onClose: () => void;
  onSelect: (id: string) => void;
  excludeIds: string[];
}) {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const { data: propertiesData, isLoading: searchLoading } = useProperties({
    search: debouncedSearch || undefined,
    limit: 12,
    page: 1,
  });

  if (!open) return null;

  const allResults = (propertiesData as any)?.data ?? [];
  const filtered = allResults.filter((p: any) => !excludeIds.includes(p.id));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div
        className="relative z-10 w-full max-w-lg rounded-2xl p-5 max-h-[80vh] overflow-hidden flex flex-col"
        style={{ backgroundColor: "var(--card)" }}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display font-semibold text-sm" style={{ color: "var(--foreground)" }}>
            Add Property to Compare
          </h3>
          <button onClick={onClose}>
            <X size={18} style={{ color: "var(--muted-foreground)" }} />
          </button>
        </div>

        <input
          type="text"
          placeholder="Search properties..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full px-4 py-2.5 rounded-xl text-sm mb-4 outline-none"
          style={{
            backgroundColor: "var(--secondary)",
            color: "var(--foreground)",
            border: "1px solid var(--border)",
          }}
        />

        <div className="flex-1 overflow-y-auto space-y-2">
          {filtered.length === 0 ? (
            <p className="text-sm text-center py-8" style={{ color: "var(--muted-foreground)" }}>
              No properties found
            </p>
          ) : (
            filtered.map((p) => {
              const image = Array.isArray(p.images) && p.images.length > 0 ? p.images[0] : null;
              return (
                <button
                  key={p.id}
                  onClick={() => { onSelect(p.id); onClose(); }}
                  className="flex items-center gap-3 w-full p-3 rounded-xl text-left transition-colors hover:bg-[var(--secondary)]"
                >
                  <div
                    className="w-14 h-10 rounded-lg overflow-hidden shrink-0 flex items-center justify-center"
                    style={{ backgroundColor: "var(--secondary)" }}
                  >
                    {image ? (
                      <img src={image} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <Building2 size={16} style={{ color: "var(--muted-foreground)" }} />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: "var(--foreground)" }}>
                      {p.title}
                    </p>
                    <p className="text-xs truncate" style={{ color: "var(--muted-foreground)" }}>
                      {p.area || p.state} — {formatPrice(p.price)}
                    </p>
                  </div>
                  <Plus size={16} style={{ color: "var(--primary)" }} />
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Compare Page                                                  */
/* ------------------------------------------------------------------ */

function ComparePropertiesContent() {
  const searchParams = useSearchParams();
  const idsParam = searchParams.get("ids") || "";
  const initialIds = idsParam.split(",").filter(Boolean).slice(0, 4);

  const [propertyIds, setPropertyIds] = useState<string[]>(initialIds);
  const [addModalOpen, setAddModalOpen] = useState(false);

  // Fetch up to 4 properties
  const p0 = useCompareProperty(propertyIds[0] || null);
  const p1 = useCompareProperty(propertyIds[1] || null);
  const p2 = useCompareProperty(propertyIds[2] || null);
  const p3 = useCompareProperty(propertyIds[3] || null);

  const slots = [p0, p1, p2, p3];
  const properties = slots
    .slice(0, Math.max(propertyIds.length, 1))
    .map(s => s.property)
    .filter((p): p is Property => p !== null);

  const isAnyLoading = slots.some((s, i) => i < propertyIds.length && s.isLoading);
  const colCount = Math.max(properties.length, 1);

  const removeProperty = (idx: number) => {
    setPropertyIds(prev => prev.filter((_, i) => i !== idx));
  };

  const addProperty = (id: string) => {
    if (propertyIds.length < 4 && !propertyIds.includes(id)) {
      setPropertyIds(prev => [...prev, id]);
    }
  };

  const resetAll = () => setPropertyIds([]);

  // Helper to get comparable values
  const getValues = (fn: (p: Property) => React.ReactNode) =>
    properties.map(p => fn(p));

  // Find best value for highlighting
  const numValues = (fn: (p: Property) => number | undefined | null) =>
    properties.map(p => fn(p));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Link
              href="/properties"
              className="flex items-center gap-1 text-xs font-medium hover:underline"
              style={{ color: "var(--primary)" }}
            >
              <ArrowLeft size={14} />
              Properties
            </Link>
          </div>
          <h1 className="text-xl sm:text-2xl font-display font-bold" style={{ color: "var(--foreground)" }}>
            Compare {pluralize(properties.length, "Listing")} ({properties.length})
          </h1>
        </div>
        <div className="flex items-center gap-2">
          {properties.length > 0 && (
            <button
              onClick={resetAll}
              className="px-4 py-2 rounded-xl text-xs font-medium transition-colors"
              style={{ backgroundColor: "var(--secondary)", color: "var(--foreground)" }}
            >
              Reset
            </button>
          )}
          {propertyIds.length < 4 && (
            <button
              onClick={() => setAddModalOpen(true)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white transition-opacity hover:opacity-90"
              style={{ backgroundColor: "var(--primary)" }}
            >
              <Plus size={14} />
              Add property to compare
            </button>
          )}
        </div>
      </div>

      {/* Empty state */}
      {properties.length === 0 && !isAnyLoading && (
        <div
          className="rounded-2xl flex flex-col items-center justify-center py-20"
          style={{ backgroundColor: "var(--card)" }}
        >
          <Building2 size={48} className="mb-3" style={{ color: "var(--muted-foreground)" }} />
          <p className="font-display font-semibold text-lg mb-1" style={{ color: "var(--foreground)" }}>
            No properties to compare
          </p>
          <p className="text-sm mb-4" style={{ color: "var(--muted-foreground)" }}>
            Add properties from the properties page or search to start comparing.
          </p>
          <button
            onClick={() => setAddModalOpen(true)}
            className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-sm font-semibold text-white"
            style={{ backgroundColor: "var(--primary)" }}
          >
            <Plus size={16} />
            Add Properties
          </button>
        </div>
      )}

      {/* Compare Table */}
      {(properties.length > 0 || isAnyLoading) && (
        <div
          className="rounded-2xl overflow-x-auto"
          style={{ backgroundColor: "var(--card)" }}
        >
          <div style={{ minWidth: `${180 + colCount * 260}px` }}>
            {/* Property Cards Row */}
            <div
              className="grid py-5"
              style={{
                gridTemplateColumns: `180px repeat(${colCount}, 1fr)`,
                borderBottom: "1px solid var(--border)",
              }}
            >
              {/* Label cell */}
              <div className="px-4 flex items-end">
                <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--muted-foreground)" }}>
                  Properties
                </span>
              </div>

              {/* Property columns */}
              {propertyIds.map((pid, i) => {
                const slot = slots[i];
                if (slot.isLoading) return <CompareColumnSkeleton key={pid} />;
                if (!slot.property) return <EmptySlot key={`empty-${i}`} onClick={() => setAddModalOpen(true)} />;
                return (
                  <PropertyColumnCard
                    key={pid}
                    property={slot.property}
                    onRemove={() => removeProperty(i)}
                  />
                );
              })}

              {/* Add more slot */}
              {propertyIds.length < 4 && propertyIds.length > 0 && (
                <EmptySlot onClick={() => setAddModalOpen(true)} />
              )}
            </div>

            {/* Comparison Rows */}
            <CompareRow
              label="Building Type"
              icon={Building}
              values={getValues(p => p.propertyType || p.category)}
            />
            <CompareRow
              label="Listing Type"
              icon={Tag}
              values={getValues(p => LISTING_TYPE_LABELS[p.listingType] || p.listingType)}
            />
            <CompareRow
              label="Location"
              icon={MapPin}
              values={getValues(p =>
                p.locationText || [p.area, p.lga, p.state].filter(Boolean).join(", ") || "—"
              )}
            />
            <CompareRow
              label="Price"
              icon={TrendingUp}
              values={getValues(p => (
                <span className="font-display font-bold" style={{ color: "var(--accent)" }}>
                  {formatPrice(p.price)}
                  {p.rentFrequency && <span className="text-xs font-normal" style={{ color: "var(--muted-foreground)" }}> /{p.rentFrequency}</span>}
                </span>
              ))}
            />
            {properties.some(p => p.pricePerSqm && p.pricePerSqm > 0) && (
              <CompareRow
                label="Price/sqm"
                icon={Maximize2}
                values={getValues(p => p.pricePerSqm ? formatPrice(p.pricePerSqm) : null)}
              />
            )}
            <CompareRow
              label="Floor Area"
              icon={Maximize2}
              values={getValues(p => {
                const size = p.buildingSizeSqm || p.landSizeSqm;
                return size ? `${formatNumber(Math.round(size))} sqm` : null;
              })}
            />
            <CompareRow
              label="Bedrooms"
              icon={BedDouble}
              values={getValues(p => p.bedrooms != null ? `${p.bedrooms} ${pluralize(p.bedrooms, "Bed")}` : null)}
            />
            <CompareRow
              label="Bathrooms"
              icon={Bath}
              values={getValues(p => p.bathrooms != null ? `${p.bathrooms} ${pluralize(p.bathrooms, "Bath")}` : null)}
            />
            {properties.some(p => p.toilets != null) && (
              <CompareRow
                label="Toilets"
                icon={Droplets}
                values={getValues(p => p.toilets != null ? `${p.toilets}` : null)}
              />
            )}
            {properties.some(p => p.floors != null) && (
              <CompareRow
                label="Floors"
                icon={Layers}
                values={getValues(p => p.floors != null ? `${p.floors}` : null)}
              />
            )}
            {properties.some(p => p.parkingSpaces != null) && (
              <CompareRow
                label="Parking"
                icon={Car}
                values={getValues(p => p.parkingSpaces != null ? `${p.parkingSpaces} ${pluralize(p.parkingSpaces, "space")}` : null)}
              />
            )}
            <CompareRow
              label="Condition"
              icon={Shield}
              values={getValues(p => p.condition !== "UNKNOWN" ? p.condition?.replace("_", " ") : null)}
            />
            <CompareRow
              label="Furnishing"
              icon={Home}
              values={getValues(p => p.furnishing !== "UNKNOWN" ? p.furnishing?.replace("_", " ") : null)}
            />
            {properties.some(p => p.yearBuilt) && (
              <CompareRow
                label="Year Built"
                icon={Calendar}
                values={getValues(p => p.yearBuilt)}
              />
            )}
            <CompareRow
              label="Quality Score"
              icon={Star}
              values={getValues(p => p.qualityScore != null ? (
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{p.qualityScore}/100</span>
                  <div className="h-1.5 w-16 rounded-full overflow-hidden" style={{ backgroundColor: "var(--border)" }}>
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${p.qualityScore}%`,
                        backgroundColor: p.qualityScore >= 70 ? "var(--success)" : p.qualityScore >= 40 ? "#f59e0b" : "var(--destructive)",
                      }}
                    />
                  </div>
                </div>
              ) : null)}
            />
            <CompareRow
              label="Features"
              icon={Check}
              values={getValues(p =>
                p.features && p.features.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {p.features.slice(0, 5).map((f: string) => (
                      <span
                        key={f}
                        className="px-2 py-0.5 rounded text-[10px] font-medium"
                        style={{ backgroundColor: "var(--secondary)", color: "var(--foreground)" }}
                      >
                        {f}
                      </span>
                    ))}
                    {p.features.length > 5 && (
                      <span className="text-[10px]" style={{ color: "var(--muted-foreground)" }}>
                        +{p.features.length - 5} more
                      </span>
                    )}
                  </div>
                ) : null
              )}
            />
            <CompareRow
              label="Source"
              icon={ExternalLink}
              values={getValues(p => p.site?.name || p.source)}
            />

            {/* View Detail Links Row */}
            <div
              className="grid py-4"
              style={{
                gridTemplateColumns: `180px repeat(${colCount}, 1fr)`,
              }}
            >
              <div />
              {properties.map(p => (
                <div key={p.id} className="px-4">
                  <Link
                    href={`/properties/${p.id}`}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white transition-opacity hover:opacity-90"
                    style={{ backgroundColor: "var(--primary)" }}
                  >
                    View Details
                    <ChevronRight size={14} />
                  </Link>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Add Property Modal */}
      <AddPropertyModal
        open={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        onSelect={addProperty}
        excludeIds={propertyIds}
      />
    </div>
  );
}

export default function ComparePropertiesPage() {
  return (
    <Suspense
      fallback={
        <ModernLoader words={['Loading comparison tool...', 'Fetching property details...', 'Preparing side-by-side view...']} />
      }
    >
      <ComparePropertiesContent />
    </Suspense>
  );
}
