"use client";

import { useState } from "react";
import { usePropertyStats, useProperties } from "@/hooks/useProperties";
import { PropertyCard } from "@/components/property/property-card";
import { formatNumber, formatPrice, pluralize } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import AnimatedCounter from "@/components/ui/animated-counter";
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
} from "lucide-react";
import Link from "next/link";
import { MOCK_PROPERTIES } from "@/lib/mock-data";
import { motion } from "motion/react";
import TextType from "@/components/ui/TextType";
import { SideSheet, SideSheetContent } from "@/components/ui/side-sheet";
import { PropertyDetailPanel } from "@/components/property/property-detail-panel";
import type { Property, PropertyCategory, ListingType } from "@/types/property";

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const CATEGORY_ICONS: Record<PropertyCategory, React.ElementType> = {
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
  icon: React.ElementType;
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
    <div
      className="rounded-xl p-5 shadow-sm transition-all hover:shadow-md"
      style={{ backgroundColor: "var(--card)" }}
    >
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

      {/* Trend + sparkline */}
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
/*  Value Card (compact)                                               */
/* ------------------------------------------------------------------ */

function ValueCard({
  label,
  value,
  icon: Icon,
  iconColor,
  isLoading,
}: {
  label: string;
  value: number;
  icon: React.ElementType;
  iconColor: string;
  isLoading?: boolean;
}) {
  return (
    <div
      className="rounded-xl p-4 shadow-sm transition-all hover:shadow-md"
      style={{ backgroundColor: "var(--card)" }}
    >
      <div className="flex items-center gap-3 mb-3">
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
          style={{ backgroundColor: `${iconColor}14` }}
        >
          <Icon size={16} style={{ color: iconColor }} />
        </div>
        <p
          className="text-xs font-medium uppercase tracking-wider"
          style={{ color: "var(--muted-foreground)" }}
        >
          {label}
        </p>
      </div>
      {isLoading ? (
        <Skeleton className="h-7 w-28" />
      ) : (
        <AnimatedCounter
          value={value}
          fontSize={20}
          fontWeight={700}
          textColor="var(--foreground)"
          compact
          prefix="₦"
        />
      )}
      <div className="mt-2">
        <SparklineBars color={iconColor} opacity={0.1} />
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
/*  Properties Stats Chart (placeholder SVG bar chart)                 */
/* ------------------------------------------------------------------ */

function PropertiesStatsChart() {
  const years = ["2021", "2022", "2023", "2024", "2025", "2026"];
  const saleData = [30, 45, 60, 55, 70, 85];
  const rentData = [20, 35, 40, 50, 55, 60];
  const maxVal = 100;
  const barWidth = 16;
  const gap = 6;
  const chartHeight = 160;
  const groupWidth = barWidth * 2 + gap;

  return (
    <div
      className="rounded-xl p-6 shadow-sm"
      style={{ backgroundColor: "var(--card)" }}
    >
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <BarChart3 size={16} style={{ color: "var(--primary)" }} />
          <h2
            className="font-display font-semibold text-sm"
            style={{ color: "var(--foreground)" }}
          >
            Properties Stats
          </h2>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <div
              className="w-2.5 h-2.5 rounded-full"
              style={{ backgroundColor: "var(--primary)" }}
            />
            <span className="text-[11px]" style={{ color: "var(--muted-foreground)" }}>
              All
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <div
              className="w-2.5 h-2.5 rounded-full"
              style={{ backgroundColor: "var(--success)" }}
            />
            <span className="text-[11px]" style={{ color: "var(--muted-foreground)" }}>
              For Sale
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <div
              className="w-2.5 h-2.5 rounded-full"
              style={{ backgroundColor: "var(--accent)" }}
            />
            <span className="text-[11px]" style={{ color: "var(--muted-foreground)" }}>
              For Rent
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-end justify-between" style={{ height: chartHeight }}>
        {years.map((year, idx) => {
          const saleH = (saleData[idx] / maxVal) * chartHeight;
          const rentH = (rentData[idx] / maxVal) * chartHeight;
          return (
            <div key={year} className="flex flex-col items-center gap-2">
              <div className="flex items-end" style={{ gap, height: chartHeight }}>
                <div
                  className="rounded-t"
                  style={{
                    width: barWidth,
                    height: saleH,
                    backgroundColor: "var(--primary)",
                    opacity: 0.85,
                  }}
                />
                <div
                  className="rounded-t"
                  style={{
                    width: barWidth,
                    height: rentH,
                    backgroundColor: "var(--accent)",
                    opacity: 0.7,
                  }}
                />
              </div>
              <span
                className="text-[10px] font-medium"
                style={{ color: "var(--muted-foreground)" }}
              >
                {year}
              </span>
            </div>
          );
        })}
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
}: {
  properties: Property[];
  isLoading: boolean;
}) {
  if (isLoading) {
    return (
      <div
        className="rounded-xl shadow-sm overflow-hidden"
        style={{ backgroundColor: "var(--card)" }}
      >
        <div className="p-6">
          <h2
            className="font-display font-semibold text-sm mb-4"
            style={{ color: "var(--foreground)" }}
          >
            Property Overview
          </h2>
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
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
      </div>
    );
  }

  return (
    <div
      className="rounded-xl shadow-sm overflow-hidden"
      style={{ backgroundColor: "var(--card)" }}
    >
      <div className="p-6 pb-3">
        <div className="flex items-center justify-between">
          <h2
            className="font-display font-semibold text-sm"
            style={{ color: "var(--foreground)" }}
          >
            Property Overview
          </h2>
          <Link
            href="/properties"
            className="flex items-center gap-1 text-xs font-medium hover:underline"
            style={{ color: "var(--primary)" }}
          >
            View all
            <ChevronRight size={12} />
          </Link>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ borderBottom: "1px solid var(--border)" }}>
              {["Photo", "Property", "Type", "Price", "Date", "Status"].map((h) => (
                <th
                  key={h}
                  className="px-6 py-3 text-left text-[11px] font-semibold uppercase tracking-wider"
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
                <td
                  colSpan={6}
                  className="px-6 py-12 text-center text-sm"
                  style={{ color: "var(--muted-foreground)" }}
                >
                  No properties found
                </td>
              </tr>
            ) : (
              properties.map((property) => {
                const imageUrl =
                  Array.isArray(property.images) && property.images.length > 0
                    ? property.images[0]
                    : null;
                const statusColor = STATUS_COLORS[property.status] || "#9ca3af";
                const createdDate = property.createdAt && !isNaN(new Date(property.createdAt).getTime())
                  ? new Date(property.createdAt).toLocaleDateString("en-NG", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })
                  : "Recently";

                return (
                  <tr
                    key={property.id}
                    className="transition-colors hover:bg-[var(--secondary)]/30 cursor-pointer"
                    style={{ borderBottom: "1px solid var(--border)" }}
                  >
                    {/* Photo */}
                    <td className="px-6 py-3">
                      <div
                        className="w-10 h-10 rounded-lg overflow-hidden flex items-center justify-center"
                        style={{ backgroundColor: "var(--secondary)" }}
                      >
                        {imageUrl ? (
                          <img
                            src={imageUrl}
                            alt={property.title}
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <ImageIcon
                            size={16}
                            style={{ color: "var(--muted-foreground)" }}
                          />
                        )}
                      </div>
                    </td>

                    {/* Property name */}
                    <td className="px-6 py-3 max-w-[200px]">
                      <p
                        className="font-medium text-sm truncate"
                        style={{ color: "var(--foreground)" }}
                      >
                        {property.title}
                      </p>
                      <p
                        className="text-xs truncate mt-0.5"
                        style={{ color: "var(--muted-foreground)" }}
                      >
                        {property.area || property.state || "—"}
                      </p>
                    </td>

                    {/* Type */}
                    <td className="px-6 py-3">
                      <span
                        className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold uppercase"
                        style={{
                          backgroundColor:
                            property.listingType === "SALE"
                              ? "rgba(0,1,252,0.08)"
                              : "rgba(255,102,0,0.08)",
                          color:
                            property.listingType === "SALE"
                              ? "var(--primary)"
                              : "var(--accent)",
                        }}
                      >
                        {LISTING_LABELS[property.listingType] || property.listingType}
                      </span>
                    </td>

                    {/* Price */}
                    <td className="px-6 py-3">
                      <span
                        className="font-display font-semibold text-sm"
                        style={{ color: "var(--accent)" }}
                      >
                        {formatPrice(property.price)}
                      </span>
                    </td>

                    {/* Date */}
                    <td className="px-6 py-3">
                      <span
                        className="text-xs"
                        style={{ color: "var(--muted-foreground)" }}
                      >
                        {createdDate}
                      </span>
                    </td>

                    {/* Status badge */}
                    <td className="px-6 py-3">
                      <span
                        className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold capitalize"
                        style={{
                          backgroundColor: `${statusColor}18`,
                          color: statusColor,
                        }}
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
  const { data: recentData, isLoading: recentLoading } = useProperties({
    page: 1,
    limit: 10,
    sortBy: "createdAt",
    sortOrder: "desc",
  });
  const [recentTab, setRecentTab] = useState<"SALE" | "RENT">("SALE");
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(null);
  const [typingDone, setTypingDone] = useState(false);

  const apiProperties: Property[] = recentData?.data || [];
  
  // MERGE API Data with MOCK Data for demonstration if API is empty
  const allProperties = apiProperties.length > 0 ? apiProperties : MOCK_PROPERTIES;

  const recentProperties = (allProperties || []).filter(
    (p) => p && p.listingType === recentTab
  );

  const total = stats?.total || (apiProperties.length === 0 ? MOCK_PROPERTIES.length : 0);
  const byCategory = stats?.byCategory || [];
  const byStatus = stats?.byStatus || [];
  const byListingType = stats?.byListingType || [];

  const saleCount =
    byListingType.find(
      (lt: { listingType: ListingType; count: number }) => lt.listingType === "SALE"
    )?.count || MOCK_PROPERTIES.filter(p => p.listingType === "SALE").length;
    
  const rentCount =
    byListingType.find(
      (lt: { listingType: ListingType; count: number }) => lt.listingType === "RENT"
    )?.count || MOCK_PROPERTIES.filter(p => p.listingType === "RENT").length;

  // Estimate total value from recent properties (placeholder — API could return this)
  const saleProperties = allProperties.filter((p) => p.listingType === "SALE");
  const rentProperties = allProperties.filter((p) => p.listingType === "RENT");
  const saleValue = saleProperties.reduce((sum, p) => sum + (p.price || 0), 0);
  const rentValue = rentProperties.reduce((sum, p) => sum + (p.price || 0), 0);
  const totalValue = saleValue + rentValue;

  // Greeter logic
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good Morning" : hour < 18 ? "Good Afternoon" : "Good Evening";
  const dateOptions: Intl.DateTimeFormatOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
  const formattedDate = new Date().toLocaleDateString('en-US', dateOptions);

  return (
    <div className="space-y-6">
      {/* Greeter Section */}
      <div className="flex flex-col gap-1.5 mb-8">
        <h1 
          className="font-display text-2xl sm:text-[28px] font-bold tracking-tight min-h-[36px] sm:min-h-[42px]"
          style={{ color: "var(--foreground)" }}
        >
          <TextType
            text={[`${greeting}, David`]}
            typingSpeed={75}
            pauseDuration={1500}
            showCursor
            cursorCharacter="|"
            deletingSpeed={50}
            variableSpeedEnabled={true}
            variableSpeedMin={50}
            variableSpeedMax={100}
            cursorBlinkDuration={0.8}
            loop={false}
            initialDelay={500}
            onComplete={() => setTypingDone(true)}
          />
        </h1>
        <motion.div 
          className="flex items-center gap-1.5 text-sm" 
          style={{ color: "var(--muted-foreground)" }}
          initial={{ opacity: 0, y: 10 }}
          animate={typingDone ? { opacity: 1, y: 0 } : { opacity: 0, y: 10 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        >
          <Calendar size={15} />
          <p className="font-medium">{formattedDate}</p>
        </motion.div>
      </div>
      
      {/* Header */}
      <motion.div 
        className="flex items-center justify-between flex-wrap gap-4 mt-2"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
      >
        <div>
          <h1
            className="text-2xl font-display font-bold"
            style={{ color: "var(--foreground)" }}
          >
            Dashboard Overview
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--muted-foreground)" }}>
            Your property intelligence at a glance
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/properties"
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-white transition-opacity hover:opacity-90"
            style={{ backgroundColor: "var(--primary)" }}
          >
            <Building2 size={16} />
            View Properties
          </Link>
        </div>
      </motion.div>

      {/* KPI Cards */}
      <div data-tour="kpi-cards" className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {[
          {
            label: "Total Properties",
            value: total,
            icon: Building2,
            trend: 12,
            trendLabel: "Last month",
            iconBg: "rgba(0, 1, 252, 0.08)",
            iconColor: "var(--primary)",
            isLoading: statsLoading,
          },
          {
            label: "Properties for Sale",
            value: saleCount,
            icon: TrendingUp,
            trend: 8,
            trendLabel: "vs last month",
            iconBg: "rgba(10, 105, 6, 0.08)",
            iconColor: "var(--success)",
            isLoading: statsLoading,
          },
          {
            label: "Properties for Rent",
            value: rentCount,
            icon: Home,
            trend: 5,
            trendLabel: "vs last month",
            iconBg: "rgba(255, 102, 0, 0.08)",
            iconColor: "var(--accent)",
            isLoading: statsLoading,
          },
          {
            label: "Total Value",
            value: totalValue,
            icon: DollarSign,
            trend: 15,
            trendLabel: "Portfolio growth",
            iconBg: "rgba(139, 92, 246, 0.08)",
            iconColor: "#8b5cf6",
            isLoading: statsLoading || recentLoading,
            prefix: "₦",
            compact: true,
          }
        ].map((card, idx) => (
          <motion.div
            key={card.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 + idx * 0.1 }}
          >
            <KpiCard {...card} />
          </motion.div>
        ))}
      </div>

      {/* Properties Stats Chart + Value Cards */}
      <motion.div 
        className="grid grid-cols-1 lg:grid-cols-3 gap-5"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.6 }}
      >
        <div className="lg:col-span-2">
          <PropertiesStatsChart />
        </div>
        <div className="grid grid-rows-2 gap-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.7 }}
          >
            <ValueCard
              label="Properties for Sale Value"
              value={saleValue}
              icon={TrendingUp}
              iconColor="var(--success)"
              isLoading={statsLoading || recentLoading}
            />
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.8 }}
          >
            <ValueCard
              label="Properties for Rent Value"
              value={rentValue}
              icon={Home}
              iconColor="var(--accent)"
              isLoading={statsLoading || recentLoading}
            />
          </motion.div>
        </div>
      </motion.div>

      {/* Charts row: Category + Status */}
      <motion.div 
        className="grid grid-cols-1 lg:grid-cols-2 gap-5"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.8 }}
      >
        {/* Category Distribution */}
        <div
          data-tour="category-chart"
          className="rounded-xl p-6 shadow-sm"
          style={{ backgroundColor: "var(--card)" }}
        >
          <div className="flex items-center justify-between mb-5">
            <h2
              className="font-display font-semibold text-sm"
              style={{ color: "var(--foreground)" }}
            >
              Properties by Category
            </h2>
            <span
              className="text-xs font-medium"
              style={{ color: "var(--muted-foreground)" }}
            >
              Total: {formatNumber(total)} {pluralize(total, "property", "properties")}
            </span>
          </div>
          <div className="space-y-4">
            {statsLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="w-8 h-8 rounded-lg" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-3 w-1/3" />
                    <Skeleton className="h-2 w-full rounded-full" />
                  </div>
                </div>
              ))
            ) : byCategory.length > 0 ? (
              byCategory.map(
                (item: { category: PropertyCategory; count: number }) => (
                  <CategoryBar
                    key={item.category}
                    category={item.category}
                    count={item.count}
                    total={total}
                  />
                )
              )
            ) : (
              (
                [
                  "RESIDENTIAL",
                  "COMMERCIAL",
                  "LAND",
                  "SHORTLET",
                  "INDUSTRIAL",
                ] as PropertyCategory[]
              ).map((cat) => (
                <CategoryBar key={cat} category={cat} count={0} total={1} />
              ))
            )}
          </div>
        </div>

        {/* Status Overview (donut chart) */}
        <div
          className="rounded-xl p-6 shadow-sm"
          style={{ backgroundColor: "var(--card)" }}
        >
          <div className="flex items-center justify-between mb-5">
            <h2
              className="font-display font-semibold text-sm"
              style={{ color: "var(--foreground)" }}
            >
              Status Analysis
            </h2>
          </div>

          {statsLoading ? (
            <div className="flex items-center gap-8">
              <Skeleton className="w-36 h-36 rounded-full shrink-0" />
              <div className="flex-1 space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-4 w-full" />
                ))}
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-8">
              <div className="relative w-36 h-36 shrink-0">
                <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                  {(() => {
                    let offset = 0;
                    const items =
                      byStatus.length > 0
                        ? byStatus
                        : [
                            { status: "AVAILABLE", count: 70 },
                            { status: "SOLD", count: 15 },
                            { status: "RENTED", count: 10 },
                            { status: "WITHDRAWN", count: 5 },
                          ];
                    const statusTotal =
                      items.reduce(
                        (s: number, i: { count: number }) => s + i.count,
                        0
                      ) || 1;

                    return items.map(
                      (item: { status: string; count: number }) => {
                        const pct = (item.count / statusTotal) * 100;
                        const circumference = 2 * Math.PI * 40;
                        const dashArray = `${(pct / 100) * circumference} ${circumference}`;
                        const dashOffset =
                          -(offset / 100) * circumference;
                        const delay = (item.count / statusTotal) * 0.5; // Stagger slightly based on size
                        const currentOffset = offset;
                        offset += pct;

                        return (
                          <motion.circle
                            key={item.status}
                            cx="50"
                            cy="50"
                            r="40"
                            fill="none"
                            stroke={
                              STATUS_COLORS[item.status] || "#d1d5db"
                            }
                            strokeWidth="14"
                            strokeDasharray={dashArray}
                            initial={{ strokeDashoffset: circumference }}
                            whileInView={{ strokeDashoffset: dashOffset }}
                            viewport={{ once: true }}
                            transition={{ duration: 1.5, ease: "easeOut", delay: currentOffset * 0.01 }}
                            strokeLinecap="round"
                          />
                        );
                      }
                    );
                  })()}
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <AnimatedCounter
                    value={total}
                    fontSize={20}
                    fontWeight={700}
                    textColor="var(--foreground)"
                  />
                  <span
                    className="text-[10px]"
                    style={{ color: "var(--muted-foreground)" }}
                  >
                    Total
                  </span>
                </div>
              </div>

              <div className="flex-1 space-y-3">
                {(byStatus.length > 0
                  ? byStatus
                  : [
                      { status: "AVAILABLE", count: 0 },
                      { status: "SOLD", count: 0 },
                      { status: "RENTED", count: 0 },
                      { status: "UNDER_OFFER", count: 0 },
                    ]
                ).map((item: { status: string; count: number }) => (
                  <StatusDot
                    key={item.status}
                    label={item.status}
                    count={item.count}
                    color={STATUS_COLORS[item.status] || "#9ca3af"}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </motion.div>

      {/* Property Overview Table */}
      <PropertyOverviewTable
        properties={(allProperties || []).slice(0, 10)}
        isLoading={recentLoading}
      />

      {/* Recently Listed */}
      <div data-tour="explore-section">
        <div className="flex flex-row items-center justify-between w-full mb-6 relative gap-2 sm:gap-4 overflow-x-auto no-scrollbar">
          <h2
            className="font-display font-semibold text-[15px] sm:text-xl shrink-0 whitespace-nowrap"
            style={{ color: "var(--foreground)" }}
          >
            Recently Listed
          </h2>
          
          {/* Tabs - Flow on all sizes to prevent overlap */}
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
                  backgroundColor:
                    recentTab === tab ? "var(--card)" : "transparent",
                  color:
                    recentTab === tab
                      ? "var(--foreground)"
                      : "var(--muted-foreground)",
                  boxShadow:
                    recentTab === tab
                      ? "0 2px 8px rgba(0,0,0,0.08)"
                      : "none",
                }}
              >
                {tab === "SALE" ? "For Sale" : "For Rent"}
              </button>
            ))}
          </div>

          <Link
            href="/properties"
            className="flex items-center gap-0.5 sm:gap-1.5 text-xs sm:text-base font-bold hover:underline shrink-0 whitespace-nowrap"
            style={{ color: "#0000ee" }}
          >
            <span className="hidden min-[360px]:inline">View all</span>
            <span className="inline min-[360px]:hidden">All</span>
            <ChevronRight size={14} className="sm:w-[18px] sm:h-[18px]" />
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {recentLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="rounded-2xl overflow-hidden"
                style={{ backgroundColor: "var(--card)" }}
              >
                <Skeleton className="aspect-[4/3] w-full rounded-none" />
                <div className="p-4 space-y-3">
                  <Skeleton className="h-4 w-4/5" />
                  <Skeleton className="h-5 w-1/2" />
                  <div
                    className="h-px"
                    style={{ backgroundColor: "var(--border)" }}
                  />
                  <Skeleton className="h-3 w-3/5" />
                </div>
              </div>
            ))
          ) : (recentProperties || []).length > 0 ? (
            (recentProperties || [])
              .slice(0, 4)
              .map((property, index) => (
                <motion.div
                  key={property.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: index * 0.1 }}
                  className="h-full"
                >
                  <PropertyCard 
                    property={property} 
                    onClick={(id) => setSelectedPropertyId(id)}
                  />
                </motion.div>
              ))
          ) : (
            <div
              className="col-span-full flex flex-col items-center justify-center py-12 rounded-xl"
              style={{ backgroundColor: "var(--card)" }}
            >
              <Building2
                size={32}
                style={{ color: "var(--muted-foreground)" }}
                className="mb-2"
              />
              <p
                className="text-sm"
                style={{ color: "var(--muted-foreground)" }}
              >
                No {recentTab === "SALE" ? "sale" : "rental"}{" "}
                {pluralize(0, "property", "properties")} found
              </p>
            </div>
          )}
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
              property={allProperties.find(p => p.id === selectedPropertyId)!}
              onClose={() => setSelectedPropertyId(null)}
            />
          )}
        </SideSheetContent>
      </SideSheet>
    </div>
  );
}
