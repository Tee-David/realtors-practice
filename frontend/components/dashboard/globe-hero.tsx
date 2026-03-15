"use client";

import React, { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import dynamic from "next/dynamic";
import { motion } from "framer-motion";
import { useDashboardKPIs, useDashboardCharts, useSiteQualityRankings } from "@/hooks/use-analytics";
import { Activity, Building2, TrendingUp, Star, Globe2, Calendar, Home, Tag } from "lucide-react";
import TextType from "@/components/ui/TextType";

const Globe = dynamic(() => import("@/components/ui/globe"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex flex-col items-center justify-center opacity-50">
      <div className="w-32 h-32 rounded-full border-[2px] border-[#5227FF] border-t-transparent animate-spin ring-8 ring-[#5227FF]/10 mb-6" />
      <span className="text-xs text-[#5227FF] tracking-widest uppercase font-bold animate-pulse">Initializing...</span>
    </div>
  ),
});

// ─── Stat Card ──────────────────────────────────────────────────────────────

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  color,
  delay = 0,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  sub?: string;
  color: string;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 200, damping: 20, delay }}
      className="bg-secondary/50 dark:bg-[#0b0818] border border-[#5227FF]/15 rounded-2xl p-4 flex flex-col gap-2 relative overflow-hidden group hover:border-[#5227FF]/30 transition-colors"
    >
      <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700" style={{ backgroundImage: `linear-gradient(to right, transparent, ${color}, transparent)` }} />
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${color}15` }}>
          <Icon className="w-4 h-4" style={{ color }} />
        </div>
        <span className="text-foreground/50 dark:text-white/50 text-[10px] font-bold tracking-widest uppercase">{label}</span>
      </div>
      <div className="flex items-end justify-between">
        <span className="text-2xl sm:text-3xl font-bold text-foreground dark:text-white leading-none">{value}</span>
        {sub && <span className="text-xs text-foreground/40 dark:text-white/40 mb-0.5">{sub}</span>}
      </div>
    </motion.div>
  );
}

// ─── Site Quality Mini Bar ──────────────────────────────────────────────────

function SiteBar({ name, score, maxScore, delay }: { name: string; score: number; maxScore: number; delay: number }) {
  const pct = maxScore > 0 ? (score / maxScore) * 100 : 0;
  return (
    <div className="flex items-center text-[9px] mb-1.5">
      <span className="w-20 text-foreground/50 dark:text-white/50 truncate shrink-0">{name}</span>
      <div className="flex-1 h-1.5 bg-foreground/10 dark:bg-white/10 rounded-full overflow-hidden mr-2">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ delay, duration: 0.8, ease: "easeOut" }}
          className="h-full rounded-full bg-gradient-to-r from-[#5227FF] to-[#8b5cf6]"
        />
      </div>
      <span className="text-foreground/40 dark:text-white/40 tabular-nums w-6 text-right">{score}</span>
    </div>
  );
}

// ─── Category Breakdown Donut ───────────────────────────────────────────────

function CategoryBreakdown({ data }: { data: { category: string; count: number }[] }) {
  const total = data.reduce((s, d) => s + d.count, 0);
  if (total === 0) return null;
  const colors = ["#5227FF", "#8b5cf6", "#4ade80", "#facc15", "#f97316", "#ef4444"];
  const top4 = data.slice(0, 4);

  return (
    <div className="flex flex-col gap-1.5 mt-1">
      {top4.map((item, i) => {
        const pct = ((item.count / total) * 100).toFixed(0);
        return (
          <div key={item.category} className="flex items-center gap-2 text-[9px]">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: colors[i % colors.length] }} />
            <span className="text-foreground/60 dark:text-white/60 flex-1 truncate">{item.category}</span>
            <span className="text-foreground/40 dark:text-white/40 tabular-nums">{pct}%</span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Main Hero ──────────────────────────────────────────────────────────────

export function GlobeHero() {
  const { data: kpis } = useDashboardKPIs();
  const { data: charts } = useDashboardCharts();
  const { data: siteRankings } = useSiteQualityRankings();
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const [typingDone, setTypingDone] = useState(false);
  const [clientData, setClientData] = useState<{
    greeting: string;
    formattedDate: string;
    year: number;
    isMounted: boolean;
  }>({ greeting: "Hello", formattedDate: "", year: 2024, isMounted: false });

  // Real data
  const totalProperties = kpis?.totalProperties || 0;
  const newToday = kpis?.newPropertiesToday || 0;
  const qualityScore = kpis?.averageQualityScore || 0;
  const sources = kpis?.activeDataSources || 0;
  const forSale = kpis?.forSale || 0;
  const forRent = kpis?.forRent || 0;
  const avgPrice = charts?.avgPrice || 0;
  const topSites = siteRankings?.slice(0, 4) || [];
  const categories = charts?.byCategory || [];

  const formatNum = (n: number) => {
    if (n >= 1_000_000_000) return `₦${(n / 1_000_000_000).toFixed(1)}B`;
    if (n >= 1_000_000) return `₦${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `₦${(n / 1_000).toFixed(0)}K`;
    return n > 0 ? `₦${n.toLocaleString()}` : "—";
  };

  useEffect(() => {
    const hour = new Date().getHours();
    const greeting = hour < 12 ? "Good Morning" : hour < 18 ? "Good Afternoon" : "Good Evening";
    const dateOptions: Intl.DateTimeFormatOptions = { weekday: "long", year: "numeric", month: "long", day: "numeric" };
    setClientData({
      greeting,
      formattedDate: new Date().toLocaleDateString("en-US", dateOptions),
      year: new Date().getFullYear(),
      isMounted: true,
    });
  }, []);

  const containerVars: any = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.1, delayChildren: 0.3 } },
  };

  return (
    <div className="w-full bg-white dark:bg-[#03010b] rounded-[1.5rem] p-4 sm:p-5 my-4 sm:my-6 overflow-hidden relative shadow-2xl border border-[#5227FF]/10">

      {/* Top Meta Bar */}
      <div className="relative sm:absolute sm:top-5 sm:left-6 sm:right-6 flex items-center justify-between z-10 pointer-events-none mb-3 sm:mb-0">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse shrink-0" />
          <span className="text-[8px] sm:text-[10px] tracking-widest font-bold text-foreground/40 dark:text-white/50 uppercase truncate">Intelligence Engine</span>
          <span className="text-[8px] sm:text-[10px] tracking-widest font-bold text-green-500 uppercase shrink-0">Live</span>
        </div>
        <div className="hidden sm:flex gap-4">
          <div className="text-right">
            <span className="text-[10px] uppercase tracking-wider text-foreground/40 dark:text-white/40 block">Data Sources</span>
            <span className="text-xs font-mono text-foreground/80 dark:text-white/80">{sources} active</span>
          </div>
          <div className="text-right">
            <span className="text-[10px] uppercase tracking-wider text-foreground/40 dark:text-white/40 block">Quality</span>
            <span className="text-xs font-mono text-[#4ade80]">{qualityScore}%</span>
          </div>
        </div>
      </div>

      {/* Greeter */}
      <div className="relative sm:absolute sm:top-14 sm:left-6 z-10 flex flex-col gap-1.5 pointer-events-none mb-4 sm:mb-0">
        <h1 className="font-display text-xl sm:text-[28px] font-bold tracking-tight min-h-[32px] sm:min-h-[42px] text-foreground dark:text-white">
          {clientData.isMounted && (
            <TextType
              text={[`${clientData.greeting}, David`]}
              typingSpeed={75}
              pauseDuration={1500}
              showCursor={false}
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
          )}
        </h1>
        <motion.div
          className="flex items-center gap-1.5 text-sm text-foreground/60 dark:text-white/60 min-h-[20px]"
          initial={{ opacity: 0, y: 10 }}
          animate={typingDone && clientData.isMounted ? { opacity: 1, y: 0 } : { opacity: 0, y: 10 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        >
          {clientData.isMounted && (
            <>
              <Calendar size={15} />
              <p className="font-medium">{clientData.formattedDate}</p>
            </>
          )}
        </motion.div>
      </div>

      {/* Globe (desktop only) */}
      <motion.div
        initial={{ opacity: 0, x: -50 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 2, ease: "easeOut" }}
        className="hidden lg:block absolute -bottom-[45%] -left-[12%] w-[50%] h-[130%] pointer-events-none z-0"
      >
        <div className="absolute inset-0 flex items-center justify-center">
          <Globe
            rotateCities={["lagos", "london", "dubai", "new york"]}
            rotationSpeed={3000}
            markers={[
              { location: [6.5244, 3.3792], size: 0.12 },
              { location: [9.0579, 7.4951], size: 0.08 },
              { location: [51.5074, -0.1278], size: 0.06 },
              { location: [25.2048, 55.2708], size: 0.06 },
              { location: [40.7128, -74.006], size: 0.06 },
            ]}
            dark={1}
            diffuse={isDark ? 1.2 : 1.6}
            mapBrightness={isDark ? 6 : 4}
            baseColor={isDark ? [0.15, 0.08, 0.35] : [0.25, 0.25, 0.7]}
            glowColor={isDark ? [0.32, 0.15, 1] : [0.2, 0.1, 0.8]}
            markerColor={isDark ? [0.32, 0.15, 1] : [0, 0.004, 0.99]}
            className="w-full max-w-[650px] aspect-square"
          />
        </div>
      </motion.div>

      <div className="hidden sm:flex absolute bottom-5 left-6 lg:left-[28%] z-10 items-center gap-2 pointer-events-none">
        <Activity className="w-3.5 h-3.5 text-green-500 animate-pulse" />
        <span className="text-[10px] text-foreground/80 dark:text-white/80 uppercase tracking-widest font-mono font-semibold">Sensors Active</span>
      </div>

      {/* ── Stats Grid ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-5 min-h-0 lg:min-h-[520px] relative z-10">

        {/* Left space for globe */}
        <div className="lg:col-span-3 hidden lg:block" />

        {/* Right: Real Data Cards */}
        <motion.div
          className="lg:col-span-9 grid grid-cols-2 sm:grid-cols-2 gap-3 sm:gap-4 sm:mt-10 mb-4"
          variants={containerVars}
          initial="hidden"
          animate="visible"
        >
          {/* Card 1: Total Properties */}
          <StatCard
            icon={Building2}
            label="Total Properties"
            value={totalProperties.toLocaleString()}
            sub={`${forSale} sale · ${forRent} rent`}
            color="#5227FF"
            delay={0.3}
          />

          {/* Card 2: New Today */}
          <StatCard
            icon={TrendingUp}
            label="New Today"
            value={newToday}
            sub="properties added"
            color="#4ade80"
            delay={0.4}
          />

          {/* Card 3: Avg Price + Site Rankings */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 200, damping: 20, delay: 0.5 }}
            className="bg-secondary/50 dark:bg-[#0b0818] border border-[#5227FF]/15 rounded-2xl p-4 flex flex-col gap-2 relative overflow-hidden group hover:border-[#5227FF]/30 transition-colors"
          >
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-[#f9731615]">
                <Star className="w-4 h-4 text-[#f97316]" />
              </div>
              <span className="text-foreground/50 dark:text-white/50 text-[10px] font-bold tracking-widest uppercase">Top Sites</span>
            </div>
            <div className="flex items-end gap-2 mb-2">
              <span className="text-lg font-bold text-foreground dark:text-white leading-none">{formatNum(avgPrice)}</span>
              <span className="text-[10px] text-foreground/40 dark:text-white/40 mb-0.5">avg price</span>
            </div>
            <div className="flex-1">
              {topSites.length > 0 ? (
                topSites.map((site, i) => (
                  <SiteBar
                    key={site.site.id}
                    name={site.site.name}
                    score={Math.round(site.score)}
                    maxScore={100}
                    delay={0.8 + i * 0.1}
                  />
                ))
              ) : (
                <p className="text-[10px] text-foreground/30 dark:text-white/30 italic">No site data yet</p>
              )}
            </div>
          </motion.div>

          {/* Card 4: Categories */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 200, damping: 20, delay: 0.6 }}
            className="bg-secondary/50 dark:bg-[#0b0818] border border-[#5227FF]/15 rounded-2xl p-4 flex flex-col gap-2 relative overflow-hidden group hover:border-[#5227FF]/30 transition-colors"
          >
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-[#8b5cf615]">
                <Tag className="w-4 h-4 text-[#8b5cf6]" />
              </div>
              <span className="text-foreground/50 dark:text-white/50 text-[10px] font-bold tracking-widest uppercase">Categories</span>
            </div>
            <div className="flex items-end gap-2 mb-1">
              <span className="text-lg font-bold text-foreground dark:text-white leading-none">{qualityScore}%</span>
              <span className="text-[10px] text-foreground/40 dark:text-white/40 mb-0.5">data quality</span>
            </div>
            {categories.length > 0 ? (
              <CategoryBreakdown data={categories} />
            ) : (
              <p className="text-[10px] text-foreground/30 dark:text-white/30 italic">No category data yet</p>
            )}
          </motion.div>
        </motion.div>
      </div>

      {/* Footer */}
      <div className="absolute bottom-0 left-4 right-4 h-[1px] bg-gradient-to-r from-transparent via-[#5227FF]/30 to-transparent" />
      <div className="absolute bottom-1 right-6 text-[8px] text-foreground/30 dark:text-white/30 uppercase tracking-widest font-mono">
        System Operational • v2.0.4 • {clientData.isMounted ? clientData.year : ""}
      </div>
    </div>
  );
}
