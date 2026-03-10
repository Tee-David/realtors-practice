"use client";

import { motion } from "framer-motion";
import { PropertyCard } from "./property-card";
import { Skeleton } from "@/components/ui/skeleton";
import { SearchX } from "lucide-react";
import type { Property } from "@/types/property";

interface PropertyGridProps {
  properties: Property[];
  isLoading?: boolean;
  emptyMessage?: string;
  selectedId?: string | null;
  onFavorite?: (id: string) => void;
  onHover?: (id: string | null) => void;
  onClick?: (id: string) => void;
  /** Number of grid columns (responsive via CSS) or a className string */
  columns?: number | string;
}

const containerVariants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.04,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 16, scale: 0.97 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] as const },
  },
  exit: { opacity: 0, y: -8, transition: { duration: 0.15 } },
};

function getGridStyle(cols: number): React.CSSProperties {
  return {
    display: "grid",
    gap: cols >= 5 ? "0.75rem" : "1rem",
    gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
    alignItems: "stretch",
  };
}

function PropertyGridSkeleton({ count = 8, cols = 4 }: { count?: number; cols?: number }) {
  return (
    <div style={getGridStyle(cols)}>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="rounded-2xl overflow-hidden"
          style={{ backgroundColor: "var(--card)" }}
        >
          <Skeleton className="aspect-[4/3] w-full" />
          <div className="p-4 space-y-3">
            <Skeleton className="h-4 w-4/5" />
            <Skeleton className="h-5 w-1/2" />
            <div className="h-px" style={{ backgroundColor: "var(--border)" }} />
            <Skeleton className="h-3 w-3/5" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function PropertyGrid({ properties, isLoading, emptyMessage, selectedId, onFavorite, onHover, onClick, columns = 4 }: PropertyGridProps) {
  const numCols = typeof columns === "number" ? columns : 4;

  if (isLoading) {
    return <PropertyGridSkeleton cols={numCols} />;
  }

  if (!properties || properties.length === 0) {
    return (
      <motion.div
        className="flex flex-col items-center justify-center py-20 gap-3"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <SearchX size={48} strokeWidth={1} style={{ color: "var(--muted-foreground)" }} />
        <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
          {emptyMessage || "No properties found"}
        </p>
      </motion.div>
    );
  }

  const gridStyle = typeof columns === "number" ? getGridStyle(columns) : undefined;
  const gridClass = typeof columns === "string" ? columns : undefined;

  return (
    <motion.div
      className={gridClass}
      style={gridStyle}
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {properties.map((property) => (
        <motion.div key={property.id} variants={itemVariants}>
          <PropertyCard
            property={property}
            isActive={selectedId === property.id}
            onFavorite={onFavorite}
            onHover={onHover}
            onClick={onClick}
          />
        </motion.div>
      ))}
    </motion.div>
  );
}
