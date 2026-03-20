"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ai } from "@/lib/api";
import {
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  KeyRound,
  Zap,
  Clock,
  Activity,
  ChevronDown,
  ChevronUp,
  ExternalLink,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface ProviderStatus {
  name: string;
  slug: string;
  status: "operational" | "degraded" | "down" | "no_key";
  latencyMs: number | null;
  model: string | null;
  error: string | null;
  checkedAt: string;
}

interface HealthData {
  overall: "all_operational" | "partial" | "all_down";
  operational: number;
  total: number;
  providers: ProviderStatus[];
  checkedAt: string;
}

const STATUS_CONFIG = {
  operational: {
    icon: CheckCircle2,
    label: "Operational",
    color: "#16a34a",
    bg: "rgba(22,163,74,0.08)",
    border: "rgba(22,163,74,0.2)",
    dot: "#22c55e",
  },
  degraded: {
    icon: AlertTriangle,
    label: "Degraded",
    color: "#d97706",
    bg: "rgba(217,119,6,0.08)",
    border: "rgba(217,119,6,0.2)",
    dot: "#f59e0b",
  },
  down: {
    icon: XCircle,
    label: "Down",
    color: "#dc2626",
    bg: "rgba(220,38,38,0.08)",
    border: "rgba(220,38,38,0.2)",
    dot: "#ef4444",
  },
  no_key: {
    icon: KeyRound,
    label: "No Key",
    color: "#6b7280",
    bg: "rgba(107,114,128,0.08)",
    border: "rgba(107,114,128,0.2)",
    dot: "#9ca3af",
  },
};

const PROVIDER_META: Record<string, { description: string; tier: string; url: string }> = {
  groq: { description: "LPU-powered inference", tier: "Primary", url: "https://console.groq.com" },
  cerebras: { description: "Wafer-Scale Engine", tier: "Fallback #1", url: "https://cloud.cerebras.ai" },
  sambanova: { description: "RDU inference", tier: "Fallback #2", url: "https://cloud.sambanova.ai" },
  gemini: { description: "Google AI", tier: "Emergency", url: "https://ai.google.dev" },
};

function ProviderCard({ provider }: { provider: ProviderStatus }) {
  const [expanded, setExpanded] = useState(false);
  const cfg = STATUS_CONFIG[provider.status];
  const Icon = cfg.icon;
  const meta = PROVIDER_META[provider.slug] || { description: "", tier: "", url: "#" };

  return (
    <div
      className="rounded-xl border overflow-hidden transition-shadow hover:shadow-md"
      style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full p-4 flex items-center gap-3 text-left"
      >
        {/* Status dot */}
        <div className="relative shrink-0">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ backgroundColor: cfg.bg }}
          >
            <Zap className="w-5 h-5" style={{ color: cfg.color }} />
          </div>
          <div
            className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2"
            style={{
              backgroundColor: cfg.dot,
              borderColor: "var(--card)",
            }}
          />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold font-display" style={{ color: "var(--foreground)" }}>
              {provider.name}
            </span>
            <span
              className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider"
              style={{ backgroundColor: cfg.bg, color: cfg.color }}
            >
              {cfg.label}
            </span>
          </div>
          <div className="flex items-center gap-3 mt-0.5">
            <span className="text-[11px]" style={{ color: "var(--muted-foreground)" }}>
              {meta.tier}
            </span>
            {provider.latencyMs !== null && (
              <span className="flex items-center gap-1 text-[11px]" style={{ color: "var(--muted-foreground)" }}>
                <Clock className="w-3 h-3" />
                {provider.latencyMs}ms
              </span>
            )}
            {provider.model && (
              <span className="text-[11px] font-mono" style={{ color: "var(--muted-foreground)" }}>
                {provider.model}
              </span>
            )}
          </div>
        </div>

        {/* Expand toggle */}
        <div className="shrink-0" style={{ color: "var(--muted-foreground)" }}>
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </div>
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div
              className="px-4 pb-4 pt-0 space-y-2 border-t"
              style={{ borderColor: "var(--border)" }}
            >
              <div className="grid grid-cols-2 gap-3 pt-3">
                <div>
                  <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--muted-foreground)" }}>
                    Hardware
                  </span>
                  <p className="text-xs mt-0.5" style={{ color: "var(--foreground)" }}>
                    {meta.description}
                  </p>
                </div>
                <div>
                  <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--muted-foreground)" }}>
                    Latency
                  </span>
                  <p className="text-xs mt-0.5" style={{ color: "var(--foreground)" }}>
                    {provider.latencyMs !== null ? `${provider.latencyMs}ms` : "—"}
                  </p>
                </div>
                <div>
                  <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--muted-foreground)" }}>
                    Model
                  </span>
                  <p className="text-xs font-mono mt-0.5" style={{ color: "var(--foreground)" }}>
                    {provider.model || "—"}
                  </p>
                </div>
                <div>
                  <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--muted-foreground)" }}>
                    Priority
                  </span>
                  <p className="text-xs mt-0.5" style={{ color: "var(--foreground)" }}>
                    {meta.tier}
                  </p>
                </div>
              </div>

              {provider.error && (
                <div
                  className="flex items-start gap-2 px-3 py-2 rounded-lg text-xs"
                  style={{ backgroundColor: cfg.bg, color: cfg.color }}
                >
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  {provider.error}
                </div>
              )}

              <a
                href={meta.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-[11px] font-medium hover:underline"
                style={{ color: "var(--primary)" }}
              >
                Open console <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function AIProviderStatus() {
  const { data, isLoading, isError, refetch, isFetching, dataUpdatedAt } = useQuery<HealthData>({
    queryKey: ["ai-health"],
    queryFn: async () => {
      const res = await ai.health();
      return res.data.data;
    },
    refetchInterval: 60_000, // Auto-refresh every 60s
    staleTime: 30_000,
    retry: 1,
  });

  const overallCfg =
    data?.overall === "all_operational"
      ? STATUS_CONFIG.operational
      : data?.overall === "partial"
      ? STATUS_CONFIG.degraded
      : STATUS_CONFIG.down;

  return (
    <div
      className="rounded-2xl border overflow-hidden"
      style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}
    >
      {/* Header */}
      <div className="p-5 border-b" style={{ borderColor: "var(--border)" }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ backgroundColor: "rgba(0,1,252,0.08)" }}
            >
              <Activity className="w-5 h-5" style={{ color: "var(--primary)" }} />
            </div>
            <div>
              <h3 className="text-base font-semibold font-display" style={{ color: "var(--foreground)" }}>
                AI Provider Status
              </h3>
              <div className="flex items-center gap-2 mt-0.5">
                {!isLoading && data && (
                  <>
                    <div
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: overallCfg.dot }}
                    />
                    <span className="text-[11px] font-medium" style={{ color: overallCfg.color }}>
                      {data.operational}/{data.total} operational
                    </span>
                  </>
                )}
                {dataUpdatedAt > 0 && (
                  <span className="text-[10px]" style={{ color: "var(--muted-foreground)" }}>
                    · Auto-refreshes every 60s
                  </span>
                )}
              </div>
            </div>
          </div>

          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors hover:bg-[var(--secondary)]"
            style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? "animate-spin" : ""}`} />
            {isFetching ? "Checking..." : "Check now"}
          </button>
        </div>
      </div>

      {/* Provider grid */}
      <div className="p-4">
        {isLoading ? (
          <div className="grid sm:grid-cols-2 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="rounded-xl border p-4 animate-pulse"
                style={{ borderColor: "var(--border)" }}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl" style={{ backgroundColor: "var(--secondary)" }} />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-24 rounded" style={{ backgroundColor: "var(--secondary)" }} />
                    <div className="h-3 w-32 rounded" style={{ backgroundColor: "var(--secondary)" }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : isError ? (
          <div
            className="flex flex-col items-center justify-center py-8 gap-3 rounded-xl"
            style={{ backgroundColor: "var(--secondary)" }}
          >
            <XCircle className="w-8 h-8" style={{ color: "var(--destructive)" }} />
            <p className="text-sm font-medium" style={{ color: "var(--foreground)" }}>
              Failed to reach backend
            </p>
            <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
              Make sure the backend server is running on port 5000
            </p>
            <button
              onClick={() => refetch()}
              className="px-4 py-2 rounded-xl text-xs font-semibold transition-colors hover:opacity-90"
              style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}
            >
              Retry
            </button>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 gap-3">
            {data?.providers.map((provider) => (
              <ProviderCard key={provider.slug} provider={provider} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
