"use client";

import dynamic from "next/dynamic";
import type { Property } from "@/types/property";

interface Props {
  properties: Property[];
  hoveredId: string | null;
  onMarkerClick: (id: string) => void;
}

const PropertyMap = dynamic<Props>(
  () => import("../map/property-map").then((mod) => ({ default: mod.PropertyMap })),
  {
    ssr: false,
    loading: () => (
      <div
        className="w-full h-full rounded-xl flex items-center justify-center p-6 border"
        style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
      >
        <div className="flex flex-col items-center gap-3">
          <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: "var(--primary)", borderTopColor: "transparent" }} />
          <p className="text-xs text-muted-foreground animate-pulse font-medium">Initializing Map Engine...</p>
        </div>
      </div>
    ),
  }
);

export function DynamicPropertyMap(props: Props) {
  return <PropertyMap {...props} />;
}
