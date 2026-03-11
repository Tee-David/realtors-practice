import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export function BentoGrid({
  className,
  children,
}: {
  className?: string;
  children?: ReactNode;
}) {
  return (
    <div
      className={cn(
        "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 auto-rows-[minmax(180px,auto)]",
        className
      )}
    >
      {children}
    </div>
  );
}

export function BentoGridItem({
  className,
  children,
  colSpan,
  rowSpan,
}: {
  className?: string;
  children?: ReactNode;
  colSpan?: number;
  rowSpan?: number;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl p-5 shadow-sm transition-all hover:shadow-md overflow-hidden relative group/bento",
        colSpan === 2 && "md:col-span-2",
        colSpan === 3 && "lg:col-span-3",
        rowSpan === 2 && "row-span-2",
        className
      )}
      style={{ backgroundColor: "var(--card)" }}
    >
      {children}
    </div>
  );
}
