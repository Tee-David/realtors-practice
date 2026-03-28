"use client";

import { useState } from "react";
import {
  Globe, Pencil, Sparkles, Settings, ChevronDown, ChevronUp,
  ArrowRight, User, Clock, Camera, RotateCcw,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { PropertyVersion, ChangeSource } from "@/types/property";
import { VersionSnapshotModal } from "./version-snapshot-modal";
import { VersionRevertDialog } from "./version-revert-dialog";

/* ------------------------------------------------------------------ */
/*  Source config                                                       */
/* ------------------------------------------------------------------ */

const SOURCE_CONFIG: Record<ChangeSource, {
  icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }>;
  label: string;
  color: string;
  bg: string;
}> = {
  SCRAPER: {
    icon: Globe,
    label: "Scraper",
    color: "#2563eb",
    bg: "rgba(37, 99, 235, 0.1)",
  },
  MANUAL_EDIT: {
    icon: Pencil,
    label: "Manual Edit",
    color: "#16a34a",
    bg: "rgba(22, 163, 74, 0.1)",
  },
  ENRICHMENT: {
    icon: Sparkles,
    label: "Enrichment",
    color: "#9333ea",
    bg: "rgba(147, 51, 234, 0.1)",
  },
  SYSTEM: {
    icon: Settings,
    label: "System",
    color: "#6b7280",
    bg: "rgba(107, 114, 128, 0.1)",
  },
};

/* ------------------------------------------------------------------ */
/*  Field labels                                                       */
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
  if (typeof value === "object") return JSON.stringify(value);
  if (typeof value === "number") return value.toLocaleString();
  return String(value);
}

/* ------------------------------------------------------------------ */
/*  Diff Row                                                           */
/* ------------------------------------------------------------------ */

function DiffRow({ field, oldVal, newVal }: { field: string; oldVal: unknown; newVal: unknown }) {
  return (
    <div
      className="grid grid-cols-[110px_1fr_20px_1fr] items-start gap-2 py-2"
      style={{ borderBottom: "1px solid var(--border)" }}
    >
      <span className="text-[11px] font-medium truncate" style={{ color: "var(--foreground)" }}>
        {formatFieldLabel(field)}
      </span>
      <span
        className="text-[11px] px-2 py-1 rounded break-words"
        style={{ backgroundColor: "rgba(239, 68, 68, 0.06)", color: "#b91c1c" }}
      >
        {formatValue(oldVal)}
      </span>
      <ArrowRight size={11} className="mt-1 shrink-0" style={{ color: "var(--muted-foreground)" }} />
      <span
        className="text-[11px] px-2 py-1 rounded break-words"
        style={{ backgroundColor: "rgba(34, 197, 94, 0.06)", color: "#15803d" }}
      >
        {formatValue(newVal)}
      </span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Single Version Entry                                               */
/* ------------------------------------------------------------------ */

function VersionEntry({
  version,
  isLast,
  onViewSnapshot,
  onRevert,
  isLatest,
}: {
  version: PropertyVersion;
  isLast: boolean;
  onViewSnapshot: (version: PropertyVersion) => void;
  onRevert: (version: PropertyVersion) => void;
  isLatest: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const config = SOURCE_CONFIG[version.changeSource] || SOURCE_CONFIG.SYSTEM;
  const Icon = config.icon;
  const fields = version.changedFields || [];
  const hasDiff = fields.length > 0;

  const relativeTime = formatRelativeTime(new Date(version.createdAt));

  return (
    <div className="flex gap-3.5">
      {/* Timeline rail */}
      <div className="flex flex-col items-center pt-0.5">
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
          style={{ backgroundColor: config.bg, border: `2px solid ${config.color}` }}
        >
          <Icon size={14} style={{ color: config.color }} />
        </div>
        {!isLast && (
          <div className="w-px flex-1 min-h-[16px]" style={{ backgroundColor: "var(--border)" }} />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 pb-5 min-w-0">
        {/* Header row */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-display font-bold text-xs" style={{ color: "var(--foreground)" }}>
            v{version.version}
          </span>
          <span
            className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
            style={{ backgroundColor: config.bg, color: config.color }}
          >
            {config.label}
          </span>
          {fields.length > 0 && (
            <span
              className="text-[10px] px-1.5 py-0.5 rounded font-medium"
              style={{ backgroundColor: "var(--secondary)", color: "var(--muted-foreground)" }}
            >
              {fields.length} field{fields.length !== 1 ? "s" : ""}
            </span>
          )}
          {isLatest && (
            <span
              className="text-[10px] px-1.5 py-0.5 rounded font-bold"
              style={{ backgroundColor: "rgba(34,197,94,0.12)", color: "#16a34a" }}
            >
              Current
            </span>
          )}
        </div>

        {/* Summary */}
        <p className="text-xs mt-1 leading-relaxed" style={{ color: "var(--muted-foreground)" }}>
          {version.changeSummary || (fields.length > 0
            ? `Updated ${fields.map(formatFieldLabel).join(", ")}`
            : "Initial version"
          )}
        </p>

        {/* Timestamp + editor */}
        <div className="flex items-center gap-3 mt-1.5">
          <span className="flex items-center gap-1 text-[10px]" style={{ color: "var(--muted-foreground)" }}>
            <Clock size={10} />
            {relativeTime}
          </span>
          {version.editor && (
            <span className="flex items-center gap-1 text-[10px]" style={{ color: "var(--muted-foreground)" }}>
              <User size={10} />
              {version.editor.firstName
                ? `${version.editor.firstName}${version.editor.lastName ? ` ${version.editor.lastName}` : ""}`
                : version.editor.email}
            </span>
          )}
        </div>

        {/* Action buttons: View Snapshot + Revert */}
        <div className="flex items-center gap-2 mt-2">
          <button
            onClick={() => onViewSnapshot(version)}
            className="flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-md transition-colors"
            style={{ backgroundColor: "var(--secondary)", color: "var(--primary)" }}
          >
            <Camera size={10} />
            View Snapshot
          </button>
          {!isLatest && (
            <button
              onClick={() => onRevert(version)}
              className="flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-md transition-colors"
              style={{ backgroundColor: "rgba(255,102,0,0.08)", color: "var(--accent)" }}
            >
              <RotateCcw size={10} />
              Revert
            </button>
          )}
        </div>

        {/* Expandable diff */}
        {hasDiff && (
          <div className="mt-2.5">
            <button
              onClick={() => setExpanded(!expanded)}
              className="flex items-center gap-1.5 text-[11px] font-semibold transition-colors"
              style={{ color: "var(--primary)" }}
            >
              {expanded ? "Hide changes" : "View changes"}
              {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </button>
            <AnimatePresence initial={false}>
              {expanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div
                    className="mt-2 rounded-lg p-3 overflow-x-auto"
                    style={{ backgroundColor: "var(--secondary)" }}
                  >
                    {fields.map((field) => (
                      <DiffRow
                        key={field}
                        field={field}
                        oldVal={version.previousData?.[field]}
                        newVal={version.newData?.[field]}
                      />
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Relative time helper                                               */
/* ------------------------------------------------------------------ */

function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffSec < 60) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  return date.toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" });
}

/* ------------------------------------------------------------------ */
/*  Exported VersionTimeline                                           */
/* ------------------------------------------------------------------ */

export function VersionTimeline({
  versions = [],
  propertyId,
  currentVersion,
}: {
  versions: PropertyVersion[];
  propertyId?: string;
  currentVersion?: number;
}) {
  const [showAll, setShowAll] = useState(false);
  const [snapshotVersion, setSnapshotVersion] = useState<PropertyVersion | null>(null);
  const [snapshotOpen, setSnapshotOpen] = useState(false);
  const [revertVersion, setRevertVersion] = useState<PropertyVersion | null>(null);
  const [revertOpen, setRevertOpen] = useState(false);

  // Determine the latest version number
  const latestVersionNum = versions.length > 0
    ? Math.max(...versions.map((v) => v.version))
    : 0;

  const handleViewSnapshot = (v: PropertyVersion) => {
    setSnapshotVersion(v);
    setSnapshotOpen(true);
  };

  const handleRevert = (v: PropertyVersion) => {
    setRevertVersion(v);
    setRevertOpen(true);
  };

  if (!versions.length) {
    return (
      <div
        className="flex flex-col items-center py-6 gap-2 rounded-lg"
        style={{ backgroundColor: "var(--secondary)" }}
      >
        <Clock size={20} style={{ color: "var(--muted-foreground)" }} />
        <p className="text-sm font-medium" style={{ color: "var(--muted-foreground)" }}>
          No version history available
        </p>
        <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
          Changes will appear here as the property is updated
        </p>
      </div>
    );
  }

  const INITIAL_SHOW = 5;
  const displayVersions = showAll ? versions : versions.slice(0, INITIAL_SHOW);
  const hasMore = versions.length > INITIAL_SHOW;

  return (
    <div>
      {/* Source legend */}
      <div className="flex flex-wrap gap-3 mb-4 pb-3" style={{ borderBottom: "1px solid var(--border)" }}>
        {Object.entries(SOURCE_CONFIG).map(([key, cfg]) => {
          const SourceIcon = cfg.icon;
          return (
            <span key={key} className="flex items-center gap-1.5 text-[10px] font-medium" style={{ color: cfg.color }}>
              <SourceIcon size={10} style={{ color: cfg.color }} />
              {cfg.label}
            </span>
          );
        })}
      </div>

      {/* Timeline */}
      <div>
        {displayVersions.map((v, i) => (
          <VersionEntry
            key={v.id}
            version={v}
            isLast={i === displayVersions.length - 1 && !hasMore}
            onViewSnapshot={handleViewSnapshot}
            onRevert={handleRevert}
            isLatest={v.version === latestVersionNum}
          />
        ))}
      </div>

      {/* Show more / less */}
      {hasMore && (
        <button
          onClick={() => setShowAll(!showAll)}
          className="flex items-center gap-1.5 text-xs font-semibold mt-1 transition-colors"
          style={{ color: "var(--primary)" }}
        >
          {showAll ? (
            <>Show fewer <ChevronUp size={13} /></>
          ) : (
            <>Show all {versions.length} versions <ChevronDown size={13} /></>
          )}
        </button>
      )}

      {/* Snapshot Modal */}
      <VersionSnapshotModal
        version={snapshotVersion}
        allVersions={versions}
        open={snapshotOpen}
        onOpenChange={setSnapshotOpen}
      />

      {/* Revert Dialog */}
      {propertyId && (
        <VersionRevertDialog
          version={revertVersion}
          allVersions={versions}
          propertyId={propertyId}
          currentVersion={currentVersion || latestVersionNum}
          open={revertOpen}
          onOpenChange={setRevertOpen}
        />
      )}
    </div>
  );
}
