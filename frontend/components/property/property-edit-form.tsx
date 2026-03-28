"use client";

import { useState, useEffect, useMemo } from "react";
import {
  SideSheet, SideSheetContent, SideSheetHeader, SideSheetTitle,
  SideSheetDescription, SideSheetFooter, SideSheetOverlay, SideSheetPortal,
} from "@/components/ui/side-sheet";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Pencil, ArrowRight, Save, Loader2, AlertTriangle } from "lucide-react";
import type { Property, PropertyCategory, ListingType, PropertyStatus } from "@/types/property";
import { useUpdateProperty } from "@/hooks/useProperties";
import { useQueryClient } from "@tanstack/react-query";

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const CATEGORIES: { value: PropertyCategory; label: string }[] = [
  { value: "RESIDENTIAL", label: "Residential" },
  { value: "COMMERCIAL", label: "Commercial" },
  { value: "LAND", label: "Land" },
  { value: "SHORTLET", label: "Shortlet" },
  { value: "INDUSTRIAL", label: "Industrial" },
];

const LISTING_TYPES: { value: ListingType; label: string }[] = [
  { value: "SALE", label: "For Sale" },
  { value: "RENT", label: "For Rent" },
  { value: "LEASE", label: "For Lease" },
  { value: "SHORTLET", label: "Shortlet" },
];

const STATUSES: { value: PropertyStatus; label: string }[] = [
  { value: "AVAILABLE", label: "Available" },
  { value: "SOLD", label: "Sold" },
  { value: "RENTED", label: "Rented" },
  { value: "UNDER_OFFER", label: "Under Offer" },
  { value: "WITHDRAWN", label: "Withdrawn" },
  { value: "EXPIRED", label: "Expired" },
];

const NIGERIAN_STATES = [
  "Abia", "Adamawa", "Akwa Ibom", "Anambra", "Bauchi", "Bayelsa", "Benue", "Borno",
  "Cross River", "Delta", "Ebonyi", "Edo", "Ekiti", "Enugu", "FCT", "Gombe", "Imo",
  "Jigawa", "Kaduna", "Kano", "Katsina", "Kebbi", "Kogi", "Kwara", "Lagos", "Nasarawa",
  "Niger", "Ogun", "Ondo", "Osun", "Oyo", "Plateau", "Rivers", "Sokoto", "Taraba",
  "Yobe", "Zamfara",
];

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface EditableFields {
  title: string;
  description: string;
  price: string;
  bedrooms: string;
  bathrooms: string;
  features: string;
  category: PropertyCategory;
  listingType: ListingType;
  status: PropertyStatus;
  area: string;
  state: string;
}

interface FieldChange {
  field: string;
  label: string;
  oldValue: unknown;
  newValue: unknown;
}

function getLabel(field: string): string {
  const map: Record<string, string> = {
    title: "Title", description: "Description", price: "Price",
    bedrooms: "Bedrooms", bathrooms: "Bathrooms", features: "Features",
    category: "Category", listingType: "Listing Type", status: "Status",
    area: "Area", state: "State",
  };
  return map[field] || field;
}

function formatDisplayValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "\u2014";
  if (Array.isArray(value)) return value.length ? value.join(", ") : "\u2014";
  if (typeof value === "number") return value.toLocaleString();
  return String(value);
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function PropertyEditForm({
  property,
  open,
  onOpenChange,
}: {
  property: Property;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const updateMutation = useUpdateProperty();
  const [showConfirm, setShowConfirm] = useState(false);

  const initialValues: EditableFields = useMemo(() => ({
    title: property.title || "",
    description: property.description || "",
    price: property.price != null ? String(property.price) : "",
    bedrooms: property.bedrooms != null ? String(property.bedrooms) : "",
    bathrooms: property.bathrooms != null ? String(property.bathrooms) : "",
    features: (property.features || []).join(", "),
    category: property.category,
    listingType: property.listingType,
    status: property.status,
    area: property.area || "",
    state: property.state || "",
  }), [property]);

  const [form, setForm] = useState<EditableFields>(initialValues);

  // Reset form when property changes or panel opens
  useEffect(() => {
    if (open) {
      setForm(initialValues);
      setShowConfirm(false);
    }
  }, [open, initialValues]);

  const set = (field: keyof EditableFields) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const setSelect = (field: keyof EditableFields) => (value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  /* ---- Compute changes ---- */
  const changes: FieldChange[] = useMemo(() => {
    const result: FieldChange[] = [];
    const fieldMap: { key: keyof EditableFields; oldVal: () => unknown; newVal: () => unknown }[] = [
      { key: "title", oldVal: () => property.title, newVal: () => form.title },
      { key: "description", oldVal: () => property.description || "", newVal: () => form.description },
      {
        key: "price",
        oldVal: () => property.price,
        newVal: () => form.price ? Number(form.price) : null,
      },
      {
        key: "bedrooms",
        oldVal: () => property.bedrooms,
        newVal: () => form.bedrooms ? Number(form.bedrooms) : null,
      },
      {
        key: "bathrooms",
        oldVal: () => property.bathrooms,
        newVal: () => form.bathrooms ? Number(form.bathrooms) : null,
      },
      {
        key: "features",
        oldVal: () => (property.features || []).join(", "),
        newVal: () => form.features,
      },
      { key: "category", oldVal: () => property.category, newVal: () => form.category },
      { key: "listingType", oldVal: () => property.listingType, newVal: () => form.listingType },
      { key: "status", oldVal: () => property.status, newVal: () => form.status },
      { key: "area", oldVal: () => property.area || "", newVal: () => form.area },
      { key: "state", oldVal: () => property.state || "", newVal: () => form.state },
    ];

    for (const { key, oldVal, newVal } of fieldMap) {
      const o = oldVal();
      const n = newVal();
      if (String(o ?? "") !== String(n ?? "")) {
        result.push({ field: key, label: getLabel(key), oldValue: o, newValue: n });
      }
    }
    return result;
  }, [form, property]);

  const hasChanges = changes.length > 0;

  /* ---- Build payload ---- */
  const buildPayload = (): Record<string, unknown> => {
    const payload: Record<string, unknown> = {};
    for (const change of changes) {
      if (change.field === "features") {
        payload.features = form.features
          .split(",")
          .map((f) => f.trim())
          .filter(Boolean);
      } else if (change.field === "price") {
        payload.price = form.price ? Number(form.price) : null;
      } else if (change.field === "bedrooms") {
        payload.bedrooms = form.bedrooms ? Number(form.bedrooms) : null;
      } else if (change.field === "bathrooms") {
        payload.bathrooms = form.bathrooms ? Number(form.bathrooms) : null;
      } else {
        payload[change.field] = change.newValue;
      }
    }
    payload.changeSource = "MANUAL_EDIT";
    return payload;
  };

  const handleSave = async () => {
    try {
      await updateMutation.mutateAsync({ id: property.id, data: buildPayload() });
      // Also invalidate versions so the timeline refreshes
      queryClient.invalidateQueries({ queryKey: ["property-versions", property.id] });
      queryClient.invalidateQueries({ queryKey: ["property-price-history", property.id] });
      setShowConfirm(false);
      onOpenChange(false);
    } catch {
      // Error is handled by mutation state
    }
  };

  return (
    <>
      {/* ---- Edit Slide-Over ---- */}
      <SideSheet open={open && !showConfirm} onOpenChange={onOpenChange} side="right" width="520px">
        <SideSheetPortal>
          <SideSheetOverlay />
          <SideSheetContent className="overflow-y-auto">
            <SideSheetHeader>
              <SideSheetTitle className="font-display flex items-center gap-2">
                <Pencil size={16} style={{ color: "var(--primary)" }} />
                Edit Property
              </SideSheetTitle>
              <SideSheetDescription>
                Changes create a new version with full diff tracking.
              </SideSheetDescription>
            </SideSheetHeader>

          <div className="px-4 pb-4 space-y-5">
            {/* Title */}
            <div className="space-y-1.5">
              <Label htmlFor="edit-title" className="text-xs font-semibold" style={{ color: "var(--foreground)" }}>
                Title
              </Label>
              <Input id="edit-title" value={form.title} onChange={set("title")} />
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <Label htmlFor="edit-desc" className="text-xs font-semibold" style={{ color: "var(--foreground)" }}>
                Description
              </Label>
              <textarea
                id="edit-desc"
                value={form.description}
                onChange={set("description")}
                rows={4}
                className="w-full min-w-0 rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs transition-[color,box-shadow] outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 resize-y"
                style={{ color: "var(--foreground)" }}
              />
            </div>

            {/* Price */}
            <div className="space-y-1.5">
              <Label htmlFor="edit-price" className="text-xs font-semibold" style={{ color: "var(--foreground)" }}>
                Price ({property.priceCurrency || "NGN"})
              </Label>
              <Input
                id="edit-price"
                type="number"
                value={form.price}
                onChange={set("price")}
                placeholder="e.g. 25000000"
              />
            </div>

            {/* Bedrooms + Bathrooms */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="edit-beds" className="text-xs font-semibold" style={{ color: "var(--foreground)" }}>
                  Bedrooms
                </Label>
                <Input id="edit-beds" type="number" value={form.bedrooms} onChange={set("bedrooms")} min={0} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-baths" className="text-xs font-semibold" style={{ color: "var(--foreground)" }}>
                  Bathrooms
                </Label>
                <Input id="edit-baths" type="number" value={form.bathrooms} onChange={set("bathrooms")} min={0} />
              </div>
            </div>

            {/* Category + Listing Type */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold" style={{ color: "var(--foreground)" }}>Category</Label>
                <Select value={form.category} onValueChange={setSelect("category")}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold" style={{ color: "var(--foreground)" }}>Listing Type</Label>
                <Select value={form.listingType} onValueChange={setSelect("listingType")}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LISTING_TYPES.map((l) => (
                      <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Status */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold" style={{ color: "var(--foreground)" }}>Status</Label>
              <Select value={form.status} onValueChange={setSelect("status")}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUSES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Features */}
            <div className="space-y-1.5">
              <Label htmlFor="edit-features" className="text-xs font-semibold" style={{ color: "var(--foreground)" }}>
                Features
              </Label>
              <Input
                id="edit-features"
                value={form.features}
                onChange={set("features")}
                placeholder="Swimming Pool, Generator, Security, ..."
              />
              <p className="text-[10px]" style={{ color: "var(--muted-foreground)" }}>
                Comma-separated list
              </p>
            </div>

            {/* Area + State */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="edit-area" className="text-xs font-semibold" style={{ color: "var(--foreground)" }}>
                  Area
                </Label>
                <Input id="edit-area" value={form.area} onChange={set("area")} placeholder="e.g. Lekki Phase 1" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold" style={{ color: "var(--foreground)" }}>State</Label>
                <Select value={form.state} onValueChange={setSelect("state")}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select state" />
                  </SelectTrigger>
                  <SelectContent>
                    {NIGERIAN_STATES.map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <SideSheetFooter>
            <div className="flex items-center gap-2 w-full">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button
                className="flex-1"
                disabled={!hasChanges}
                onClick={() => setShowConfirm(true)}
              >
                <Save size={14} />
                Review Changes ({changes.length})
              </Button>
            </div>
          </SideSheetFooter>
          </SideSheetContent>
        </SideSheetPortal>
      </SideSheet>

      {/* ---- Confirmation Dialog ---- */}
      <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display flex items-center gap-2">
              <AlertTriangle size={16} style={{ color: "var(--accent)" }} />
              Confirm Changes
            </DialogTitle>
            <DialogDescription>
              The following {changes.length} field{changes.length !== 1 ? "s" : ""} will be updated.
              A new version (v{property.currentVersion + 1}) will be created.
            </DialogDescription>
          </DialogHeader>

          <div
            className="max-h-[40vh] overflow-y-auto rounded-lg p-3 space-y-0"
            style={{ backgroundColor: "var(--secondary)" }}
          >
            {changes.map((change) => (
              <div
                key={change.field}
                className="grid grid-cols-[100px_1fr_20px_1fr] items-start gap-2 py-2.5"
                style={{ borderBottom: "1px solid var(--border)" }}
              >
                <span className="text-[11px] font-semibold truncate" style={{ color: "var(--foreground)" }}>
                  {change.label}
                </span>
                <span
                  className="text-[11px] px-2 py-1 rounded break-words"
                  style={{ backgroundColor: "rgba(239, 68, 68, 0.06)", color: "#b91c1c" }}
                >
                  {formatDisplayValue(change.oldValue)}
                </span>
                <ArrowRight size={11} className="mt-1 shrink-0" style={{ color: "var(--muted-foreground)" }} />
                <span
                  className="text-[11px] px-2 py-1 rounded break-words"
                  style={{ backgroundColor: "rgba(34, 197, 94, 0.06)", color: "#15803d" }}
                >
                  {formatDisplayValue(change.newValue)}
                </span>
              </div>
            ))}
          </div>

          {updateMutation.isError && (
            <div
              className="flex items-center gap-2 p-3 rounded-lg text-xs font-medium"
              style={{ backgroundColor: "rgba(239,68,68,0.08)", color: "#dc2626" }}
            >
              <AlertTriangle size={14} />
              Failed to save changes. Please try again.
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfirm(false)}>
              Back to Editing
            </Button>
            <Button
              onClick={handleSave}
              disabled={updateMutation.isPending}
            >
              {updateMutation.isPending ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Save size={14} />
              )}
              {updateMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
