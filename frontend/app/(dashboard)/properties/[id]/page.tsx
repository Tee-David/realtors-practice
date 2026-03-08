"use client";

import { use } from "react";
import { useProperty, usePropertyVersions, usePropertyPriceHistory } from "@/hooks/useProperties";
import { formatPrice } from "@/lib/utils";
import {
  ArrowLeft, MapPin, BedDouble, Bath, Maximize2, Calendar, Star, Shield,
  ExternalLink, Phone, Mail, Building, User, Clock, Tag, ChevronDown,
  Layers, TrendingUp,
} from "lucide-react";
import Link from "next/link";
import type { PropertyVersion, PriceHistoryEntry } from "@/types/property";

const CATEGORY_COLORS: Record<string, string> = {
  RESIDENTIAL: "#3b82f6",
  LAND: "#10b981",
  SHORTLET: "#f97316",
  COMMERCIAL: "#8b5cf6",
  INDUSTRIAL: "#64748b",
};

const STATUS_STYLES: Record<string, { bg: string; color: string }> = {
  AVAILABLE: { bg: "#dcfce7", color: "#166534" },
  SOLD: { bg: "#fee2e2", color: "#991b1b" },
  RENTED: { bg: "#dbeafe", color: "#1e40af" },
  UNDER_OFFER: { bg: "#fef3c7", color: "#92400e" },
  WITHDRAWN: { bg: "#f3f4f6", color: "#374151" },
  EXPIRED: { bg: "#f3f4f6", color: "#6b7280" },
};

function InfoItem({ icon: Icon, label, value }: {
  icon: React.ElementType;
  label: string;
  value: React.ReactNode;
}) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-3 py-2.5">
      <Icon size={16} className="mt-0.5 shrink-0" style={{ color: "var(--muted-foreground)" }} />
      <div>
        <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>{label}</p>
        <p className="text-sm font-medium" style={{ color: "var(--foreground)" }}>{value}</p>
      </div>
    </div>
  );
}

function VersionTimeline({ versions }: { versions: PropertyVersion[] }) {
  if (!versions.length) return <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>No version history</p>;

  return (
    <div className="space-y-3">
      {versions.map((v) => (
        <div key={v.id} className="flex gap-3">
          <div className="flex flex-col items-center">
            <div className="w-2.5 h-2.5 rounded-full mt-1.5" style={{ backgroundColor: "var(--primary)" }} />
            <div className="w-px flex-1" style={{ backgroundColor: "var(--border)" }} />
          </div>
          <div className="pb-4 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold" style={{ color: "var(--foreground)" }}>
                v{v.version}
              </span>
              <span
                className="text-[10px] px-1.5 py-0.5 rounded font-medium"
                style={{ backgroundColor: "var(--secondary)", color: "var(--muted-foreground)" }}
              >
                {v.changeSource}
              </span>
            </div>
            <p className="text-xs mt-0.5" style={{ color: "var(--muted-foreground)" }}>
              {v.changeSummary || v.changedFields.join(", ")}
            </p>
            <p className="text-[10px] mt-1" style={{ color: "var(--muted-foreground)" }}>
              {new Date(v.createdAt).toLocaleString()}
              {v.editor && ` by ${v.editor.firstName || v.editor.email}`}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

function PriceChart({ history }: { history: PriceHistoryEntry[] }) {
  if (!history.length) return <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>No price history</p>;

  const prices = history.map((h) => h.price);
  const maxPrice = Math.max(...prices);
  const minPrice = Math.min(...prices);
  const range = maxPrice - minPrice || 1;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-8 text-xs" style={{ color: "var(--muted-foreground)" }}>
        <span>Low: {formatPrice(minPrice)}</span>
        <span>High: {formatPrice(maxPrice)}</span>
      </div>
      <div className="flex items-end gap-1 h-24">
        {history.map((h, i) => {
          const height = ((h.price - minPrice) / range) * 100 || 20;
          return (
            <div key={h.id} className="flex-1 flex flex-col items-center gap-1">
              <div
                className="w-full rounded-t transition-all"
                style={{
                  height: `${Math.max(height, 8)}%`,
                  backgroundColor: "var(--accent)",
                  opacity: 0.5 + (i / history.length) * 0.5,
                }}
              />
              <span className="text-[9px]" style={{ color: "var(--muted-foreground)" }}>
                {new Date(h.recordedAt).toLocaleDateString("en-NG", { month: "short" })}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function PropertyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: property, isLoading } = useProperty(id);
  const { data: versionsData } = usePropertyVersions(id);
  const { data: priceHistory } = usePropertyPriceHistory(id);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: "var(--primary)", borderTopColor: "transparent" }} />
      </div>
    );
  }

  if (!property) {
    return (
      <div className="text-center py-20">
        <p className="text-lg font-display font-semibold" style={{ color: "var(--foreground)" }}>Property not found</p>
        <Link href="/properties" className="text-sm mt-2 inline-block" style={{ color: "var(--primary)" }}>
          Back to properties
        </Link>
      </div>
    );
  }

  const images = Array.isArray(property.images) ? property.images : [];
  const statusStyle = STATUS_STYLES[property.status] || STATUS_STYLES.AVAILABLE;
  const categoryColor = CATEGORY_COLORS[property.category] || CATEGORY_COLORS.RESIDENTIAL;
  const location = property.locationText || [property.area, property.lga, property.state].filter(Boolean).join(", ");
  const versions = versionsData?.data || [];

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Back + Title */}
      <div>
        <Link
          href="/properties"
          className="inline-flex items-center gap-1.5 text-xs font-medium mb-3 transition-colors hover:opacity-80"
          style={{ color: "var(--primary)" }}
        >
          <ArrowLeft size={14} />
          Back to properties
        </Link>

        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-display font-bold" style={{ color: "var(--foreground)" }}>
              {property.title}
            </h1>
            <div className="flex items-center gap-2 mt-1.5">
              <MapPin size={13} style={{ color: "var(--muted-foreground)" }} />
              <span className="text-sm" style={{ color: "var(--muted-foreground)" }}>{location}</span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span
              className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase"
              style={{ backgroundColor: statusStyle.bg, color: statusStyle.color }}
            >
              {property.status.replace("_", " ")}
            </span>
            <a
              href={property.listingUrl}
              target="_blank"
              rel="noopener"
              className="p-2 rounded-lg transition-colors"
              style={{ backgroundColor: "var(--secondary)" }}
            >
              <ExternalLink size={14} style={{ color: "var(--muted-foreground)" }} />
            </a>
          </div>
        </div>
      </div>

      {/* Image Gallery */}
      {images.length > 0 && (
        <div className="grid grid-cols-4 gap-2 rounded-2xl overflow-hidden max-h-[400px]">
          <div className="col-span-2 row-span-2">
            <img src={images[0]} alt="" className="w-full h-full object-cover" />
          </div>
          {images.slice(1, 5).map((img: string, i: number) => (
            <div key={i} className="relative">
              <img src={img} alt="" className="w-full h-full object-cover" />
              {i === 3 && images.length > 5 && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                  <span className="text-white font-semibold text-sm">+{images.length - 5}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Main content grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Price + Category bar */}
          <div
            className="rounded-xl p-5 flex items-center justify-between"
            style={{ backgroundColor: "var(--card)" }}
          >
            <div>
              <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>Price</p>
              <p className="text-2xl font-display font-bold" style={{ color: "var(--accent)" }}>
                {formatPrice(property.price)}
                {property.rentFrequency && (
                  <span className="text-sm font-normal ml-1" style={{ color: "var(--muted-foreground)" }}>
                    /{property.rentFrequency}
                  </span>
                )}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span
                className="px-3 py-1.5 rounded-full text-xs font-semibold text-white"
                style={{ backgroundColor: categoryColor }}
              >
                {property.category}
              </span>
              {property.qualityScore != null && (
                <div className="flex items-center gap-1 px-3 py-1.5 rounded-full" style={{ backgroundColor: "var(--secondary)" }}>
                  <Star size={12} fill="#facc15" stroke="#facc15" />
                  <span className="text-xs font-semibold" style={{ color: "var(--foreground)" }}>
                    {(property.qualityScore / 20).toFixed(1)}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Key details grid */}
          <div className="rounded-xl p-5 grid grid-cols-2 sm:grid-cols-4 gap-4" style={{ backgroundColor: "var(--card)" }}>
            {property.bedrooms != null && (
              <div className="text-center">
                <BedDouble size={20} className="mx-auto mb-1" style={{ color: "var(--primary)" }} />
                <p className="text-lg font-display font-bold" style={{ color: "var(--foreground)" }}>{property.bedrooms}</p>
                <p className="text-[10px] uppercase" style={{ color: "var(--muted-foreground)" }}>Bedrooms</p>
              </div>
            )}
            {property.bathrooms != null && (
              <div className="text-center">
                <Bath size={20} className="mx-auto mb-1" style={{ color: "var(--primary)" }} />
                <p className="text-lg font-display font-bold" style={{ color: "var(--foreground)" }}>{property.bathrooms}</p>
                <p className="text-[10px] uppercase" style={{ color: "var(--muted-foreground)" }}>Bathrooms</p>
              </div>
            )}
            {(property.landSizeSqm || property.buildingSizeSqm) && (
              <div className="text-center">
                <Maximize2 size={20} className="mx-auto mb-1" style={{ color: "var(--primary)" }} />
                <p className="text-lg font-display font-bold" style={{ color: "var(--foreground)" }}>
                  {Math.round(property.landSizeSqm || property.buildingSizeSqm || 0)}
                </p>
                <p className="text-[10px] uppercase" style={{ color: "var(--muted-foreground)" }}>Sqm</p>
              </div>
            )}
            {property.floors != null && (
              <div className="text-center">
                <Layers size={20} className="mx-auto mb-1" style={{ color: "var(--primary)" }} />
                <p className="text-lg font-display font-bold" style={{ color: "var(--foreground)" }}>{property.floors}</p>
                <p className="text-[10px] uppercase" style={{ color: "var(--muted-foreground)" }}>Floors</p>
              </div>
            )}
          </div>

          {/* Description */}
          {property.description && (
            <div className="rounded-xl p-5" style={{ backgroundColor: "var(--card)" }}>
              <h2 className="font-display font-semibold text-sm mb-3" style={{ color: "var(--foreground)" }}>
                Description
              </h2>
              <p className="text-sm leading-relaxed whitespace-pre-line" style={{ color: "var(--muted-foreground)" }}>
                {property.description}
              </p>
            </div>
          )}

          {/* Features */}
          {property.features.length > 0 && (
            <div className="rounded-xl p-5" style={{ backgroundColor: "var(--card)" }}>
              <h2 className="font-display font-semibold text-sm mb-3" style={{ color: "var(--foreground)" }}>
                Features & Amenities
              </h2>
              <div className="flex flex-wrap gap-2">
                {property.features.map((f: string) => (
                  <span
                    key={f}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium"
                    style={{ backgroundColor: "var(--secondary)", color: "var(--foreground)" }}
                  >
                    {f}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Additional details */}
          <div className="rounded-xl p-5" style={{ backgroundColor: "var(--card)" }}>
            <h2 className="font-display font-semibold text-sm mb-2" style={{ color: "var(--foreground)" }}>
              Property Details
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0" style={{ borderColor: "var(--border)" }}>
              <div>
                <InfoItem icon={Building} label="Property Type" value={property.propertyType} />
                <InfoItem icon={Tag} label="Listing Type" value={property.listingType} />
                <InfoItem icon={Shield} label="Condition" value={property.condition !== "UNKNOWN" ? property.condition : undefined} />
                <InfoItem icon={Calendar} label="Year Built" value={property.yearBuilt} />
              </div>
              <div className="sm:pl-6">
                <InfoItem icon={MapPin} label="Full Address" value={property.fullAddress} />
                <InfoItem icon={MapPin} label="Estate" value={property.estateName} />
                <InfoItem icon={Clock} label="Days on Market" value={property.daysOnMarket} />
                <InfoItem icon={Layers} label="Source" value={property.source} />
              </div>
            </div>
          </div>
        </div>

        {/* Right sidebar */}
        <div className="space-y-5">
          {/* Agent card */}
          {(property.agentName || property.agencyName) && (
            <div className="rounded-xl p-5" style={{ backgroundColor: "var(--card)" }}>
              <h2 className="font-display font-semibold text-sm mb-3" style={{ color: "var(--foreground)" }}>
                Contact
              </h2>
              {property.agentName && (
                <div className="flex items-center gap-3 mb-3">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: "var(--secondary)" }}
                  >
                    <User size={18} style={{ color: "var(--muted-foreground)" }} />
                  </div>
                  <div>
                    <p className="text-sm font-medium" style={{ color: "var(--foreground)" }}>
                      {property.agentName}
                    </p>
                    {property.agencyName && (
                      <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>{property.agencyName}</p>
                    )}
                  </div>
                </div>
              )}
              {property.agentPhone && (
                <a
                  href={`tel:${property.agentPhone}`}
                  className="flex items-center gap-2 w-full py-2.5 px-4 rounded-lg text-sm font-medium text-white text-center justify-center mb-2"
                  style={{ backgroundColor: "var(--primary)" }}
                >
                  <Phone size={14} />
                  {property.agentPhone}
                </a>
              )}
              {property.agentEmail && (
                <a
                  href={`mailto:${property.agentEmail}`}
                  className="flex items-center gap-2 w-full py-2.5 px-4 rounded-lg text-sm font-medium text-center justify-center"
                  style={{ backgroundColor: "var(--secondary)", color: "var(--foreground)" }}
                >
                  <Mail size={14} />
                  Email Agent
                </a>
              )}
            </div>
          )}

          {/* Price History */}
          <div className="rounded-xl p-5" style={{ backgroundColor: "var(--card)" }}>
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp size={14} style={{ color: "var(--accent)" }} />
              <h2 className="font-display font-semibold text-sm" style={{ color: "var(--foreground)" }}>
                Price History
              </h2>
            </div>
            <PriceChart history={priceHistory || []} />
          </div>

          {/* Version History */}
          <div className="rounded-xl p-5" style={{ backgroundColor: "var(--card)" }}>
            <div className="flex items-center gap-2 mb-3">
              <Clock size={14} style={{ color: "var(--primary)" }} />
              <h2 className="font-display font-semibold text-sm" style={{ color: "var(--foreground)" }}>
                Version History
              </h2>
              {property._count?.versions != null && (
                <span className="text-[10px] px-1.5 py-0.5 rounded font-medium" style={{ backgroundColor: "var(--secondary)", color: "var(--muted-foreground)" }}>
                  {property._count.versions}
                </span>
              )}
            </div>
            <VersionTimeline versions={versions} />
          </div>

          {/* Metadata */}
          <div className="rounded-xl p-5" style={{ backgroundColor: "var(--card)" }}>
            <h2 className="font-display font-semibold text-sm mb-2" style={{ color: "var(--foreground)" }}>
              Metadata
            </h2>
            <div className="space-y-2 text-xs" style={{ color: "var(--muted-foreground)" }}>
              <div className="flex justify-between">
                <span>Version</span>
                <span className="font-medium" style={{ color: "var(--foreground)" }}>v{property.currentVersion}</span>
              </div>
              <div className="flex justify-between">
                <span>Quality Score</span>
                <span className="font-medium" style={{ color: "var(--foreground)" }}>{property.qualityScore || "—"}/100</span>
              </div>
              <div className="flex justify-between">
                <span>Verification</span>
                <span className="font-medium" style={{ color: "var(--foreground)" }}>{property.verificationStatus}</span>
              </div>
              <div className="flex justify-between">
                <span>Created</span>
                <span className="font-medium" style={{ color: "var(--foreground)" }}>
                  {new Date(property.createdAt).toLocaleDateString()}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Source</span>
                <span className="font-medium" style={{ color: "var(--foreground)" }}>{property.site?.name || property.source}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
