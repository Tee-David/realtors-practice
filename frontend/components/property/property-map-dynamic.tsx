"use client";

import dynamic from "next/dynamic";
import type { Property } from "@/types/property";

const PropertyMap = dynamic(
  () => import("./property-map").then((mod) => ({ default: mod.PropertyMap })),
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

interface Props {
  properties: Property[];
  hoveredId: string | null;
  onMarkerClick: (id: string) => void;
}

export function DynamicPropertyMap(props: Props) {
  return <PropertyMap {...props} />;
}
