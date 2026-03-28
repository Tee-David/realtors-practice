"use client";

import { useState, useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useDashboardKPIs, useDashboardCharts, useListingVelocity, useActivityHeatmap, usePriceTrends, useKPITrends } from "@/hooks/use-analytics";
import {
  Building2, TrendingUp, TrendingDown, Home, DollarSign, BarChart3,
  ArrowUpRight, ArrowDownRight, Download, Search, Filter,
  Calendar, RefreshCw, Globe, ChevronDown, MoreHorizontal,
  Eye, Bed, MapPin, Tag, Activity, BarChart3 as BarChart3Icon,
  Sparkles, Brain,
} from "lucide-react";
import { AIPlaceholderCard, AIPlaceholderBanner } from "@/components/ai/ai-placeholder";
import { motion } from "framer-motion";
import AnimatedCounter from "@/components/ui/animated-counter";
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ComposedChart, Legend,
} from "recharts";

// ─── Types ──────────────────────────────────────────────────────────────────

type TimeRange = "7d" | "30d" | "90d" | "1y";
type TableTab = "All" | "Active" | "Sold" | "Rented" | "Pending";

// ─── Helpers ────────────────────────────────────────────────────────────────

function fmtPrice(n: number): string {
  if (n >= 1_000_000_000) return `₦${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000)     return `₦${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)         return `₦${(n / 1_000).toFixed(0)}K`;
  return `₦${n}`;
}
function fmtCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

/** Format listing velocity data into chart series, filtered by time range */
function formatVelocityData(velocity: { date: string; count: number }[] | undefined, range: TimeRange) {
  if (!velocity || velocity.length === 0) {
    // Return empty series placeholder
    return Array.from({ length: range === "7d" ? 7 : 12 }, (_, i) => ({
      name: `Day ${i + 1}`,
      properties: 0,
      new: 0,
    }));
  }

  const now = new Date();
  const cutoff = new Date(now);
  if (range === "7d") cutoff.setDate(cutoff.getDate() - 7);
  else if (range === "30d") cutoff.setDate(cutoff.getDate() - 30);
  else if (range === "90d") cutoff.setDate(cutoff.getDate() - 90);
  else cutoff.setFullYear(cutoff.getFullYear() - 1);

  const filtered = velocity.filter(v => new Date(v.date) >= cutoff);

  if (range === "7d" || range === "30d") {
    // Daily granularity
    return filtered.map(v => {
      const d = new Date(v.date);
      const label = range === "7d"
        ? d.toLocaleDateString("en-NG", { weekday: "short" })
        : d.toLocaleDateString("en-NG", { day: "numeric", month: "short" });
      return { name: label, properties: v.count, new: v.count };
    });
  }

  // Weekly/monthly aggregation for 90d/1y
  const buckets = new Map<string, number>();
  for (const v of filtered) {
    const d = new Date(v.date);
    const key = range === "90d"
      ? `W${Math.ceil(d.getDate() / 7)} ${d.toLocaleDateString("en-NG", { month: "short" })}`
      : d.toLocaleDateString("en-NG", { month: "short", year: "2-digit" });
    buckets.set(key, (buckets.get(key) || 0) + v.count);
  }
  return Array.from(buckets.entries()).map(([name, count]) => ({
    name,
    properties: count,
    new: count,
  }));
}

/** Format heatmap data from real backend response */
function formatHeatmapData(heatmap: { day: number; hours: number[] }[] | undefined) {
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const displayHours = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20];

  if (!heatmap || heatmap.length === 0) {
    return dayNames.map(day => ({
      day,
      hours: displayHours.map(h => ({ h, val: 0 })),
    }));
  }

  return heatmap.map(row => ({
    day: dayNames[row.day] || `Day${row.day}`,
    hours: displayHours.map(h => ({ h, val: row.hours[h] || 0 })),
  }));
}

// ─── Shared Components ──────────────────────────────────────────────────────

const tooltipStyle = {
  contentStyle: { backgroundColor: "var(--card)", borderRadius: 12, border: "1px solid var(--border)", fontSize: 12 },
  itemStyle: { color: "var(--foreground)", fontWeight: 600 },
  labelStyle: { color: "var(--muted-foreground)", fontSize: 11, marginBottom: 2 },
};

function TimeBtn({ value, active, onChange }: { value: TimeRange; active: boolean; onChange: () => void }) {
  return (
    <button onClick={onChange} className="px-3 py-1.5 rounded-md text-xs font-semibold transition-all"
      style={{ backgroundColor: active ? "var(--card)" : "transparent", color: active ? "var(--foreground)" : "var(--muted-foreground)", boxShadow: active ? "0 1px 4px rgba(0,0,0,0.1)" : "none" }}>
      {value}
    </button>
  );
}

function TabBtn({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className="px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all"
      style={{ backgroundColor: active ? "var(--primary)" : "transparent", color: active ? "var(--primary-foreground)" : "var(--muted-foreground)" }}>
      {label}
    </button>
  );
}

// ─── Hero KPI (large dark card) ─────────────────────────────────────────────

function HeroKpi({ value, trend, isLoading }: { value: number; trend: number; isLoading: boolean }) {
  return (
    <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}
      className="relative rounded-2xl overflow-hidden p-6 flex flex-col justify-between"
      style={{ background: "linear-gradient(135deg, #0a0a1a 0%, #1a1040 60%, #0f0620 100%)", minHeight: 196 }}>
      {/* Background accent */}
      <div className="absolute top-0 right-0 w-32 h-32 rounded-bl-[80px]" style={{ background: "rgba(82,39,255,0.25)" }} />
      <div className="absolute bottom-4 right-6 w-16 h-16 rounded-full" style={{ background: "rgba(82,39,255,0.15)" }} />

      <div className="flex items-start justify-between">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: "rgba(82,39,255,0.35)" }}>
          <Building2 className="w-5 h-5 text-white" />
        </div>
        <span className="text-xs font-semibold px-2.5 py-1 rounded-full text-white" style={{ backgroundColor: "rgba(255,255,255,0.12)" }}>
          All Time
        </span>
      </div>

      <div>
        <p className="text-sm font-medium mb-1" style={{ color: "rgba(255,255,255,0.55)" }}>Total Properties</p>
        {isLoading ? (
          <div className="h-10 w-28 rounded-lg animate-pulse" style={{ backgroundColor: "rgba(255,255,255,0.1)" }} />
        ) : (
          <div className="text-4xl font-black text-white"><AnimatedCounter value={value} compact /></div>
        )}
        <div className="flex items-center gap-1.5 mt-2">
          {trend >= 0
            ? <ArrowUpRight className="w-4 h-4" style={{ color: "#4ade80" }} />
            : <ArrowDownRight className="w-4 h-4" style={{ color: "#f87171" }} />}
          <span className="text-xs font-bold" style={{ color: trend >= 0 ? "#4ade80" : "#f87171" }}>
            +{trend}%
          </span>
          <span className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>vs last period</span>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Mini KPI card ───────────────────────────────────────────────────────────

function MiniKpi({ label, value, trend, icon: Icon, color, bg, prefix = "", isLoading }: {
  label: string; value: number | string; trend?: number;
  icon: React.ComponentType<any>; color: string; bg: string; prefix?: string; isLoading?: boolean;
}) {
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border p-4 flex items-start justify-between"
      style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}>
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: "var(--muted-foreground)" }}>{label}</p>
        {isLoading
          ? <div className="h-7 w-16 rounded animate-pulse" style={{ backgroundColor: "var(--secondary)" }} />
          : <div className="text-xl font-bold" style={{ color: "var(--foreground)" }}>{typeof value === "number" ? <AnimatedCounter value={value} prefix={prefix} compact /> : `${prefix}${value}`}</div>}
        {trend != null && (
          <div className="flex items-center gap-0.5 mt-1.5" style={{ color: trend >= 0 ? "#16a34a" : "#dc2626" }}>
            {trend >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            <span className="text-[10px] font-bold">{trend > 0 ? "+" : ""}{trend}%</span>
          </div>
        )}
      </div>
      <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: bg }}>
        <Icon className="w-5 h-5" style={{ color }} />
      </div>
    </motion.div>
  );
}

// ─── Top List (Areas / Sites) ─────────────────────────────────────────────

function TopList({ title, items, valueLabel }: {
  title: string;
  items: { name: string; value: number; pct: number; sub?: string; color?: string }[];
  valueLabel: string;
}) {
  const max = Math.max(...items.map(i => i.value), 1);
  return (
    <div className="rounded-2xl border p-5" style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>{title}</h3>
        <button className="p-1 rounded-lg hover:bg-[var(--secondary)]"><MoreHorizontal className="w-4 h-4" style={{ color: "var(--muted-foreground)" }} /></button>
      </div>
      <div className="space-y-3">
        {items.map((item, i) => (
          <div key={item.name} className="flex items-center gap-3">
            <span className="text-xs font-bold w-5 text-center" style={{ color: "var(--muted-foreground)" }}>{i + 1}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold truncate" style={{ color: "var(--foreground)" }}>{item.name}</span>
                <span className="text-xs font-bold ml-2 shrink-0" style={{ color: "var(--foreground)" }}>{fmtCount(item.value)}</span>
              </div>
              <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: "var(--secondary)" }}>
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${(item.value / max) * 100}%` }}
                  transition={{ duration: 0.8, delay: i * 0.05 }}
                  className="h-full rounded-full"
                  style={{ backgroundColor: item.color || "var(--primary)" }}
                />
              </div>
            </div>
            <span className="text-[10px] font-semibold w-8 text-right shrink-0" style={{ color: "var(--muted-foreground)" }}>{item.pct}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Activity Heatmap ────────────────────────────────────────────────────────

function ActivityHeatmap({ data, maxVal }: { data: { day: string; hours: { h: number; val: number }[] }[]; maxVal: number }) {
  const hours = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20];

  return (
    <div className="rounded-2xl border p-5" style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>Scraping Activity</h3>
          <p className="text-[11px] mt-0.5" style={{ color: "var(--muted-foreground)" }}>Highest activity: <span className="font-semibold">10am – 3pm</span></p>
        </div>
        <div className="flex items-center gap-2 text-[10px]" style={{ color: "var(--muted-foreground)" }}>
          <span>Less</span>
          {[0.1, 0.3, 0.6, 0.8, 1].map(o => (
            <div key={o} className="w-3 h-3 rounded-sm" style={{ backgroundColor: `rgba(82,39,255,${o})` }} />
          ))}
          <span>More</span>
        </div>
      </div>
      <div className="overflow-x-auto">
        <div style={{ minWidth: 480 }}>
          {/* Hour labels */}
          <div className="flex items-center mb-1.5">
            <div className="w-10 shrink-0" />
            {hours.map(h => (
              <div key={h} className="flex-1 text-center text-[9px] font-medium" style={{ color: "var(--muted-foreground)" }}>
                {h > 12 ? `${h - 12}pm` : h === 12 ? "12pm" : `${h}am`}
              </div>
            ))}
          </div>
          {data.map(row => (
            <div key={row.day} className="flex items-center mb-1">
              <span className="w-10 text-[10px] font-medium shrink-0 pr-2" style={{ color: "var(--muted-foreground)" }}>{row.day}</span>
              {row.hours.map(cell => {
                const intensity = maxVal > 0 ? cell.val / maxVal : 0;
                return (
                  <div
                    key={cell.h}
                    className="flex-1 mx-0.5 h-5 rounded-sm cursor-pointer transition-transform hover:scale-110"
                    style={{
                      backgroundColor: `rgba(82,39,255,${Math.max(0.05, intensity * 0.9)})`,
                    }}
                    title={`${row.day} ${cell.h}:00 — ${cell.val} scrapes`}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Combo Chart (line + bar) ────────────────────────────────────────────────

function TrendChart({ data, timeRange, onTimeRange }: { data: { name: string; properties: number; new: number }[]; timeRange: TimeRange; onTimeRange: (v: TimeRange) => void }) {
  const totalNew = data.reduce((s, d) => s + d.new, 0);
  const totalAll = data.reduce((s, d) => s + d.properties, 0);

  return (
    <div className="rounded-2xl border p-5 h-full flex flex-col" style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}>
      <div className="flex items-start justify-between mb-2">
        <div>
          <h3 className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>Properties Over Time</h3>
          <div className="flex items-baseline gap-2 mt-1">
            <div className="text-2xl font-bold flex items-center" style={{ color: "var(--foreground)" }}><AnimatedCounter value={totalAll} compact /></div>
            <span className="text-xs px-2 py-0.5 rounded-full font-bold flex items-center" style={{ backgroundColor: "rgba(22,163,74,0.12)", color: "#16a34a" }}>
              +<AnimatedCounter value={totalNew} compact /> new
            </span>
          </div>
        </div>
        <div data-tour="time-range" className="flex gap-1 p-0.5 rounded-lg" style={{ backgroundColor: "var(--secondary)" }}>
          {(["7d", "30d", "90d", "1y"] as TimeRange[]).map(r => (
            <TimeBtn key={r} value={r} active={timeRange === r} onChange={() => onTimeRange(r)} />
          ))}
        </div>
      </div>
      <div className="flex-1 min-h-[150px] mt-3">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
            <defs>
              <linearGradient id="trendGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#5227FF" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#5227FF" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} />
            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} tickFormatter={fmtCount} />
            <Tooltip {...tooltipStyle} />
            <Bar dataKey="new" name="New" fill="rgba(82,39,255,0.15)" radius={[3, 3, 0, 0]} />
            <Area type="monotone" dataKey="properties" name="Total" stroke="#5227FF" strokeWidth={2.5} fill="url(#trendGrad)" />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ─── Price Trends Chart ──────────────────────────────────────────────────────

function PriceTrendsChart({ data }: { data: { month: string; listingType: string; avgPrice: number; count: number }[] | undefined }) {
  const chartData = useMemo(() => {
    if (!data || data.length === 0) return [];

    // Pivot data: one row per month with avgSale and avgRent columns
    const monthMap = new Map<string, { month: string; sale: number; rent: number; saleCount: number; rentCount: number }>();
    for (const d of data) {
      const existing = monthMap.get(d.month) || { month: d.month, sale: 0, rent: 0, saleCount: 0, rentCount: 0 };
      if (d.listingType === "SALE") {
        existing.sale = d.avgPrice;
        existing.saleCount = d.count;
      } else if (d.listingType === "RENT") {
        existing.rent = d.avgPrice;
        existing.rentCount = d.count;
      }
      monthMap.set(d.month, existing);
    }

    return Array.from(monthMap.values())
      .sort((a, b) => a.month.localeCompare(b.month))
      .map(d => {
        const date = new Date(d.month + "-15");
        return {
          name: date.toLocaleDateString("en-NG", { month: "short", year: "2-digit" }),
          sale: d.sale,
          rent: d.rent,
        };
      });
  }, [data]);

  if (chartData.length === 0) {
    return (
      <div className="rounded-2xl border p-5 flex flex-col items-center justify-center" style={{ borderColor: "var(--border)", backgroundColor: "var(--card)", minHeight: 200 }}>
        <DollarSign className="w-8 h-8 mb-2" style={{ color: "var(--muted-foreground)", opacity: 0.4 }} />
        <p className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>Price Trends</p>
        <p className="text-xs mt-1" style={{ color: "var(--muted-foreground)" }}>Not enough data yet</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border p-5 flex flex-col" style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}>
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>Avg Price Trends</h3>
          <p className="text-[10px] mt-0.5" style={{ color: "var(--muted-foreground)" }}>Last 6 months by listing type</p>
        </div>
        <div className="flex items-center gap-3 text-[10px] font-semibold">
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: "#2563eb" }} />Sale</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: "#ea580c" }} />Rent</span>
        </div>
      </div>
      <div className="flex-1 min-h-[180px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} />
            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} tickFormatter={fmtPrice} />
            <Tooltip {...tooltipStyle} formatter={(value: number) => fmtPrice(value)} />
            <Line type="monotone" dataKey="sale" name="Avg Sale Price" stroke="#2563eb" strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} />
            <Line type="monotone" dataKey="rent" name="Avg Rent Price" stroke="#ea580c" strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ─── Property Table ──────────────────────────────────────────────────────────

const STATUS_BADGE: Record<string, { bg: string; text: string }> = {
  ACTIVE:    { bg: "rgba(22,163,74,0.12)",   text: "#16a34a" },
  SOLD:      { bg: "rgba(37,99,235,0.12)",   text: "#2563eb" },
  RENTED:    { bg: "rgba(8,145,178,0.12)",   text: "#0891b2" },
  PENDING:   { bg: "rgba(202,138,4,0.12)",   text: "#ca8a04" },
  WITHDRAWN: { bg: "rgba(220,38,38,0.12)",   text: "#dc2626" },
};

function PropertyTable({ data, tab, setTab, onExport }: { data: any[]; tab: TableTab; setTab: (t: TableTab) => void; onExport: () => void }) {
  const tabs: TableTab[] = ["All", "Active", "Sold", "Rented", "Pending"];
  const [query, setQuery] = useState("");

  const filtered = data.filter(p => {
    if (tab !== "All" && p.status !== tab.toUpperCase()) return false;
    if (query && !JSON.stringify(p).toLowerCase().includes(query.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="rounded-2xl border overflow-hidden" style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}>
      {/* Table Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-5 border-b" style={{ borderColor: "var(--border)" }}>
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <h3 className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>Property Ledger</h3>
          <div className="flex items-center gap-1 p-1 rounded-xl" style={{ backgroundColor: "var(--secondary)" }}>
            {tabs.map(t => <TabBtn key={t} label={t} active={tab === t} onClick={() => setTab(t)} />)}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: "var(--muted-foreground)" }} />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search table…"
              className="pl-8 pr-3 py-1.5 text-xs rounded-lg border focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
              style={{ backgroundColor: "var(--background)", borderColor: "var(--border)", color: "var(--foreground)", width: 160 }}
            />
          </div>
          <button onClick={onExport}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors hover:bg-[var(--secondary)]"
            style={{ borderColor: "var(--border)", color: "var(--foreground)" }}>
            <Download className="w-3.5 h-3.5" /> Export
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr style={{ borderBottom: "1px solid var(--border)", backgroundColor: "var(--secondary)" }}>
              {["Title / ID", "Type", "Category", "Bedrooms", "Price", "Area", "Source", "Listed", "Status"].map(h => (
                <th key={h} className="px-4 py-2.5 text-left font-semibold uppercase tracking-wider whitespace-nowrap" style={{ color: "var(--muted-foreground)", fontSize: 10 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.slice(0, 20).map((p: any, i: number) => {
              const badge = STATUS_BADGE[p.status] || STATUS_BADGE.ACTIVE;
              return (
                <tr key={p.id || i} className="transition-colors hover:bg-[var(--secondary)]/40 cursor-pointer" style={{ borderBottom: "1px solid var(--border)" }}>
                  <td className="px-4 py-3">
                    <div>
                      <p className="font-semibold truncate max-w-[180px]" style={{ color: "var(--foreground)" }}>{p.title || "Untitled"}</p>
                      <p className="text-[10px] font-mono" style={{ color: "var(--muted-foreground)" }}>#{(p.id || "—").slice(0, 8)}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="px-2 py-0.5 rounded-md font-medium" style={{ backgroundColor: "rgba(82,39,255,0.08)", color: "#5227FF" }}>
                      {p.listingType || "—"}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap" style={{ color: "var(--muted-foreground)" }}>{p.category || "Residential"}</td>
                  <td className="px-4 py-3 text-center" style={{ color: "var(--foreground)" }}>
                    {p.bedrooms ? <span className="flex items-center justify-center gap-1"><Bed className="w-3 h-3" />{p.bedrooms}</span> : "—"}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap font-semibold" style={{ color: "var(--foreground)" }}>
                    {p.price ? fmtPrice(p.price) : "—"}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap" style={{ color: "var(--muted-foreground)" }}>
                    {[p.area, p.state].filter(Boolean).join(", ") || "—"}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="inline-flex items-center gap-1" style={{ color: "var(--muted-foreground)" }}>
                      <Globe className="w-3 h-3" />{p.site?.name || p.sourceUrl?.split("/")[2]?.replace("www.", "") || "—"}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap" style={{ color: "var(--muted-foreground)" }}>
                    {p.createdAt ? new Date(p.createdAt).toLocaleDateString("en-NG", { month: "short", day: "numeric" }) : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-bold whitespace-nowrap" style={{ backgroundColor: badge.bg, color: badge.text }}>
                      {(p.status || "ACTIVE").replace("_", " ")}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-3" style={{ backgroundColor: "rgba(0,1,252,0.08)" }}>
              <BarChart3 className="w-7 h-7" style={{ color: "var(--primary)", opacity: 0.5 }} />
            </div>
            <p className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>No analytics data yet</p>
            <p className="text-xs mt-1 mb-4" style={{ color: "var(--muted-foreground)" }}>
              {tab !== "All" ? "No properties match this filter." : "Scrape some properties to see analytics and insights."}
            </p>
            {tab === "All" && (
              <a
                href="/scraper"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-colors hover:opacity-90"
                style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}
              >
                <Activity className="w-3.5 h-3.5" /> Start Scraping
              </a>
            )}
          </div>
        )}
      </div>
      {filtered.length > 20 && (
        <div className="px-5 py-3 border-t text-xs" style={{ borderColor: "var(--border)", color: "var(--muted-foreground)" }}>
          Showing 20 of {filtered.length} results
        </div>
      )}
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function AnalyticsPage() {
  const [timeRange, setTimeRange] = useState<TimeRange>("30d");
  const [tableTab, setTableTab] = useState<TableTab>("All");

  const { data: kpis, isLoading: kpisLoading } = useDashboardKPIs();
  const { data: charts, isLoading: chartsLoading } = useDashboardCharts();
  const { data: velocity } = useListingVelocity();
  const { data: heatmapRaw } = useActivityHeatmap();
  const { data: priceTrends } = usePriceTrends();
  const { data: kpiTrends } = useKPITrends();
  const isLoading = kpisLoading || chartsLoading;

  // Live data — no hardcoded fallbacks
  const total = kpis?.totalProperties || 0;
  const forSale  = kpis?.forSale   || 0;
  const forRent  = kpis?.forRent   || 0;
  const avgPrice = charts?.avgPrice || 0;
  const byCategory: any[] = charts?.byCategory || [];
  const topSites: any[] = charts?.topSites || [];
  const recentProps: any[] = charts?.recentProperties || [];

  const heatmapData = useMemo(() => formatHeatmapData(heatmapRaw), [heatmapRaw]);
  const heatmapMax = useMemo(() => Math.max(1, ...heatmapData.flatMap(r => r.hours.map(h => h.val))), [heatmapData]);
  const seriesData  = useMemo(() => formatVelocityData(velocity, timeRange), [velocity, timeRange]);

  // Top areas — real data only
  const topAreas = useMemo(() => {
    const raw: any[] = charts?.topAreas || [];
    const t = raw.reduce((s: number, r: any) => s + (r.count || 0), 0) || 1;
    return raw.slice(0, 5).map((a: any) => ({ name: a.area || a.name, value: a.count || 0, pct: Math.round(((a.count || 0) / t) * 100), color: "#5227FF" }));
  }, [charts]);

  // Top sites — real data only
  const topSitesList = useMemo(() => {
    const raw = topSites;
    const t = raw.reduce((s: number, r: any) => s + (r.count || 0), 0) || 1;
    return raw.slice(0, 5).map((s: any) => ({ name: s.name || s.source || s.site?.name, value: s.count || 0, pct: Math.round(((s.count || 0) / t) * 100), color: "#ea580c" }));
  }, [topSites]);

  // Export CSV of recentProps
  const exportCsv = useCallback(() => {
    if (!recentProps.length) return;
    const headers = ["ID", "Title", "Listing Type", "Category", "Bedrooms", "Price", "Area", "State", "Status", "Source", "Listed"];
    const rows = recentProps.map((p: any) => [
      p.id, p.title, p.listingType, p.category, p.bedrooms, p.price,
      p.area, p.state, p.status, p.site?.name || p.sourceUrl, p.createdAt,
    ]);
    const csv = [headers, ...rows].map(r => r.map((c: any) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `analytics-${Date.now()}.csv`;
    a.click();
  }, [recentProps]);

  return (
    <div className="space-y-5 pb-10">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>Analytics</h1>
          <p className="text-xs mt-0.5" style={{ color: "var(--muted-foreground)" }}>Dashboard / Analytics</p>
        </div>
        <button onClick={exportCsv} className="flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-medium transition-colors hover:bg-[var(--secondary)]" style={{ borderColor: "var(--border)", color: "var(--foreground)" }}>
          <Download className="w-4 h-4" /> Export Report
        </button>
      </div>

      {/* Row 1: Hero KPI + Mini KPIs + Trend Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left: Hero + mini KPIs stacked */}
        <div className="flex flex-col gap-4">
          <HeroKpi value={total} trend={kpiTrends?.totalProperties?.changePercent ?? 0} isLoading={isLoading} />
          <div className="grid grid-cols-2 gap-4">
            <MiniKpi label="For Sale" value={forSale} trend={kpiTrends?.forSale?.changePercent} icon={Home} color="#2563eb" bg="rgba(37,99,235,0.08)" isLoading={isLoading} />
            <MiniKpi label="For Rent" value={forRent} trend={kpiTrends?.forRent?.changePercent} icon={Tag} color="#ea580c" bg="rgba(234,88,12,0.08)" isLoading={isLoading} />
            <MiniKpi label="Avg Price" value={avgPrice} prefix="₦" trend={kpiTrends?.avgPrice?.changePercent} icon={DollarSign} color="#7c3aed" bg="rgba(124,58,237,0.08)" isLoading={isLoading} />
            <MiniKpi label="Active Sites" value={kpis?.totalSites || 0} icon={Globe} color="#0891b2" bg="rgba(8,145,178,0.08)" isLoading={isLoading} />
          </div>
        </div>

        {/* Right: Trend chart (spans 2 cols) */}
        <div className="lg:col-span-2">
          <TrendChart data={seriesData} timeRange={timeRange} onTimeRange={setTimeRange} />
        </div>
      </div>

      {/* Row 1.5: Price Trends Chart */}
      <div className="grid grid-cols-1 gap-4">
        <PriceTrendsChart data={priceTrends} />
      </div>

      {/* Row 2: Top Areas + Top Sites + Heatmap */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <TopList title="Top Areas" items={topAreas} valueLabel="Properties" />
        <TopList title="Top Sites" items={topSitesList} valueLabel="Scraped" />
        <div className="md:col-span-2 lg:col-span-1">
          <ActivityHeatmap data={heatmapData} maxVal={heatmapMax} />
        </div>
      </div>

      {/* Row 3: Full property table */}
      <PropertyTable
        data={recentProps}
        tab={tableTab}
        setTab={setTableTab}
        onExport={exportCsv}
      />

      {/* AI Insights */}
      <div className="grid sm:grid-cols-2 gap-3">
        <AIPlaceholderCard
          icon={Brain}
          title="Predictive Analytics"
          description="AI-powered price and volume forecasts for the next 30/90 days based on historical trends."
          features={["Price forecast", "Volume prediction", "Confidence intervals"]}
        />
        <AIPlaceholderCard
          icon={Sparkles}
          title="Anomaly Detection"
          description="Automatically flag unexpected price spikes, listing volume drops, and data quality issues."
          features={["Price outliers", "Volume anomalies", "Seasonal patterns"]}
        />
      </div>
    </div>
  );
}
