"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
  useScrapeJobs,
  useStartScrape,
  useStopScrape,
  type LiveProgress,
  type LiveProperty,
} from "@/hooks/use-scrape-jobs";
import { useSocket } from "@/hooks/use-socket";
import {
  Play,
  Square,
  Terminal,
  Activity,
  CheckCircle2,
  AlertCircle,
  Clock,
  Sparkles,
  Settings2,
  X,
  Home,
  FileText,
  Copy,
  Layers,
  Circle,
  RefreshCcw,
  Search,
  Globe2,
  CalendarDays,
  Check,
  Pencil,
  Save,
  ChevronRight,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { useSites, type Site } from "@/hooks/use-sites";
import {
  SideSheet,
  SideSheetContent,
} from "@/components/ui/side-sheet";
import {
  BottomSheet,
  BottomSheetContent,
} from "@/components/ui/bottom-sheet";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import { ScrapeLogsSection } from "@/components/scraper/scrape-logs-section";
import Link from "next/link";

// ─── Config Types ────────────────────────────────────────────────────────────

interface ScrapeConfig {
  scrapeMode: "PASSIVE_BULK" | "ACTIVE_INTENT";
  selectedSiteIds: string[];
  searchQueryParam: string;
  maxDepth: number;
  scheduleTime: string;
}

const SAVED_CONFIG_KEY = "rp-scrape-config";

function loadSavedConfig(): ScrapeConfig | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(SAVED_CONFIG_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function saveConfig(config: ScrapeConfig) {
  localStorage.setItem(SAVED_CONFIG_KEY, JSON.stringify(config));
}

// ─── AnimatedCounter ─────────────────────────────────────────────────────────

interface AnimatedCounterProps {
  value: number;
  duration?: number;
  className?: string;
}

function AnimatedCounter({ value, duration = 600, className }: AnimatedCounterProps) {
  const [display, setDisplay] = useState(value);
  const prevRef = useRef(value);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const start = prevRef.current;
    const end = value;
    if (start === end) return;
    const startTime = performance.now();

    const animate = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Cubic ease-out
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(start + (end - start) * eased));
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate);
      } else {
        prevRef.current = end;
      }
    };

    rafRef.current = requestAnimationFrame(animate);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [value, duration]);

  return <span className={className}>{display.toLocaleString()}</span>;
}

// ─── StatRow ─────────────────────────────────────────────────────────────────

interface StatRowProps {
  icon: React.ReactNode;
  label: string;
  value: number;
  iconBg?: string;
  iconColor?: string;
}

function StatRow({ icon, label, value, iconBg = "bg-primary/10", iconColor = "text-primary" }: StatRowProps) {
  return (
    <div className="flex items-center gap-3 py-2">
      <div className={`w-8 h-8 rounded-lg ${iconBg} flex items-center justify-center shrink-0`}>
        <span className={iconColor}>{icon}</span>
      </div>
      <span className="text-sm text-muted-foreground flex-1">{label}</span>
      <AnimatedCounter value={value} className="text-sm font-bold tabular-nums text-foreground" />
    </div>
  );
}

// ─── MiniStat ────────────────────────────────────────────────────────────────

interface MiniStatProps {
  label: string;
  value: string | number;
  color?: string;
}

function MiniStat({ label, value, color }: MiniStatProps) {
  return (
    <div className="flex flex-col gap-0.5 p-3 rounded-xl bg-secondary/30 border border-border/40">
      <span className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">{label}</span>
      <span className={`text-lg font-bold tabular-nums ${color || "text-foreground"}`}>{value}</span>
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatElapsed(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}m ${seconds.toString().padStart(2, "0")}s`;
}

function formatPrice(price: number): string {
  if (price >= 1_000_000) return `₦${(price / 1_000_000).toFixed(1)}M`;
  if (price >= 1_000) return `₦${Math.round(price / 1_000)}K`;
  return `₦${price.toLocaleString()}`;
}

// ─── Main Page ────────────────────────────────────────────────────────────────

type PageState = "idle" | "running" | "complete";

interface CompletionStats {
  propertiesFound: number;
  duplicates: number;
  errors: number;
  elapsed: number;
  sites: number;
}

export default function ScraperPage() {
  const { data: jobs, isLoading, refetch } = useScrapeJobs();
  const startScrape = useStartScrape();
  const stopScrape = useStopScrape();
  const { data: sitesData, isLoading: isSitesLoading } = useSites(1, 100);
  const allSites = useMemo(() => {
    if (!sitesData) return [];
    return (sitesData as any).sites ?? (sitesData as unknown as Site[]);
  }, [sitesData]);

  const { socket, isConnected } = useSocket({ namespace: "/scrape" });

  // ── Live state
  const [logs, setLogs] = useState<{ id: number; message: string; timestamp: string; level: string }[]>([]);
  const [liveProgress, setLiveProgress] = useState<LiveProgress | null>(null);
  const [liveProperties, setLiveProperties] = useState<LiveProperty[]>([]);
  const [completionStats, setCompletionStats] = useState<CompletionStats | null>(null);
  const [pageState, setPageState] = useState<PageState>("idle");
  const [latestLogMessage, setLatestLogMessage] = useState<string | null>(null);

  // ── Elapsed timer
  const [elapsedMs, setElapsedMs] = useState(0);
  const elapsedIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const jobStartRef = useRef<number | null>(null);

  // ── Config state
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [scrapeMode, setScrapeMode] = useState<"PASSIVE_BULK" | "ACTIVE_INTENT">("PASSIVE_BULK");
  const [selectedSiteIds, setSelectedSiteIds] = useState<string[]>([]);
  const [searchQueryParam, setSearchQueryParam] = useState("");
  const [maxDepth, setMaxDepth] = useState<number>(100);
  const [scheduleTime, setScheduleTime] = useState("");
  const [sourceSearch, setSourceSearch] = useState("");
  const [isMobile, setIsMobile] = useState(false);
  const [savedConfig, setSavedConfig] = useState<ScrapeConfig | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  // ── Execution History state
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [historyStatusFilter, setHistoryStatusFilter] = useState<string>("");
  const logsEndRef = useRef<HTMLDivElement>(null);
  const logsSectionRef = useRef<HTMLDivElement>(null);

  // ── Live terminal log filters
  const [terminalLogFilter, setTerminalLogFilter] = useState<string>("all");

  // ── Pipeline (per-site progress tracking when multi-site)
  const [pipelineSites, setPipelineSites] = useState<Record<string, { found: number; status: "queued" | "active" | "done" }>>({});

  // ── Detect active job
  const activeJob = useMemo(
    () => jobs?.find(j => j.status === "RUNNING" || j.status === "PENDING"),
    [jobs]
  );

  // ── Sync page state with job status
  useEffect(() => {
    if (activeJob) {
      setPageState("running");
    } else if (pageState === "running") {
      // Job disappeared from active list (completed/failed) — poll detected completion
      // Only transition if we didn't already get a job:completed socket event
      const latestJob = jobs?.[0];
      if (latestJob && (latestJob.status === "COMPLETED" || latestJob.status === "FAILED" || latestJob.status === "CANCELLED")) {
        setCompletionStats(prev => prev ?? {
          propertiesFound: (latestJob as any).totalListings ?? 0,
          duplicates: (latestJob as any).duplicates ?? 0,
          errors: (latestJob as any).errors ?? 0,
          elapsed: elapsedMs,
          sites: (latestJob as any).siteIds?.length ?? selectedSiteIds.length,
        });
        setPageState("complete");
      }
    }
  }, [activeJob, jobs, pageState]);

  // ── Load saved config on mount
  useEffect(() => {
    const cfg = loadSavedConfig();
    if (cfg) setSavedConfig(cfg);
  }, []);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    const handleToggle = () => setIsConfigOpen(prev => !prev);
    document.addEventListener("toggle-scraper-config", handleToggle);
    return () => document.removeEventListener("toggle-scraper-config", handleToggle);
  }, []);

  // ── Elapsed timer: start/stop with job
  useEffect(() => {
    if (pageState === "running" && activeJob) {
      if (!jobStartRef.current) {
        jobStartRef.current = activeJob.startTime
          ? new Date(activeJob.startTime).getTime()
          : Date.now();
      }
      elapsedIntervalRef.current = setInterval(() => {
        setElapsedMs(Date.now() - (jobStartRef.current ?? Date.now()));
      }, 1000);
    } else {
      if (elapsedIntervalRef.current) clearInterval(elapsedIntervalRef.current);
      if (pageState !== "running") {
        jobStartRef.current = null;
      }
    }
    return () => {
      if (elapsedIntervalRef.current) clearInterval(elapsedIntervalRef.current);
    };
  }, [pageState, activeJob]);

  // ── Join socket room when an active job exists (so we receive room-scoped events)
  const currentJobIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (!socket) return;
    const jobId = activeJob?.id ?? null;
    if (jobId === currentJobIdRef.current) return;

    // Leave previous room
    if (currentJobIdRef.current) {
      socket.emit("leave:job", currentJobIdRef.current);
    }
    // Join new room
    if (jobId) {
      socket.emit("join:job", jobId);
    }
    currentJobIdRef.current = jobId;

    return () => {
      if (currentJobIdRef.current) {
        socket.emit("leave:job", currentJobIdRef.current);
        currentJobIdRef.current = null;
      }
    };
  }, [socket, activeJob?.id]);

  // ── Socket events
  useEffect(() => {
    if (!socket) return;

    socket.on("job:progress", (data: LiveProgress) => {
      setLiveProgress(data);
      // Track per-site pipeline
      if (data.currentSite) {
        setPipelineSites(prev => ({
          ...prev,
          [data.currentSite!]: {
            found: data.propertiesFound ?? 0,
            status: "active",
          },
        }));
      }
    });

    socket.on("job:log", (data: any) => {
      const msg = data.message ?? String(data);
      setLatestLogMessage(msg);
      setLogs(prev => {
        const entry = {
          id: Date.now() + Math.random(),
          message: msg,
          timestamp: new Date().toISOString(),
          level: data.level ?? "info",
        };
        return [...prev, entry].slice(-200);
      });
    });

    socket.on("scrape_log", (data: any) => {
      const msg = data.message ?? String(data);
      setLatestLogMessage(msg);
      setLogs(prev => {
        const entry = {
          id: Date.now() + Math.random(),
          message: msg,
          timestamp: new Date().toISOString(),
          level: data.level ?? "info",
        };
        return [...prev, entry].slice(-200);
      });
    });

    socket.on("job:property", (data: any) => {
      // Backend sends { jobId, property, timestamp } — extract the property
      const prop: LiveProperty = data.property ?? data;
      setLiveProperties(prev => [prop, ...prev].slice(0, 100));
    });

    socket.on("job:completed", (data: any) => {
      // Stats may be nested under data.stats (from broadcastScrapeComplete) or flat
      const s = data.stats || data;
      setCompletionStats({
        propertiesFound: s.totalListings ?? s.propertiesFound ?? liveProgress?.propertiesFound ?? 0,
        duplicates: s.duplicates ?? liveProgress?.duplicates ?? 0,
        errors: s.errors ?? liveProgress?.errors ?? 0,
        elapsed: elapsedMs,
        sites: s.sites ?? selectedSiteIds.length,
      });
      setPageState("complete");
      // Mark all pipeline sites as done
      setPipelineSites(prev => {
        const next = { ...prev };
        Object.keys(next).forEach(k => { next[k] = { ...next[k], status: "done" }; });
        return next;
      });
      refetch();
    });

    socket.on("job:error", (data: any) => {
      toast.error(data.message ?? "Scraper reported an error");
    });

    socket.on("job_update", () => refetch());

    return () => {
      socket.off("job:progress");
      socket.off("job:log");
      socket.off("scrape_log");
      socket.off("job:property");
      socket.off("job:completed");
      socket.off("job:error");
      socket.off("job_update");
    };
  }, [socket, refetch, liveProgress, elapsedMs, selectedSiteIds.length]);

  // ── Auto-scroll logs (within container, not page)
  useEffect(() => {
    const el = logsEndRef.current;
    if (el?.parentElement) {
      el.parentElement.scrollTop = el.parentElement.scrollHeight;
    }
  }, [logs]);

  // ── Site helpers
  const enabledSites = useMemo(() => allSites.filter((s: Site) => s.enabled), [allSites]);
  const filteredSources = useMemo(() => {
    if (!sourceSearch) return enabledSites;
    const q = sourceSearch.toLowerCase();
    return enabledSites.filter((s: Site) =>
      s.name.toLowerCase().includes(q) || s.baseUrl.toLowerCase().includes(q)
    );
  }, [enabledSites, sourceSearch]);

  const getValidSiteIds = (ids: string[]) =>
    ids.filter(id => allSites.some((s: Site) => s.id === id));

  const getSelectedSiteNames = (ids: string[]) =>
    ids.map(id => allSites.find((s: Site) => s.id === id)?.name).filter(Boolean) as string[];

  // ── Config sheet open
  const openConfig = (edit = false) => {
    if (edit && savedConfig) {
      setScrapeMode(savedConfig.scrapeMode);
      setSelectedSiteIds(savedConfig.selectedSiteIds);
      setSearchQueryParam(savedConfig.searchQueryParam);
      setMaxDepth(savedConfig.maxDepth);
      setScheduleTime(savedConfig.scheduleTime);
      setIsEditing(true);
    } else if (!edit) {
      const last = savedConfig || loadSavedConfig();
      if (last) {
        setScrapeMode(last.scrapeMode);
        setSelectedSiteIds(last.selectedSiteIds);
        setSearchQueryParam(last.searchQueryParam);
        setMaxDepth(last.maxDepth);
        setScheduleTime(last.scheduleTime);
      }
      setIsEditing(false);
    }
    setSourceSearch("");
    setIsConfigOpen(true);
  };

  // ── Save config
  const handleSaveConfig = () => {
    if (scrapeMode === "PASSIVE_BULK" && selectedSiteIds.length === 0) {
      toast.error("Select at least one source.");
      return;
    }
    if (scrapeMode === "ACTIVE_INTENT" && !searchQueryParam.trim()) {
      toast.error("A search query is required.");
      return;
    }
    const cfg: ScrapeConfig = { scrapeMode, selectedSiteIds, searchQueryParam, maxDepth, scheduleTime };
    saveConfig(cfg);
    setSavedConfig(cfg);
    setIsConfigOpen(false);
    toast.success("Configuration saved.");
  };

  // ── Save and Run
  const handleSaveAndRun = () => {
    if (scrapeMode === "PASSIVE_BULK" && selectedSiteIds.length === 0) {
      toast.error("Select at least one source.");
      return;
    }
    if (scrapeMode === "ACTIVE_INTENT" && !searchQueryParam.trim()) {
      toast.error("A search query is required.");
      return;
    }
    const cfg: ScrapeConfig = { scrapeMode, selectedSiteIds, searchQueryParam, maxDepth, scheduleTime };
    saveConfig(cfg);
    setSavedConfig(cfg);
    setIsConfigOpen(false);
    dispatchJob(cfg);
  };

  // ── Dispatch
  const dispatchJob = useCallback((cfg: ScrapeConfig) => {
    setLogs([]);
    setLiveProperties([]);
    setLiveProgress(null);
    setLatestLogMessage(null);
    setCompletionStats(null);
    setPipelineSites(
      cfg.scrapeMode === "PASSIVE_BULK"
        ? Object.fromEntries(cfg.selectedSiteIds.map(id => [id, { found: 0, status: "queued" as const }]))
        : {}
    );
    setPageState("running");

    startScrape.mutate(
      {
        type: cfg.scrapeMode,
        siteIds: cfg.scrapeMode === "PASSIVE_BULK" ? cfg.selectedSiteIds : allSites.map((s: Site) => s.id),
        searchQuery: cfg.scrapeMode === "ACTIVE_INTENT" ? cfg.searchQueryParam : undefined,
        maxListingsPerSite: cfg.maxDepth,
        parameters: cfg.scheduleTime ? { scheduledAt: cfg.scheduleTime } : undefined,
      },
      {
        onSuccess: (job: any) => {
          toast.success("Scrape job dispatched!");
          // Immediately join socket room for this job so we get progress/property/completed events
          if (socket && job?.id) {
            socket.emit("join:job", job.id);
            currentJobIdRef.current = job.id;
          }
        },
        onError: (err: any) => {
          setPageState("idle");
          toast.error(err.response?.data?.message || "Failed to start scraping job");
        },
      }
    );
  }, [startScrape, allSites, socket]);

  const handleDispatch = () => {
    if (!savedConfig) {
      toast.error("Configure the scraper first.");
      return;
    }
    dispatchJob(savedConfig);
  };

  const handleStop = (jobId: string) => {
    stopScrape.mutate(jobId, {
      onSuccess: () => toast.success("Stop signal sent"),
      onError: (err: any) => toast.error(err.response?.data?.message || "Failed to stop job"),
    });
  };

  const handleClearConfig = () => {
    localStorage.removeItem(SAVED_CONFIG_KEY);
    setSavedConfig(null);
    toast.success("Configuration cleared.");
  };

  // ── Multi-site pipeline display
  const pipelineEntries = useMemo(() => {
    if (!savedConfig || savedConfig.selectedSiteIds.length <= 1) return [];
    return savedConfig.selectedSiteIds.map(id => {
      const site = allSites.find((s: Site) => s.id === id);
      const pipeline = pipelineSites[id];
      return {
        id,
        name: site?.name ?? id,
        found: pipeline?.found ?? 0,
        status: pipeline?.status ?? "queued" as const,
      };
    });
  }, [savedConfig, allSites, pipelineSites]);

  // ── Filtered history
  const filteredJobs = useMemo(() => {
    if (!jobs) return [];
    return jobs.filter(job => {
      if (historyStatusFilter && job.status !== historyStatusFilter) return false;
      return true;
    });
  }, [jobs, historyStatusFilter]);

  // ─── Config Sheet Content ─────────────────────────────────────────────────

  const configContent = (
    <div className="flex flex-col h-full bg-card relative">
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary to-accent z-20" />

      <div className="px-4 sm:px-6 pb-4 sm:pb-6 pt-6 border-b border-border/50 shrink-0 flex justify-between items-start">
        <div className="min-w-0">
          <h3 className="font-display font-bold text-lg sm:text-xl flex items-center gap-2">
            <Settings2 className="w-5 h-5 text-primary shrink-0" />
            <span>Scraper Configuration</span>
          </h3>
          <p className="text-xs text-muted-foreground mt-1">Set parameters before running.</p>
        </div>
        <button
          onClick={() => setIsConfigOpen(false)}
          className="p-2 rounded-full hover:bg-secondary/80 transition-colors text-muted-foreground shrink-0 bg-secondary/30 hidden md:block"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
        {/* Mode Selection */}
        <div className="space-y-3">
          <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Scrape Mode
          </label>
          <div className="grid grid-cols-1 gap-2">
            <button
              type="button"
              onClick={() => setScrapeMode("PASSIVE_BULK")}
              className={`text-left border rounded-xl p-3 transition-all ${
                scrapeMode === "PASSIVE_BULK"
                  ? "bg-primary/5 border-primary ring-1 ring-primary"
                  : "bg-background hover:border-primary/30"
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className={`text-sm font-bold ${scrapeMode === "PASSIVE_BULK" ? "text-primary" : "text-foreground"}`}>
                  Bulk Scrape
                </span>
                <Globe2 className={`w-4 h-4 shrink-0 ${scrapeMode === "PASSIVE_BULK" ? "text-primary" : "text-muted-foreground"}`} />
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Systematic crawl of selected sources for all available listings.
              </p>
            </button>

            <button
              type="button"
              onClick={() => setScrapeMode("ACTIVE_INTENT")}
              className={`text-left border rounded-xl p-3 transition-all ${
                scrapeMode === "ACTIVE_INTENT"
                  ? "bg-accent/5 border-accent ring-1 ring-accent"
                  : "bg-background hover:border-accent/30"
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className={`text-sm font-bold ${scrapeMode === "ACTIVE_INTENT" ? "text-accent" : "text-foreground"}`}>
                  Active Search
                </span>
                <Search className={`w-4 h-4 shrink-0 ${scrapeMode === "ACTIVE_INTENT" ? "text-accent" : "text-muted-foreground"}`} />
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Targeted scraping driven by a natural language search query.
              </p>
            </button>
          </div>
        </div>

        {/* Search Query (Active Intent only) */}
        {scrapeMode === "ACTIVE_INTENT" && (
          <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Search Query
            </label>
            <input
              type="text"
              value={searchQueryParam}
              onChange={e => setSearchQueryParam(e.target.value)}
              placeholder="e.g. '3 bedroom flat in Lekki under 5 million'"
              className="w-full px-4 py-3 rounded-xl border bg-secondary/30 focus:bg-background transition-colors focus:ring-2 focus:ring-accent outline-none text-sm"
            />
          </div>
        )}

        {/* Site Selection (Bulk Scrape only) */}
        {scrapeMode === "PASSIVE_BULK" && (
          <div className="space-y-3 animate-in fade-in slide-in-from-top-2">
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
              <span>Target Sources ({selectedSiteIds.length} selected)</span>
              <button
                type="button"
                onClick={() => {
                  if (selectedSiteIds.length === enabledSites.length) setSelectedSiteIds([]);
                  else setSelectedSiteIds(enabledSites.map((s: Site) => s.id));
                }}
                className="text-primary hover:underline text-[10px] font-bold"
              >
                {selectedSiteIds.length === enabledSites.length ? "Deselect All" : "Select All"}
              </button>
            </label>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <input
                type="text"
                value={sourceSearch}
                onChange={e => setSourceSearch(e.target.value)}
                placeholder="Filter sources..."
                className="w-full pl-9 pr-4 py-2.5 rounded-xl border bg-secondary/30 focus:bg-background transition-colors focus:ring-2 focus:ring-primary/50 outline-none text-sm"
              />
            </div>

            <div className="max-h-52 overflow-y-auto rounded-xl border bg-secondary/10 divide-y divide-border/30">
              {isSitesLoading ? (
                <div className="p-6 flex items-center justify-center gap-2 text-muted-foreground text-xs">
                  <RefreshCcw className="w-3.5 h-3.5 animate-spin" /> Loading sources...
                </div>
              ) : filteredSources.length === 0 ? (
                <div className="p-4 text-center text-xs text-muted-foreground">
                  {enabledSites.length === 0
                    ? "No active sources. Enable sources in Data Sources."
                    : "No sources match your search."}
                </div>
              ) : (
                filteredSources.map((site: Site) => {
                  const isSelected = selectedSiteIds.includes(site.id);
                  return (
                    <label
                      key={site.id}
                      className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors hover:bg-secondary/40 ${isSelected ? "bg-primary/5" : ""}`}
                    >
                      <div
                        className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors ${
                          isSelected ? "bg-primary border-primary" : "border-muted-foreground/30"
                        }`}
                      >
                        {isSelected && <Check className="w-3 h-3 text-white" />}
                      </div>
                      <img
                        src={`https://www.google.com/s2/favicons?domain=${new URL(site.baseUrl).hostname}&sz=32`}
                        alt=""
                        className="w-4 h-4 rounded-sm shrink-0"
                        onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
                      />
                      <div className="min-w-0 flex-1">
                        <span className="text-sm font-medium truncate block">{site.name}</span>
                        <span className="text-[10px] text-muted-foreground truncate block">
                          {new URL(site.baseUrl).hostname}
                        </span>
                      </div>
                      <input
                        type="checkbox"
                        className="sr-only"
                        checked={isSelected}
                        onChange={e => {
                          if (e.target.checked) setSelectedSiteIds(prev => [...prev, site.id]);
                          else setSelectedSiteIds(prev => prev.filter(id => id !== site.id));
                        }}
                      />
                    </label>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* Max Listings Slider */}
        <div className="space-y-2">
          <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Max Listings per Source
          </label>
          <div className="flex items-center gap-3 bg-secondary/20 p-3 rounded-xl border border-border/30">
            <input
              type="range"
              min="10"
              max="500"
              step="10"
              value={maxDepth}
              onChange={e => setMaxDepth(parseInt(e.target.value))}
              className="flex-1 accent-primary"
            />
            <div className="w-14 text-center bg-background py-1 rounded-md text-sm font-bold text-foreground border border-border">
              {maxDepth}
            </div>
          </div>
          <p className="text-[10px] text-muted-foreground pl-1">
            Maximum listings to fetch per source.
          </p>
        </div>

        {/* Schedule */}
        <div className="space-y-2">
          <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <CalendarDays className="w-3.5 h-3.5" /> Schedule (Optional)
            </span>
            {scheduleTime && (
              <button
                type="button"
                onClick={() => setScheduleTime("")}
                className="text-red-400 hover:text-red-300 text-[10px] font-bold flex items-center gap-1"
              >
                <X className="w-3 h-3" /> Clear
              </button>
            )}
          </label>
          <DateTimePicker
            value={scheduleTime ? new Date(scheduleTime) : undefined}
            onChange={date => {
              if (date) setScheduleTime(date.toISOString().slice(0, 16));
              else setScheduleTime("");
            }}
            placeholder="Select date and time"
          />
          <p className="text-[10px] text-muted-foreground pl-1">Leave empty to run immediately.</p>
        </div>
      </div>

      {/* Footer */}
      <div className="p-4 sm:p-6 border-t border-border/50 shrink-0 bg-secondary/10 flex gap-2">
        <button
          type="button"
          onClick={() => setIsConfigOpen(false)}
          className="px-4 py-2.5 rounded-xl font-semibold border hover:bg-secondary transition-colors text-sm whitespace-nowrap"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSaveConfig}
          className="px-4 py-2.5 rounded-xl font-semibold border border-border hover:bg-secondary transition-colors text-sm flex items-center justify-center gap-1.5 whitespace-nowrap"
        >
          <Save className="w-3.5 h-3.5 shrink-0" /> Save
        </button>
        <button
          type="button"
          onClick={handleSaveAndRun}
          disabled={startScrape.isPending}
          className="flex-1 px-4 py-2.5 rounded-xl font-bold text-white transition-all shadow-lg hover:-translate-y-0.5 text-sm flex items-center justify-center gap-1.5 disabled:opacity-50 whitespace-nowrap"
          style={{ background: "var(--primary)" }}
        >
          {startScrape.isPending
            ? <RefreshCcw className="w-3.5 h-3.5 animate-spin shrink-0" />
            : <Play className="w-3.5 h-3.5 fill-current shrink-0" />}
          Save &amp; Run
        </button>
      </div>
    </div>
  );

  // ─── JSX ──────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 md:px-8 py-8 animate-in fade-in duration-500">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-xs font-bold uppercase tracking-widest mb-2" style={{ color: "var(--primary)" }}>
            <Sparkles className="w-3 h-3" /> Data Collection
          </div>
          <h1 className="font-display text-3xl md:text-4xl font-bold tracking-tight text-foreground">
            Scraper
          </h1>
          <p className="text-muted-foreground mt-1 text-sm max-w-lg">
            Live command center for Nigerian property data collection. Monitor streams and control jobs in real-time.
          </p>
        </div>

        <div data-tour="scraper-controls" className="flex items-center gap-3 shrink-0">
          {/* Connection indicator */}
          <div className="hidden md:flex items-center gap-2 px-3 py-2 rounded-xl bg-secondary/50 border border-border text-xs font-medium">
            <div className="relative flex items-center justify-center w-3 h-3">
              <span
                className={`absolute inline-flex h-full w-full rounded-full opacity-75 ${
                  isConnected ? "bg-green-500 animate-ping duration-1000" : "bg-amber-400"
                }`}
              />
              <span className={`relative inline-flex rounded-full h-2 w-2 ${isConnected ? "bg-green-500" : "bg-amber-400"}`} />
            </div>
            <span className="text-muted-foreground">
              {isConnected ? "Connected" : "Standby"}
            </span>
          </div>

          {/* Action button */}
          {activeJob ? (
            <button
              onClick={() => handleStop(activeJob.id)}
              disabled={stopScrape.isPending}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all hover:-translate-y-0.5 shadow-lg bg-red-500 hover:bg-red-600 text-white disabled:opacity-50"
            >
              <Square className="w-4 h-4 fill-current" /> Stop
            </button>
          ) : (
            <button
              onClick={() => openConfig(false)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all hover:-translate-y-0.5 shadow-lg text-white"
              style={{ background: "var(--primary)" }}
            >
              <Settings2 className="w-4 h-4" /> Configure
            </button>
          )}
        </div>
      </div>

      {/* ── Saved Config Summary (idle only) ─────────────────────────────── */}
      {savedConfig && pageState === "idle" && (
        <Card className="relative overflow-hidden border shadow-sm">
          <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-primary to-accent" />
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-1.5 min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                  <span className="text-sm font-bold">Configuration Ready</span>
                </div>
                <div className="flex flex-wrap gap-1.5 text-xs">
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-bold ${
                      savedConfig.scrapeMode === "PASSIVE_BULK"
                        ? "bg-primary/10 text-primary"
                        : "bg-accent/10 text-accent"
                    }`}
                  >
                    {savedConfig.scrapeMode === "PASSIVE_BULK"
                      ? <Globe2 className="w-3 h-3" />
                      : <Search className="w-3 h-3" />}
                    {savedConfig.scrapeMode === "PASSIVE_BULK" ? "Bulk Scrape" : "Active Search"}
                  </span>
                  {savedConfig.scrapeMode === "PASSIVE_BULK" && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-secondary text-muted-foreground font-medium">
                      {getValidSiteIds(savedConfig.selectedSiteIds).length} source
                      {getValidSiteIds(savedConfig.selectedSiteIds).length !== 1 ? "s" : ""}
                      {getSelectedSiteNames(savedConfig.selectedSiteIds).length > 0 && (
                        <span className="text-foreground ml-0.5">
                          ({getSelectedSiteNames(savedConfig.selectedSiteIds).slice(0, 2).join(", ")}
                          {getValidSiteIds(savedConfig.selectedSiteIds).length > 2
                            ? ` +${getValidSiteIds(savedConfig.selectedSiteIds).length - 2}`
                            : ""})
                        </span>
                      )}
                    </span>
                  )}
                  {savedConfig.scrapeMode === "ACTIVE_INTENT" && savedConfig.searchQueryParam && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-secondary text-muted-foreground font-medium max-w-[200px] truncate">
                      &ldquo;{savedConfig.searchQueryParam}&rdquo;
                    </span>
                  )}
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-secondary text-muted-foreground font-medium">
                    Max {savedConfig.maxDepth}
                  </span>
                  {savedConfig.scheduleTime && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-secondary text-muted-foreground font-medium">
                      <CalendarDays className="w-3 h-3" />
                      {new Date(savedConfig.scheduleTime).toLocaleString([], {
                        dateStyle: "short",
                        timeStyle: "short",
                      })}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => openConfig(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border hover:bg-secondary transition-colors text-muted-foreground"
                >
                  <Pencil className="w-3 h-3" /> Edit
                </button>
                <button
                  onClick={handleClearConfig}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border hover:bg-red-500/10 text-red-400 transition-colors"
                >
                  <X className="w-3 h-3" /> Clear
                </button>
                <button
                  onClick={handleDispatch}
                  disabled={startScrape.isPending}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-white transition-all shadow-lg hover:-translate-y-0.5 disabled:opacity-50"
                  style={{ background: "var(--primary)" }}
                >
                  {startScrape.isPending
                    ? <RefreshCcw className="w-3.5 h-3.5 animate-spin" />
                    : <Play className="w-3.5 h-3.5 fill-current" />}
                  {savedConfig.scheduleTime ? "Schedule" : "Dispatch"}
                </button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Main 2-column grid ───────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 lg:items-stretch">

        {/* ── LEFT COLUMN ──────────────────────────────────────────────── */}
        <div className="lg:col-span-4 flex flex-col gap-5">

          {/* Live Stats Card */}
          <Card data-tour="scraper-stats" className="border shadow-sm relative overflow-hidden">
            <div
              className={`absolute top-0 left-0 right-0 h-0.5 transition-colors duration-700 ${
                pageState === "running"
                  ? "bg-gradient-to-r from-primary via-accent to-primary bg-[length:200%] animate-[shimmer_2s_linear_infinite]"
                  : pageState === "complete"
                  ? "bg-green-500"
                  : "bg-border"
              }`}
            />
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-muted-foreground" />
                  {pageState === "running" ? "Live Progress" : pageState === "complete" ? "Run Complete" : "Ready"}
                </span>
                {pageState === "running" && (
                  <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-primary/10 text-[10px] uppercase font-bold tracking-wider" style={{ color: "var(--primary)" }}>
                    <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                    Running
                  </span>
                )}
                {pageState === "complete" && (
                  <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-green-500/10 text-green-600 text-[10px] uppercase font-bold tracking-wider">
                    <CheckCircle2 className="w-3 h-3" /> Done
                  </span>
                )}
                {pageState === "idle" && (
                  <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-secondary text-muted-foreground text-[10px] uppercase font-bold tracking-wider">
                    Idle
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {pageState === "idle" && (
                <div className="text-center py-8">
                  <div className="w-14 h-14 rounded-2xl bg-secondary/50 flex items-center justify-center mx-auto mb-3 border border-border/50">
                    <Activity className="w-7 h-7 text-muted-foreground/30" />
                  </div>
                  <p className="text-sm font-medium text-foreground mb-1">System Ready</p>
                  <p className="text-xs text-muted-foreground">
                    {savedConfig ? "Configuration loaded. Click Dispatch to run." : "Configure the scraper to begin."}
                  </p>
                </div>
              )}

              {pageState === "running" && liveProgress && (
                <div className="space-y-4">
                  {/* Progress bar */}
                  {liveProgress.total > 0 && (
                    <div>
                      <div className="flex justify-between text-xs mb-1 text-muted-foreground">
                        <span>Progress</span>
                        <span className="tabular-nums font-semibold text-foreground">
                          {liveProgress.processed} / {liveProgress.total}
                        </span>
                      </div>
                      <div className="w-full bg-secondary/50 border border-border/50 h-2 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-700 ease-out"
                          style={{
                            width: `${Math.min(100, (liveProgress.processed / liveProgress.total) * 100)}%`,
                            background: "linear-gradient(90deg, var(--primary), var(--accent))",
                          }}
                        />
                      </div>
                    </div>
                  )}

                  <div className="divide-y divide-border/40">
                    <StatRow
                      icon={<Home className="w-3.5 h-3.5" />}
                      label="Properties Found"
                      value={liveProgress.propertiesFound ?? 0}
                      iconBg="bg-primary/10"
                      iconColor="text-primary"
                    />
                    <StatRow
                      icon={<Copy className="w-3.5 h-3.5" />}
                      label="Duplicates Skipped"
                      value={liveProgress.duplicates ?? 0}
                      iconBg="bg-yellow-500/10"
                      iconColor="text-yellow-500"
                    />
                    <StatRow
                      icon={<AlertCircle className="w-3.5 h-3.5" />}
                      label="Errors"
                      value={liveProgress.errors ?? 0}
                      iconBg="bg-red-500/10"
                      iconColor="text-red-500"
                    />
                    <StatRow
                      icon={<FileText className="w-3.5 h-3.5" />}
                      label="Pages Fetched"
                      value={liveProgress.pagesFetched ?? 0}
                      iconBg="bg-secondary"
                      iconColor="text-muted-foreground"
                    />
                  </div>

                  <div className="flex items-center justify-between text-xs text-muted-foreground pt-1 border-t border-border/40">
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-3 h-3" />
                      <span>{formatElapsed(elapsedMs)}</span>
                    </div>
                    {liveProgress.currentSite && (
                      <span className="truncate max-w-[140px] text-right">
                        {liveProgress.currentSite}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {pageState === "running" && !liveProgress && (
                <div className="py-6 space-y-3">
                  <div className="flex items-center justify-center gap-2 text-muted-foreground text-sm">
                    <RefreshCcw className="w-4 h-4 animate-spin" />
                    {latestLogMessage ? "Working..." : "Initialising..."}
                  </div>
                  {latestLogMessage && (
                    <p className="text-xs text-muted-foreground text-center truncate px-2">
                      {latestLogMessage}
                    </p>
                  )}
                  <div className="flex items-center justify-center text-xs text-muted-foreground gap-1.5">
                    <Clock className="w-3 h-3" />
                    <span>{formatElapsed(elapsedMs)}</span>
                  </div>
                </div>
              )}

              {pageState === "complete" && completionStats && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <MiniStat label="Found" value={completionStats.propertiesFound} color="text-primary" />
                    <MiniStat label="Duplicates" value={completionStats.duplicates} color="text-yellow-500" />
                    <MiniStat label="Errors" value={completionStats.errors} color="text-red-500" />
                    <MiniStat label="Elapsed" value={formatElapsed(completionStats.elapsed)} />
                  </div>
                  <button
                    onClick={() => setPageState("idle")}
                    className="w-full py-2 rounded-xl text-xs font-semibold border hover:bg-secondary transition-colors text-muted-foreground"
                  >
                    Clear & Reset
                  </button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Pipeline Queue (running, multi-site only) */}
          {pageState === "running" && pipelineEntries.length > 1 && (
            <Card className="border shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Layers className="w-4 h-4 text-muted-foreground" />
                  Pipeline Queue
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0 space-y-1">
                {pipelineEntries.map(entry => (
                  <div key={entry.id} className="flex items-center gap-2.5 py-1.5">
                    {entry.status === "active" ? (
                      <RefreshCcw className="w-3.5 h-3.5 animate-spin shrink-0" style={{ color: "var(--primary)" }} />
                    ) : entry.status === "done" ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0" />
                    ) : (
                      <Circle className="w-3.5 h-3.5 text-muted-foreground/30 shrink-0" />
                    )}
                    <span
                      className={`text-xs flex-1 truncate ${
                        entry.status === "active"
                          ? "font-semibold text-foreground"
                          : entry.status === "done"
                          ? "text-muted-foreground line-through"
                          : "text-muted-foreground"
                      }`}
                    >
                      {entry.name}
                    </span>
                    {entry.found > 0 && (
                      <span className="text-[10px] tabular-nums text-muted-foreground shrink-0">
                        {entry.found}
                      </span>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Execution History */}
          <Card className="border shadow-sm flex-1 flex flex-col min-h-0">
            <CardHeader className="pb-3 border-b border-border/50">
              <div className="flex items-center justify-between mb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Clock className="w-4 h-4 text-muted-foreground" />
                  Execution History
                </CardTitle>
              </div>
              <div className="flex flex-wrap gap-1">
                {(["", "COMPLETED", "FAILED", "RUNNING", "PENDING"] as const).map(status => {
                  const isActive = historyStatusFilter === status;
                  const activeStyles: Record<string, string> = {
                    "": "bg-primary/10 border-primary/20",
                    COMPLETED: "bg-green-500/10 text-green-600 border-green-500/20",
                    FAILED: "bg-red-500/10 text-red-600 border-red-500/20",
                    RUNNING: "bg-blue-500/10 text-blue-600 border-blue-500/20",
                    PENDING: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
                  };
                  return (
                    <button
                      key={status}
                      onClick={() => setHistoryStatusFilter(status)}
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border transition-all ${
                        isActive
                          ? activeStyles[status] + (status === "" ? " text-primary" : "")
                          : "bg-secondary/50 text-muted-foreground border-border/50 hover:bg-secondary"
                      }`}
                    >
                      {status || "All"}
                    </button>
                  );
                })}
              </div>
            </CardHeader>
            <CardContent className="pt-0 px-0 flex-1 overflow-hidden flex flex-col">
              {isLoading ? (
                <div className="p-8 flex flex-col items-center justify-center text-muted-foreground flex-1">
                  <RefreshCcw className="w-4 h-4 animate-spin mb-2 opacity-50" />
                  <span className="text-xs">Loading history...</span>
                </div>
              ) : filteredJobs.length === 0 ? (
                <div className="p-8 text-sm text-center text-muted-foreground flex flex-col items-center flex-1 justify-center">
                  <Terminal className="w-6 h-6 mb-2 opacity-20" />
                  {jobs && jobs.length > 0 ? "No jobs match current filter." : "No execution history yet."}
                </div>
              ) : (
                <div className="divide-y divide-border/40 overflow-y-auto max-h-72">
                  {filteredJobs.slice(0, 20).map(job => (
                    <div
                      key={job.id}
                      onClick={() => {
                        setSelectedJobId(prev => prev === job.id ? null : job.id);
                        setTimeout(() => logsSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
                      }}
                      className={`p-3.5 hover:bg-secondary/30 transition-colors flex flex-col gap-1.5 cursor-pointer group ${
                        selectedJobId === job.id ? "bg-primary/5 border-l-2 border-l-primary" : ""
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border ${
                            job.status === "COMPLETED"
                              ? "bg-green-500/10 text-green-600 border-green-500/20"
                              : job.status === "FAILED"
                              ? "bg-red-500/10 text-red-600 border-red-500/20"
                              : job.status === "RUNNING"
                              ? "bg-blue-500/10 text-blue-600 border-blue-500/20"
                              : "bg-zinc-500/10 text-zinc-500 border-zinc-500/20"
                          }`}
                        >
                          {job.status === "COMPLETED" && <CheckCircle2 className="w-3 h-3" />}
                          {job.status === "FAILED" && <AlertCircle className="w-3 h-3" />}
                          {job.status === "RUNNING" && <Activity className="w-3 h-3 animate-pulse" />}
                          {job.status}
                        </span>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(job.createdAt), { addSuffix: true })}
                          </span>
                          <div
                            className={`w-5 h-5 rounded-full bg-secondary flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity ${
                              selectedJobId === job.id ? "opacity-100 bg-primary/10" : ""
                            }`}
                          >
                            <ChevronRight className={`w-3 h-3 ${selectedJobId === job.id ? "text-primary" : "text-muted-foreground"}`} />
                          </div>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                        <span className="text-foreground font-medium">{job.successfulItems}</span>
                        indexed &bull;
                        <span className="text-foreground font-medium">{job.failedItems}</span>
                        errors
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ── RIGHT COLUMN ─────────────────────────────────────────────── */}
        <div className="lg:col-span-8 flex flex-col">

          {/* Live Terminal */}
          <Card data-tour="scraper-terminal" className="bg-white dark:bg-[#0A0A0B] border border-border dark:border-white/10 shadow-xl relative overflow-hidden flex flex-col rounded-2xl min-h-[340px] max-h-[600px]">
            {/* Terminal header */}
            <CardHeader className="pb-2 border-b border-border dark:border-white/10 bg-slate-50/80 dark:bg-[#0A0A0B]/80 backdrop-blur-xl z-10 flex-shrink-0">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xs font-mono font-medium flex items-center gap-2 text-slate-500 dark:text-zinc-400">
                  <Terminal className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">root@scraper:~$ tail -f /var/log/scraper.log</span>
                  <span className="sm:hidden">scraper.log</span>
                  {pageState === "running" && (
                    <span className="ml-1 animate-pulse font-bold text-green-400">&gt;&gt;_</span>
                  )}
                </CardTitle>
                <div className="flex items-center gap-2">
                  {/* Log level filter pills */}
                  <div className="flex items-center gap-0.5 mr-2">
                    {[
                      { key: "all", label: "All" },
                      { key: "error", label: "ERR", color: "text-red-400" },
                      { key: "warn", label: "WRN", color: "text-yellow-400" },
                      { key: "info", label: "INF", color: "text-blue-400" },
                    ].map(f => (
                      <button
                        key={f.key}
                        onClick={() => setTerminalLogFilter(f.key)}
                        className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider transition-colors ${
                          terminalLogFilter === f.key
                            ? "bg-white/10 dark:bg-white/10 text-foreground"
                            : `${f.color || "text-zinc-500"} opacity-50 hover:opacity-100`
                        }`}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                  {logs.length > 0 && (
                    <button
                      onClick={() => setLogs([])}
                      className="text-[9px] font-mono text-zinc-500 hover:text-zinc-300 transition-colors mr-2"
                    >
                      clear
                    </button>
                  )}
                  <div className="w-2.5 h-2.5 rounded-full bg-red-500/60" />
                  <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/60" />
                  <div className="w-2.5 h-2.5 rounded-full bg-green-500/60" />
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-4 flex-1 overflow-y-auto font-mono text-xs bg-white dark:bg-[#0A0A0B] text-slate-700 dark:text-zinc-300 relative z-0">
              {logs.length === 0 ? (
                <div className="h-full min-h-[200px] flex flex-col items-center justify-center text-slate-400 dark:text-zinc-700">
                  <Terminal className="w-8 h-8 mb-3 opacity-20" />
                  <p className="italic text-sm">Awaiting stdout stream...</p>
                </div>
              ) : (
                <div className="space-y-1 pb-4">
                  {logs.filter(log => terminalLogFilter === "all" || log.level.toLowerCase() === terminalLogFilter).map(log => (
                    <div key={log.id} className="flex items-start gap-2 sm:gap-3 break-words hover:bg-black/[0.02] dark:hover:bg-white/[0.02] px-1 rounded">
                      <span className="text-zinc-400 dark:text-zinc-600 shrink-0 select-none hidden sm:inline text-[10px] pt-0.5 tabular-nums">
                        {new Date(log.timestamp).toLocaleTimeString([], {
                          hour12: false,
                          hour: "2-digit",
                          minute: "2-digit",
                          second: "2-digit",
                        })}
                      </span>
                      <span
                        className={`shrink-0 w-10 text-[10px] font-bold tracking-wider uppercase pt-0.5 ${
                          log.level === "error"
                            ? "text-red-400"
                            : log.level === "warn"
                            ? "text-yellow-400"
                            : log.level === "success"
                            ? "text-green-400"
                            : "text-blue-400"
                        }`}
                      >
                        {log.level}
                      </span>
                      <span
                        className={`flex-1 break-all leading-relaxed ${
                          log.level === "error"
                            ? "text-red-300 dark:text-red-400"
                            : log.level === "warn"
                            ? "text-yellow-200 dark:text-yellow-300"
                            : "text-slate-700 dark:text-zinc-300"
                        }`}
                      >
                        {log.message}
                      </span>
                    </div>
                  ))}
                  <div ref={logsEndRef} />
                </div>
              )}
            </CardContent>
            <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-white dark:from-[#0A0A0B] to-transparent pointer-events-none z-10" />
          </Card>

        </div>
      </div>

      {/* ── Incoming Properties Feed (full-width, before logs) ─────────── */}
      {(pageState === "running" || pageState === "complete") && (
        <Card data-tour="scraper-feed" className="border shadow-sm overflow-hidden">
          <CardHeader className="pb-3 border-b border-border/50">
            <CardTitle className="text-sm font-semibold flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Home className="w-4 h-4 text-muted-foreground" />
                Incoming Properties
                {liveProperties.length > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-primary/10 tabular-nums" style={{ color: "var(--primary)" }}>
                    {liveProperties.length}
                  </span>
                )}
              </span>
              {pageState === "running" && (
                <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                  Live
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {liveProperties.length === 0 ? (
              <div className="py-10 flex flex-col items-center justify-center text-muted-foreground">
                <Home className="w-8 h-8 mb-2 opacity-20" />
                <p className="text-xs italic">Properties will appear here as they are discovered...</p>
              </div>
            ) : (
              <div className="divide-y divide-border/40 max-h-80 overflow-y-auto">
                {liveProperties.map((prop, idx) => (
                  <div key={`${prop.timestamp}-${idx}`} className="flex items-center gap-3 p-3 hover:bg-secondary/20 transition-colors animate-in fade-in slide-in-from-top-1 duration-300">
                    {prop.image ? (
                      <img
                        src={prop.image}
                        alt=""
                        className="w-12 h-12 rounded-lg object-cover shrink-0 bg-secondary border border-border"
                        onError={e => {
                          (e.target as HTMLImageElement).style.display = "none";
                        }}
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-lg bg-secondary flex items-center justify-center shrink-0 border border-border">
                        <Home className="w-5 h-5 text-muted-foreground/30" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {prop.title || "Untitled Listing"}
                      </p>
                      <div className="flex flex-wrap items-center gap-2 mt-0.5">
                        {prop.price !== undefined && prop.price > 0 && (
                          <span className="text-xs font-bold" style={{ color: "var(--accent)" }}>
                            {formatPrice(prop.price)}
                          </span>
                        )}
                        {prop.location && (
                          <span className="text-xs text-muted-foreground truncate">{prop.location}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 text-[10px] text-muted-foreground">
                        {prop.bedrooms !== undefined && (
                          <span>{prop.bedrooms} bed</span>
                        )}
                        {prop.bathrooms !== undefined && (
                          <span>{prop.bathrooms} bath</span>
                        )}
                        {prop.source && (
                          <span className="ml-auto truncate">{prop.source}</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {pageState === "complete" && liveProperties.length > 0 && (
              <div className="p-3 border-t border-border/40 bg-secondary/10">
                <Link
                  href="/properties"
                  className="flex items-center justify-center gap-1.5 text-xs font-semibold hover:underline"
                  style={{ color: "var(--primary)" }}
                >
                  View All in Properties <ChevronRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── ScrapeLogsSection ───────────────────────────────────────────── */}
      <div ref={logsSectionRef}>
        <ScrapeLogsSection jobId={selectedJobId} onClearJobFilter={() => setSelectedJobId(null)} />
      </div>

      {/* ── Config Sheet ────────────────────────────────────────────────── */}
      {isMobile ? (
        <BottomSheet open={isConfigOpen} onOpenChange={setIsConfigOpen} height="90vh">
          <BottomSheetContent className="p-0 bg-card border-white/10">
            {configContent}
          </BottomSheetContent>
        </BottomSheet>
      ) : (
        <SideSheet open={isConfigOpen} onOpenChange={setIsConfigOpen} side="right" width="480px">
          <SideSheetContent className="p-0 bg-transparent border-none shadow-2xl">
            <div className="h-full bg-card shadow-2xl border-l border-white/10 relative">
              {configContent}
            </div>
          </SideSheetContent>
        </SideSheet>
      )}
    </div>
  );
}
