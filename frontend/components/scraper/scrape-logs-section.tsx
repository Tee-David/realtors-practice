"use client";

import { useState, useMemo } from "react";
import { useScrapeLogs, useScrapeLogDetail, type ScrapeLogsFilters } from "@/hooks/use-scrape-logs";
import { useSites } from "@/hooks/use-sites";
import { format, formatDistanceToNow } from "date-fns";
import {
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Clock,
  AlertCircle,
  CheckCircle2,
  Info,
  Bug,
  X,
  Terminal,
  FileText,
  RefreshCcw,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { AdvancedDateRangePicker, type DateRange } from "@/components/ui/advanced-date-picker";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const LOG_LEVELS = ["INFO", "WARN", "ERROR", "DEBUG", "SUCCESS"] as const;

const levelConfig: Record<string, { color: string; bgColor: string; borderColor: string; icon: React.ReactNode }> = {
  ERROR: {
    color: "text-red-600 dark:text-red-400",
    bgColor: "bg-red-500/10",
    borderColor: "border-red-500/20",
    icon: <AlertCircle className="w-3.5 h-3.5" />,
  },
  WARN: {
    color: "text-yellow-600 dark:text-yellow-400",
    bgColor: "bg-yellow-500/10",
    borderColor: "border-yellow-500/20",
    icon: <AlertCircle className="w-3.5 h-3.5" />,
  },
  SUCCESS: {
    color: "text-green-600 dark:text-green-400",
    bgColor: "bg-green-500/10",
    borderColor: "border-green-500/20",
    icon: <CheckCircle2 className="w-3.5 h-3.5" />,
  },
  INFO: {
    color: "text-blue-600 dark:text-blue-400",
    bgColor: "bg-blue-500/10",
    borderColor: "border-blue-500/20",
    icon: <Info className="w-3.5 h-3.5" />,
  },
  DEBUG: {
    color: "text-zinc-500 dark:text-zinc-400",
    bgColor: "bg-zinc-500/10",
    borderColor: "border-zinc-500/20",
    icon: <Bug className="w-3.5 h-3.5" />,
  },
};

const ITEMS_PER_PAGE_OPTIONS = [10, 25, 50, 100];

export function ScrapeLogsSection() {
  // Filter state
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedLevel, setSelectedLevel] = useState<string>("");
  const [selectedSiteId, setSelectedSiteId] = useState<string>("");
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [showFilters, setShowFilters] = useState(true);

  // Detail modal
  const [selectedLogId, setSelectedLogId] = useState<string | null>(null);

  // Sites for filter dropdown
  const { data: sitesData } = useSites(1, 100);
  const allSites = useMemo(() => {
    if (!sitesData) return [];
    return sitesData.sites ?? (sitesData as unknown as { id: string; name: string }[]);
  }, [sitesData]);

  // Debounce search
  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    const timer = setTimeout(() => {
      setDebouncedSearch(value);
      setPage(1);
    }, 400);
    return () => clearTimeout(timer);
  };

  // Build filters
  const filters: ScrapeLogsFilters = {
    page,
    limit,
    search: debouncedSearch || undefined,
    level: selectedLevel || undefined,
    siteId: selectedSiteId || undefined,
    from: dateRange?.from ? dateRange.from.toISOString() : undefined,
    to: dateRange?.to ? dateRange.to.toISOString() : undefined,
  };

  const { data: logsResponse, isLoading, refetch } = useScrapeLogs(filters);
  const { data: logDetail, isLoading: detailLoading } = useScrapeLogDetail(selectedLogId || "");

  const logs = logsResponse?.data || [];
  const total = logsResponse?.pagination?.total || 0;
  const totalPages = Math.ceil(total / limit);

  // Active filter count
  const activeFilterCount = [
    selectedLevel,
    selectedSiteId,
    debouncedSearch,
    dateRange?.from,
  ].filter(Boolean).length;

  const clearFilters = () => {
    setSearchQuery("");
    setDebouncedSearch("");
    setSelectedLevel("");
    setSelectedSiteId("");
    setDateRange(undefined);
    setPage(1);
  };

  return (
    <section className="w-full" data-tour="scrape-logs-section">
      <Card className="bg-background/80 backdrop-blur-xl border shadow-lg overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary via-accent to-[#0a6906]" />

        {/* Header */}
        <CardHeader className="pb-4 border-b border-border/50">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-primary/10 shrink-0">
                <FileText className="w-5 h-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg font-bold font-display">
                  Scrape Logs
                </CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {total > 0 ? `${total.toLocaleString()} total log entries` : "All scraping activity logs"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => refetch()}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border hover:bg-secondary transition-colors text-muted-foreground"
              >
                <RefreshCcw className="w-3.5 h-3.5" /> Refresh
              </button>
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border transition-colors ${
                  showFilters ? "bg-primary/10 text-primary border-primary/30" : "hover:bg-secondary text-muted-foreground"
                }`}
              >
                <Filter className="w-3.5 h-3.5" />
                Filters
                {activeFilterCount > 0 && (
                  <span className="w-5 h-5 rounded-full bg-primary text-white text-[10px] flex items-center justify-center font-bold">
                    {activeFilterCount}
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* Filters Row */}
          {showFilters && (
            <div className="mt-4 space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
              {/* Search + Date Range */}
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => handleSearchChange(e.target.value)}
                    placeholder="Search log messages..."
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border bg-secondary/30 focus:bg-background transition-colors focus:ring-2 focus:ring-primary/50 outline-none text-sm"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => { setSearchQuery(""); setDebouncedSearch(""); setPage(1); }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded-full hover:bg-secondary"
                    >
                      <X className="w-3.5 h-3.5 text-muted-foreground" />
                    </button>
                  )}
                </div>
                <div className="shrink-0">
                  <AdvancedDateRangePicker
                    value={dateRange}
                    onChange={(range) => { setDateRange(range); setPage(1); }}
                  />
                </div>
              </div>

              {/* Level + Site + Clear */}
              <div className="flex flex-wrap gap-2 items-center">
                {/* Level filter chips */}
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mr-1">Level:</span>
                {LOG_LEVELS.map((level) => {
                  const config = levelConfig[level];
                  const isActive = selectedLevel === level;
                  return (
                    <button
                      key={level}
                      onClick={() => {
                        setSelectedLevel(isActive ? "" : level);
                        setPage(1);
                      }}
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border transition-all ${
                        isActive
                          ? `${config.bgColor} ${config.color} ${config.borderColor}`
                          : "bg-secondary/50 text-muted-foreground border-border/50 hover:bg-secondary"
                      }`}
                    >
                      {config.icon}
                      {level}
                    </button>
                  );
                })}

                <div className="w-px h-5 bg-border/50 mx-1 hidden sm:block" />

                {/* Site filter */}
                <select
                  value={selectedSiteId}
                  onChange={(e) => { setSelectedSiteId(e.target.value); setPage(1); }}
                  className="px-3 py-1.5 rounded-lg border bg-secondary/30 text-sm outline-none focus:ring-2 focus:ring-primary/50"
                >
                  <option value="">All Sites</option>
                  {allSites.map((site: { id: string; name: string }) => (
                    <option key={site.id} value={site.id}>{site.name}</option>
                  ))}
                </select>

                {activeFilterCount > 0 && (
                  <button
                    onClick={clearFilters}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold text-red-500 hover:bg-red-500/10 transition-colors ml-auto"
                  >
                    <X className="w-3 h-3" />
                    Clear all
                  </button>
                )}
              </div>
            </div>
          )}
        </CardHeader>

        {/* Logs Table */}
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-12 flex flex-col items-center justify-center text-muted-foreground">
              <RefreshCcw className="w-6 h-6 animate-spin mb-3 opacity-50" />
              <span className="text-sm">Loading logs...</span>
            </div>
          ) : logs.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">
              <Terminal className="w-10 h-10 mx-auto mb-3 opacity-20" />
              <p className="text-sm font-medium">No logs found</p>
              <p className="text-xs mt-1">
                {activeFilterCount > 0 ? "Try adjusting your filters." : "Logs will appear here when scrape jobs run."}
              </p>
            </div>
          ) : (
            <>
              {/* Desktop: Table view */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-secondary/20">
                      <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground w-[180px]">Timestamp</th>
                      <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground w-[90px]">Level</th>
                      <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Message</th>
                      <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground w-[120px]">Job</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/30">
                    {logs.map((log) => {
                      const config = levelConfig[log.level] || levelConfig.INFO;
                      return (
                        <tr
                          key={log.id}
                          onClick={() => setSelectedLogId(log.id)}
                          className="hover:bg-secondary/30 transition-colors cursor-pointer group"
                        >
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1.5 text-muted-foreground">
                              <Clock className="w-3 h-3 shrink-0 opacity-50" />
                              <span className="text-xs font-mono">
                                {format(new Date(log.timestamp), "MMM dd HH:mm:ss")}
                              </span>
                            </div>
                            <span className="text-[10px] text-muted-foreground/60">
                              {formatDistanceToNow(new Date(log.timestamp), { addSuffix: true })}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${config.bgColor} ${config.color} ${config.borderColor} border`}>
                              {config.icon}
                              {log.level}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <p className="text-sm text-foreground truncate max-w-[500px] group-hover:text-primary transition-colors">
                              {log.message}
                            </p>
                          </td>
                          <td className="px-4 py-3">
                            {log.job && (
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                                log.job.status === "COMPLETED" ? "bg-green-500/10 text-green-600" :
                                log.job.status === "FAILED" ? "bg-red-500/10 text-red-600" :
                                log.job.status === "RUNNING" ? "bg-blue-500/10 text-blue-600" :
                                "bg-zinc-500/10 text-zinc-500"
                              }`}>
                                {log.job.status}
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile: Card view */}
              <div className="md:hidden divide-y divide-border/30">
                {logs.map((log) => {
                  const config = levelConfig[log.level] || levelConfig.INFO;
                  return (
                    <div
                      key={log.id}
                      onClick={() => setSelectedLogId(log.id)}
                      className="p-4 hover:bg-secondary/30 transition-colors cursor-pointer active:bg-secondary/50"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${config.bgColor} ${config.color} ${config.borderColor} border`}>
                          {config.icon}
                          {log.level}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          {formatDistanceToNow(new Date(log.timestamp), { addSuffix: true })}
                        </span>
                      </div>
                      <p className="text-sm text-foreground line-clamp-2">{log.message}</p>
                      {log.job && (
                        <div className="mt-2 flex items-center gap-2 text-[10px] text-muted-foreground">
                          <span>Job: {log.job.type}</span>
                          <span className={`px-1.5 py-0.5 rounded ${
                            log.job.status === "COMPLETED" ? "bg-green-500/10 text-green-600" :
                            log.job.status === "FAILED" ? "bg-red-500/10 text-red-600" :
                            "bg-zinc-500/10 text-zinc-500"
                          }`}>{log.job.status}</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </CardContent>

        {/* Pagination Footer */}
        {total > 0 && (
          <div className="border-t border-border/50 px-4 py-3 flex flex-col sm:flex-row items-center justify-between gap-3 bg-secondary/10">
            {/* Items per page */}
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>Rows per page:</span>
              <select
                value={limit}
                onChange={(e) => { setLimit(Number(e.target.value)); setPage(1); }}
                className="px-2 py-1 rounded-md border bg-background text-xs outline-none focus:ring-2 focus:ring-primary/50"
              >
                {ITEMS_PER_PAGE_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
              <span className="hidden sm:inline">
                Showing {((page - 1) * limit) + 1}–{Math.min(page * limit, total)} of {total.toLocaleString()}
              </span>
            </div>

            {/* Page controls */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage(1)}
                disabled={page === 1}
                className="p-1.5 rounded-lg hover:bg-secondary transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronsLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-1.5 rounded-lg hover:bg-secondary transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              {/* Page numbers */}
              <div className="flex items-center gap-0.5 mx-1">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum: number;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (page <= 3) {
                    pageNum = i + 1;
                  } else if (page >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = page - 2 + i;
                  }
                  return (
                    <button
                      key={pageNum}
                      onClick={() => setPage(pageNum)}
                      className={`w-8 h-8 rounded-lg text-xs font-semibold transition-all ${
                        page === pageNum
                          ? "bg-primary text-white shadow-sm"
                          : "hover:bg-secondary text-muted-foreground"
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
              </div>

              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-1.5 rounded-lg hover:bg-secondary transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              <button
                onClick={() => setPage(totalPages)}
                disabled={page === totalPages}
                className="p-1.5 rounded-lg hover:bg-secondary transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronsRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </Card>

      {/* Log Detail Modal */}
      <Dialog open={!!selectedLogId} onOpenChange={(open) => !open && setSelectedLogId(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-display">
              <FileText className="w-5 h-5 text-primary" />
              Log Details
            </DialogTitle>
          </DialogHeader>

          {detailLoading ? (
            <div className="p-8 flex items-center justify-center">
              <RefreshCcw className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : logDetail ? (
            <div className="space-y-4">
              {/* Level + Timestamp */}
              <div className="flex flex-wrap items-center gap-3">
                {(() => {
                  const config = levelConfig[logDetail.level] || levelConfig.INFO;
                  return (
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold uppercase tracking-wider ${config.bgColor} ${config.color} ${config.borderColor} border`}>
                      {config.icon}
                      {logDetail.level}
                    </span>
                  );
                })()}
                <span className="text-sm text-muted-foreground flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" />
                  {format(new Date(logDetail.timestamp), "MMM dd, yyyy HH:mm:ss.SSS")}
                </span>
              </div>

              {/* Message */}
              <div className="p-4 rounded-xl bg-secondary/30 border border-border/50">
                <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2 block">Message</label>
                <p className="text-sm text-foreground font-mono whitespace-pre-wrap break-words leading-relaxed">{logDetail.message}</p>
              </div>

              {/* Job Info */}
              {logDetail.job && (
                <div className="p-4 rounded-xl bg-secondary/30 border border-border/50">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-3 block">Related Job</label>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-xs text-muted-foreground">Type</span>
                      <p className="font-semibold">{logDetail.job.type}</p>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground">Status</span>
                      <p className={`font-semibold ${
                        logDetail.job.status === "COMPLETED" ? "text-green-600" :
                        logDetail.job.status === "FAILED" ? "text-red-600" :
                        logDetail.job.status === "RUNNING" ? "text-blue-600" :
                        "text-muted-foreground"
                      }`}>{logDetail.job.status}</p>
                    </div>
                    {logDetail.job.sites && logDetail.job.sites.length > 0 && (
                      <div className="col-span-2">
                        <span className="text-xs text-muted-foreground">Sites</span>
                        <div className="flex flex-wrap gap-1.5 mt-1">
                          {logDetail.job.sites.map((site) => (
                            <span key={site.id} className="inline-flex items-center px-2 py-0.5 rounded-md bg-primary/10 text-primary text-xs font-medium">
                              {site.name}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    {logDetail.job.createdBy && (
                      <div className="col-span-2">
                        <span className="text-xs text-muted-foreground">Created By</span>
                        <p className="font-medium text-sm">{logDetail.job.createdBy.firstName || logDetail.job.createdBy.email}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Details JSON */}
              {logDetail.details && Object.keys(logDetail.details).length > 0 && (
                <div className="p-4 rounded-xl bg-secondary/30 border border-border/50">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2 block">Details (JSON)</label>
                  <pre className="text-xs font-mono text-foreground/80 whitespace-pre-wrap break-words bg-background rounded-lg p-3 border border-border/30 max-h-[300px] overflow-y-auto">
                    {JSON.stringify(logDetail.details, null, 2)}
                  </pre>
                </div>
              )}

              {/* Meta */}
              <div className="flex flex-wrap gap-3 text-[10px] text-muted-foreground pt-2 border-t border-border/30">
                <span>Log ID: <code className="font-mono">{logDetail.id}</code></span>
                <span>Job ID: <code className="font-mono">{logDetail.jobId}</code></span>
                {logDetail.siteId && <span>Site ID: <code className="font-mono">{logDetail.siteId}</code></span>}
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground p-4">Log not found.</p>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}
