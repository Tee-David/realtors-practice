"use client";

import { useMemo } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  Area,
  AreaChart,
} from "recharts";
import { TrendingUp, TrendingDown, Minus, Clock } from "lucide-react";
import { formatPrice } from "@/lib/utils";
import type { PriceHistoryEntry, ChangeSource } from "@/types/property";

/* ------------------------------------------------------------------ */
/*  Source badge colors                                                 */
/* ------------------------------------------------------------------ */

const SOURCE_COLORS: Record<string, { color: string; label: string }> = {
  SCRAPER: { color: "#2563eb", label: "Scraper" },
  MANUAL_EDIT: { color: "#16a34a", label: "Manual Edit" },
  ENRICHMENT: { color: "#9333ea", label: "Enrichment" },
  SYSTEM: { color: "#6b7280", label: "System" },
};

/* ------------------------------------------------------------------ */
/*  Custom tooltip                                                     */
/* ------------------------------------------------------------------ */

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const entry = payload[0].payload;

  const sourceInfo = SOURCE_COLORS[entry.source] || SOURCE_COLORS.SYSTEM;

  return (
    <div
      className="rounded-lg px-3 py-2.5 shadow-lg"
      style={{
        backgroundColor: "var(--card)",
        border: "1px solid var(--border)",
      }}
    >
      <p className="text-xs font-display font-bold" style={{ color: "var(--accent)" }}>
        {formatPrice(entry.price)}
      </p>
      <p className="text-[10px] mt-1" style={{ color: "var(--muted-foreground)" }}>
        {new Date(entry.recordedAt).toLocaleDateString("en-NG", {
          day: "numeric",
          month: "long",
          year: "numeric",
        })}
      </p>
      <span
        className="inline-block text-[9px] font-semibold mt-1 px-1.5 py-0.5 rounded"
        style={{ backgroundColor: `${sourceInfo.color}15`, color: sourceInfo.color }}
      >
        {sourceInfo.label}
      </span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Custom dot                                                         */
/* ------------------------------------------------------------------ */

function CustomDot(props: any) {
  const { cx, cy, payload } = props;
  const sourceInfo = SOURCE_COLORS[payload.source] || SOURCE_COLORS.SYSTEM;
  return (
    <circle
      cx={cx}
      cy={cy}
      r={4}
      fill={sourceInfo.color}
      stroke="var(--card)"
      strokeWidth={2}
    />
  );
}

function CustomActiveDot(props: any) {
  const { cx, cy, payload } = props;
  const sourceInfo = SOURCE_COLORS[payload.source] || SOURCE_COLORS.SYSTEM;
  return (
    <circle
      cx={cx}
      cy={cy}
      r={6}
      fill={sourceInfo.color}
      stroke="var(--card)"
      strokeWidth={3}
    />
  );
}

/* ------------------------------------------------------------------ */
/*  Exported PriceHistoryChart                                         */
/* ------------------------------------------------------------------ */

export function PriceHistoryChart({
  history,
  currentPrice,
}: {
  history: PriceHistoryEntry[];
  currentPrice?: number | null;
}) {
  const chartData = useMemo(() => {
    if (!history.length) return [];
    return history.map((h) => ({
      ...h,
      date: new Date(h.recordedAt).toLocaleDateString("en-NG", {
        month: "short",
        year: "2-digit",
      }),
      priceValue: h.price,
    }));
  }, [history]);

  const stats = useMemo(() => {
    if (!history.length) return null;
    const prices = history.map((h) => h.price);
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const latest = prices[prices.length - 1];
    const first = prices[0];
    const totalChange = first > 0 ? ((latest - first) / first) * 100 : 0;
    const lastChange =
      prices.length > 1
        ? ((prices[prices.length - 1] - prices[prices.length - 2]) / prices[prices.length - 2]) * 100
        : 0;
    const avg = prices.reduce((a, b) => a + b, 0) / prices.length;

    return { min, max, latest, first, totalChange, lastChange, avg };
  }, [history]);

  if (!history.length) {
    return (
      <div
        className="flex flex-col items-center py-6 gap-2 rounded-lg"
        style={{ backgroundColor: "var(--secondary)" }}
      >
        <Clock size={20} style={{ color: "var(--muted-foreground)" }} />
        <p className="text-sm font-medium" style={{ color: "var(--muted-foreground)" }}>
          No price history recorded
        </p>
        <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
          Price changes will appear here over time
        </p>
      </div>
    );
  }

  if (!stats) return null;

  const TrendIcon =
    stats.totalChange > 0 ? TrendingUp : stats.totalChange < 0 ? TrendingDown : Minus;
  const trendColor =
    stats.totalChange > 0 ? "var(--success, #16a34a)" : stats.totalChange < 0 ? "var(--destructive, #dc2626)" : "var(--muted-foreground)";

  return (
    <div className="space-y-4">
      {/* Stats row */}
      <div
        className="grid grid-cols-3 gap-3 p-3 rounded-lg"
        style={{ backgroundColor: "var(--secondary)" }}
      >
        <div>
          <p className="text-[10px] uppercase tracking-wide font-medium" style={{ color: "var(--muted-foreground)" }}>
            Low
          </p>
          <p className="text-xs font-display font-bold mt-0.5" style={{ color: "var(--foreground)" }}>
            {formatPrice(stats.min)}
          </p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wide font-medium" style={{ color: "var(--muted-foreground)" }}>
            High
          </p>
          <p className="text-xs font-display font-bold mt-0.5" style={{ color: "var(--foreground)" }}>
            {formatPrice(stats.max)}
          </p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wide font-medium" style={{ color: "var(--muted-foreground)" }}>
            Change
          </p>
          <div className="flex items-center gap-1 mt-0.5">
            <TrendIcon size={12} style={{ color: trendColor }} />
            <p className="text-xs font-display font-bold" style={{ color: trendColor }}>
              {stats.totalChange > 0 ? "+" : ""}
              {stats.totalChange.toFixed(1)}%
            </p>
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="w-full h-48">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 8, right: 8, left: -10, bottom: 0 }}>
            <defs>
              <linearGradient id="priceGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--accent, #FF6600)" stopOpacity={0.2} />
                <stop offset="100%" stopColor="var(--accent, #FF6600)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="var(--border)"
              vertical={false}
            />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v: number) => {
                if (v >= 1_000_000_000) return `${(v / 1_000_000_000).toFixed(1)}B`;
                if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
                if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K`;
                return v.toString();
              }}
              width={55}
            />
            <Tooltip content={<CustomTooltip />} />
            {stats.avg > 0 && (
              <ReferenceLine
                y={stats.avg}
                stroke="var(--muted-foreground)"
                strokeDasharray="4 4"
                strokeOpacity={0.4}
              />
            )}
            <Area
              type="monotone"
              dataKey="priceValue"
              stroke="var(--accent, #FF6600)"
              strokeWidth={2.5}
              fill="url(#priceGradient)"
              dot={<CustomDot />}
              activeDot={<CustomActiveDot />}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Last change note */}
      {history.length > 1 && stats.lastChange !== 0 && (
        <p className="text-[10px]" style={{ color: "var(--muted-foreground)" }}>
          Last change:{" "}
          <span
            className="font-semibold"
            style={{ color: stats.lastChange > 0 ? "var(--success, #16a34a)" : "var(--destructive, #dc2626)" }}
          >
            {stats.lastChange > 0 ? "+" : ""}
            {stats.lastChange.toFixed(1)}%
          </span>
          {" "}on{" "}
          {new Date(history[history.length - 1].recordedAt).toLocaleDateString("en-NG", {
            day: "numeric",
            month: "short",
            year: "numeric",
          })}
        </p>
      )}
    </div>
  );
}
