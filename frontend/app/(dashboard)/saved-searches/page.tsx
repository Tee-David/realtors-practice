"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSavedSearches, useCreateSavedSearch, useUpdateSavedSearch, useDeleteSavedSearch } from "@/hooks/use-saved-searches";
import { savedSearches as savedSearchesApi } from "@/lib/api";
import {
  Search, Plus, Trash2, Eye, EyeOff, Bell, BellOff, Mail,
  ChevronRight, X, Bookmark, SlidersHorizontal, Home, Building2,
  TreePine, Sunset, Factory, Car, Layers, Bed, Bath,
  CheckSquare, ChevronDown, MapPin, DollarSign, ExternalLink,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Skeleton } from "@/components/ui/skeleton";

// ─── Types ────────────────────────────────────────────────────────────────

interface SavedSearchFilters {
  listingType?: string | string[];
  category?: string | string[];
  propertyType?: string | string[];
  minPrice?: number;
  maxPrice?: number;
  bedrooms?: number;
  bathrooms?: number;
  state?: string;
  area?: string;
  furnishing?: string;
  parking?: number;
  serviced?: boolean;
}

// ─── Data ─────────────────────────────────────────────────────────────────

const LISTING_TYPES = [
  { value: "SALE",     label: "Buy",      color: "#2563eb", bg: "rgba(37,99,235,0.1)" },
  { value: "RENT",     label: "Rent",     color: "#ea580c", bg: "rgba(234,88,12,0.1)" },
  { value: "LEASE",    label: "Lease",    color: "#7c3aed", bg: "rgba(124,58,237,0.1)" },
  { value: "SHORTLET", label: "Shortlet", color: "#0891b2", bg: "rgba(8,145,178,0.1)" },
  { value: "LAND",     label: "Land",     color: "#16a34a", bg: "rgba(22,163,74,0.1)" },
];

const CATEGORIES = [
  { value: "RESIDENTIAL", label: "Residential", icon: Home },
  { value: "COMMERCIAL",  label: "Commercial",  icon: Building2 },
  { value: "LAND",        label: "Land",        icon: TreePine },
  { value: "SHORTLET",    label: "Shortlet",    icon: Sunset },
  { value: "INDUSTRIAL",  label: "Industrial",  icon: Factory },
];

const PROPERTY_TYPES = [
  "Flat / Apartment", "Duplex", "Semi-Detached Duplex", "Detached Duplex",
  "Bungalow", "Semi-Detached Bungalow", "Detached Bungalow",
  "Penthouse", "Maisonette", "Terraced House", "Townhouse",
  "Studio", "Self-Contained", "Mini Flat", "Mansion",
  "Warehouse", "Office Space", "Shop / Plaza", "Event Centre",
];

const FURNISHING_OPTIONS = [
  { value: "furnished",       label: "Furnished" },
  { value: "semi-furnished",  label: "Semi-Furnished" },
  { value: "unfurnished",     label: "Unfurnished" },
];

const PRICE_PRESETS = [
  { label: "< ₦5M",     min: 0,          max: 5_000_000 },
  { label: "₦5M–15M",   min: 5_000_000,  max: 15_000_000 },
  { label: "₦15M–50M",  min: 15_000_000, max: 50_000_000 },
  { label: "₦50M–100M", min: 50_000_000, max: 100_000_000 },
  { label: "> ₦100M",   min: 100_000_000, max: undefined as number | undefined },
];

// ─── Chip Selector ────────────────────────────────────────────────────────

function ChipSelector({ options, value, onChange, multi = false }: {
  options: string[];
  value: string | string[];
  onChange: (v: string | string[]) => void;
  multi?: boolean;
}) {
  const selected = multi ? (Array.isArray(value) ? value : []) : value;

  const toggle = (opt: string) => {
    if (!multi) {
      onChange(selected === opt ? "" : opt);
    } else {
      const arr = Array.isArray(selected) ? selected : [];
      onChange(arr.includes(opt) ? arr.filter(v => v !== opt) : [...arr, opt]);
    }
  };

  const isSelected = (opt: string) => multi ? (Array.isArray(selected) && selected.includes(opt)) : selected === opt;

  return (
    <div className="flex flex-wrap gap-2">
      {options.map(opt => (
        <button
          key={opt}
          type="button"
          onClick={() => toggle(opt)}
          className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all border"
          style={{
            borderColor: isSelected(opt) ? "var(--primary)" : "var(--border)",
            backgroundColor: isSelected(opt) ? "rgba(0,1,252,0.08)" : "var(--background)",
            color: isSelected(opt) ? "var(--primary)" : "var(--muted-foreground)",
          }}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}

// ─── Section ──────────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--muted-foreground)" }}>{title}</p>
      {children}
    </div>
  );
}

// ─── Create/Edit Modal ────────────────────────────────────────────────────

function SavedSearchModal({ open, onClose, initialData, onSubmit, isLoading }: {
  open: boolean; onClose: () => void; initialData?: any; onSubmit: (d: any) => void; isLoading: boolean;
}) {
  const [name, setName] = useState(initialData?.name || "");
  const [description, setDescription] = useState(initialData?.description || "");
  const [naturalQuery, setNaturalQuery] = useState(initialData?.naturalQuery || "");
  const [filters, setFilters] = useState<SavedSearchFilters>(initialData?.filters || {});
  const [notifyInApp, setNotifyInApp] = useState(initialData?.notifyInApp ?? true);
  const [notifyEmail, setNotifyEmail] = useState(initialData?.notifyEmail ?? false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const set = (key: keyof SavedSearchFilters, value: any) =>
    setFilters(f => ({ ...f, [key]: value || undefined }));

  if (!open) return null;

  const inputClass = "w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]";
  const inputStyle = { backgroundColor: "var(--background)", borderColor: "var(--border)", color: "var(--foreground)" };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[1100] flex items-end md:items-start md:justify-end bg-black/60 md:p-4 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={isMobile ? { y: "100%" } : { x: "100%" }}
          animate={isMobile ? { y: 0 } : { x: 0 }}
          exit={isMobile ? { y: "100%" } : { x: "100%" }}
          transition={{ type: "spring", bounce: 0, duration: 0.4 }}
          onClick={(e) => e.stopPropagation()}
          className="w-full md:w-[480px] h-[90vh] md:h-full bg-[var(--card)] rounded-t-3xl md:rounded-2xl border shadow-2xl flex flex-col overflow-hidden"
          style={{ borderColor: "var(--border)" }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: "var(--border)" }}>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: "rgba(0,1,252,0.1)" }}>
                <Bookmark className="w-4 h-4" style={{ color: "var(--primary)" }} />
              </div>
              <h2 className="text-base font-semibold" style={{ color: "var(--foreground)" }}>
                {initialData ? "Edit Saved Search" : "New Saved Search"}
              </h2>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[var(--secondary)] transition-colors">
              <X className="w-4 h-4" style={{ color: "var(--muted-foreground)" }} />
            </button>
          </div>

          {/* Form */}
          <form
            onSubmit={e => { e.preventDefault(); onSubmit({ name, description, naturalQuery, filters, notifyInApp, notifyEmail }); }}
            className="overflow-y-auto flex-1"
          >
            <div className="p-6 space-y-6">

              {/* Name + Description */}
              <Section title="Search Details">
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium mb-1" style={{ color: "var(--foreground)" }}>Name <span style={{ color: "var(--destructive)" }}>*</span></label>
                    <input value={name} onChange={e => setName(e.target.value)} className={inputClass} style={inputStyle} placeholder="e.g. 3 bed flats in Lekki under ₦30m" required />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1" style={{ color: "var(--foreground)" }}>Description</label>
                    <input value={description} onChange={e => setDescription(e.target.value)} className={inputClass} style={inputStyle} placeholder="Optional notes about this search" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1" style={{ color: "var(--foreground)" }}>Natural Language Query</label>
                    <input value={naturalQuery} onChange={e => setNaturalQuery(e.target.value)} className={inputClass} style={inputStyle} placeholder="e.g. 3 bedroom apartment in Lekki under 30m with parking" />
                    <p className="text-[11px] mt-1" style={{ color: "var(--muted-foreground)" }}>Descriptive query used for AI matching</p>
                  </div>
                </div>
              </Section>

              {/* Listing Type */}
              <Section title="Listing Type (select multiple)">
                <div className="flex flex-wrap gap-2">
                  {LISTING_TYPES.map(lt => {
                    const activeArray = Array.isArray(filters.listingType) ? filters.listingType : filters.listingType ? [filters.listingType] : [];
                    const active = activeArray.includes(lt.value);
                    return (
                    <button
                      key={lt.value}
                      type="button"
                      onClick={() => set("listingType", active ? activeArray.filter(v => v !== lt.value) : [...activeArray, lt.value])}
                      className="px-4 py-2 rounded-xl text-sm font-semibold transition-all border"
                      style={{
                        borderColor: active ? lt.color : "var(--border)",
                        backgroundColor: active ? lt.bg : "transparent",
                        color: active ? lt.color : "var(--muted-foreground)",
                      }}
                    >
                      {lt.label}
                    </button>
                    );
                  })}
                </div>
              </Section>

              {/* Categories */}
              <Section title="Property Category (select multiple)">
                <div className="flex flex-wrap gap-2">
                  {CATEGORIES.map(cat => {
                    const Icon = cat.icon;
                    const activeArray = Array.isArray(filters.category) ? filters.category : filters.category ? [filters.category] : [];
                    const active = activeArray.includes(cat.value);
                    return (
                      <button
                        key={cat.value}
                        type="button"
                        onClick={() => set("category", active ? activeArray.filter(v => v !== cat.value) : [...activeArray, cat.value])}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-all border"
                        style={{
                          borderColor: active ? "var(--primary)" : "var(--border)",
                          backgroundColor: active ? "rgba(0,1,252,0.07)" : "transparent",
                          color: active ? "var(--primary)" : "var(--muted-foreground)",
                        }}
                      >
                        <Icon className="w-3.5 h-3.5" />{cat.label}
                      </button>
                    );
                  })}
                </div>
              </Section>

              {/* Property Type */}
              <Section title="Property Type (select all that apply)">
                <ChipSelector
                  options={PROPERTY_TYPES}
                  multi={true}
                  value={filters.propertyType ? (Array.isArray(filters.propertyType) ? filters.propertyType : [filters.propertyType]) : []}
                  onChange={v => set("propertyType", v)}
                />
              </Section>

              {/* Price */}
              <Section title="Price Range">
                <div className="space-y-3">
                  <div className="flex flex-wrap gap-2">
                    {PRICE_PRESETS.map(p => {
                      const active = filters.minPrice === p.min && filters.maxPrice === p.max;
                      return (
                        <button
                          key={p.label}
                          type="button"
                          onClick={() => { set("minPrice", p.min || undefined); set("maxPrice", p.max); }}
                          className="px-3 py-1.5 rounded-lg text-xs font-medium border transition-all"
                          style={{
                            borderColor: active ? "var(--primary)" : "var(--border)",
                            backgroundColor: active ? "rgba(0,1,252,0.07)" : "transparent",
                            color: active ? "var(--primary)" : "var(--muted-foreground)",
                          }}
                        >
                          {p.label}
                        </button>
                      );
                    })}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium mb-1" style={{ color: "var(--muted-foreground)" }}>Min Price (₦)</label>
                      <input type="number" value={filters.minPrice || ""} onChange={e => set("minPrice", e.target.value ? Number(e.target.value) : undefined)} className={inputClass} style={inputStyle} placeholder="0" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1" style={{ color: "var(--muted-foreground)" }}>Max Price (₦)</label>
                      <input type="number" value={filters.maxPrice || ""} onChange={e => set("maxPrice", e.target.value ? Number(e.target.value) : undefined)} className={inputClass} style={inputStyle} placeholder="No max" />
                    </div>
                  </div>
                </div>
              </Section>

              {/* Bedrooms & Bathrooms */}
              <Section title="Rooms">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium mb-1.5 flex items-center gap-1" style={{ color: "var(--muted-foreground)" }}>
                      <Bed className="w-3 h-3" /> Bedrooms (min)
                    </label>
                    <div className="flex gap-1.5 flex-wrap">
                      {["Any", "1", "2", "3", "4", "5+"].map(b => (
                        <button key={b} type="button"
                          onClick={() => set("bedrooms", b === "Any" ? undefined : b === "5+" ? 5 : Number(b))}
                          className="w-10 h-9 rounded-lg text-sm font-semibold border transition-all"
                          style={{
                            borderColor: (b === "Any" ? !filters.bedrooms : filters.bedrooms === (b === "5+" ? 5 : Number(b))) ? "var(--primary)" : "var(--border)",
                            backgroundColor: (b === "Any" ? !filters.bedrooms : filters.bedrooms === (b === "5+" ? 5 : Number(b))) ? "rgba(0,1,252,0.07)" : "transparent",
                            color: (b === "Any" ? !filters.bedrooms : filters.bedrooms === (b === "5+" ? 5 : Number(b))) ? "var(--primary)" : "var(--muted-foreground)",
                          }}
                        >{b}</button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1.5 flex items-center gap-1" style={{ color: "var(--muted-foreground)" }}>
                      <Bath className="w-3 h-3" /> Bathrooms (min)
                    </label>
                    <div className="flex gap-1.5 flex-wrap">
                      {["Any", "1", "2", "3", "4+"].map(b => (
                        <button key={b} type="button"
                          onClick={() => set("bathrooms", b === "Any" ? undefined : b === "4+" ? 4 : Number(b))}
                          className="w-10 h-9 rounded-lg text-sm font-semibold border transition-all"
                          style={{
                            borderColor: (b === "Any" ? !filters.bathrooms : filters.bathrooms === (b === "4+" ? 4 : Number(b))) ? "var(--primary)" : "var(--border)",
                            backgroundColor: (b === "Any" ? !filters.bathrooms : filters.bathrooms === (b === "4+" ? 4 : Number(b))) ? "rgba(0,1,252,0.07)" : "transparent",
                            color: (b === "Any" ? !filters.bathrooms : filters.bathrooms === (b === "4+" ? 4 : Number(b))) ? "var(--primary)" : "var(--muted-foreground)",
                          }}
                        >{b}</button>
                      ))}
                    </div>
                  </div>
                </div>
              </Section>

              {/* Location */}
              <Section title="Location">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium mb-1" style={{ color: "var(--muted-foreground)" }}>State</label>
                    <input value={filters.state || ""} onChange={e => set("state", e.target.value)} className={inputClass} style={inputStyle} placeholder="e.g. Lagos" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1" style={{ color: "var(--muted-foreground)" }}>Area / LGA</label>
                    <input value={filters.area || ""} onChange={e => set("area", e.target.value)} className={inputClass} style={inputStyle} placeholder="e.g. Lekki, Ikoyi" />
                  </div>
                </div>
              </Section>

              {/* Additional */}
              <Section title="Additional Filters">
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium mb-2" style={{ color: "var(--muted-foreground)" }}>Furnishing</label>
                    <div className="flex gap-2">
                      {FURNISHING_OPTIONS.map(f => (
                        <button key={f.value} type="button"
                          onClick={() => set("furnishing", filters.furnishing === f.value ? undefined : f.value)}
                          className="px-3 py-1.5 rounded-lg text-xs font-medium border transition-all"
                          style={{
                            borderColor: filters.furnishing === f.value ? "var(--primary)" : "var(--border)",
                            backgroundColor: filters.furnishing === f.value ? "rgba(0,1,252,0.07)" : "transparent",
                            color: filters.furnishing === f.value ? "var(--primary)" : "var(--muted-foreground)",
                          }}
                        >{f.label}</button>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <button type="button" onClick={() => set("serviced", filters.serviced ? undefined : true)}
                        className="w-8 h-4 rounded-full transition-colors relative"
                        style={{ backgroundColor: filters.serviced ? "var(--primary)" : "var(--border)" }}
                      >
                        <span className="absolute top-0.5 left-0.5 w-3 h-3 rounded-full bg-white transition-transform" style={{ transform: filters.serviced ? "translateX(16px)" : "translateX(0)" }} />
                      </button>
                      <span className="text-sm" style={{ color: "var(--foreground)" }}>Serviced</span>
                    </label>
                    <div className="flex items-center gap-2">
                      <Car className="w-3.5 h-3.5" style={{ color: "var(--muted-foreground)" }} />
                      <label className="text-xs font-medium" style={{ color: "var(--muted-foreground)" }}>Parking</label>
                      <input type="number" min={0} max={10} value={filters.parking || ""} onChange={e => set("parking", e.target.value ? Number(e.target.value) : undefined)} className="w-16 rounded-lg border px-2 py-1 text-sm text-center focus:outline-none focus:ring-2 focus:ring-[var(--primary)]" style={inputStyle} placeholder="Any" />
                    </div>
                  </div>
                </div>
              </Section>

              {/* Notifications */}
              <Section title="Alert Preferences">
                <div className="flex items-center gap-6 p-3 rounded-xl border" style={{ borderColor: "var(--border)", backgroundColor: "var(--secondary)" }}>
                  <label className="flex items-center gap-2 cursor-pointer text-sm" style={{ color: "var(--foreground)" }}>
                    <input type="checkbox" checked={notifyInApp} onChange={e => setNotifyInApp(e.target.checked)} className="rounded" />
                    <Bell className="w-4 h-4" /> In-app alerts
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-sm" style={{ color: "var(--foreground)" }}>
                    <input type="checkbox" checked={notifyEmail} onChange={e => setNotifyEmail(e.target.checked)} className="rounded" />
                    <Mail className="w-4 h-4" /> Email alerts
                  </label>
                </div>
              </Section>
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-3 px-6 py-4 border-t" style={{ borderColor: "var(--border)" }}>
              <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-medium transition-colors hover:bg-[var(--secondary)]" style={{ color: "var(--muted-foreground)" }}>
                Cancel
              </button>
              <button type="submit" disabled={isLoading || !name} className="px-5 py-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50" style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}>
                {isLoading ? "Saving..." : initialData ? "Update Search" : "Save Search"}
              </button>
            </div>
          </form>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// ─── Match Viewer ─────────────────────────────────────────────────────────

function MatchesPanel({ searchId, searchName, onClose }: { searchId: string; searchName: string; onClose: () => void }) {
  const [matches, setMatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    savedSearchesApi.getMatches(searchId, { limit: 50 })
      .then(res => { setMatches(res.data.data || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [searchId]);

  return (
    <div className="fixed inset-0 z-[1100] flex items-end md:items-start md:justify-end bg-black/60 md:p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full md:w-[480px] h-[90vh] md:h-full bg-[var(--card)] rounded-t-3xl md:rounded-2xl border shadow-2xl overflow-hidden flex flex-col" style={{ borderColor: "var(--border)" }} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b shrink-0" style={{ borderColor: "var(--border)" }}>
          <h2 className="text-base font-semibold" style={{ color: "var(--foreground)" }}>Matches — {searchName}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[var(--secondary)]"><X className="w-4 h-4" style={{ color: "var(--muted-foreground)" }} /></button>
        </div>
        <div className="overflow-y-auto flex-1 p-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: "var(--primary)" }} />
            </div>
          ) : matches.length === 0 ? (
            <div className="text-center py-12">
              <Search className="w-10 h-10 mx-auto mb-3" style={{ color: "var(--muted-foreground)", opacity: 0.4 }} />
              <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>No matches found yet. Check back later!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {matches.map((m: any) => (
                <div key={m.id} className="flex items-center gap-4 p-3 rounded-xl border transition-colors hover:bg-[var(--secondary)]" style={{ borderColor: "var(--border)" }}>
                  <div className="w-16 h-16 rounded-lg bg-[var(--secondary)] shrink-0 overflow-hidden">
                    {m.property?.images?.[0] && <img src={typeof m.property.images[0] === "string" ? m.property.images[0] : m.property.images[0]?.url} alt="" className="w-full h-full object-cover" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: "var(--foreground)" }}>{m.property?.title}</p>
                    <p className="text-xs mt-0.5" style={{ color: "var(--muted-foreground)" }}>
                      {m.property?.area}{m.property?.state ? `, ${m.property.state}` : ""}{m.property?.bedrooms ? ` · ${m.property.bedrooms} bed` : ""}
                    </p>
                    <p className="text-sm font-semibold mt-1" style={{ color: "var(--primary)" }}>
                      {m.property?.price ? `₦${new Intl.NumberFormat().format(m.property.price)}` : "Price on request"}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Search Card ──────────────────────────────────────────────────────────

function SearchCard({ s, onEdit, onDelete, onToggle, onViewMatches, onSearchNow }: {
  s: any; onEdit: () => void; onDelete: () => void; onToggle: () => void; onViewMatches: () => void; onSearchNow: () => void;
}) {
  const filters = (s.filters || {}) as SavedSearchFilters;
  const matchCount = s._count?.matches || s.matchCount || 0;
  const newSinceCheck = s.newSinceCheck || 0;
  const tags: string[] = [];
  if (filters.listingType) {
    const list = Array.isArray(filters.listingType) ? filters.listingType : [filters.listingType];
    list.forEach(v => tags.push(LISTING_TYPES.find(l => l.value === v)?.label || v));
  }
  if (filters.category) {
    const list = Array.isArray(filters.category) ? filters.category : [filters.category];
    list.forEach(v => tags.push(v));
  }
  if (filters.propertyType) {
    const list = Array.isArray(filters.propertyType) ? filters.propertyType : [filters.propertyType];
    list.forEach(v => tags.push(v));
  }
  if (filters.bedrooms) tags.push(`${filters.bedrooms}+ bed`);
  if (filters.bathrooms) tags.push(`${filters.bathrooms}+ bath`);
  if (filters.area) tags.push(filters.area);
  if (filters.state && !filters.area) tags.push(filters.state);
  if (filters.furnishing) tags.push(filters.furnishing);
  if (filters.serviced) tags.push("Serviced");
  if (filters.minPrice || filters.maxPrice) {
    const fmt = (n: number) => n >= 1_000_000 ? `₦${(n/1_000_000).toFixed(0)}M` : `₦${(n/1000).toFixed(0)}K`;
    if (filters.minPrice && filters.maxPrice) tags.push(`${fmt(filters.minPrice)}–${fmt(filters.maxPrice)}`);
    else if (filters.minPrice) tags.push(`From ${fmt(filters.minPrice)}`);
    else if (filters.maxPrice) tags.push(`Up to ${fmt(filters.maxPrice)}`);
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="rounded-2xl border p-5 transition-all hover:shadow-md group"
      style={{ borderColor: "var(--border)", backgroundColor: "var(--card)", opacity: s.isActive ? 1 : 0.65 }}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <h3 className="text-base font-semibold truncate" style={{ color: "var(--foreground)" }}>{s.name}</h3>
          {s.description && <p className="text-xs mt-0.5 truncate" style={{ color: "var(--muted-foreground)" }}>{s.description}</p>}
        </div>
        <div className="flex items-center gap-1.5 shrink-0 ml-2">
          {matchCount > 0 && (
            <span className="inline-flex items-center justify-center min-w-[22px] h-5 rounded-full text-[10px] font-bold px-1.5" style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}>
              {matchCount}
            </span>
          )}
          {newSinceCheck > 0 && (
            <span className="inline-flex items-center justify-center min-w-[22px] h-5 rounded-full text-[10px] font-bold px-1.5" style={{ backgroundColor: "#16a34a", color: "#fff" }}>
              +{newSinceCheck} new
            </span>
          )}
        </div>
      </div>

      {/* Tag chips */}
      <div className="flex flex-wrap gap-1.5 mb-4 min-h-[26px]">
        {tags.length > 0 ? tags.slice(0, 6).map((tag, i) => (
          <span key={i} className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium" style={{ backgroundColor: "var(--secondary)", color: "var(--foreground)" }}>
            {tag}
          </span>
        )) : (
          <span className="text-xs italic" style={{ color: "var(--muted-foreground)" }}>No filters set</span>
        )}
        {tags.length > 6 && <span className="text-[10px]" style={{ color: "var(--muted-foreground)" }}>+{tags.length - 6} more</span>}
      </div>

      {/* Status row */}
      <div className="flex items-center gap-3 mb-4 text-xs" style={{ color: "var(--muted-foreground)" }}>
        <span className="flex items-center gap-1">
          {s.isActive ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
          {s.isActive ? "Active" : "Paused"}
        </span>
        <span className="flex items-center gap-1">
          {s.notifyInApp ? <Bell className="w-3.5 h-3.5" /> : <BellOff className="w-3.5 h-3.5" />}
          In-app
        </span>
        {s.notifyEmail && <span className="flex items-center gap-1"><Mail className="w-3.5 h-3.5" /> Email</span>}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 border-t pt-3" style={{ borderColor: "var(--border)" }}>
        <button onClick={onSearchNow} className="flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-semibold transition-colors hover:opacity-90" style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }} title="Search Now">
          <Search className="w-3.5 h-3.5" /> Search Now
        </button>
        <button onClick={onViewMatches} className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium transition-colors hover:bg-[var(--secondary)]" style={{ color: "var(--primary)" }}>
          Matches ({matchCount}) <ChevronRight className="w-3.5 h-3.5" />
        </button>
        <button onClick={onToggle} className="p-2 rounded-lg hover:bg-[var(--secondary)] transition-colors" title={s.isActive ? "Pause" : "Resume"}>
          {s.isActive ? <EyeOff className="w-4 h-4" style={{ color: "var(--muted-foreground)" }} /> : <Eye className="w-4 h-4" style={{ color: "var(--muted-foreground)" }} />}
        </button>
        <button onClick={onEdit} className="p-2 rounded-lg hover:bg-[var(--secondary)] transition-colors" title="Edit">
          <SlidersHorizontal className="w-4 h-4" style={{ color: "var(--muted-foreground)" }} />
        </button>
        <button onClick={onDelete} className="p-2 rounded-lg hover:bg-[var(--secondary)] transition-colors" title="Delete">
          <Trash2 className="w-4 h-4" style={{ color: "var(--destructive)" }} />
        </button>
      </div>
    </motion.div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────

/**
 * Build a search page URL from saved search filters.
 * The search page uses ?q= for the natural query and filter params.
 */
function buildSearchUrl(filters: SavedSearchFilters, naturalQuery?: string): string {
  const params = new URLSearchParams();

  // Use natural query as the search query if available
  if (naturalQuery) params.set("q", naturalQuery);

  // Map filters to URL params
  if (filters.listingType) {
    const list = Array.isArray(filters.listingType) ? filters.listingType : [filters.listingType];
    if (list.length) params.set("listingType", list.join(","));
  }
  if (filters.category) {
    const list = Array.isArray(filters.category) ? filters.category : [filters.category];
    if (list.length) params.set("category", list.join(","));
  }
  if (filters.propertyType) {
    const list = Array.isArray(filters.propertyType) ? filters.propertyType : [filters.propertyType];
    if (list.length) params.set("propertyType", list.join(","));
  }
  if (filters.minPrice) params.set("minPrice", String(filters.minPrice));
  if (filters.maxPrice) params.set("maxPrice", String(filters.maxPrice));
  if (filters.bedrooms) params.set("bedrooms", String(filters.bedrooms));
  if (filters.bathrooms) params.set("bathrooms", String(filters.bathrooms));
  if (filters.state) params.set("state", filters.state);
  if (filters.area) params.set("area", filters.area);
  if (filters.furnishing) params.set("furnishing", filters.furnishing);
  if (filters.parking) params.set("parking", String(filters.parking));
  if (filters.serviced) params.set("serviced", "true");

  const qs = params.toString();
  return `/search${qs ? `?${qs}` : ""}`;
}

export default function SavedSearchesPage() {
  const router = useRouter();
  const { data: searches = [], isLoading } = useSavedSearches();
  const createMutation = useCreateSavedSearch();
  const updateMutation = useUpdateSavedSearch();
  const deleteMutation = useDeleteSavedSearch();

  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState<any>(null);
  const [matchesView, setMatchesView] = useState<{ id: string; name: string } | null>(null);

  const handleCreate = (data: any) => createMutation.mutate(data, { onSuccess: () => setModalOpen(false), onError: () => { /* toast handled by hook */ } });
  const handleUpdate = (data: any) => { if (!editItem) return; updateMutation.mutate({ id: editItem.id, data }, { onSuccess: () => setEditItem(null), onError: () => { /* toast handled by hook */ } }); };
  const handleDelete = (id: string) => { if (confirm("Delete this saved search?")) deleteMutation.mutate(id); };
  const handleToggle = (item: any) => updateMutation.mutate({ id: item.id, data: { isActive: !item.isActive } });
  const handleSearchNow = (item: any) => {
    const url = buildSearchUrl(item.filters || {}, item.naturalQuery);
    router.push(url);
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>Saved Searches</h1>
          <p className="text-sm mt-1" style={{ color: "var(--muted-foreground)" }}>
            Get notified when new properties match your criteria
          </p>
        </div>
        <button
          data-tour="new-search-btn"
          onClick={() => setModalOpen(true)}
          className="flex items-center gap-2 px-3 sm:px-4 py-2.5 rounded-xl text-sm font-semibold transition-all hover:opacity-90 shrink-0"
          style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}
        >
          <Plus className="w-4 h-4 shrink-0" />
          <span className="hidden sm:inline whitespace-nowrap">New Search</span>
        </button>
      </div>


      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-2xl border p-5" style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}>
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
                <Skeleton className="w-6 h-5 rounded-full shrink-0 ml-2" />
              </div>
              <div className="flex flex-wrap gap-1.5 mb-4">
                <Skeleton className="h-5 w-14 rounded-md" />
                <Skeleton className="h-5 w-20 rounded-md" />
                <Skeleton className="h-5 w-16 rounded-md" />
              </div>
              <div className="flex items-center gap-3 mb-4">
                <Skeleton className="h-3 w-12" />
                <Skeleton className="h-3 w-12" />
              </div>
              <div className="border-t pt-3" style={{ borderColor: "var(--border)" }}>
                <Skeleton className="h-7 w-full rounded-lg" />
              </div>
            </div>
          ))}
        </div>
      ) : searches.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 rounded-2xl border" style={{ borderColor: "var(--border)" }}>
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4" style={{ backgroundColor: "rgba(0,1,252,0.08)" }}>
            <Bookmark className="w-8 h-8" style={{ color: "var(--primary)" }} />
          </div>
          <h3 className="text-lg font-semibold mb-1" style={{ color: "var(--foreground)" }}>No saved searches yet</h3>
          <p className="text-sm mb-6 text-center max-w-xs" style={{ color: "var(--muted-foreground)" }}>
            Save your search criteria and get instant alerts when matching properties appear
          </p>
          <button onClick={() => setModalOpen(true)} className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold" style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}>
            <Plus className="w-4 h-4" /> Create your first search
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {searches.map((s: any) => (
            <SearchCard
              key={s.id}
              s={s}
              onEdit={() => setEditItem(s)}
              onDelete={() => handleDelete(s.id)}
              onToggle={() => handleToggle(s)}
              onViewMatches={() => setMatchesView({ id: s.id, name: s.name })}
              onSearchNow={() => handleSearchNow(s)}
            />
          ))}
        </div>
      )}

      <SavedSearchModal open={modalOpen} onClose={() => setModalOpen(false)} onSubmit={handleCreate} isLoading={createMutation.isPending} />
      <SavedSearchModal open={!!editItem} onClose={() => setEditItem(null)} initialData={editItem} onSubmit={handleUpdate} isLoading={updateMutation.isPending} />
      {matchesView && <MatchesPanel searchId={matchesView.id} searchName={matchesView.name} onClose={() => setMatchesView(null)} />}
    </div>
  );
}
