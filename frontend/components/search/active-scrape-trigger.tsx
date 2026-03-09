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
      className="rounded-2xl p-4 flex flex-col gap-4"
      style={{
        backgroundColor: "var(--card)",
        border: "1.5px dashed var(--border)",
      }}
    >
      <div className="flex items-center gap-3 text-left">
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
          style={{ backgroundColor: "rgba(0, 1, 252, 0.08)" }}
        >
          <Globe size={18} style={{ color: "var(--primary)" }} />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-display font-semibold text-sm" style={{ color: "var(--foreground)" }}>
            Want more results?
          </h3>
          <p className="text-xs mt-0.5 truncate" style={{ color: "var(--muted-foreground)" }}>
            Run a targeted scrape for &ldquo;{query}&rdquo;
          </p>
        </div>
      </div>

      <button
        onClick={onTriggerScrape}
        disabled={isLoading}
        className="flex items-center justify-center w-full gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90 disabled:opacity-50"
        style={{ backgroundColor: "var(--primary)" }}
      >
        {isLoading ? (
          <>
            <Loader2 size={16} className="animate-spin shrink-0" />
            Searching...
          </>
        ) : (
          <>
            <Zap size={16} className="shrink-0" />
            Search the Web
          </>
        )}
      </button>
    </div>
  );
}
