"use client";

import { useEffect } from "react";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[Dashboard Error Boundary]", error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <div
        className="w-full max-w-md rounded-xl border p-8 text-center shadow-sm"
        style={{
          backgroundColor: "var(--card)",
          borderColor: "var(--border)",
          color: "var(--foreground)",
        }}
      >
        {/* Icon */}
        <div
          className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full"
          style={{ backgroundColor: "var(--destructive)", opacity: 0.12 }}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="28"
            height="28"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ color: "var(--destructive)" }}
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" x2="12" y1="8" y2="12" />
            <line x1="12" x2="12.01" y1="16" y2="16" />
          </svg>
        </div>

        <h2 className="font-display text-xl font-semibold mb-2">
          Something went wrong
        </h2>
        <p
          className="text-sm mb-6"
          style={{ color: "var(--muted-foreground)" }}
        >
          An unexpected error occurred while loading this page. You can try
          again or navigate to a different section.
        </p>

        {/* Try Again button */}
        <button
          onClick={reset}
          className="inline-flex items-center justify-center rounded-lg px-5 py-2.5 text-sm font-medium text-white transition-colors hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2"
          style={{
            backgroundColor: "var(--primary)",
            focusRingColor: "var(--primary)",
          }}
        >
          Try Again
        </button>

        {/* Collapsible error details for debugging */}
        <details
          className="mt-6 text-left rounded-lg border p-0"
          style={{ borderColor: "var(--border)" }}
        >
          <summary
            className="cursor-pointer select-none px-4 py-2.5 text-xs font-medium"
            style={{ color: "var(--muted-foreground)" }}
          >
            Error details
          </summary>
          <pre
            className="overflow-auto px-4 py-3 text-xs leading-relaxed border-t"
            style={{
              color: "var(--muted-foreground)",
              borderColor: "var(--border)",
              backgroundColor: "var(--secondary)",
            }}
          >
            {error.message || "Unknown error"}
            {error.digest && `\n\nDigest: ${error.digest}`}
          </pre>
        </details>
      </div>
    </div>
  );
}
