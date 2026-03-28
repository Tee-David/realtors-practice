"use client";

import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Camera, ArrowRight } from "lucide-react";
import type { PropertyVersion } from "@/types/property";

/* ------------------------------------------------------------------ */
/*  Field labels (shared with version-timeline)                        */
/* ------------------------------------------------------------------ */

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
  agentEmail: "Agent Email",
  agencyName: "Agency Name",
  pricePerSqm: "Price per sqm",
  serviceCharge: "Service Charge",
  parkingSpaces: "Parking Spaces",
  floors: "Floors",
  toilets: "Toilets",
  landSize: "Land Size",
  buildingSize: "Building Size",
};

function formatFieldLabel(field: string): string {
  return FIELD_LABELS[field] || field.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase());
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return "\u2014";
  if (Array.isArray(value)) return value.length ? value.join(", ") : "\u2014";
  if (typeof value === "object") return JSON.stringify(value, null, 2);
  if (typeof value === "number") return value.toLocaleString();
  return String(value);
}

/* ------------------------------------------------------------------ */
/*  Reconstruct snapshot from version chain                            */
/* ------------------------------------------------------------------ */

/**
 * Reconstructs the property data as it was at a given version.
 *
 * Strategy:
 *   - Start from the latest version's newData (which is the current state)
 *   - Walk backwards from the latest version to the target version,
 *     undoing each change using previousData
 *   - For version 1 (initial scrape), use previousData if it has data,
 *     otherwise use newData
 */
export function reconstructSnapshot(
  targetVersion: PropertyVersion,
  allVersions: PropertyVersion[],
): Record<string, unknown> {
  // Sort versions by version number ascending
  const sorted = [...allVersions].sort((a, b) => a.version - b.version);

  // Start with an empty snapshot
  const snapshot: Record<string, unknown> = {};

  // Build up the state by applying each version's newData up to the target
  for (const v of sorted) {
    // Apply this version's changes
    if (v.newData && typeof v.newData === "object") {
      for (const [key, value] of Object.entries(v.newData)) {
        snapshot[key] = value;
      }
    }

    // If this is the target version, stop here
    if (v.version === targetVersion.version) break;
  }

  // If the target is version 1 and has previousData (initial state before any enrichment)
  // the snapshot from newData above is correct (it represents what v1 set)

  return snapshot;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function VersionSnapshotModal({
  version,
  allVersions,
  open,
  onOpenChange,
}: {
  version: PropertyVersion | null;
  allVersions: PropertyVersion[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  if (!version) return null;

  const snapshot = reconstructSnapshot(version, allVersions);

  // Group fields for display
  const entries = Object.entries(snapshot).filter(
    ([, val]) => val !== null && val !== undefined && val !== "" && !(Array.isArray(val) && val.length === 0)
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-2">
            <Camera size={16} style={{ color: "var(--primary)" }} />
            Version {version.version} Snapshot
          </DialogTitle>
          <DialogDescription>
            Full property data as it was at version {version.version} ({
              version.changeSource === "SCRAPER" ? "Scraper" :
              version.changeSource === "MANUAL_EDIT" ? "Manual Edit" :
              version.changeSource === "ENRICHMENT" ? "Enrichment" :
              "System"
            }).
            Created {new Date(version.createdAt).toLocaleDateString("en-NG", {
              day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit",
            })}.
          </DialogDescription>
        </DialogHeader>

        <div
          className="flex-1 overflow-y-auto rounded-lg p-4 space-y-0"
          style={{ backgroundColor: "var(--secondary)" }}
        >
          {entries.length === 0 ? (
            <p className="text-sm text-center py-6" style={{ color: "var(--muted-foreground)" }}>
              No snapshot data available for this version.
            </p>
          ) : (
            entries.map(([key, value]) => (
              <div
                key={key}
                className="flex items-start justify-between gap-4 py-2.5"
                style={{ borderBottom: "1px solid var(--border)" }}
              >
                <span
                  className="text-xs font-semibold shrink-0 w-[140px]"
                  style={{ color: "var(--muted-foreground)" }}
                >
                  {formatFieldLabel(key)}
                </span>
                <span
                  className="text-xs text-right break-words max-w-[60%]"
                  style={{ color: "var(--foreground)" }}
                >
                  {formatValue(value)}
                </span>
              </div>
            ))
          )}

          {/* Also show what this version changed */}
          {version.changedFields && version.changedFields.length > 0 && (
            <div className="pt-4 mt-4" style={{ borderTop: "2px solid var(--border)" }}>
              <p className="text-[11px] font-bold uppercase tracking-wider mb-3" style={{ color: "var(--muted-foreground)" }}>
                Changes in this version
              </p>
              {version.changedFields.map((field) => (
                <div
                  key={field}
                  className="grid grid-cols-[120px_1fr_20px_1fr] items-start gap-2 py-2"
                  style={{ borderBottom: "1px solid var(--border)" }}
                >
                  <span className="text-[11px] font-medium truncate" style={{ color: "var(--foreground)" }}>
                    {formatFieldLabel(field)}
                  </span>
                  <span
                    className="text-[11px] px-2 py-1 rounded break-words"
                    style={{ backgroundColor: "rgba(239, 68, 68, 0.06)", color: "#b91c1c" }}
                  >
                    {formatValue(version.previousData?.[field])}
                  </span>
                  <ArrowRight size={11} className="mt-1 shrink-0" style={{ color: "var(--muted-foreground)" }} />
                  <span
                    className="text-[11px] px-2 py-1 rounded break-words"
                    style={{ backgroundColor: "rgba(34, 197, 94, 0.06)", color: "#15803d" }}
                  >
                    {formatValue(version.newData?.[field])}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
