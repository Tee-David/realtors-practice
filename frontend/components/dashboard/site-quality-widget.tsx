"use client";

import { useState } from "react";
import { useSiteQualityRankings } from "@/hooks/use-analytics";
import { Skeleton } from "@/components/ui/skeleton";
import { Sparkles, ArrowUpRight, Activity, Database, CheckCircle2, Search } from "lucide-react";
import { motion } from "motion/react";

export function SiteQualityWidget() {
  const [searchQuery, setSearchQuery] = useState("");
  const { data: rankings, isLoading } = useSiteQualityRankings();

  if (isLoading) {
    return (
      <div className="rounded-2xl p-6 shadow-md border border-white/5 bg-card h-full min-h-[350px]">
        <div className="flex items-center gap-3 mb-6">
          <Skeleton className="w-10 h-10 rounded-xl" />
          <div className="space-y-2">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-3 w-48" />
          </div>
        </div>
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <div className="flex justify-between">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-8" />
              </div>
              <Skeleton className="h-2 w-full rounded-full" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const hasData = rankings && rankings.length > 0;

  return (
    <div className="rounded-2xl p-6 shadow-md border border-white/5 bg-card h-[420px] flex flex-col transition-all hover:shadow-lg relative overflow-hidden group">
      {/* Background glow effect */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-[50px] pointer-events-none transition-transform group-hover:scale-150 duration-700" />
      
      <div className="flex items-center justify-between mb-6 relative z-10 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20">
            <Sparkles size={18} className="text-primary" />
          </div>
          <div>
            <h2 className="font-display font-semibold text-lg text-foreground flex items-center gap-2">
              Source Intelligence
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">Real-time quality & freshness ranking</p>
          </div>
        </div>
        {hasData && (
          <div className="flex flex-col items-end gap-2">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-500/10 text-green-600 dark:text-green-400 text-[10px] uppercase font-bold tracking-wider">
              <Activity className="w-3 h-3" />
              Active
            </div>
          </div>
        )}
      </div>

      {hasData && (
        <div className="relative mb-4 z-10 shrink-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search sources..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-secondary/30 border border-border/50 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-primary/50 transition-all placeholder:text-muted-foreground/60"
          />
        </div>
      )}

      <div className="flex-1 overflow-y-auto pr-2 no-scrollbar relative z-10 space-y-5">
        {!hasData ? (
          <div className="h-full min-h-[200px] flex flex-col items-center justify-center text-center opacity-70">
            <Database className="w-10 h-10 text-muted-foreground mb-3" />
            <p className="text-sm font-medium text-foreground">Awaiting Source Data</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-[200px]">Data extraction engine has not indexed any sources yet.</p>
          </div>
        ) : (
          rankings.filter(r => r.site.name.toLowerCase().includes(searchQuery.toLowerCase())).map((ranking, idx) => {
            const isTop = idx === 0 && searchQuery === "";
            const scoreColor = ranking.score >= 80 ? 'bg-green-500' : ranking.score >= 50 ? 'bg-yellow-500' : 'bg-red-500';
            const scoreTextColor = ranking.score >= 80 ? 'text-green-600 dark:text-green-400' : ranking.score >= 50 ? 'text-yellow-600 dark:text-yellow-400' : 'text-red-500';

            return (
              <div key={ranking.site.id} className="group/item">
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    {ranking.site.logoUrl ? (
                      <img src={ranking.site.logoUrl} alt={ranking.site.name} className="w-5 h-5 rounded object-cover" />
                    ) : (
                      <div className="w-5 h-5 rounded bg-secondary flex items-center justify-center text-[9px] font-bold text-muted-foreground uppercase">
                        {ranking.site.name.substring(0, 2)}
                      </div>
                    )}
                    <span className="text-sm font-semibold text-foreground truncate max-w-[120px] sm:max-w-[150px]">
                      {ranking.site.name}
                    </span>
                    {isTop && (
                      <CheckCircle2 className="w-3.5 h-3.5 text-primary" />
                    )}
                  </div>
                  <div className={`flex items-center gap-1 text-xs font-bold ${scoreTextColor}`}>
                    {ranking.score}
                    <span className="text-[10px] text-muted-foreground font-medium">/ 100</span>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="h-2 w-full bg-secondary/50 rounded-full overflow-hidden mb-1.5 relative">
                  <motion.div
                    initial={{ width: 0 }}
                    whileInView={{ width: `${ranking.score}%` }}
                    viewport={{ once: true }}
                    transition={{ duration: 1, delay: idx * 0.1, ease: 'easeOut' }}
                    className={`h-full rounded-full ${scoreColor} shadow-[0_0_10px_rgba(0,0,0,0.2)]`}
                  />
                </div>

                {/* Sub-metrics */}
                <div className="flex items-center justify-between text-[10px] text-muted-foreground opacity-0 group-hover/item:opacity-100 transition-opacity">
                  <span className="flex items-center gap-1">
                    Freshness: <span className="font-semibold text-foreground">{ranking.metrics.freshnessPercent}%</span>
                  </span>
                  <span className="flex items-center gap-1">
                    Quality: <span className="font-semibold text-foreground">{ranking.metrics.avgQuality}</span>
                  </span>
                  <span className="flex items-center gap-1">
                    Vol: <span className="font-semibold text-foreground">{ranking.metrics.totalProperties}</span>
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
