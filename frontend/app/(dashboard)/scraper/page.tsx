"use client";

import { useState, useEffect, useRef } from "react";
import { useScrapeJobs, useStartScrape, useStopScrape } from "@/hooks/use-scrape-jobs";
import { useSocket } from "@/hooks/use-socket";
import { Play, Square, RefreshCcw, Terminal, Activity, CheckCircle2, AlertCircle, Clock, Coffee, Sparkles } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

export default function ScraperControlPage() {
  const { data: jobs, isLoading, refetch } = useScrapeJobs();
  const startScrape = useStartScrape();
  const stopScrape = useStopScrape();
  const { socket, isConnected } = useSocket({ namespace: "/scrape" });
  
  const [logs, setLogs] = useState<{ id: number; message: string; timestamp: string; level: string }[]>([]);
  const logsEndRef = useRef<HTMLDivElement>(null);

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

  const handleStart = () => {
    startScrape.mutate(
      { fullSync: true }, 
      {
        onSuccess: () => {
          toast.success("Scraping job started successfully!");
          setLogs([]); // Clear logs on new start
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
            onClick={activeJob ? () => handleStop(activeJob.id) : handleStart}
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
              {logs.length === 0 ? (
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
    </div>
  );
}
