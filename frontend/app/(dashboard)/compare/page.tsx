"use client";

import { useState, useMemo, useCallback } from "react";
import { useProperties } from "@/hooks/useProperties";
import { SearchableSelect } from "@/components/ui/searchable-select";
import type { Property } from "@/types/property";
import {
  ArrowLeftRight,
  Bed,
  Bath,
  Maximize2,
  MapPin,
  Star,
  Shield,
  Tag,
  Building2,
  Image as ImageIcon,
  X,
  Plus,
  Search,
  ChevronDown,
  CheckCircle,
  AlertTriangle,
  Layers,
  DollarSign,
  Phone,
  User,
} from "lucide-react";

// ─── Helpers ────────────────────────────────────────────────────────────────

function fmtPrice(n?: number): string {
  if (!n) return "N/A";
  if (n >= 1_000_000_000) return `₦${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `₦${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `₦${(n / 1_000).toFixed(0)}K`;
  return `₦${n.toLocaleString()}`;
}

function qualityColor(score?: number): string {
  if (score == null) return "var(--muted-foreground)";
  if (score >= 80) return "#16a34a";
  if (score >= 50) return "#ca8a04";
  return "#dc2626";
}

function verificationBadge(status?: string) {
  const map: Record<string, { icon: typeof CheckCircle; color: string; bg: string }> = {
    VERIFIED: { icon: CheckCircle, color: "#16a34a", bg: "rgba(22,163,74,0.1)" },
    FLAGGED: { icon: AlertTriangle, color: "#dc2626", bg: "rgba(220,38,38,0.1)" },
    UNVERIFIED: { icon: Shield, color: "#ca8a04", bg: "rgba(202,138,4,0.1)" },
  };
  const cfg = map[status || "UNVERIFIED"] || map.UNVERIFIED;
  const Icon = cfg.icon;
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold"
      style={{ backgroundColor: cfg.bg, color: cfg.color }}
    >
      <Icon className="w-3 h-3" />
      {status || "UNVERIFIED"}
    </span>
  );
}

// ─── Property Search Selector ───────────────────────────────────────────────

function PropertySelector({
  selectedId,
  onSelect,
  excludeIds,
}: {
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  excludeIds: string[];
}) {
  const [search, setSearch] = useState("");
  const { data } = useProperties({ search: search || undefined, limit: 50, page: 1 });

  const properties = data?.data || [];
  const options = useMemo(
    () =>
      properties
        .filter((p: Property) => !excludeIds.includes(p.id))
        .map((p: Property) => ({
          value: p.id,
          label: `${p.title || "Untitled"} — ${fmtPrice(p.price)} — ${[p.area, p.state].filter(Boolean).join(", ") || "No location"}`,
        })),
    [properties, excludeIds]
  );

  return (
    <SearchableSelect
      value={selectedId || ""}
      onChange={(v) => onSelect(v || null)}
      options={options}
      placeholder="Search and select a property..."
      searchPlaceholder="Type to search properties..."
    />
  );
}

// ─── Comparison Row ─────────────────────────────────────────────────────────

function CompareRow({
  label,
  icon: Icon,
  values,
  highlight = "none",
  formatter,
}: {
  label: string;
  icon?: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  values: (string | number | null | undefined)[];
  highlight?: "none" | "highest" | "lowest";
  formatter?: (v: any) => string;
}) {
  const fmt = formatter || ((v: any) => (v != null ? String(v) : "N/A"));
  const numericValues = values.map((v) => (typeof v === "number" ? v : null));

  let bestIdx = -1;
  if (highlight === "highest") {
    const max = Math.max(...numericValues.filter((v): v is number => v != null));
    bestIdx = numericValues.indexOf(max);
  } else if (highlight === "lowest") {
    const nums = numericValues.filter((v): v is number => v != null);
    if (nums.length > 0) {
      const min = Math.min(...nums);
      bestIdx = numericValues.indexOf(min);
    }
  }

  return (
    <div
      className="flex items-center border-b last:border-b-0 py-3"
      style={{ borderColor: "var(--border)" }}
    >
      <div className="w-36 sm:w-44 shrink-0 flex items-center gap-2 pr-3">
        {Icon && <Icon className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--muted-foreground)" }} />}
        <span className="text-xs font-semibold" style={{ color: "var(--muted-foreground)" }}>
          {label}
        </span>
      </div>
      <div className="flex-1 grid" style={{ gridTemplateColumns: `repeat(${values.length}, minmax(0, 1fr))` }}>
        {values.map((v, i) => (
          <div
            key={i}
            className="px-3 py-1 text-sm font-medium text-center"
            style={{
              color: bestIdx === i ? "#16a34a" : "var(--foreground)",
              fontWeight: bestIdx === i ? 700 : 500,
            }}
          >
            {fmt(v)}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────────────

const MAX_COMPARE = 4;

export default function ComparePage() {
  const [selectedIds, setSelectedIds] = useState<(string | null)[]>([null, null]);

  // Fetch all selected properties
  const allIds = selectedIds.filter(Boolean) as string[];
  const { data: allData } = useProperties({ limit: 200, page: 1 });

  const allProperties = allData?.data || [];

  const selectedProperties = useMemo(
    () =>
      selectedIds.map((id) =>
        id ? allProperties.find((p: Property) => p.id === id) || null : null
      ),
    [selectedIds, allProperties]
  );

  const handleSelect = useCallback(
    (index: number, id: string | null) => {
      setSelectedIds((prev) => {
        const next = [...prev];
        next[index] = id;
        return next;
      });
    },
    []
  );

  const addSlot = useCallback(() => {
    if (selectedIds.length < MAX_COMPARE) {
      setSelectedIds((prev) => [...prev, null]);
    }
  }, [selectedIds.length]);

  const removeSlot = useCallback(
    (index: number) => {
      if (selectedIds.length <= 2) return;
      setSelectedIds((prev) => prev.filter((_, i) => i !== index));
    },
    [selectedIds.length]
  );

  const filledCount = selectedProperties.filter(Boolean).length;

  return (
    <div className="space-y-5 pb-10">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>
          Compare Properties
        </h1>
        <p className="text-xs mt-0.5" style={{ color: "var(--muted-foreground)" }}>
          Select up to {MAX_COMPARE} properties to compare side by side.
        </p>
      </div>

      {/* Property Selectors */}
      <div
        className="grid gap-4"
        style={{ gridTemplateColumns: `repeat(${selectedIds.length}, minmax(0, 1fr))` }}
      >
        {selectedIds.map((id, i) => (
          <div key={i} className="space-y-3">
            <div className="flex items-center gap-2">
              <span
                className="text-xs font-bold uppercase tracking-wider"
                style={{ color: "var(--muted-foreground)" }}
              >
                Property {i + 1}
              </span>
              {selectedIds.length > 2 && (
                <button
                  onClick={() => removeSlot(i)}
                  className="p-0.5 rounded hover:bg-[var(--secondary)]"
                  title="Remove slot"
                >
                  <X className="w-3.5 h-3.5" style={{ color: "var(--muted-foreground)" }} />
                </button>
              )}
            </div>
            <PropertySelector
              selectedId={id}
              onSelect={(newId) => handleSelect(i, newId)}
              excludeIds={selectedIds.filter((sid, idx) => idx !== i && sid != null) as string[]}
            />

            {/* Property Card Preview */}
            {selectedProperties[i] && (
              <div
                className="rounded-xl border overflow-hidden"
                style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
              >
                {/* Image */}
                <div className="h-36 relative overflow-hidden" style={{ backgroundColor: "var(--secondary)" }}>
                  {selectedProperties[i]!.images && selectedProperties[i]!.images!.length > 0 ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={selectedProperties[i]!.images![0]}
                      alt={selectedProperties[i]!.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Building2
                        className="w-10 h-10"
                        style={{ color: "var(--muted-foreground)", opacity: 0.3 }}
                      />
                    </div>
                  )}
                  {selectedProperties[i]!.images && selectedProperties[i]!.images!.length > 1 && (
                    <span
                      className="absolute bottom-2 right-2 flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold"
                      style={{
                        backgroundColor: "rgba(0,0,0,0.6)",
                        color: "#fff",
                      }}
                    >
                      <ImageIcon className="w-3 h-3" />
                      {selectedProperties[i]!.images!.length}
                    </span>
                  )}
                </div>
                {/* Info */}
                <div className="p-3">
                  <p
                    className="text-sm font-semibold leading-snug line-clamp-2 mb-1"
                    style={{ color: "var(--foreground)" }}
                  >
                    {selectedProperties[i]!.title}
                  </p>
                  <p className="text-base font-bold" style={{ color: "var(--accent, #FF6600)" }}>
                    {fmtPrice(selectedProperties[i]!.price)}
                  </p>
                  {(selectedProperties[i]!.area || selectedProperties[i]!.state) && (
                    <div className="flex items-center gap-1 mt-1">
                      <MapPin
                        className="w-3 h-3 shrink-0"
                        style={{ color: "var(--muted-foreground)" }}
                      />
                      <span
                        className="text-xs truncate"
                        style={{ color: "var(--muted-foreground)" }}
                      >
                        {[selectedProperties[i]!.area, selectedProperties[i]!.state]
                          .filter(Boolean)
                          .join(", ")}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}

        {/* Add slot button */}
        {selectedIds.length < MAX_COMPARE && (
          <div className="flex items-start pt-7">
            <button
              onClick={addSlot}
              className="w-full h-36 rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-2 transition-colors hover:bg-[var(--secondary)]"
              style={{ borderColor: "var(--border)", color: "var(--muted-foreground)" }}
            >
              <Plus className="w-5 h-5" />
              <span className="text-xs font-medium">Add Property</span>
            </button>
          </div>
        )}
      </div>

      {/* Comparison Table */}
      {filledCount >= 2 && (
        <div
          className="rounded-2xl border overflow-hidden"
          style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
        >
          <div
            className="px-5 py-4 border-b flex items-center gap-2"
            style={{ borderColor: "var(--border)" }}
          >
            <ArrowLeftRight className="w-4 h-4" style={{ color: "var(--primary)" }} />
            <h2 className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
              Side-by-Side Comparison
            </h2>
          </div>

          <div className="px-5 py-2 overflow-x-auto">
            {/* Pricing */}
            <CompareRow
              label="Price"
              icon={DollarSign}
              values={selectedProperties.map((p) => p?.price)}
              highlight="lowest"
              formatter={fmtPrice}
            />
            <CompareRow
              label="Price / sqm"
              icon={DollarSign}
              values={selectedProperties.map((p) => p?.pricePerSqm)}
              highlight="lowest"
              formatter={fmtPrice}
            />
            <CompareRow
              label="Listing Type"
              icon={Tag}
              values={selectedProperties.map((p) => p?.listingType)}
            />
            <CompareRow
              label="Category"
              icon={Layers}
              values={selectedProperties.map((p) => p?.category)}
            />

            {/* Property Details */}
            <CompareRow
              label="Bedrooms"
              icon={Bed}
              values={selectedProperties.map((p) => p?.bedrooms)}
              highlight="highest"
            />
            <CompareRow
              label="Bathrooms"
              icon={Bath}
              values={selectedProperties.map((p) => p?.bathrooms)}
              highlight="highest"
            />
            <CompareRow
              label="Land Size (sqm)"
              icon={Maximize2}
              values={selectedProperties.map((p) => p?.landSizeSqm)}
              highlight="highest"
            />
            <CompareRow
              label="Building Size (sqm)"
              icon={Maximize2}
              values={selectedProperties.map((p) => p?.buildingSizeSqm)}
              highlight="highest"
            />
            <CompareRow
              label="Floors"
              values={selectedProperties.map((p) => p?.floors)}
            />
            <CompareRow
              label="Furnishing"
              values={selectedProperties.map((p) => p?.furnishing)}
            />
            <CompareRow
              label="Condition"
              values={selectedProperties.map((p) => p?.condition)}
            />
            <CompareRow
              label="Year Built"
              values={selectedProperties.map((p) => p?.yearBuilt)}
            />

            {/* Location */}
            <CompareRow
              label="Location"
              icon={MapPin}
              values={selectedProperties.map((p) =>
                p ? [p.area, p.state].filter(Boolean).join(", ") || "N/A" : null
              )}
            />
            <CompareRow
              label="Estate"
              values={selectedProperties.map((p) => p?.estateName)}
            />

            {/* Quality */}
            <CompareRow
              label="Quality Score"
              icon={Star}
              values={selectedProperties.map((p) => p?.qualityScore)}
              highlight="highest"
            />

            {/* Verification row (custom rendering) */}
            <div
              className="flex items-center border-b last:border-b-0 py-3"
              style={{ borderColor: "var(--border)" }}
            >
              <div className="w-36 sm:w-44 shrink-0 flex items-center gap-2 pr-3">
                <Shield className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--muted-foreground)" }} />
                <span className="text-xs font-semibold" style={{ color: "var(--muted-foreground)" }}>
                  Verification
                </span>
              </div>
              <div
                className="flex-1 grid"
                style={{
                  gridTemplateColumns: `repeat(${selectedProperties.length}, minmax(0, 1fr))`,
                }}
              >
                {selectedProperties.map((p, i) => (
                  <div key={i} className="flex justify-center">
                    {p ? verificationBadge(p.verificationStatus) : <span className="text-sm" style={{ color: "var(--muted-foreground)" }}>N/A</span>}
                  </div>
                ))}
              </div>
            </div>

            {/* Images count */}
            <CompareRow
              label="Images"
              icon={ImageIcon}
              values={selectedProperties.map((p) => p?.images?.length ?? 0)}
              highlight="highest"
            />

            {/* Agent */}
            <CompareRow
              label="Agent"
              icon={User}
              values={selectedProperties.map((p) => p?.agentName)}
            />
            <CompareRow
              label="Agent Phone"
              icon={Phone}
              values={selectedProperties.map((p) => p?.agentPhone)}
            />

            {/* Features row (custom rendering) */}
            <div
              className="flex items-start border-b last:border-b-0 py-3"
              style={{ borderColor: "var(--border)" }}
            >
              <div className="w-36 sm:w-44 shrink-0 flex items-center gap-2 pr-3 pt-0.5">
                <Layers className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--muted-foreground)" }} />
                <span className="text-xs font-semibold" style={{ color: "var(--muted-foreground)" }}>
                  Features
                </span>
              </div>
              <div
                className="flex-1 grid gap-3"
                style={{
                  gridTemplateColumns: `repeat(${selectedProperties.length}, minmax(0, 1fr))`,
                }}
              >
                {selectedProperties.map((p, i) => (
                  <div key={i} className="flex flex-wrap gap-1 justify-center">
                    {p && p.features && p.features.length > 0 ? (
                      p.features.slice(0, 8).map((f: string, fi: number) => (
                        <span
                          key={fi}
                          className="text-[10px] font-medium px-1.5 py-0.5 rounded"
                          style={{
                            backgroundColor: "var(--secondary)",
                            color: "var(--foreground)",
                          }}
                        >
                          {f}
                        </span>
                      ))
                    ) : (
                      <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>
                        N/A
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Days on market */}
            <CompareRow
              label="Days on Market"
              values={selectedProperties.map((p) => p?.daysOnMarket)}
              highlight="lowest"
            />
          </div>
        </div>
      )}

      {/* Empty state */}
      {filledCount < 2 && (
        <div
          className="rounded-2xl border p-12 flex flex-col items-center justify-center gap-3"
          style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
        >
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center"
            style={{ backgroundColor: "rgba(0,1,252,0.08)" }}
          >
            <ArrowLeftRight className="w-7 h-7" style={{ color: "var(--primary)", opacity: 0.5 }} />
          </div>
          <p className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
            Select at least 2 properties to compare
          </p>
          <p className="text-xs text-center max-w-sm" style={{ color: "var(--muted-foreground)" }}>
            Use the search fields above to find and select properties. The comparison
            table will appear once you have selected at least two.
          </p>
        </div>
      )}
    </div>
  );
}
