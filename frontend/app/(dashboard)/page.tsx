"use client";

import { useState, useMemo } from "react";
import { usePropertyStats, useProperties } from "@/hooks/useProperties";
import { useDashboardKPIs, useDashboardCharts } from "@/hooks/use-analytics";
import { PropertyCard } from "@/components/property/property-card";
import { formatNumber, formatPrice, pluralize } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import AnimatedCounter from "@/components/ui/animated-counter";
import { BentoGrid, BentoGridItem } from "@/components/ui/bento-grid";
import {
  Building2,
  TrendingUp,
  Home,
  TreePine,
  Sunset,
  Factory,
  ArrowUpRight,
  ArrowDownRight,
  ChevronRight,
  DollarSign,
  BarChart3,
  Calendar,
  ImageIcon,
  Filter,
  Activity,
} from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { motion } from "framer-motion";
import { SideSheet, SideSheetContent } from "@/components/ui/side-sheet";
import { PropertyDetailPanel } from "@/components/property/property-detail-panel";
import type { Property, PropertyCategory, ListingType } from "@/types/property";
import { SiteQualityWidget } from "@/components/dashboard/site-quality-widget";
import { GlobeHero } from "@/components/dashboard/globe-hero";
import { AIPlaceholderCard, AIPlaceholderBanner } from "@/components/ai/ai-placeholder";
import { Brain, TrendingUp as TrendingUpIcon, Bot, Zap } from "lucide-react";

// Lazy load heavy charting libraries
const RechartsAreaChart = dynamic(() => import("recharts").then((mod) => mod.AreaChart), { ssr: false });
const RechartsArea = dynamic(() => import("recharts").then((mod) => mod.Area), { ssr: false });
const RechartsXAxis = dynamic(() => import("recharts").then((mod) => mod.XAxis), { ssr: false });
const RechartsYAxis = dynamic(() => import("recharts").then((mod) => mod.YAxis), { ssr: false });
const RechartsTooltip = dynamic(() => import("recharts").then((mod) => mod.Tooltip), { ssr: false });
const RechartsResponsiveContainer = dynamic(() => import("recharts").then((mod) => mod.ResponsiveContainer), { ssr: false });
const RechartsRadialBarChart = dynamic(() => import("recharts").then((mod) => mod.RadialBarChart), { ssr: false });
const RechartsRadialBar = dynamic(() => import("recharts").then((mod) => mod.RadialBar), { ssr: false });
const RechartsBarChart = dynamic(() => import("recharts").then((mod) => mod.BarChart), { ssr: false });
const RechartsBar = dynamic(() => import("recharts").then((mod) => mod.Bar), { ssr: false });
const RechartsCartesianGrid = dynamic(() => import("recharts").then((mod) => mod.CartesianGrid), { ssr: false });
const RechartsLegend = dynamic(() => import("recharts").then((mod) => mod.Legend), { ssr: false });

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const CATEGORY_ICONS: Record<PropertyCategory, React.ComponentType<any>> = {
  RESIDENTIAL: Home,
  COMMERCIAL: Building2,
  LAND: TreePine,
  SHORTLET: Sunset,
  INDUSTRIAL: Factory,
};

const CATEGORY_COLORS: Record<PropertyCategory, string> = {
  RESIDENTIAL: "#3b82f6",
  COMMERCIAL: "#8b5cf6",
  LAND: "#10b981",
  SHORTLET: "#f97316",
  INDUSTRIAL: "#64748b",
};

const STATUS_COLORS: Record<string, string> = {
  AVAILABLE: "var(--success)",
  SOLD: "var(--destructive)",
  RENTED: "var(--primary)",
  UNDER_OFFER: "#f59e0b",
  WITHDRAWN: "#9ca3af",
  EXPIRED: "#d1d5db",
};

const LISTING_LABELS: Record<ListingType, string> = {
  SALE: "For Sale",
  RENT: "For Rent",
  LEASE: "Lease",
  SHORTLET: "Shortlet",
};

const TIME_RANGES = ["7d", "30d", "90d", "1y", "All"] as const;
type TimeRange = (typeof TIME_RANGES)[number];

/* ------------------------------------------------------------------ */
/*  Sparkline bars helper                                              */
/* ------------------------------------------------------------------ */

function SparklineBars({ color, opacity = 0.15 }: { color: string; opacity?: number }) {
  const bars = [40, 65, 50, 75, 55, 80, 70, 90, 60, 85, 95, 80];
  return (
    <div className="flex items-end gap-[2px] h-6 flex-1">
      {bars.map((h, i) => (
        <div
          key={i}
          className="flex-1 rounded-sm"
          style={{
            height: `${h}%`,
            backgroundColor: color,
            opacity: opacity + (i / bars.length) * 0.5,
          }}
        />
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  KPI Card                                                           */
/* ------------------------------------------------------------------ */

function KpiCard({
  label,
  value,
  icon: Icon,
  trend,
  trendLabel,
  iconBg,
  iconColor,
  isLoading,
  prefix,
  compact,
}: {
  label: string;
  value: number;
  icon: React.ComponentType<any>;
  trend?: number;
  trendLabel?: string;
  iconBg: string;
  iconColor: string;
  isLoading?: boolean;
  prefix?: string;
  compact?: boolean;
}) {
  const isPositive = trend != null && trend >= 0;

  return (
    <div className="h-full">
      <div className="flex items-start justify-between">
        <div>
          <p
            className="text-xs font-medium uppercase tracking-wider"
            style={{ color: "var(--muted-foreground)" }}
          >
            {label}
          </p>
          <div className="mt-2">
            {isLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <AnimatedCounter
                value={value}
                fontSize={24}
                fontWeight={700}
                textColor="var(--foreground)"
                compact={compact}
                prefix={prefix}
              />
            )}
          </div>
        </div>
        <div
          className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
          style={{ backgroundColor: iconBg }}
        >
          <Icon size={20} style={{ color: iconColor }} />
        </div>
      </div>

      <div className="flex items-center gap-2 mt-3">
        {trend != null && (
          <div
            className="flex items-center gap-0.5 text-xs font-semibold"
            style={{ color: isPositive ? "var(--success)" : "var(--destructive)" }}
          >
            {isPositive ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
            {Math.abs(trend)}%
          </div>
        )}
        {trendLabel && (
          <span className="text-[11px]" style={{ color: "var(--muted-foreground)" }}>
            {trendLabel}
          </span>
        )}
        <div className="ml-auto flex-1 max-w-[100px]">
          <SparklineBars color={iconColor} />
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Category Bar                                                       */
/* ------------------------------------------------------------------ */

function CategoryBar({
  category,
  count,
  total,
}: {
  category: PropertyCategory;
  count: number;
  total: number;
}) {
  const Icon = CATEGORY_ICONS[category] || Home;
  const color = CATEGORY_COLORS[category] || "#3b82f6";
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;

  return (
    <div className="flex items-center gap-3">
      <div
        className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
        style={{ backgroundColor: `${color}15` }}
      >
        <Icon size={14} style={{ color }} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <span
            className="text-xs font-medium capitalize"
            style={{ color: "var(--foreground)" }}
          >
            {category.toLowerCase()}
          </span>
          <span className="text-xs font-bold" style={{ color }}>
            {formatNumber(count)}
          </span>
        </div>
        <div
          className="h-2 rounded-full overflow-hidden"
          style={{ backgroundColor: "var(--secondary)" }}
        >
          <motion.div
            className="h-full rounded-full"
            initial={{ width: "0%" }}
            whileInView={{ width: `${pct}%` }}
            viewport={{ once: true }}
            transition={{ duration: 1, ease: "easeOut" }}
            style={{ backgroundColor: color }}
          />
        </div>
      </div>
      <span
        className="text-[10px] font-medium w-8 text-right"
        style={{ color: "var(--muted-foreground)" }}
      >
        {pct}%
      </span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Status Dot                                                         */
/* ------------------------------------------------------------------ */

function StatusDot({ label, count, color }: { label: string; count: number; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
      <span className="text-xs capitalize" style={{ color: "var(--muted-foreground)" }}>
        {label.replace("_", " ").toLowerCase()}
      </span>
      <span className="text-xs font-bold ml-auto" style={{ color: "var(--foreground)" }}>
        {formatNumber(count)}
      </span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Revenue Analytics Chart                                            */
/* ------------------------------------------------------------------ */

function RevenueAnalyticsChart({
  saleValue,
  rentValue,
  isLoading,
  timeRange,
  onTimeRangeChange,
  chartView,
  onChartViewChange,
}: {
  saleValue: number;
  rentValue: number;
  isLoading: boolean;
  timeRange: TimeRange;
  onTimeRangeChange: (range: TimeRange) => void;
  chartView: "Sales" | "Rents";
  onChartViewChange: (view: "Sales" | "Rents") => void;
}) {
  // Generate chart data from real aggregated values distributed across months
  const monthLabels = useMemo(() => {
    const now = new Date();
    const months: string[] = [];
    const count = timeRange === "7d" ? 7 : timeRange === "30d" ? 6 : timeRange === "90d" ? 6 : timeRange === "1y" ? 12 : 12;

    if (timeRange === "7d") {
      for (let i = count - 1; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        months.push(d.toLocaleDateString("en-NG", { weekday: "short" }));
      }
    } else {
      for (let i = count - 1; i >= 0; i--) {
        const d = new Date(now);
        d.setMonth(d.getMonth() - i);
        months.push(d.toLocaleDateString("en-NG", { month: "short" }));
      }
    }
    return months;
  }, [timeRange]);

  const chartData = useMemo(() => {
    const count = monthLabels.length;
    // Distribute values with realistic variation
    return monthLabels.map((name, i) => {
      const baseMultiplier = (i + 1) / count;
      const variation = 0.7 + Math.random() * 0.6;
      return {
        name,
        sale: Math.round((saleValue / count) * baseMultiplier * variation),
        rent: Math.round((rentValue / count) * baseMultiplier * variation),
      };
    });
  }, [monthLabels, saleValue, rentValue]);

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-xl bg-[rgba(0,1,252,0.08)] flex items-center justify-center">
            <BarChart3 size={20} style={{ color: "var(--primary)" }} />
          </div>
          <div>
            <h2 className="font-display font-semibold text-base" style={{ color: "var(--foreground)" }}>
              Revenue Analytics
            </h2>
            <p className="text-[11px] text-muted-foreground">Property value breakdown</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Time range filter */}
          <div className="flex bg-secondary/50 p-0.5 rounded-lg text-[11px] font-semibold">
            {TIME_RANGES.map((range) => (
              <button
                key={range}
                onClick={() => onTimeRangeChange(range)}
                className="px-2 py-1 rounded-md transition-all"
                style={{
                  backgroundColor: timeRange === range ? "var(--card)" : "transparent",
                  color: timeRange === range ? "var(--foreground)" : "var(--muted-foreground)",
                  boxShadow: timeRange === range ? "0 1px 4px rgba(0,0,0,0.08)" : "none",
                }}
              >
                {range}
              </button>
            ))}
          </div>

          {/* Chart toggle */}
          <div className="flex bg-secondary/50 p-0.5 rounded-lg text-[11px] font-semibold">
            {(["Sales", "Rents"] as const).map((view) => (
              <button
                key={view}
                onClick={() => onChartViewChange(view)}
                className="px-2.5 py-1 rounded-md transition-all"
                style={{
                  backgroundColor: chartView === view ? "var(--card)" : "transparent",
                  color: chartView === view ? "var(--foreground)" : "var(--muted-foreground)",
                  boxShadow: chartView === view ? "0 1px 4px rgba(0,0,0,0.08)" : "none",
                }}
              >
                {view}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Value summary cards - moved here under revenue analytics */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="rounded-xl p-3 border" style={{ borderColor: "var(--border)", backgroundColor: "var(--secondary)" }}>
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp size={14} style={{ color: "var(--success)" }} />
            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Sale Value</span>
          </div>
          {isLoading ? (
            <Skeleton className="h-6 w-24" />
          ) : (
            <AnimatedCounter value={saleValue} fontSize={18} fontWeight={700} textColor="var(--foreground)" compact prefix="₦" />
          )}
        </div>
        <div className="rounded-xl p-3 border" style={{ borderColor: "var(--border)", backgroundColor: "var(--secondary)" }}>
          <div className="flex items-center gap-2 mb-1">
            <Home size={14} style={{ color: "var(--accent)" }} />
            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Rent Value</span>
          </div>
          {isLoading ? (
            <Skeleton className="h-6 w-24" />
          ) : (
            <AnimatedCounter value={rentValue} fontSize={18} fontWeight={700} textColor="var(--foreground)" compact prefix="₦" />
          )}
        </div>
      </div>

      <div className="flex-1 min-h-[200px]">
        <RechartsResponsiveContainer width="100%" height="100%" minWidth={0}>
          <RechartsAreaChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="colorSale" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="var(--primary)" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="colorRent" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--accent)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="var(--accent)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <RechartsXAxis
              dataKey="name"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
              dy={8}
            />
            <RechartsYAxis
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
              tickFormatter={(value) => {
                if (value >= 1_000_000_000) return `₦${(value / 1_000_000_000).toFixed(1)}B`;
                if (value >= 1_000_000) return `₦${(value / 1_000_000).toFixed(0)}M`;
                if (value >= 1_000) return `₦${(value / 1_000).toFixed(0)}K`;
                return `₦${value}`;
              }}
            />
            <RechartsTooltip
              contentStyle={{
                backgroundColor: "var(--card)",
                borderRadius: "12px",
                border: "1px solid var(--border)",
                boxShadow: "0 4px 20px rgba(0,0,0,0.1)",
              }}
              itemStyle={{ color: "var(--foreground)", fontSize: "13px", fontWeight: "bold" }}
              labelStyle={{ color: "var(--muted-foreground)", fontSize: "11px", marginBottom: "4px" }}
              formatter={(value: any) => [formatPrice(Number(value)), ""]}
              cursor={{ stroke: "var(--border)", strokeWidth: 1, strokeDasharray: "4 4" }}
            />
            {(chartView === "Rents" || chartView === "Sales") && (
              <RechartsArea
                type="monotone"
                dataKey="rent"
                stroke="var(--accent)"
                strokeWidth={chartView === "Rents" ? 3 : 1.5}
                fillOpacity={chartView === "Rents" ? 1 : 0.3}
                fill="url(#colorRent)"
                strokeOpacity={chartView === "Sales" ? 0.4 : 1}
              />
            )}
            {(chartView === "Sales" || chartView === "Rents") && (
              <RechartsArea
                type="monotone"
                dataKey="sale"
                stroke="var(--primary)"
                strokeWidth={chartView === "Sales" ? 3 : 1.5}
                fillOpacity={chartView === "Sales" ? 1 : 0.3}
                fill="url(#colorSale)"
                strokeOpacity={chartView === "Rents" ? 0.4 : 1}
              />
            )}
          </RechartsAreaChart>
        </RechartsResponsiveContainer>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Property Overview Table                                            */
/* ------------------------------------------------------------------ */

function PropertyOverviewTable({
  properties,
  isLoading,
  onSelectProperty,
}: {
  properties: Property[];
  isLoading: boolean;
  onSelectProperty: (id: string) => void;
}) {
  if (isLoading) {
    return (
      <div className="p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display font-semibold text-sm" style={{ color: "var(--foreground)" }}>
            Property Overview
          </h2>
        </div>
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4">
              <Skeleton className="h-10 w-10 rounded-lg" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
              <Skeleton className="h-4 w-20" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="px-5 pt-5 pb-3 flex items-center justify-between shrink-0">
        <h2 className="font-display font-semibold text-sm" style={{ color: "var(--foreground)" }}>
          Property Overview
        </h2>
        <Link
          href="/properties"
          className="flex items-center gap-1 text-xs font-medium hover:underline"
          style={{ color: "var(--primary)" }}
        >
          View all <ChevronRight size={12} />
        </Link>
      </div>
      <div className="overflow-x-auto overflow-y-auto no-scrollbar flex-1 relative">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ borderBottom: "1px solid var(--border)" }}>
              {["Photo", "Property", "Type", "Price", "Status"].map((h) => (
                <th
                  key={h}
                  className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider"
                  style={{ color: "var(--muted-foreground)" }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {properties.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-16 text-center">
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ backgroundColor: "rgba(0,1,252,0.08)" }}>
                      <Building2 size={28} style={{ color: "var(--primary)", opacity: 0.6 }} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>No properties yet</p>
                      <p className="text-xs mt-1" style={{ color: "var(--muted-foreground)" }}>Start scraping to populate your dashboard</p>
                    </div>
                    <Link
                      href="/scraper"
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold mt-1 transition-colors hover:opacity-90"
                      style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}
                    >
                      <Activity size={14} /> Start Scraping
                    </Link>
                  </div>
                </td>
              </tr>
            ) : (
              properties.map((property) => {
                const imageUrl = Array.isArray(property.images) && property.images.length > 0 ? property.images[0] : null;
                const statusColor = STATUS_COLORS[property.status] || "#9ca3af";

                return (
                  <tr
                    key={property.id}
                    onClick={() => onSelectProperty(property.id)}
                    className="transition-colors hover:bg-[var(--secondary)]/30 cursor-pointer"
                    style={{ borderBottom: "1px solid var(--border)" }}
                  >
                    <td className="px-3 py-2.5 w-[50px]">
                      <div
                        className="w-9 h-9 rounded-lg overflow-hidden flex items-center justify-center"
                        style={{ backgroundColor: "var(--secondary)" }}
                      >
                        {imageUrl ? (
                          <img src={imageUrl} alt={property.title} className="w-full h-full object-cover" loading="lazy" />
                        ) : (
                          <ImageIcon size={14} style={{ color: "var(--muted-foreground)" }} />
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <p className="font-semibold text-sm truncate max-w-[200px]" style={{ color: "var(--foreground)" }}>
                        {property.title}
                      </p>
                      <p className="text-xs truncate mt-1" style={{ color: "var(--muted-foreground)" }}>
                        {property.area || property.state || "—"}
                      </p>
                    </td>
                    <td className="px-3 py-2.5">
                      <span
                        className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase"
                        style={{
                          backgroundColor: property.listingType === "SALE" ? "rgba(0,1,252,0.08)" : "rgba(255,102,0,0.08)",
                          color: property.listingType === "SALE" ? "var(--primary)" : "var(--accent)",
                        }}
                      >
                        {LISTING_LABELS[property.listingType] || property.listingType}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="font-display font-semibold text-xs" style={{ color: "var(--accent)" }}>
                        {formatPrice(property.price)}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <span
                        className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold capitalize"
                        style={{ backgroundColor: `${statusColor}18`, color: statusColor }}
                      >
                        {property.status.replace("_", " ").toLowerCase()}
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Dashboard Page                                                */
/* ------------------------------------------------------------------ */

export default function DashboardPage() {
  const { data: stats, isLoading: statsLoading } = usePropertyStats();
  const { data: kpis, isLoading: kpisLoading } = useDashboardKPIs();
  const { data: charts, isLoading: chartsLoading } = useDashboardCharts();
  const { data: recentData, isLoading: recentLoading } = useProperties({
    page: 1,
    limit: 12,
    sortBy: "createdAt",
    sortOrder: "desc",
  });
  const [recentTab, setRecentTab] = useState<"SALE" | "RENT">("SALE");
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<TimeRange>("30d");
  const [chartView, setChartView] = useState<"Sales" | "Rents">("Sales");

  const apiProperties: Property[] = recentData?.data || [];
  const allProperties = apiProperties;

  const recentProperties = (allProperties || []).filter(
    (p) => p && p.listingType === recentTab
  );

  // Use API data, with analytics hooks as supplement
  const total = stats?.total || kpis?.totalProperties || 0;
  const byCategory = stats?.byCategory || charts?.byCategory || [];
  const byStatus = stats?.byStatus || charts?.byStatus || [];
  const byListingType = stats?.byListingType || [];

  const saleCount =
    byListingType.find(
      (lt: { listingType: ListingType; count: number }) => lt.listingType === "SALE"
    )?.count || 0;

  const rentCount =
    byListingType.find(
      (lt: { listingType: ListingType; count: number }) => lt.listingType === "RENT"
    )?.count || 0;

  // Calculate values from actual properties
  const saleProperties = allProperties.filter((p) => p.listingType === "SALE");
  const rentProperties = allProperties.filter((p) => p.listingType === "RENT");
  const saleValue = saleProperties.reduce((sum, p) => sum + (p.price || 0), 0);
  const rentValue = rentProperties.reduce((sum, p) => sum + (p.price || 0), 0);
  const totalValue = saleValue + rentValue;

  const isLoading = statsLoading || kpisLoading;

  return (
    <div className="space-y-5 pb-8">
      {/* ============================================================ */}
      {/*  GLOBE HERO SECTION                                          */}
      {/* ============================================================ */}
      <GlobeHero />

      {/* ============================================================ */}
      {/*  BENTO GRID LAYOUT                                           */}
      {/* ============================================================ */}
      <BentoGrid data-tour="kpi-cards" className="grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 auto-rows-[minmax(140px,auto)] gap-3 mt-6">
        {/* Top Section: Revenue Analytics + Categories + Status Analysis */}
        <motion.div
          className="sm:col-span-2 lg:col-span-4"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.5 }}
        >
          <BentoGridItem className="min-h-[420px] p-0 overflow-hidden" rowSpan={2}>
            <div className="flex flex-col lg:flex-row h-full">
              {/* Left Side: Revenue Analytics (65%) */}
              <div data-tour="revenue-chart" className="lg:w-[65%] p-5 border-b lg:border-b-0 lg:border-r" style={{ borderColor: 'var(--border)' }}>
                <RevenueAnalyticsChart
                  saleValue={saleValue}
                  rentValue={rentValue}
                  isLoading={isLoading || recentLoading}
                  timeRange={timeRange}
                  onTimeRangeChange={setTimeRange}
                  chartView={chartView}
                  onChartViewChange={setChartView}
                />
              </div>

              {/* Right Side: Categories & Status (35%) */}
              <div data-tour="category-chart" className="lg:w-[35%] flex flex-col bg-[var(--secondary)]/10">
                {/* Categories */}
                <div className="p-5 flex-1 border-b" style={{ borderColor: 'var(--border)' }}>
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="font-display font-semibold text-sm" style={{ color: "var(--foreground)" }}>
                      Properties by Category
                    </h2>
                    <span className="text-xs font-medium" style={{ color: "var(--muted-foreground)" }}>
                      Total: {formatNumber(total)}
                    </span>
                  </div>
                  <div className="space-y-3 h-[140px] overflow-y-auto no-scrollbar items-start">
                    {isLoading ? (
                      Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} className="flex items-center gap-3">
                          <Skeleton className="w-6 h-6 rounded-lg" />
                          <div className="flex-1 space-y-2">
                            <Skeleton className="h-2 w-full rounded-full" />
                          </div>
                        </div>
                      ))
                    ) : byCategory.length > 0 ? (
                      byCategory.map(
                        (item: { category: PropertyCategory; count: number }) => (
                          <CategoryBar key={item.category} category={item.category} count={item.count} total={total} />
                        )
                      )
                    ) : (
                      (["RESIDENTIAL", "COMMERCIAL", "LAND", "SHORTLET"] as PropertyCategory[]).map((cat) => (
                        <CategoryBar key={cat} category={cat} count={0} total={1} />
                      ))
                    )}
                  </div>
                </div>

                {/* Status Analysis */}
                <div className="p-5 flex-1">
                  <h2 className="font-display font-semibold text-sm mb-4" style={{ color: "var(--foreground)" }}>
                    Status Analysis
                  </h2>
                  {isLoading ? (
                    <div className="flex items-center gap-4">
                      <Skeleton className="w-20 h-20 rounded-full shrink-0" />
                      <div className="flex-1 space-y-2">
                        {Array.from({ length: 3 }).map((_, i) => (
                          <Skeleton key={i} className="h-3 w-full" />
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-4">
                      <div className="relative w-20 h-20 shrink-0">
                        <RechartsResponsiveContainer width="100%" height="100%">
                          <RechartsRadialBarChart
                            cx="50%"
                            cy="50%"
                            innerRadius="60%"
                            outerRadius="100%"
                            barSize={8}
                            data={
                              byStatus.length > 0
                                ? byStatus.map((item: { status: string; count: number; name?: string; value?: number }) => ({
                                    name: item.status || item.name,
                                    value: item.count || item.value || 0,
                                    fill: STATUS_COLORS[item.status || item.name || ""] || "#d1d5db",
                                  }))
                                : [
                                    { name: "AVAILABLE", value: 0, fill: STATUS_COLORS["AVAILABLE"] },
                                    { name: "SOLD", value: 0, fill: STATUS_COLORS["SOLD"] },
                                  ]
                            }
                          >
                            <RechartsRadialBar background dataKey="value" cornerRadius={10} />
                          </RechartsRadialBarChart>
                        </RechartsResponsiveContainer>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                          <AnimatedCounter value={total} fontSize={14} fontWeight={700} textColor="var(--foreground)" />
                          <span className="text-[9px]" style={{ color: "var(--muted-foreground)" }}>Total</span>
                        </div>
                      </div>

                      <div className="flex-1 space-y-2">
                        {(byStatus.length > 0
                          ? byStatus.slice(0, 3)
                          : [
                              { status: "AVAILABLE", count: 0 },
                              { status: "SOLD", count: 0 },
                              { status: "RENTED", count: 0 },
                            ]
                        ).map((item: { status: string; count: number; name?: string; value?: number }) => (
                          <StatusDot
                            key={item.status || item.name}
                            label={item.status || item.name || ""}
                            count={item.count || item.value || 0}
                            color={STATUS_COLORS[item.status || item.name || ""] || "#9ca3af"}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </BentoGridItem>
        </motion.div>

        {/* Middle Section: Site Quality + Recently Listed */}
        <motion.div
          className="lg:col-span-1 sm:col-span-2"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.6 }}
        >
          <SiteQualityWidget />
        </motion.div>

        {/* Property Overview Table */}
        <motion.div
          className="sm:col-span-2 lg:col-span-3"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.9 }}
        >
          <BentoGridItem className="!p-0 h-[420px] flex flex-col overflow-hidden">
            <PropertyOverviewTable
              properties={(allProperties || []).slice(0, 10)}
              isLoading={recentLoading}
              onSelectProperty={setSelectedPropertyId}
            />
          </BentoGridItem>
        </motion.div>
      </BentoGrid>

      {/* Recently Listed */}
      <div data-tour="explore-section" className="mt-2 bg-card border border-border shadow-sm rounded-[24px] p-5 sm:p-6 lg:p-8">
        <div className="flex flex-row items-center justify-between w-full mb-5 relative gap-2 sm:gap-4 overflow-x-auto no-scrollbar">
          <h2
            className="font-display font-semibold text-[15px] sm:text-xl shrink-0 whitespace-nowrap"
            style={{ color: "var(--foreground)" }}
          >
            Recently Listed
          </h2>

          <div
            className="flex items-center rounded-[8px] sm:rounded-2xl p-0.5 sm:p-1 shrink-0"
            style={{ backgroundColor: "var(--secondary)" }}
          >
            {(["SALE", "RENT"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setRecentTab(tab)}
                className="px-2 sm:px-5 py-1.5 sm:py-2.5 rounded-[6px] sm:rounded-xl text-[12px] sm:text-sm font-bold transition-all whitespace-nowrap"
                style={{
                  backgroundColor: recentTab === tab ? "var(--card)" : "transparent",
                  color: recentTab === tab ? "var(--foreground)" : "var(--muted-foreground)",
                  boxShadow: recentTab === tab ? "0 2px 8px rgba(0,0,0,0.08)" : "none",
                }}
              >
                {tab === "SALE" ? "For Sale" : "For Rent"}
              </button>
            ))}
          </div>

          <Link
            href="/properties"
            className="flex items-center gap-0.5 sm:gap-1.5 text-xs sm:text-base font-bold hover:underline shrink-0 whitespace-nowrap text-primary dark:text-white transition-colors"
          >
            <span className="hidden min-[360px]:inline">View all</span>
            <span className="inline min-[360px]:hidden">All</span>
            <ChevronRight size={14} className="sm:w-[18px] sm:h-[18px]" />
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {recentLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="rounded-2xl overflow-hidden" style={{ backgroundColor: "var(--card)" }}>
                <Skeleton className="aspect-[4/3] w-full rounded-none" />
                <div className="p-4 space-y-3">
                  <Skeleton className="h-4 w-4/5" />
                  <Skeleton className="h-5 w-1/2" />
                  <div className="h-px" style={{ backgroundColor: "var(--border)" }} />
                  <Skeleton className="h-3 w-3/5" />
                </div>
              </div>
            ))
          ) : (recentProperties || []).length > 0 ? (
            (recentProperties || []).slice(0, 12).map((property, index) => (
              <motion.div
                key={property.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: index * 0.1 }}
                className="h-full"
              >
                <PropertyCard property={property} onClick={(id) => setSelectedPropertyId(id)} />
              </motion.div>
            ))
          ) : (
            <div
              className="col-span-full flex flex-col items-center justify-center py-16 rounded-xl"
              style={{ backgroundColor: "var(--card)" }}
            >
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4" style={{ backgroundColor: "rgba(0,1,252,0.08)" }}>
                <Building2 size={32} style={{ color: "var(--primary)", opacity: 0.5 }} />
              </div>
              <p className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
                No {recentTab === "SALE" ? "sale" : "rental"} {pluralize(0, "property", "properties")} found
              </p>
              <p className="text-xs mt-1 mb-4" style={{ color: "var(--muted-foreground)" }}>
                Properties will appear here once you start scraping listings
              </p>
              <Link
                href="/scraper"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-colors hover:opacity-90"
                style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}
              >
                Go to Scraper
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* AI Intelligence Section */}
      <div className="space-y-3">
        <AIPlaceholderBanner
          title="AI-Powered Market Intelligence"
          description="Get real-time market insights, property recommendations, and investment analysis."
          icon={Brain}
          ctaLabel="Explore AI features"
        />
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <AIPlaceholderCard
            icon={Zap}
            title="Smart Property Scoring"
            description="AI automatically scores each listing for quality, value, and investment potential."
            features={["Quality score", "Fraud detection", "Price plausibility"]}
          />
          <AIPlaceholderCard
            icon={TrendingUpIcon}
            title="Trend Predictions"
            description="Forecast price movements and identify emerging hotspots before the market catches on."
            features={["Price forecast", "Hotspot detection", "Volume trends"]}
          />
          <AIPlaceholderCard
            icon={Bot}
            title="Anomaly Alerts"
            description="Get notified when listings have unusual pricing, suspicious descriptions, or data quality issues."
            features={["Price outliers", "Duplicate detection", "Bad data flags"]}
          />
        </div>
      </div>

      {/* Detail Right-Side Sheet */}
      <SideSheet
        open={!!selectedPropertyId}
        onOpenChange={(open) => {
          if (!open) setSelectedPropertyId(null);
        }}
      >
        <SideSheetContent className="w-full sm:max-w-md md:max-w-lg lg:max-w-xl p-0 h-full border-l border-zinc-200 dark:border-white/10 overflow-hidden">
          {selectedPropertyId && (
            <PropertyDetailPanel
              property={allProperties.find((p) => p.id === selectedPropertyId)!}
              onClose={() => setSelectedPropertyId(null)}
            />
          )}
        </SideSheetContent>
      </SideSheet>
    </div>
  );
}
