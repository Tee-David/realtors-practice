"use client";

import { useRouter } from "next/navigation";
import { MapPin, BedDouble, Bath, Maximize2, Phone, Mail, User, ExternalLink, X } from "lucide-react";
import { formatPrice } from "@/lib/utils";
import type { Property } from "@/types/property";
import AnimatedCounter from "@/components/ui/animated-counter";

const STATUS_STYLES: Record<string, { bg: string; color: string }> = {
  AVAILABLE: { bg: "#dcfce7", color: "#166534" },
  SOLD: { bg: "#fee2e2", color: "#991b1b" },
  RENTED: { bg: "#dbeafe", color: "#1e40af" },
  UNDER_OFFER: { bg: "#fef3c7", color: "#92400e" },
  WITHDRAWN: { bg: "#f3f4f6", color: "#374151" },
  EXPIRED: { bg: "#f3f4f6", color: "#6b7280" },
};

interface PropertyDetailPanelProps {
  property: Property;
  onClose: () => void;
}

export function PropertyDetailPanel({ property, onClose }: PropertyDetailPanelProps) {
  const router = useRouter();

  if (!property) {
    return (
      <div className="p-8 text-center flex items-center justify-center h-64">
        <p className="text-sm text-muted-foreground">Property not found</p>
      </div>
    );
  }

  const images = Array.isArray(property.images) ? property.images : [];
  const location = property.locationText || [property.area, property.lga, property.state].filter(Boolean).join(", ");
  const statusStyle = STATUS_STYLES[property.status] || STATUS_STYLES.AVAILABLE;

  return (
    <div className="space-y-5">
      {/* Close button */}
      <div className="flex items-center justify-between">
        <h2 className="font-display font-bold text-base" style={{ color: "var(--foreground)" }}>
          Property Details
        </h2>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg transition-colors hover:bg-[var(--secondary)]"
        >
          <X size={18} style={{ color: "var(--muted-foreground)" }} />
        </button>
      </div>

      {/* Image gallery */}
      {images.length > 0 && (
        <div className="relative rounded-xl overflow-hidden aspect-[16/10]">
          <img src={images[0]} alt={property.title} className="w-full h-full object-cover" />
          {images.length > 1 && (
            <div
              className="absolute bottom-2 right-2 px-2 py-1 rounded text-xs font-medium"
              style={{ backgroundColor: "rgba(0,0,0,0.6)", color: "#fff" }}
            >
              1/{images.length}
            </div>
          )}
        </div>
      )}

      {/* Title + status */}
      <div>
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-display font-bold text-lg leading-snug" style={{ color: "var(--foreground)" }}>
            {property.title}
          </h3>
          <span
            className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase shrink-0"
            style={{ backgroundColor: statusStyle.bg, color: statusStyle.color }}
          >
            {property.status.replace("_", " ")}
          </span>
        </div>
        <div className="flex items-center gap-1 mt-1">
          <MapPin size={13} style={{ color: "var(--muted-foreground)" }} />
          <span className="text-sm" style={{ color: "var(--muted-foreground)" }}>{location}</span>
        </div>
      </div>

      <div className="rounded-xl p-4" style={{ backgroundColor: "var(--secondary)" }}>
        <AnimatedCounter
          value={property.price || 0}
          fontSize={24}
          fontWeight={700}
          textColor="var(--accent)"
          compact={true}
          prefix="₦"
        />
        {property.rentFrequency && (
          <span className="text-sm ml-1" style={{ color: "var(--muted-foreground)" }}>/{property.rentFrequency}</span>
        )}
      </div>

      {/* Key stats */}
      <div className="grid grid-cols-3 gap-3">
        {property.bedrooms != null && (
          <div className="text-center rounded-xl p-3" style={{ backgroundColor: "var(--secondary)" }}>
            <BedDouble size={18} className="mx-auto mb-1" style={{ color: "var(--primary)" }} />
            <div className="flex justify-center">
              <AnimatedCounter value={property.bedrooms} fontSize={16} fontWeight={700} textColor="var(--foreground)" />
            </div>
            <p className="text-[10px]" style={{ color: "var(--muted-foreground)" }}>Beds</p>
          </div>
        )}
        {property.bathrooms != null && (
          <div className="text-center rounded-xl p-3" style={{ backgroundColor: "var(--secondary)" }}>
            <Bath size={18} className="mx-auto mb-1" style={{ color: "var(--primary)" }} />
            <div className="flex justify-center">
              <AnimatedCounter value={property.bathrooms} fontSize={16} fontWeight={700} textColor="var(--foreground)" />
            </div>
            <p className="text-[10px]" style={{ color: "var(--muted-foreground)" }}>Baths</p>
          </div>
        )}
        {(property.landSizeSqm || property.buildingSizeSqm) && (
          <div className="text-center rounded-xl p-3" style={{ backgroundColor: "var(--secondary)" }}>
            <Maximize2 size={18} className="mx-auto mb-1" style={{ color: "var(--primary)" }} />
            <div className="flex justify-center">
              <AnimatedCounter 
                value={Math.round(property.landSizeSqm || property.buildingSizeSqm || 0)} 
                fontSize={16} 
                fontWeight={700} 
                textColor="var(--foreground)" 
              />
            </div>
            <p className="text-[10px]" style={{ color: "var(--muted-foreground)" }}>Sqm</p>
          </div>
        )}
      </div>

      {/* Description excerpt */}
      {property.description && (
        <div>
          <h4 className="font-display font-semibold text-sm mb-1" style={{ color: "var(--foreground)" }}>Description</h4>
          <p className="text-sm leading-relaxed line-clamp-4" style={{ color: "var(--muted-foreground)" }}>
            {property.description}
          </p>
        </div>
      )}

      {/* Features */}
      {property.features && property.features.length > 0 && (
        <div>
          <h4 className="font-display font-semibold text-sm mb-2" style={{ color: "var(--foreground)" }}>Features</h4>
          <div className="flex flex-wrap gap-1.5">
            {(property.features || []).slice(0, 8).map((f: string) => (
              <span
                key={f}
                className="px-2.5 py-1 rounded-lg text-xs"
                style={{ backgroundColor: "var(--secondary)", color: "var(--foreground)" }}
              >
                {f}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Agent info */}
      {(property.agentName || property.agencyName) && (
        <div className="rounded-xl p-4" style={{ backgroundColor: "var(--secondary)" }}>
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: "var(--card)" }}>
              <User size={18} style={{ color: "var(--muted-foreground)" }} />
            </div>
            <div>
              <p className="text-sm font-medium" style={{ color: "var(--foreground)" }}>{property.agentName}</p>
              {property.agencyName && <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>{property.agencyName}</p>}
            </div>
          </div>
          <div className="flex gap-2">
            {property.agentPhone && (
              <a href={`tel:${property.agentPhone}`} className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium text-white" style={{ backgroundColor: "var(--primary)" }}>
                <Phone size={12} /> Call
              </a>
            )}
            {property.agentEmail && (
              <a href={`mailto:${property.agentEmail}`} className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium" style={{ backgroundColor: "var(--card)", color: "var(--foreground)" }}>
                <Mail size={12} /> Email
              </a>
            )}
          </div>
        </div>
      )}

      {/* Open full page + original listing buttons */}
      <div className="flex gap-2 pt-2">
        <button
          onClick={() => router.push(`/properties/${property.id}`)}
          className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white text-center"
          style={{ backgroundColor: "var(--primary)" }}
        >
          Open Full Page
        </button>
        {property.listingUrl && (
          <a
            href={property.listingUrl}
            target="_blank"
            rel="noopener"
            className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-medium"
            style={{ backgroundColor: "var(--secondary)", color: "var(--foreground)" }}
          >
            <ExternalLink size={14} /> Source
          </a>
        )}
      </div>
    </div>
  );
}
