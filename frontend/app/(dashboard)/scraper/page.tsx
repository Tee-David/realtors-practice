"use client";

import { useState, useEffect, useRef } from "react";
import { useScrapeJobs, useStartScrape, useStopScrape } from "@/hooks/use-scrape-jobs";
import { useSocket } from "@/hooks/use-socket";
import { Play, Square, RefreshCcw, Terminal, Activity, CheckCircle2, AlertCircle, Clock, Coffee } from "lucide-react";
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
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold" style={{ color: "var(--foreground)" }}>
            Extraction Engine
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--muted-foreground)" }}>
            Manage web scraping jobs, monitor live tasks, and review crawler logs.
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
            <span className={`w-2 h-2 rounded-full ${isConnected ? "bg-green-500 animate-pulse" : "bg-red-500"}`} />
            <span style={{ color: "var(--muted-foreground)" }}>
              {isConnected ? "Engine Connected" : "Engine Disconnected"}
            </span>
          </div>
          
          <button
            onClick={activeJob ? () => handleStop(activeJob.id) : handleStart}
            disabled={startScrape.isPending || stopScrape.isPending}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
              activeJob 
                ? "bg-red-500 hover:bg-red-600 text-white" 
                : "bg-primary hover:bg-primary/90 text-primary-foreground"
            }`}
          >
            {activeJob ? (
              <>
                <Square className="w-4 h-4" /> Stop Crawler
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-current" /> Start Crawl
              </>
            )}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Job Progress & Stats */}
        <div className="space-y-6 lg:col-span-1">
          {/* Active Job Progress */}
          <Card className="bg-card border-border shadow-sm">
            <CardHeader className="pb-3 border-b border-border">
              <CardTitle className="text-base font-semibold flex items-center justify-between">
                Current Task Status
                {activeJob && (
                  <span className="flex items-center gap-1.5 px-2 py-1 rounded bg-blue-500/10 text-blue-500 text-[10px] uppercase font-bold tracking-wider">
                    <Activity className="w-3 h-3 animate-pulse" />
                    Running
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-5 space-y-5">
              {!activeJob ? (
                <div className="text-center py-6 text-sm" style={{ color: "var(--muted-foreground)" }}>
                  <Coffee className="w-8 h-8 mx-auto mb-3 opacity-20" />
                  No active extraction jobs running.
                </div>
              ) : (
                <>
                  <div>
                    <div className="flex justify-between text-xs mb-1.5" style={{ color: "var(--muted-foreground)" }}>
                      <span className="font-medium text-foreground">Processing Properties</span>
                      <span>{activeJob.processedItems} / {activeJob.totalItems || "?"}</span>
                    </div>
                    <div className="w-full bg-secondary h-2.5 rounded-full overflow-hidden">
                      <div 
                        className="bg-primary h-full transition-all duration-500 rounded-full"
                        style={{ width: `${Math.min(100, (activeJob.processedItems / (activeJob.totalItems || 1)) * 100)}%` }}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                      <div className="flex items-center gap-1.5 text-green-600 mb-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span className="text-[10px] font-bold uppercase tracking-wider">Success</span>
                      </div>
                      <p className="text-lg font-bold text-green-700 dark:text-green-500">{activeJob.successfulItems}</p>
                    </div>
                    <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                      <div className="flex items-center gap-1.5 text-red-600 mb-1">
                        <AlertCircle className="w-3.5 h-3.5" />
                        <span className="text-[10px] font-bold uppercase tracking-wider">Failed</span>
                      </div>
                      <p className="text-lg font-bold text-red-700 dark:text-red-500">{activeJob.failedItems}</p>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Recent Jobs History */}
          <Card className="bg-card border-border shadow-sm">
            <CardHeader className="pb-3 border-b border-border">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Clock className="w-4 h-4 text-muted-foreground" />
                Recent Jobs
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 px-0">
              {isLoading ? (
                <div className="p-5 flex justify-center"><RefreshCcw className="w-4 h-4 animate-spin text-muted-foreground" /></div>
              ) : !jobs || jobs.length === 0 ? (
                <div className="p-5 text-sm text-center text-muted-foreground">No historical jobs found.</div>
              ) : (
                <ul className="divide-y divide-border">
                  {jobs.slice(0, 5).map(job => (
                    <li key={job.id} className="p-4 hover:bg-secondary/50 transition-colors">
                      <div className="flex justify-between items-start mb-1">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded ${
                          job.status === 'COMPLETED' ? 'bg-green-500/10 text-green-600' :
                          job.status === 'FAILED' ? 'bg-red-500/10 text-red-600' :
                          'bg-zinc-500/10 text-zinc-600'
                        }`}>
                          {job.status}
                        </span>
                        <span className="text-[11px] text-muted-foreground">
                          {formatDistanceToNow(new Date(job.createdAt), { addSuffix: true })}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">
                        {job.successfulItems} saved &bull; {job.failedItems} failed
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Live Logs Feed */}
        <div className="lg:col-span-2">
          <Card className="bg-zinc-950 border-zinc-900 shadow-sm h-full flex flex-col min-h-[500px] overflow-hidden">
            <CardHeader className="pb-3 border-b border-zinc-900 bg-zinc-950/80 backdrop-blur z-10 flex-shrink-0">
              <CardTitle className="text-sm font-semibold flex items-center justify-between text-zinc-300">
                <div className="flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-zinc-500" />
                  Terminal Logs
                </div>
                {activeJob && <span className="flex w-2 h-2 rounded-full bg-blue-500 animate-ping" />}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 flex-1 overflow-y-auto font-mono text-[11px] lg:text-xs">
              {logs.length === 0 ? (
                <div className="h-full flex items-center justify-center text-zinc-700 italic">
                  Waiting for crawler dispatch...
                </div>
              ) : (
                <div className="space-y-1.5 pb-4">
                  {logs.map((log) => (
                    <div key={log.id} className="flex items-start gap-3 break-words">
                      <span className="text-zinc-600 shrink-0">
                        {new Date(log.timestamp).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </span>
                      <span className={`shrink-0 lowercase w-12 ${
                        log.level === 'error' ? 'text-red-400' : 
                        log.level === 'warn' ? 'text-yellow-400' : 
                        log.level === 'success' ? 'text-green-400' :
                        'text-blue-400'
                      }`}>
                        [{log.level}]
                      </span>
                      <span className="text-zinc-300">
                        {log.message}
                      </span>
                    </div>
                  ))}
                  <div ref={logsEndRef} />
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
