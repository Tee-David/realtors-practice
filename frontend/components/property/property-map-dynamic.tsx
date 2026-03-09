"use client";

import dynamic from "next/dynamic";
import type { Property } from "@/types/property";

interface Props {
  properties: Property[];
  hoveredId: string | null;
  onMarkerClick: (id: string) => void;
}

const PropertyMap = dynamic<Props>(
  () => import("./property-map-mapcn").then((mod) => ({ default: mod.PropertyMapCN })),
  {
    ssr: false,
    loading: () => (
      <div
        className="w-full h-full rounded-xl flex items-center justify-center"
        style={{ backgroundColor: "var(--secondary)" }}
      >
        <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: "var(--primary)", borderTopColor: "transparent" }} />
      </div>
    ),
  }
);

export function DynamicPropertyMap(props: Props) {
  return <PropertyMap {...props} />;
}
