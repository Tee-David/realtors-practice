"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { useScrapeJobs, useStartScrape, useStopScrape } from "@/hooks/use-scrape-jobs";
import { useSocket } from "@/hooks/use-socket";
import { Play, Square, RefreshCcw, Terminal, Activity, CheckCircle2, AlertCircle, Clock, Coffee, Sparkles, SlidersHorizontal, Settings2, CalendarDays, X, Globe2, Search, Check, ChevronRight, Pencil, Save, RotateCcw } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { useSites, type Site } from "@/hooks/use-sites";
import ModernLoader from "@/components/ui/modern-loader";
import {
  SideSheet,
  SideSheetContent,
} from "@/components/ui/side-sheet";
import {
  BottomSheet,
  BottomSheetContent,
} from "@/components/ui/bottom-sheet";

// Saved config type
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

export default function ScraperControlPage() {
  const { data: jobs, isLoading, refetch } = useScrapeJobs();
  const startScrape = useStartScrape();
  const stopScrape = useStopScrape();
  const { data: sitesData } = useSites(1, 100);
  const allSites = useMemo(() => {
    if (!sitesData) return [];
    return sitesData.sites ?? (sitesData as unknown as Site[]);
  }, [sitesData]);
  const { socket, isConnected } = useSocket({ namespace: "/scrape" });

  const [logs, setLogs] = useState<{ id: number; message: string; timestamp: string; level: string }[]>([]);
  const logsEndRef = useRef<HTMLDivElement>(null);

  // Config state
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [scrapeMode, setScrapeMode] = useState<"PASSIVE_BULK" | "ACTIVE_INTENT">("PASSIVE_BULK");
  const [selectedSiteIds, setSelectedSiteIds] = useState<string[]>([]);
  const [searchQueryParam, setSearchQueryParam] = useState("");
  const [maxDepth, setMaxDepth] = useState<number>(100);
  const [scheduleTime, setScheduleTime] = useState("");
  const [sourceSearch, setSourceSearch] = useState("");
  const [isMobile, setIsMobile] = useState(false);

  // Saved config state — shows summary card after saving
  const [savedConfig, setSavedConfig] = useState<ScrapeConfig | null>(null);
  const [isEditing, setIsEditing] = useState(false); // true when editing existing saved config

  // Load saved config on mount
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

  const activeJob = jobs?.find(j => j.status === "RUNNING" || j.status === "PENDING");

  // Socket events
  useEffect(() => {
    if (!socket) return;
    socket.on("scrape_log", (data: any) => {
      setLogs((prev) => {
        const newLogs = [...prev, {
          id: Date.now() + Math.random(),
          message: data.message,
          timestamp: new Date().toISOString(),
          level: data.level || "info"
        }];
        return newLogs.slice(-100);
      });
    });
    socket.on("job_update", () => refetch());
    return () => { socket.off("scrape_log"); socket.off("job_update"); };
  }, [socket, refetch]);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  // Filter sources by search
  const enabledSites = useMemo(() => allSites.filter(s => s.enabled), [allSites]);
  const filteredSources = useMemo(() => {
    if (!sourceSearch) return enabledSites;
    const q = sourceSearch.toLowerCase();
    return enabledSites.filter(s => s.name.toLowerCase().includes(q) || s.baseUrl.toLowerCase().includes(q));
  }, [enabledSites, sourceSearch]);

  // Open config sheet to configure (fresh or edit)
  const openConfig = (edit = false) => {
    if (edit && savedConfig) {
      setScrapeMode(savedConfig.scrapeMode);
      setSelectedSiteIds(savedConfig.selectedSiteIds);
      setSearchQueryParam(savedConfig.searchQueryParam);
      setMaxDepth(savedConfig.maxDepth);
      setScheduleTime(savedConfig.scheduleTime);
      setIsEditing(true);
    } else if (!edit) {
      // Use last config as defaults if available
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

  // Save configuration (not dispatch)
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
    toast.success("Configuration saved! Ready to dispatch.");
  };

  // Dispatch scrape using saved config
  const handleDispatch = () => {
    const cfg = savedConfig;
    if (!cfg) {
      toast.error("Please configure the crawler first.");
      return;
    }
    startScrape.mutate(
      {
        type: cfg.scrapeMode,
        siteIds: cfg.scrapeMode === "PASSIVE_BULK" ? cfg.selectedSiteIds : (allSites.map(s => s.id)),
        searchQuery: cfg.scrapeMode === "ACTIVE_INTENT" ? cfg.searchQueryParam : undefined,
        maxListingsPerSite: cfg.maxDepth,
        parameters: cfg.scheduleTime ? { scheduledAt: cfg.scheduleTime } : undefined
      },
      {
        onSuccess: () => {
          toast.success("Scraping job dispatched!");
          setLogs([]);
        },
        onError: (err: any) => {
          toast.error(err.response?.data?.message || "Failed to start scraping job");
        }
      }
    );
  };

  const handleStop = (jobId: string) => {
    stopScrape.mutate(jobId, {
      onSuccess: () => toast.success("Job stop requested"),
      onError: (err: any) => toast.error(err.response?.data?.message || "Failed to stop job")
    });
  };

  // Clear saved config
  const handleClearConfig = () => {
    localStorage.removeItem(SAVED_CONFIG_KEY);
    setSavedConfig(null);
    toast.success("Configuration cleared.");
  };

  // Get site names for display
  const getSelectedSiteNames = (ids: string[]) => {
    return ids.map(id => allSites.find(s => s.id === id)?.name || "Unknown").slice(0, 3);
  };

  // ---- Config Sheet Content ----
  const configContent = (
    <div className="flex flex-col h-full bg-card relative">
      <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-primary to-accent z-20" />

      <div className="px-4 sm:px-6 pb-4 sm:pb-6 pt-6 border-b border-border/50 shrink-0 flex justify-between items-start">
        <div className="min-w-0">
          <h3 className="font-display font-bold text-lg sm:text-xl md:text-2xl flex items-center gap-2">
            <SlidersHorizontal className="w-5 h-5 text-primary shrink-0" />
            <span className="truncate">Crawler Configuration</span>
          </h3>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">Set parameters before dispatching.</p>
        </div>
        <button onClick={() => setIsConfigOpen(false)} className="p-2 rounded-full hover:bg-secondary/80 transition-colors text-muted-foreground shrink-0 bg-secondary/30 hidden md:block">
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 sm:space-y-8">
        {/* Mode Selection */}
        <div className="space-y-3">
          <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            <Settings2 className="w-4 h-4" /> Traversal Mode
          </label>
          <div className="grid grid-cols-1 gap-3">
            <button
              type="button"
              onClick={() => setScrapeMode("PASSIVE_BULK")}
              className={`text-left border rounded-xl p-3 sm:p-4 transition-all ${scrapeMode === "PASSIVE_BULK" ? 'bg-primary/5 border-primary ring-1 ring-primary' : 'bg-background hover:border-primary/30'}`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className={`text-sm font-bold ${scrapeMode === 'PASSIVE_BULK' ? 'text-primary' : 'text-foreground'}`}>Passive Bulk</span>
                <Globe2 className={`w-4 h-4 shrink-0 ${scrapeMode === 'PASSIVE_BULK' ? 'text-primary' : 'text-muted-foreground'}`} />
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">Systematic crawling of selected sources for all available properties.</p>
            </button>

            <button
              type="button"
              onClick={() => setScrapeMode("ACTIVE_INTENT")}
              className={`text-left border rounded-xl p-3 sm:p-4 transition-all ${scrapeMode === "ACTIVE_INTENT" ? 'bg-accent/5 border-accent ring-1 ring-accent' : 'bg-background hover:border-accent/30'}`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className={`text-sm font-bold ${scrapeMode === 'ACTIVE_INTENT' ? 'text-accent' : 'text-foreground'}`}>Active Intent</span>
                <Search className={`w-4 h-4 shrink-0 ${scrapeMode === 'ACTIVE_INTENT' ? 'text-accent' : 'text-muted-foreground'}`} />
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">Targeted scraping based on a natural language search query.</p>
            </button>
          </div>
        </div>

        {/* Active Intent: Search Query */}
        {scrapeMode === "ACTIVE_INTENT" && (
          <div className="space-y-3 animate-in fade-in slide-in-from-top-2">
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Search Query</label>
            <input
              type="text"
              value={searchQueryParam}
              onChange={e => setSearchQueryParam(e.target.value)}
              placeholder="e.g. '3 bedroom flat in Lekki under 5 million'"
              className="w-full px-4 py-3 rounded-xl border bg-secondary/30 focus:bg-background transition-colors focus:ring-2 focus:ring-accent outline-none text-sm"
            />
          </div>
        )}

        {/* Passive Bulk: Source Selection with Search */}
        {scrapeMode === "PASSIVE_BULK" && (
          <div className="space-y-3 animate-in fade-in slide-in-from-top-2">
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
              <span>Target Sources ({selectedSiteIds.length} selected)</span>
              <button
                type="button"
                onClick={() => {
                  if (selectedSiteIds.length === enabledSites.length) setSelectedSiteIds([]);
                  else setSelectedSiteIds(enabledSites.map(s => s.id));
                }}
                className="text-primary hover:underline text-[10px] font-bold"
              >
                {selectedSiteIds.length === enabledSites.length ? "Deselect All" : "Select All"}
              </button>
            </label>

            {/* Search within sources */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <input
                type="text"
                value={sourceSearch}
                onChange={e => setSourceSearch(e.target.value)}
                placeholder="Search sources..."
                className="w-full pl-9 pr-4 py-2.5 rounded-xl border bg-secondary/30 focus:bg-background transition-colors focus:ring-2 focus:ring-primary/50 outline-none text-sm"
              />
            </div>

            <div className="max-h-52 overflow-y-auto rounded-xl border bg-secondary/10 divide-y divide-border/30">
              {filteredSources.length === 0 ? (
                <div className="p-4 text-center text-xs text-muted-foreground">
                  {enabledSites.length === 0 ? "No active sources. Enable sources in Data Sources." : "No sources match your search."}
                </div>
              ) : (
                filteredSources.map(site => {
                  const isSelected = selectedSiteIds.includes(site.id);
                  return (
                    <label
                      key={site.id}
                      className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors hover:bg-secondary/40 ${isSelected ? 'bg-primary/5' : ''}`}
                    >
                      <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors ${isSelected ? 'bg-primary border-primary' : 'border-muted-foreground/30'}`}>
                        {isSelected && <Check className="w-3 h-3 text-white" />}
                      </div>
                      {/* Favicon */}
                      <img
                        src={`https://www.google.com/s2/favicons?domain=${new URL(site.baseUrl).hostname}&sz=32`}
                        alt=""
                        className="w-4 h-4 rounded-sm shrink-0"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                      />
                      <div className="min-w-0 flex-1">
                        <span className="text-sm font-medium truncate block">{site.name}</span>
                        <span className="text-[10px] text-muted-foreground truncate block">{new URL(site.baseUrl).hostname}</span>
                      </div>
                      <input
                        type="checkbox"
                        className="sr-only"
                        checked={isSelected}
                        onChange={(e) => {
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

        {/* Max Depth */}
        <div className="space-y-3">
          <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Listings Depth per Source</label>
          <div className="flex items-center gap-3 bg-secondary/20 p-3 rounded-xl border border-border/30">
            <input
              type="range"
              min="10"
              max="1000"
              step="10"
              value={maxDepth}
              onChange={e => setMaxDepth(parseInt(e.target.value))}
              className="flex-1 accent-primary"
            />
            <div className="w-14 text-center bg-background py-1 rounded-md text-sm font-bold text-foreground border border-border">
              {maxDepth}
            </div>
          </div>
          <p className="text-[10px] text-muted-foreground pl-1">Maximum listings to parse per target.</p>
        </div>

        {/* Scheduling */}
        <div className="space-y-3">
          <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
            <span className="flex items-center gap-2">
              <CalendarDays className="w-4 h-4" /> Schedule (Optional)
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
          <input
            type="datetime-local"
            value={scheduleTime}
            onChange={e => setScheduleTime(e.target.value)}
            min={new Date().toISOString().slice(0, 16)}
            className="w-full px-4 py-3 rounded-xl border bg-secondary/30 focus:bg-background transition-colors focus:ring-2 focus:ring-primary outline-none text-sm dark:[color-scheme:dark] max-w-full"
          />
          <p className="text-[10px] text-muted-foreground pl-1">Leave empty to dispatch immediately.</p>
        </div>
      </div>

      {/* Footer: Save button */}
      <div className="p-4 sm:p-6 border-t border-border/50 shrink-0 bg-secondary/10 flex flex-col sm:flex-row gap-3">
        <button
          type="button"
          onClick={() => setIsConfigOpen(false)}
          className="w-full sm:flex-1 px-4 py-3 rounded-xl font-semibold border hover:bg-secondary transition-colors text-sm"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSaveConfig}
          className="w-full sm:flex-1 px-4 py-3 rounded-xl font-bold bg-primary hover:bg-primary/90 text-white transition-all shadow-lg hover:-translate-y-0.5 text-sm flex items-center justify-center gap-2"
        >
          <Save className="w-4 h-4" />
          Save Configuration
        </button>
      </div>
    </div>
  );

  return (
    <div className="space-y-8 max-w-7xl mx-auto px-4 md:px-8 py-8 animate-in fade-in duration-700">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 relative">
        <div className="relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold uppercase tracking-widest mb-3">
            <Sparkles className="w-3.5 h-3.5" />
            Core Systems
          </div>
          <h1 className="font-display text-3xl md:text-4xl font-bold tracking-tight text-foreground">
            Extraction Engine
          </h1>
          <p className="text-muted-foreground mt-2 max-w-xl text-sm md:text-base">
            Command center for distributed web scraping tasks. Monitor live data streams, control worker nodes, and review crawler logs in real-time.
          </p>
        </div>

        <div className="flex items-center gap-3 relative z-10">
          <div className="hidden md:flex items-center gap-2 px-4 py-2 rounded-2xl bg-background/60 backdrop-blur-xl border border-white/10 shadow-sm text-sm font-medium">
            <div className="relative flex items-center justify-center w-3 h-3">
              <span className={`absolute inline-flex h-full w-full rounded-full opacity-75 ${isConnected ? "bg-green-500 animate-ping duration-1000" : "bg-red-500"}`} />
              <span className={`relative inline-flex rounded-full h-2 w-2 ${isConnected ? "bg-green-500" : "bg-red-500"}`} />
            </div>
            <span className="text-muted-foreground">
              {isConnected ? "Engine Connected" : "Connection Lost"}
            </span>
          </div>

          {activeJob ? (
            <button
              onClick={() => handleStop(activeJob.id)}
              disabled={stopScrape.isPending}
              className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold transition-all hover:-translate-y-1 shadow-lg bg-red-500 hover:bg-red-600 text-white shadow-red-500/25 disabled:opacity-50 disabled:hover:translate-y-0"
            >
              <Square className="w-4 h-4 fill-current" /> Terminate Signal
            </button>
          ) : (
            <button
              onClick={() => openConfig(false)}
              className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold transition-all hover:-translate-y-1 shadow-lg bg-primary hover:bg-primary/90 text-primary-foreground shadow-primary/25"
            >
              <SlidersHorizontal className="w-4 h-4" /> Configure Crawler
            </button>
          )}
        </div>

        <div className="absolute top-1/2 left-0 -translate-y-1/2 w-64 h-64 bg-primary/10 rounded-full blur-[100px] pointer-events-none -z-10" />
      </div>

      {/* Saved Configuration Summary Card */}
      {savedConfig && !activeJob && (
        <Card className="bg-background/80 backdrop-blur-xl border shadow-lg relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary to-accent" />
          <CardContent className="p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-2 min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                  <span className="text-sm font-bold text-foreground">Configuration Ready</span>
                </div>
                <div className="flex flex-wrap gap-2 text-xs">
                  <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full font-bold ${savedConfig.scrapeMode === 'PASSIVE_BULK' ? 'bg-primary/10 text-primary' : 'bg-accent/10 text-accent'}`}>
                    {savedConfig.scrapeMode === "PASSIVE_BULK" ? <Globe2 className="w-3 h-3" /> : <Search className="w-3 h-3" />}
                    {savedConfig.scrapeMode === "PASSIVE_BULK" ? "Passive Bulk" : "Active Intent"}
                  </span>
                  {savedConfig.scrapeMode === "PASSIVE_BULK" && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-secondary text-muted-foreground font-medium">
                      {savedConfig.selectedSiteIds.length} source{savedConfig.selectedSiteIds.length !== 1 ? 's' : ''}
                      {savedConfig.selectedSiteIds.length > 0 && (
                        <span className="text-foreground ml-0.5">
                          ({getSelectedSiteNames(savedConfig.selectedSiteIds).join(", ")}
                          {savedConfig.selectedSiteIds.length > 3 ? ` +${savedConfig.selectedSiteIds.length - 3}` : ""})
                        </span>
                      )}
                    </span>
                  )}
                  {savedConfig.scrapeMode === "ACTIVE_INTENT" && savedConfig.searchQueryParam && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-secondary text-muted-foreground font-medium truncate max-w-[200px]">
                      &ldquo;{savedConfig.searchQueryParam}&rdquo;
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-secondary text-muted-foreground font-medium">
                    Depth: {savedConfig.maxDepth}
                  </span>
                  {savedConfig.scheduleTime && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-secondary text-muted-foreground font-medium">
                      <CalendarDays className="w-3 h-3" />
                      {new Date(savedConfig.scheduleTime).toLocaleString([], { dateStyle: "short", timeStyle: "short" })}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => openConfig(true)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border hover:bg-secondary transition-colors"
                  style={{ color: "var(--muted-foreground)" }}
                >
                  <Pencil className="w-3 h-3" /> Edit
                </button>
                <button
                  onClick={handleClearConfig}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border hover:bg-red-500/10 text-red-400 transition-colors"
                >
                  <X className="w-3 h-3" /> Clear
                </button>
                <button
                  onClick={handleDispatch}
                  disabled={startScrape.isPending}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold bg-primary hover:bg-primary/90 text-white transition-all shadow-lg hover:-translate-y-0.5 disabled:opacity-50"
                >
                  {startScrape.isPending ? <RefreshCcw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 fill-current" />}
                  {savedConfig.scheduleTime ? "Schedule" : "Dispatch"}
                </button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 relative">
        {/* Left Column: Job Progress & Stats */}
        <div className="space-y-6 lg:col-span-4 flex flex-col">
          {/* Active Job Progress */}
          <Card className="bg-background/80 backdrop-blur-xl border border-white/10 shadow-2xl relative overflow-hidden group">
            <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${activeJob ? "from-blue-500 via-primary to-blue-500 background-pan" : "from-border to-border"} transition-colors`} />
            <CardHeader className="pb-4">
              <CardTitle className="text-base font-semibold flex items-center justify-between">
                Current Operation
                {activeJob ? (
                  <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-500 text-[10px] uppercase font-bold tracking-wider relative overflow-hidden">
                    <span className="absolute inset-0 bg-blue-500/10 animate-pulse" />
                    <Activity className="w-3 h-3 animate-pulse" />
                    Running
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-zinc-500/10 text-zinc-500 text-[10px] uppercase font-bold tracking-wider">
                    <Coffee className="w-3 h-3" />
                    Idle
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-2">
              {!activeJob ? (
                <div className="text-center py-8">
                  <div className="w-16 h-16 rounded-2xl bg-secondary/50 flex items-center justify-center mx-auto mb-4 border border-border/50 shadow-inner group-hover:scale-110 transition-transform duration-500">
                    <Activity className="w-8 h-8 text-muted-foreground/30" />
                  </div>
                  <p className="text-sm font-medium text-foreground mb-1">System Standby</p>
                  <p className="text-xs text-muted-foreground">Ready to dispatch new extraction workers.</p>
                </div>
              ) : (
                <div className="space-y-6 fade-in animate-in">
                  <div>
                    <div className="flex justify-between text-sm mb-2 font-medium">
                      <span className="text-muted-foreground">Properties Scraped</span>
                      <span className="text-foreground">{activeJob.processedItems} <span className="text-muted-foreground/50">/</span> {activeJob.totalItems || "?"}</span>
                    </div>
                    <div className="w-full bg-secondary/50 border border-border/50 h-3 rounded-full overflow-hidden relative shadow-inner">
                      <div
                        className="absolute top-0 left-0 bottom-0 bg-gradient-to-r from-primary/80 to-primary rounded-full transition-all duration-700 ease-out"
                        style={{ width: `${Math.min(100, (activeJob.processedItems / (activeJob.totalItems || 1)) * 100)}%` }}
                      >
                        <div className="absolute inset-0 bg-white/20 background-pan translate-z-0" style={{ backgroundImage: 'linear-gradient(45deg,rgba(255,255,255,.15) 25%,transparent 25%,transparent 50%,rgba(255,255,255,.15) 50%,rgba(255,255,255,.15) 75%,transparent 75%,transparent)', backgroundSize: '1rem 1rem' }} />
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 rounded-2xl bg-green-500/5 border border-green-500/10 shadow-inner relative overflow-hidden group/stat hover:bg-green-500/10 transition-colors">
                      <div className="absolute -right-4 -bottom-4 bg-green-500/10 w-16 h-16 rounded-full blur-2xl group-hover/stat:bg-green-500/20 transition-colors" />
                      <div className="flex items-center gap-2 text-green-600 mb-2">
                        <CheckCircle2 className="w-4 h-4" />
                        <span className="text-xs font-bold uppercase tracking-wider">Success</span>
                      </div>
                      <p className="text-2xl font-bold text-foreground">{activeJob.successfulItems}</p>
                    </div>
                    <div className="p-4 rounded-2xl bg-red-500/5 border border-red-500/10 shadow-inner relative overflow-hidden group/stat hover:bg-red-500/10 transition-colors">
                      <div className="absolute -right-4 -bottom-4 bg-red-500/10 w-16 h-16 rounded-full blur-2xl group-hover/stat:bg-red-500/20 transition-colors" />
                      <div className="flex items-center gap-2 text-red-600 mb-2">
                        <AlertCircle className="w-4 h-4" />
                        <span className="text-xs font-bold uppercase tracking-wider">Failed</span>
                      </div>
                      <p className="text-2xl font-bold text-foreground">{activeJob.failedItems}</p>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Jobs History */}
          <Card className="bg-background/60 backdrop-blur-md border border-white/10 shadow-lg flex-1">
            <CardHeader className="pb-3 border-b border-white/5">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Clock className="w-4 h-4 text-muted-foreground" />
                Execution History
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 px-0">
              {isLoading ? (
                <div className="p-8 flex flex-col items-center justify-center text-muted-foreground">
                  <RefreshCcw className="w-5 h-5 animate-spin mb-3 opacity-50" />
                  <span className="text-xs">Loading history...</span>
                </div>
              ) : !jobs || jobs.length === 0 ? (
                <div className="p-8 text-sm text-center text-muted-foreground flex flex-col items-center">
                  <Terminal className="w-6 h-6 mb-2 opacity-20" />
                  No historical logs found.
                </div>
              ) : (
                <div className="divide-y divide-white/5">
                  {jobs.slice(0, 5).map(job => (
                    <div key={job.id} className="p-4 hover:bg-secondary/30 transition-colors flex items-center justify-between group">
                      <div>
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                            job.status === 'COMPLETED' ? 'bg-green-500/10 text-green-600 border border-green-500/20' :
                            job.status === 'FAILED' ? 'bg-red-500/10 text-red-600 border border-red-500/20' :
                            'bg-zinc-500/10 text-zinc-500 border border-zinc-500/20'
                          }`}>
                            {job.status === 'COMPLETED' && <CheckCircle2 className="w-3 h-3" />}
                            {job.status === 'FAILED' && <AlertCircle className="w-3 h-3" />}
                            {job.status}
                          </span>
                          <span className="text-xs text-muted-foreground group-hover:text-foreground transition-colors">
                            {formatDistanceToNow(new Date(job.createdAt), { addSuffix: true })}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground/80 mt-1">
                          <strong className="text-foreground">{job.successfulItems}</strong> indexed &bull; {job.failedItems} errors
                        </p>
                      </div>
                      <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <Terminal className="w-3 h-3 text-muted-foreground" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Live Logs Feed */}
        <div className="lg:col-span-8 flex flex-col h-full min-h-[500px] lg:min-h-0">
          <Card className="bg-[#0A0A0B] border border-white/10 shadow-2xl relative overflow-hidden flex-1 flex flex-col rounded-3xl group">
            <div className={`absolute -top-40 -right-40 w-96 h-96 rounded-full blur-[120px] pointer-events-none transition-colors duration-1000 ${activeJob ? "bg-primary/20" : "bg-zinc-800/20"}`} />
            <CardHeader className="pb-3 border-b border-white/10 bg-[#0A0A0B]/80 backdrop-blur-xl z-10 flex-shrink-0 relative">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xs font-mono font-medium flex items-center gap-2 text-zinc-400">
                  <Terminal className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">root@extraction-engine:~$ tail -f /var/log/crawler.log</span>
                  <span className="sm:hidden">crawler.log</span>
                </CardTitle>
                <div className="flex items-center gap-1.5 opacity-50">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
                  <div className="w-2.5 h-2.5 rounded-full bg-yellow-500" />
                  <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-5 flex-1 overflow-y-auto font-mono text-xs sm:text-sm bg-[#0A0A0B] text-zinc-300 relative z-0 scroller">
              {activeJob && logs.length < 3 && activeJob.status !== "FAILED" ? (
                <div className="flex-1 flex items-center justify-center p-8 relative h-full">
                  <div className="absolute inset-0 z-0">
                    <div className="absolute top-1/4 left-1/4 w-32 h-32 bg-primary/20 rounded-full blur-3xl opacity-50 animate-pulse" />
                    <div className="absolute bottom-1/4 right-1/4 w-32 h-32 bg-accent/20 rounded-full blur-3xl opacity-50 animate-pulse delay-1000" />
                  </div>
                  <div className="relative z-10 scale-90 md:scale-100">
                    <ModernLoader
                      words={[
                        "Waking up the web crawlers...",
                        "Bribing the proxies with digital coffee",
                        "Bypassing the anti-bot captchas seamlessly...",
                        "Negotiating with Cloudflare",
                        "Fetching your shiny new properties...",
                        "Summoning the JSON spirits",
                        "Writing magic into the database...",
                        "Just a few more milliseconds..."
                      ]}
                    />
                  </div>
                </div>
              ) : logs.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-zinc-700">
                  <Terminal className="w-10 h-10 mb-4 opacity-20" />
                  <p className="italic">Awaiting stdout stream...</p>
                </div>
              ) : (
                <div className="space-y-2 pb-6">
                  {logs.map((log) => (
                    <div key={log.id} className="flex items-start gap-2 sm:gap-4 break-words hover:bg-white/[0.02] p-1 -mx-1 rounded transition-colors group/log">
                      <span className="text-zinc-600 shrink-0 select-none hidden sm:inline">
                        {new Date(log.timestamp).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </span>
                      <span className={`shrink-0 uppercase w-12 sm:w-16 text-[10px] font-bold tracking-wider pt-0.5 ${
                        log.level === 'error' ? 'text-red-400' :
                        log.level === 'warn' ? 'text-yellow-400' :
                        log.level === 'success' ? 'text-green-400' :
                        'text-blue-400'
                      }`}>
                        {log.level}
                      </span>
                      <span className={`flex-1 break-all ${
                        log.level === 'error' ? 'text-red-200' :
                        log.level === 'warn' ? 'text-yellow-200' :
                        'text-zinc-300'
                      }`}>
                        {log.message}
                      </span>
                    </div>
                  ))}
                  <div ref={logsEndRef} />
                </div>
              )}
            </CardContent>
            <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-[#0A0A0B] to-transparent pointer-events-none z-10" />
          </Card>
        </div>
      </div>

      {/* Scraper Configuration Responsive Sheets */}
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
