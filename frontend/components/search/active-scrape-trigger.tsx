"use client";

import { Globe, Loader2, Zap } from "lucide-react";

interface ActiveScrapeTriggerProps {
  query: string;
  onTriggerScrape: () => void;
  isLoading?: boolean;
}

export function ActiveScrapeTrigger({ query, onTriggerScrape, isLoading }: ActiveScrapeTriggerProps) {
  return (
    <div
      className="rounded-xl p-6 flex flex-col sm:flex-row items-center gap-4 sm:gap-6"
      style={{
        backgroundColor: "var(--card)",
        border: "1.5px dashed var(--border)",
      }}
    >
      <div
        className="w-12 h-12 rounded-full flex items-center justify-center shrink-0"
        style={{ backgroundColor: "rgba(0, 1, 252, 0.08)" }}
      >
        <Globe size={22} style={{ color: "var(--primary)" }} />
      </div>

      <div className="flex-1 text-center sm:text-left">
        <h3 className="font-display font-semibold text-sm" style={{ color: "var(--foreground)" }}>
          Want more results?
        </h3>
        <p className="text-xs mt-0.5" style={{ color: "var(--muted-foreground)" }}>
          We can search the web for &ldquo;{query}&rdquo; and add new listings to your database.
        </p>
      </div>

      <button
        onClick={onTriggerScrape}
        disabled={isLoading}
        className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90 disabled:opacity-50 shrink-0"
        style={{ backgroundColor: "var(--primary)" }}
      >
        {isLoading ? (
          <>
            <Loader2 size={16} className="animate-spin" />
            Searching...
          </>
        ) : (
          <>
            <Zap size={16} />
            Search the Web
          </>
        )}
      </button>
    </div>
  );
}
