"use client";

import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { RotateCcw, ArrowRight, AlertTriangle, Loader2 } from "lucide-react";
import type { PropertyVersion, Property } from "@/types/property";
import { useUpdateProperty } from "@/hooks/useProperties";
import { useQueryClient } from "@tanstack/react-query";
import { reconstructSnapshot } from "./version-snapshot-modal";

/* ------------------------------------------------------------------ */
/*  Field labels                                                       */
/* ------------------------------------------------------------------ */

const FIELD_LABELS: Record<string, string> = {
  title: "Title", price: "Price", description: "Description",
  bedrooms: "Bedrooms", bathrooms: "Bathrooms", status: "Status",
  listingType: "Listing Type", category: "Category", fullAddress: "Address",
  locationText: "Location", area: "Area", state: "State", lga: "LGA",
  propertyType: "Property Type", condition: "Condition", furnishing: "Furnishing",
  qualityScore: "Quality Score", verificationStatus: "Verification",
  features: "Features", agentName: "Agent Name", agentPhone: "Agent Phone",
};

function formatFieldLabel(field: string): string {
  return FIELD_LABELS[field] || field.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase());
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return "\u2014";
  if (Array.isArray(value)) return value.length ? value.join(", ") : "\u2014";
  if (typeof value === "number") return value.toLocaleString();
  return String(value);
}

/* ------------------------------------------------------------------ */
/*  Editable fields we can revert                                      */
/* ------------------------------------------------------------------ */

const REVERTABLE_FIELDS = [
  "title", "description", "price", "bedrooms", "bathrooms", "features",
  "category", "listingType", "status", "area", "state", "lga",
  "fullAddress", "locationText", "propertyType", "condition", "furnishing",
  "agentName", "agentPhone", "agentEmail", "agencyName",
  "landSize", "landSizeSqm", "buildingSize", "buildingSizeSqm",
  "parkingSpaces", "floors", "toilets", "serviceCharge",
];

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function VersionRevertDialog({
  version,
  allVersions,
  propertyId,
  currentVersion,
  open,
  onOpenChange,
}: {
  version: PropertyVersion | null;
  allVersions: PropertyVersion[];
  propertyId: string;
  currentVersion: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const updateMutation = useUpdateProperty();

  if (!version) return null;

  // Reconstruct the snapshot at the target version
  const snapshot = reconstructSnapshot(version, allVersions);

  // Get current state from the latest version
  const latestVersion = [...allVersions].sort((a, b) => b.version - a.version)[0];
  const currentState = latestVersion
    ? reconstructSnapshot(latestVersion, allVersions)
    : {};

  // Compute what will change
  const changes: { field: string; currentVal: unknown; revertVal: unknown }[] = [];
  for (const field of REVERTABLE_FIELDS) {
    const current = currentState[field];
    const revert = snapshot[field];
    const currentStr = JSON.stringify(current ?? null);
    const revertStr = JSON.stringify(revert ?? null);
    if (currentStr !== revertStr) {
      changes.push({ field, currentVal: current, revertVal: revert });
    }
  }

  const handleRevert = async () => {
    // Build the payload with snapshot data for revertable fields
    const payload: Record<string, unknown> = {};
    for (const change of changes) {
      payload[change.field] = change.revertVal ?? null;
    }
    payload.changeSource = "SYSTEM";
    payload.changeSummary = `Reverted to version ${version.version}`;

    try {
      await updateMutation.mutateAsync({ id: propertyId, data: payload });
      queryClient.invalidateQueries({ queryKey: ["property-versions", propertyId] });
      queryClient.invalidateQueries({ queryKey: ["property-price-history", propertyId] });
      onOpenChange(false);
    } catch {
      // Error handled by mutation state
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-2">
            <RotateCcw size={16} style={{ color: "var(--accent)" }} />
            Revert to Version {version.version}
          </DialogTitle>
          <DialogDescription>
            This will create a new version (v{currentVersion + 1}) that restores the property
            data to how it was at version {version.version}. This action cannot be undone.
          </DialogDescription>
        </DialogHeader>

        {changes.length === 0 ? (
          <div
            className="flex flex-col items-center py-6 gap-2 rounded-lg"
            style={{ backgroundColor: "var(--secondary)" }}
          >
            <p className="text-sm font-medium" style={{ color: "var(--muted-foreground)" }}>
              No differences found
            </p>
            <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
              The current property data matches version {version.version}.
            </p>
          </div>
        ) : (
          <>
            <div
              className="flex items-center gap-2 p-3 rounded-lg text-xs font-medium"
              style={{ backgroundColor: "rgba(245,158,11,0.08)", color: "#92400e" }}
            >
              <AlertTriangle size={14} />
              {changes.length} field{changes.length !== 1 ? "s" : ""} will be changed.
            </div>

            <div
              className="flex-1 overflow-y-auto rounded-lg p-3 space-y-0"
              style={{ backgroundColor: "var(--secondary)" }}
            >
              {changes.map((change) => (
                <div
                  key={change.field}
                  className="grid grid-cols-[100px_1fr_20px_1fr] items-start gap-2 py-2.5"
                  style={{ borderBottom: "1px solid var(--border)" }}
                >
                  <span className="text-[11px] font-semibold truncate" style={{ color: "var(--foreground)" }}>
                    {formatFieldLabel(change.field)}
                  </span>
                  <span
                    className="text-[11px] px-2 py-1 rounded break-words"
                    style={{ backgroundColor: "rgba(239, 68, 68, 0.06)", color: "#b91c1c" }}
                  >
                    {formatValue(change.currentVal)}
                  </span>
                  <ArrowRight size={11} className="mt-1 shrink-0" style={{ color: "var(--muted-foreground)" }} />
                  <span
                    className="text-[11px] px-2 py-1 rounded break-words"
                    style={{ backgroundColor: "rgba(34, 197, 94, 0.06)", color: "#15803d" }}
                  >
                    {formatValue(change.revertVal)}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}

        {updateMutation.isError && (
          <div
            className="flex items-center gap-2 p-3 rounded-lg text-xs font-medium"
            style={{ backgroundColor: "rgba(239,68,68,0.08)", color: "#dc2626" }}
          >
            <AlertTriangle size={14} />
            Failed to revert. Please try again.
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleRevert}
            disabled={updateMutation.isPending || changes.length === 0}
            style={changes.length > 0 ? { backgroundColor: "var(--accent)" } : undefined}
          >
            {updateMutation.isPending ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <RotateCcw size={14} />
            )}
            {updateMutation.isPending ? "Reverting..." : `Revert to v${version.version}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
