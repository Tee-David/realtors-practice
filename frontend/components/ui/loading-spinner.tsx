"use client";

export function LoadingSpinner({ size = 24, className = "" }: { size?: number; className?: string }) {
  return (
    <div
      className={`inline-block animate-spin rounded-full border-2 border-t-transparent ${className}`}
      style={{
        width: size,
        height: size,
        borderColor: "var(--primary)",
        borderTopColor: "transparent",
      }}
    />
  );
}
