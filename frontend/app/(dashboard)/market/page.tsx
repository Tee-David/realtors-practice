"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  TrendingUp, DollarSign, Clock, Eye, BarChart3,
  ArrowUpRight, ArrowDownRight, Building2, MapPin,
} from "lucide-react";
import { usePricePerSqm, useRentalYield, useDaysOnMarket, useMostViewed } from "@/hooks/use-market";
import { formatPrice } from "@/lib/utils";

// ─── Types ──────────────────────────────────────────────────────────────────

type Tab = "price-sqm" | "rental-yield" | "days-on-market" | "most-viewed";

// ─── Stat Card ──────────────────────────────────────────────────────────────

function StatCard({ icon: Icon, label, value, sub, color, delay = 0 }: {
  icon: React.ElementType; label: string; value: string | number; sub?: string; color: string; delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4 }}
      className="rounded-2xl border p-5 relative overflow-hidden group hover:shadow-lg transition-shadow"
      style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}
    >
      <div className="absolute top-0 left-0 right-0 h-0.5 opacity-0 group-hover:opacity-100 transition-opacity" style={{ background: `linear-gradient(to right, transparent, ${color}, transparent)` }} />
      <div className="flex items-center gap-2.5 mb-3">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: `${color}15` }}>
          <Icon className="w-4.5 h-4.5" style={{ color }} />
        </div>
        <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--muted-foreground)" }}>{label}</span>
      </div>
      <p className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>{value}</p>
      {sub && <p className="text-xs mt-1" style={{ color: "var(--muted-foreground)" }}>{sub}</p>}
    </motion.div>
  );
}

// ─── Bar Chart Row ──────────────────────────────────────────────────────────

function BarRow({ label, value, maxValue, suffix = "", delay = 0, color = "var(--primary)" }: {
  label: string; value: number; maxValue: number; suffix?: string; delay?: number; color?: string;
}) {
  const pct = maxValue > 0 ? Math.min((value / maxValue) * 100, 100) : 0;
  return (
    <div className="flex items-center gap-3 py-2.5">
      <span className="w-32 sm:w-40 text-sm truncate shrink-0" style={{ color: "var(--foreground)" }}>{label}</span>
      <div className="flex-1 h-3 rounded-full overflow-hidden" style={{ backgroundColor: "var(--secondary)" }}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ delay, duration: 0.8, ease: "easeOut" }}
          className="h-full rounded-full"
          style={{ backgroundColor: color }}
        />
      </div>
      <span className="text-sm font-semibold tabular-nums w-24 text-right" style={{ color: "var(--foreground)" }}>
        {typeof value === "number" && value >= 1000 ? value.toLocaleString() : value}{suffix}
      </span>
    </div>
  );
}

// ─── Tab Button ─────────────────────────────────────────────────────────────

function TabButton({ active, onClick, icon: Icon, label }: {
  active: boolean; onClick: () => void; icon: React.ElementType; label: string;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all"
      style={{
        backgroundColor: active ? "var(--primary)" : "transparent",
        color: active ? "var(--primary-foreground)" : "var(--muted-foreground)",
        border: active ? "none" : "1px solid var(--border)",
      }}
    >
      <Icon className="w-4 h-4" />
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}

// ─── Price Per Sqm Tab ──────────────────────────────────────────────────────

function PricePerSqmTab() {
  const { data, isLoading } = usePricePerSqm();
  if (isLoading) return <LoadingSkeleton />;
  if (!data || data.length === 0) return <EmptyState message="No price per sqm data available yet. Properties need area (sqm) values." />;

  const maxVal = Math.max(...data.map(d => d.avgPricePerSqm));

  return (
    <div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <StatCard icon={DollarSign} label="Highest ₦/sqm" value={formatPrice(data[0]?.avgPricePerSqm)} sub={data[0]?.area} color="#0001fc" delay={0.1} />
        <StatCard icon={BarChart3} label="Areas Tracked" value={data.length} sub="with price & area data" color="#8b5cf6" delay={0.2} />
        <StatCard icon={Building2} label="Total Properties" value={data.reduce((s, d) => s + d.count, 0)} sub="with sqm data" color="#4ade80" delay={0.3} />
      </div>
      <div className="rounded-2xl border p-5" style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}>
        <h3 className="text-sm font-bold uppercase tracking-wider mb-4" style={{ color: "var(--muted-foreground)" }}>Average Price per sqm by Area</h3>
        {data.slice(0, 15).map((item, i) => (
          <BarRow key={item.area} label={item.area} value={item.avgPricePerSqm} maxValue={maxVal} suffix="" delay={0.1 + i * 0.05} />
        ))}
      </div>
    </div>
  );
}

// ─── Rental Yield Tab ───────────────────────────────────────────────────────

function RentalYieldTab() {
  const { data, isLoading } = useRentalYield();
  if (isLoading) return <LoadingSkeleton />;
  if (!data || data.length === 0) return <EmptyState message="No rental yield data available. Requires both sale and rental listings in the same area." />;

  const maxYield = Math.max(...data.map(d => d.annualYield));
  const avgYield = data.reduce((s, d) => s + d.annualYield, 0) / data.length;

  return (
    <div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <StatCard icon={TrendingUp} label="Best Yield" value={`${data[0]?.annualYield.toFixed(1)}%`} sub={data[0]?.area} color="#4ade80" delay={0.1} />
        <StatCard icon={BarChart3} label="Avg Yield" value={`${avgYield.toFixed(1)}%`} sub="across all areas" color="#f97316" delay={0.2} />
        <StatCard icon={MapPin} label="Areas" value={data.length} sub="with yield data" color="#8b5cf6" delay={0.3} />
      </div>
      <div className="rounded-2xl border p-5" style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}>
        <h3 className="text-sm font-bold uppercase tracking-wider mb-4" style={{ color: "var(--muted-foreground)" }}>Annual Rental Yield by Area</h3>
        {data.slice(0, 15).map((item, i) => (
          <BarRow key={item.area} label={item.area} value={item.annualYield} maxValue={maxYield} suffix="%" delay={0.1 + i * 0.05} color="#4ade80" />
        ))}
      </div>
    </div>
  );
}

// ─── Days on Market Tab ─────────────────────────────────────────────────────

function DaysOnMarketTab() {
  const { data, isLoading } = useDaysOnMarket();
  if (isLoading) return <LoadingSkeleton />;
  if (!data || data.length === 0) return <EmptyState message="No days-on-market data available yet." />;

  const maxDays = Math.max(...data.map(d => d.avgDays));
  const overallAvg = data.reduce((s, d) => s + d.avgDays, 0) / data.length;

  return (
    <div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <StatCard icon={Clock} label="Fastest Area" value={`${Math.round(data[data.length - 1]?.avgDays || 0)}d`} sub={data[data.length - 1]?.area} color="#4ade80" delay={0.1} />
        <StatCard icon={Clock} label="Avg Days" value={`${Math.round(overallAvg)}d`} sub="across all areas" color="#f97316" delay={0.2} />
        <StatCard icon={Clock} label="Slowest Area" value={`${Math.round(data[0]?.avgDays || 0)}d`} sub={data[0]?.area} color="#ef4444" delay={0.3} />
      </div>
      <div className="rounded-2xl border p-5" style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}>
        <h3 className="text-sm font-bold uppercase tracking-wider mb-4" style={{ color: "var(--muted-foreground)" }}>Average Days on Market by Area</h3>
        {data.slice(0, 15).map((item, i) => (
          <BarRow key={item.area} label={item.area} value={Math.round(item.avgDays)} maxValue={maxDays} suffix="d" delay={0.1 + i * 0.05} color="#f97316" />
        ))}
      </div>
    </div>
  );
}

// ─── Most Viewed Tab ────────────────────────────────────────────────────────

function MostViewedTab() {
  const { data, isLoading } = useMostViewed();
  if (isLoading) return <LoadingSkeleton />;
  if (!data || data.length === 0) return <EmptyState message="No view data yet. Property views are tracked when users visit detail pages." />;

  return (
    <div className="rounded-2xl border p-5" style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}>
      <h3 className="text-sm font-bold uppercase tracking-wider mb-4" style={{ color: "var(--muted-foreground)" }}>Most Viewed Properties</h3>
      <div className="divide-y" style={{ borderColor: "var(--border)" }}>
        {data.slice(0, 20).map((item, i) => (
          <motion.div
            key={item.id}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.05 }}
            className="flex items-center justify-between py-3 gap-4"
          >
            <div className="flex items-center gap-3 min-w-0">
              <span className="text-sm font-bold tabular-nums w-6 text-center" style={{ color: "var(--muted-foreground)" }}>{i + 1}</span>
              <div className="min-w-0">
                <p className="text-sm font-medium truncate" style={{ color: "var(--foreground)" }}>{item.title}</p>
                <p className="text-xs flex items-center gap-1" style={{ color: "var(--muted-foreground)" }}>
                  <MapPin className="w-3 h-3" />{item.location || "—"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4 shrink-0">
              <span className="text-sm font-bold" style={{ color: "var(--accent, #ff6600)" }}>{formatPrice(item.price)}</span>
              <span className="flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-lg" style={{ backgroundColor: "var(--secondary)", color: "var(--foreground)" }}>
                <Eye className="w-3 h-3" />{item.views}
              </span>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

// ─── Shared Components ──────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="rounded-2xl border p-5 animate-pulse" style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}>
            <div className="h-4 w-24 rounded mb-3" style={{ backgroundColor: "var(--secondary)" }} />
            <div className="h-8 w-20 rounded" style={{ backgroundColor: "var(--secondary)" }} />
          </div>
        ))}
      </div>
      <div className="rounded-2xl border p-5 animate-pulse" style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}>
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} className="flex items-center gap-3 py-3">
            <div className="h-3 w-32 rounded" style={{ backgroundColor: "var(--secondary)" }} />
            <div className="flex-1 h-3 rounded-full" style={{ backgroundColor: "var(--secondary)" }} />
          </div>
        ))}
      </div>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border p-12 text-center" style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}>
      <BarChart3 className="w-12 h-12 mx-auto mb-4" style={{ color: "var(--muted-foreground)" }} />
      <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>{message}</p>
    </div>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────────────

export default function MarketTrendsPage() {
  const [activeTab, setActiveTab] = useState<Tab>("price-sqm");

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-6" data-tour="market-trends">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold" style={{ color: "var(--foreground)" }}>Market Intelligence</h1>
          <p className="text-sm mt-1" style={{ color: "var(--muted-foreground)" }}>Price trends, rental yields, and market analytics across Nigerian property areas.</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2">
        <TabButton active={activeTab === "price-sqm"} onClick={() => setActiveTab("price-sqm")} icon={DollarSign} label="Price / sqm" />
        <TabButton active={activeTab === "rental-yield"} onClick={() => setActiveTab("rental-yield")} icon={TrendingUp} label="Rental Yield" />
        <TabButton active={activeTab === "days-on-market"} onClick={() => setActiveTab("days-on-market")} icon={Clock} label="Days on Market" />
        <TabButton active={activeTab === "most-viewed"} onClick={() => setActiveTab("most-viewed")} icon={Eye} label="Most Viewed" />
      </div>

      {/* Tab Content */}
      <motion.div key={activeTab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
        {activeTab === "price-sqm" && <PricePerSqmTab />}
        {activeTab === "rental-yield" && <RentalYieldTab />}
        {activeTab === "days-on-market" && <DaysOnMarketTab />}
        {activeTab === "most-viewed" && <MostViewedTab />}
      </motion.div>
    </div>
  );
}
