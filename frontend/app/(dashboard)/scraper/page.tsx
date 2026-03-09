"use client";

import { useState, useEffect, useRef } from "react";
import { useScrapeJobs, useStartScrape, useStopScrape } from "@/hooks/use-scrape-jobs";
import { useSocket } from "@/hooks/use-socket";
import { Play, Square, RefreshCcw, Terminal, Activity, CheckCircle2, AlertCircle, Clock, Coffee, Sparkles, SlidersHorizontal, Settings2, CalendarDays, X, Globe2, Search } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { useSites } from "@/hooks/use-sites";
import ModernLoader from "@/components/ui/modern-loader";
import {
  SideSheet,
  SideSheetContent,
} from "@/components/ui/side-sheet";
import {
  BottomSheet,
  BottomSheetContent,
} from "@/components/ui/bottom-sheet";

export default function ScraperControlPage() {
  const { data: jobs, isLoading, refetch } = useScrapeJobs();
  const startScrape = useStartScrape();
  const stopScrape = useStopScrape();
  const { data: allSites } = useSites(100);
  const { socket, isConnected } = useSocket({ namespace: "/scrape" });
  
  const [logs, setLogs] = useState<{ id: number; message: string; timestamp: string; level: string }[]>([]);
  const logsEndRef = useRef<HTMLDivElement>(null);
  
  // Scraper Configuration State
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [scrapeMode, setScrapeMode] = useState<"PASSIVE_BULK" | "ACTIVE_INTENT">("PASSIVE_BULK");
  const [selectedSiteIds, setSelectedSiteIds] = useState<string[]>([]);
  const [searchQueryParam, setSearchQueryParam] = useState("");
  const [maxDepth, setMaxDepth] = useState<number>(100);
  const [scheduleTime, setScheduleTime] = useState("");
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 1024); // Desktop starts at lg for SideSheet consistency usually, or md (768). Let's use 768.
    setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", () => setIsMobile(window.innerWidth < 768));
    return () => window.removeEventListener("resize", () => setIsMobile(window.innerWidth < 768));
  }, []);

  useEffect(() => {
    const handleToggle = () => setIsConfigOpen(prev => !prev);
    document.addEventListener("toggle-scraper-config", handleToggle);
    return () => document.removeEventListener("toggle-scraper-config", handleToggle);
  }, []);

  // Active job is the most recent one if it's running/pending
  const activeJob = jobs?.find(j => j.status === "RUNNING" || j.status === "PENDING");

  // Handle Socket events
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
        // Keep only last 100 logs
        return newLogs.slice(-100);
      });
    });

    socket.on("job_update", () => {
      refetch();
    });

    return () => {
      socket.off("scrape_log");
      socket.off("job_update");
    };
  }, [socket, refetch]);

  // Auto-scroll logs
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  const handleStart = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    
    if (scrapeMode === "PASSIVE_BULK" && selectedSiteIds.length === 0) {
       toast.error("Please select at least one source for bulk scraping.");
       return;
    }
    
    if (scrapeMode === "ACTIVE_INTENT" && !searchQueryParam) {
       toast.error("A search query is required for active intent scraping.");
       return;
    }

    startScrape.mutate(
      { 
        type: scrapeMode,
        siteIds: scrapeMode === "PASSIVE_BULK" ? selectedSiteIds : (allSites?.map(s => s.id) || []),
        searchQuery: scrapeMode === "ACTIVE_INTENT" ? searchQueryParam : undefined,
        maxListingsPerSite: maxDepth,
        parameters: scheduleTime ? { scheduledAt: scheduleTime } : undefined
      }, 
      {
        onSuccess: () => {
          toast.success("Scraping job started successfully!");
          setLogs([]); // Clear logs on new start
          setIsConfigOpen(false);
        },
        onError: (err: any) => {
          toast.error(err.response?.data?.message || "Failed to start scraping job");
        }
      }
    );
  };

  const handleStop = (jobId: string) => {
    stopScrape.mutate(jobId, {
      onSuccess: () => {
        toast.success("Job stop requested");
      },
      onError: (err: any) => {
        toast.error(err.response?.data?.message || "Failed to stop job");
      }
    });
  };

  const configContent = (
    <div className="flex flex-col h-full bg-card relative">
      <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-primary to-accent z-20" />
      
      <div className="px-6 pb-6 pt-6 border-b border-border/50 shrink-0 flex justify-between items-start">
        <div>
          <h3 className="font-display font-bold text-xl md:text-2xl flex items-center gap-2">
            <SlidersHorizontal className="w-5 h-5 text-primary" />
            Engine Configuration
          </h3>
          <p className="text-sm text-muted-foreground mt-1">Set parameters before dispatching traversal workers.</p>
        </div>
        <button onClick={() => setIsConfigOpen(false)} className="p-2 rounded-full hover:bg-secondary/80 transition-colors text-muted-foreground shrink-0 bg-secondary/30 hidden md:block">
          <X className="w-5 h-5" />
        </button>
      </div>

      <form onSubmit={handleStart} className="flex-1 overflow-y-auto p-6 space-y-8 scroller relative">
        {/* Mode Selection */}
        <div className="space-y-3">
          <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            <Settings2 className="w-4 h-4" /> Traversal Mode
          </label>
          <div className="grid grid-cols-1 gap-4">
            <div 
              onClick={() => setScrapeMode("PASSIVE_BULK")}
              className={`cursor-pointer border rounded-xl p-4 transition-all ${scrapeMode === "PASSIVE_BULK" ? 'bg-primary/5 border-primary shadow-[0_0_15px_rgba(var(--primary-rgb),0.2)] ring-1 ring-primary' : 'bg-background hover:border-white/20'}`}
            >
              <div className="flex items-center justify-between mb-2">
                  <span className={`text-sm font-bold ${scrapeMode === 'PASSIVE_BULK' ? 'text-primary' : 'text-foreground'}`}>Passive Bulk</span>
                  <Globe2 className={`w-4 h-4 ${scrapeMode === 'PASSIVE_BULK' ? 'text-primary' : 'text-muted-foreground'}`} />
              </div>
              <p className="text-xs text-muted-foreground">Systematic crawling of selected sources for all property available. Best for general index updates.</p>
            </div>
            
            <div 
              onClick={() => setScrapeMode("ACTIVE_INTENT")}
              className={`cursor-pointer border rounded-xl p-4 transition-all ${scrapeMode === "ACTIVE_INTENT" ? 'bg-accent/5 border-accent shadow-[0_0_15px_rgba(var(--accent-rgb),0.2)] ring-1 ring-accent' : 'bg-background hover:border-white/20'}`}
            >
              <div className="flex items-center justify-between mb-2">
                  <span className={`text-sm font-bold ${scrapeMode === 'ACTIVE_INTENT' ? 'text-accent' : 'text-foreground'}`}>Active Intent</span>
                  <Search className={`w-4 h-4 ${scrapeMode === 'ACTIVE_INTENT' ? 'text-accent' : 'text-muted-foreground'}`} />
              </div>
              <p className="text-xs text-muted-foreground">Targeted scraping across all sources based on a specific Natural Language search query.</p>
            </div>
          </div>
        </div>

        {/* Conditional Inputs */}
        {scrapeMode === "ACTIVE_INTENT" && (
          <div className="space-y-3 animate-in fade-in slide-in-from-top-2">
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Search Query</label>
            <input
              type="text"
              required
              value={searchQueryParam}
              onChange={e => setSearchQueryParam(e.target.value)}
              placeholder="e.g. '3 bedroom flat in Lekki under 5 million'"
              className="w-full px-4 py-3 rounded-xl border bg-secondary/30 focus:bg-background transition-colors focus:ring-2 focus:ring-accent outline-none text-sm"
            />
          </div>
        )}

        {scrapeMode === "PASSIVE_BULK" && (
          <div className="space-y-3 animate-in fade-in slide-in-from-top-2">
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex justify-between">
              <span>Target Sources</span>
              <button type="button" onClick={() => setSelectedSiteIds(allSites?.map(s => s.id) || [])} className="text-primary hover:underline">Select All</button>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto p-1 scroller">
                {allSites?.filter(s => s.isActive).map(site => (
                  <label key={site.id} className="flex items-center gap-2 p-3 rounded-lg border bg-secondary/10 hover:bg-secondary/50 cursor-pointer transition-colors">
                    <input 
                      type="checkbox" 
                      className="rounded border-zinc-600 w-4 h-4 text-primary focus:ring-primary"
                      checked={selectedSiteIds.includes(site.id)}
                      onChange={(e) => {
                        if (e.target.checked) setSelectedSiteIds([...selectedSiteIds, site.id]);
                        else setSelectedSiteIds(selectedSiteIds.filter(id => id !== site.id));
                      }}
                    />
                    <span className="text-sm font-medium truncate" title={site.name}>{site.name}</span>
                  </label>
                ))}
            </div>
            {(!allSites || allSites.filter(s => s.isActive).length === 0) && (
                <p className="text-xs text-red-400 p-3 bg-red-500/10 rounded-lg">No active sources available. Please enable sources in the Data Sources tab.</p>
            )}
          </div>
        )}

        <div className="space-y-6">
          {/* Max Depth */}
          <div className="space-y-3">
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Listings Depth per Source</label>
            <div className="flex items-center gap-4 bg-secondary/20 p-3 rounded-xl border border-white/5">
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
            <p className="text-[10px] text-muted-foreground pl-1">Maximum listings to parse per target website.</p>
          </div>

          {/* Scheduling */}
          <div className="space-y-3">
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <CalendarDays className="w-4 h-4" /> Queue Schedule (Optional)
            </label>
            <input
              type="datetime-local"
              value={scheduleTime}
              onChange={e => setScheduleTime(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border bg-secondary/30 focus:bg-background transition-colors focus:ring-2 focus:ring-primary outline-none text-sm dark:[color-scheme:dark]"
            />
            <p className="text-[10px] text-muted-foreground pl-1">Leave empty to dispatch immediately.</p>
          </div>
        </div>
      </form>
      
      <div className="p-4 md:p-6 border-t border-border/50 shrink-0 bg-secondary/10 flex flex-col md:flex-row gap-3">
          <button
            type="button"
            onClick={() => setIsConfigOpen(false)}
            className="w-full md:flex-1 px-4 py-3.5 md:py-3 rounded-xl font-semibold border hover:bg-secondary transition-colors text-sm order-2 md:order-1"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleStart}
            disabled={startScrape.isPending || (scrapeMode === "PASSIVE_BULK" && selectedSiteIds.length === 0)}
            className={`w-full md:flex-1 px-4 py-3.5 md:py-3 rounded-xl font-bold transition-all shadow-lg hover:-translate-y-0.5 disabled:opacity-50 text-sm flex items-center justify-center gap-2 text-white order-1 md:order-2 ${scrapeMode === 'ACTIVE_INTENT' ? 'bg-accent hover:bg-accent/90' : 'bg-primary hover:bg-primary/90'}`}
          >
            {startScrape.isPending ? <RefreshCcw className="w-4 h-4 animate-spin" /> : scheduleTime ? "Schedule" : "Dispatch"}
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
        
        <div className="flex items-center gap-4 relative z-10">
          <div className="hidden md:flex items-center gap-2 px-4 py-2 rounded-2xl bg-background/60 backdrop-blur-xl border border-white/10 shadow-sm text-sm font-medium">
            <div className="relative flex items-center justify-center w-3 h-3">
              <span className={`absolute inline-flex h-full w-full rounded-full opacity-75 ${isConnected ? "bg-green-500 animate-ping duration-1000" : "bg-red-500"}`} />
              <span className={`relative inline-flex rounded-full h-2 w-2 ${isConnected ? "bg-green-500" : "bg-red-500"}`} />
            </div>
            <span className="text-muted-foreground">
              {isConnected ? "Engine Connected" : "Connection Lost"}
            </span>
          </div>
          
          <button
            onClick={activeJob ? () => handleStop(activeJob.id) : () => setIsConfigOpen(true)}
            disabled={startScrape.isPending || stopScrape.isPending}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold transition-all hover:-translate-y-1 shadow-lg ${
              activeJob 
                ? "bg-red-500 hover:bg-red-600 text-white shadow-red-500/25" 
                : "bg-primary hover:bg-primary/90 text-primary-foreground shadow-primary/25"
            } disabled:opacity-50 disabled:hover:translate-y-0`}
          >
            {activeJob ? (
              <>
                <Square className="w-4 h-4 fill-current" /> Terminate Signal
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-current" /> Dispatch Crawler
              </>
            )}
          </button>
        </div>
        
        {/* Background glow for header */}
        <div className="absolute top-1/2 left-0 -translate-y-1/2 w-64 h-64 bg-primary/10 rounded-full blur-[100px] pointer-events-none -z-10" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 relative">
        {/* Left Column: Job Progress & Stats */}
        <div className="space-y-6 lg:col-span-4 flex flex-col">
          {/* Active Job Progress */}
          <Card className="bg-background/80 backdrop-blur-xl border border-white/10 shadow-2xl relative overflow-hidden group">
            {/* Animated border gradient line at top */}
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
                      <p className="text-2xl font-bold text-foreground">
                        {activeJob.successfulItems}
                      </p>
                    </div>
                    <div className="p-4 rounded-2xl bg-red-500/5 border border-red-500/10 shadow-inner relative overflow-hidden group/stat hover:bg-red-500/10 transition-colors">
                      <div className="absolute -right-4 -bottom-4 bg-red-500/10 w-16 h-16 rounded-full blur-2xl group-hover/stat:bg-red-500/20 transition-colors" />
                      <div className="flex items-center gap-2 text-red-600 mb-2">
                        <AlertCircle className="w-4 h-4" />
                        <span className="text-xs font-bold uppercase tracking-wider">Failed</span>
                      </div>
                      <p className="text-2xl font-bold text-foreground">
                        {activeJob.failedItems}
                      </p>
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
             {/* Decorative glow */}
            <div className={`absolute -top-40 -right-40 w-96 h-96 rounded-full blur-[120px] pointer-events-none transition-colors duration-1000 ${activeJob ? "bg-primary/20" : "bg-zinc-800/20"}`} />
            
            <CardHeader className="pb-3 border-b border-white/10 bg-[#0A0A0B]/80 backdrop-blur-xl z-10 flex-shrink-0 relative">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xs font-mono font-medium flex items-center gap-2 text-zinc-400">
                  <Terminal className="w-3.5 h-3.5" />
                  root@extraction-engine:~$ tail -f /var/log/crawler.log
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
                        "Bribing the proxies with digital coffee ☕",
                        "Bypassing the anti-bot captchas seamlessly...",
                        "Negotiating with Cloudflare 🛡️",
                        "Fetching your shiny new properties...",
                        "Summoning the JSON spirits 🪄",
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
                    <div key={log.id} className="flex items-start gap-4 break-words hover:bg-white/[0.02] p-1 -mx-1 rounded transition-colors group/log">
                      <span className="text-zinc-600 shrink-0 select-none hidden sm:inline">
                        {new Date(log.timestamp).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit', fractionalSecondDigits: 3 })}
                      </span>
                      <span className={`shrink-0 uppercase w-16 text-[10px] font-bold tracking-wider pt-0.5 ${
                        log.level === 'error' ? 'text-red-400' : 
                        log.level === 'warn' ? 'text-yellow-400' : 
                        log.level === 'success' ? 'text-green-400' :
                        'text-blue-400'
                      }`}>
                        {log.level}
                      </span>
                      <span className={`flex-1 ${
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
            
            {/* Scroll fade overlay */}
            <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-[#0A0A0B] to-transparent pointer-events-none z-10" />
          </Card>
        </div>
      </div>

      {/* Scraper Configuration Responsive Sheets */}
      {isMobile ? (
        <BottomSheet open={isConfigOpen} onOpenChange={setIsConfigOpen} height="85vh">
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
