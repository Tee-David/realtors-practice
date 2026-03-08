"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, ArrowRight } from "lucide-react";
import type { PropertyVersion } from "@/types/property";

const FIELD_LABELS: Record<string, string> = {
  title: "Title",
  price: "Price",
  description: "Description",
  bedrooms: "Bedrooms",
  bathrooms: "Bathrooms",
  status: "Status",
  listingType: "Listing Type",
  category: "Category",
  fullAddress: "Address",
  locationText: "Location",
  area: "Area",
  state: "State",
  lga: "LGA",
  propertyType: "Property Type",
  condition: "Condition",
  furnishing: "Furnishing",
  qualityScore: "Quality Score",
  verificationStatus: "Verification",
  landSizeSqm: "Land Size (sqm)",
  buildingSizeSqm: "Building Size (sqm)",
  features: "Features",
  images: "Images",
  agentName: "Agent Name",
  agentPhone: "Agent Phone",
};

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (Array.isArray(value)) return value.length ? value.join(", ") : "—";
  if (typeof value === "object") return JSON.stringify(value);
  if (typeof value === "number") return value.toLocaleString();
  return String(value);
}

function DiffRow({ field, oldVal, newVal }: { field: string; oldVal: unknown; newVal: unknown }) {
  const label = FIELD_LABELS[field] || field.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase());

  return (
    <div className="grid grid-cols-[140px_1fr_20px_1fr] items-start gap-2 py-2.5 border-b" style={{ borderColor: "var(--border)" }}>
      <span className="text-xs font-medium truncate" style={{ color: "var(--foreground)" }}>
        {label}
      </span>
      <span
        className="text-xs px-2 py-1 rounded"
        style={{ backgroundColor: "rgba(239, 68, 68, 0.08)", color: "#b91c1c" }}
      >
        {formatValue(oldVal)}
      </span>
      <ArrowRight size={12} className="mt-1 shrink-0" style={{ color: "var(--muted-foreground)" }} />
      <span
        className="text-xs px-2 py-1 rounded"
        style={{ backgroundColor: "rgba(34, 197, 94, 0.08)", color: "#15803d" }}
      >
        {formatValue(newVal)}
      </span>
    </div>
  );
}

export function VersionDiffViewer({ version }: { version: PropertyVersion }) {
  const [expanded, setExpanded] = useState(false);
  const fields = version.changedFields;

  if (!fields.length) return null;

  return (
    <div className="rounded-lg overflow-hidden" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3 text-left transition-colors hover:opacity-90"
        style={{ backgroundColor: "var(--secondary)" }}
      >
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold" style={{ color: "var(--foreground)" }}>
            v{version.version}
          </span>
          <span
            className="text-[10px] px-1.5 py-0.5 rounded font-medium"
            style={{ backgroundColor: "var(--card)", color: "var(--muted-foreground)" }}
          >
            {version.changeSource}
          </span>
          <span className="text-[10px]" style={{ color: "var(--muted-foreground)" }}>
            {fields.length} field{fields.length !== 1 ? "s" : ""} changed
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px]" style={{ color: "var(--muted-foreground)" }}>
            {new Date(version.createdAt).toLocaleDateString()}
          </span>
          {expanded ? (
            <ChevronUp size={14} style={{ color: "var(--muted-foreground)" }} />
          ) : (
            <ChevronDown size={14} style={{ color: "var(--muted-foreground)" }} />
          )}
        </div>
      </button>

      {expanded && (
        <div className="px-4 py-2">
          {version.changeSummary && (
            <p className="text-xs mb-3 italic" style={{ color: "var(--muted-foreground)" }}>
              {version.changeSummary}
            </p>
          )}
          {fields.map((field) => (
            <DiffRow
              key={field}
              field={field}
              oldVal={version.previousData[field]}
              newVal={version.newData[field]}
            />
          ))}
          {version.editor && (
            <p className="text-[10px] mt-2 pb-1" style={{ color: "var(--muted-foreground)" }}>
              Changed by {version.editor.firstName || version.editor.email}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export function VersionDiffList({ versions }: { versions: PropertyVersion[] }) {
  if (!versions.length) {
    return <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>No version history</p>;
  }

  return (
    <div className="space-y-2">
      {versions.map((v) => (
        <VersionDiffViewer key={v.id} version={v} />
      ))}
    </div>
  );
}
