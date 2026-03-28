"use client";

import { useEffect, useRef, useState } from "react";
import io from "socket.io-client";
import { supabase } from "@/lib/supabase";
import { useScraperStore } from "@/stores/scraper-store";
import { useScrapeJobs, type LiveProgress, type LiveProperty } from "@/hooks/use-scrape-jobs";
import { useQueryClient } from "@tanstack/react-query";

type SocketInstance = ReturnType<typeof io>;

const SOCKET_URL = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api").replace("/api", "");

/**
 * Persistent socket provider that lives at the dashboard layout level.
 * Maintains the /scrape socket connection and feeds events into the Zustand store
 * so that scraper state survives page navigation.
 */
export function ScraperSocketProvider() {
  const socketRef = useRef<SocketInstance | null>(null);
  const currentJobIdRef = useRef<string | null>(null);
  const [socketReady, setSocketReady] = useState(false);
  const queryClient = useQueryClient();

  const { data: jobs } = useScrapeJobs();

  // Get store actions (stable references from Zustand)
  const addLog = useScraperStore((s) => s.addLog);
  const setLiveProgress = useScraperStore((s) => s.setLiveProgress);
  const addLiveProperty = useScraperStore((s) => s.addLiveProperty);
  const setCompletionStats = useScraperStore((s) => s.setCompletionStats);
  const setPageState = useScraperStore((s) => s.setPageState);
  const updatePipelineSite = useScraperStore((s) => s.updatePipelineSite);
  const markAllPipelineSitesDone = useScraperStore((s) => s.markAllPipelineSitesDone);
  const setActiveJobId = useScraperStore((s) => s.setActiveJobId);
  const setJobStartTime = useScraperStore((s) => s.setJobStartTime);
  const setSocketConnected = useScraperStore((s) => s.setSocketConnected);
  const resetLiveState = useScraperStore((s) => s.resetLiveState);

  // Track active job from polling
  const activeJob = jobs?.find((j) => j.status === "RUNNING" || j.status === "PENDING");

  // Sync active job into store + handle state transitions
  useEffect(() => {
    const store = useScraperStore.getState();

    if (activeJob) {
      // If new job appeared (different from what we had), reset live state
      if (store.activeJobId && store.activeJobId !== activeJob.id) {
        resetLiveState();
      }

      setActiveJobId(activeJob.id);

      if (store.pageState !== "running") {
        setPageState("running");
      }

      // Set job start time if not already set
      if (!store.jobStartTime) {
        const startMs = activeJob.startedAt
          ? new Date(activeJob.startedAt).getTime()
          : Date.now();
        setJobStartTime(startMs);
      }

      // Restore persisted progress from DB if we have no live progress yet
      if (!store.liveProgress) {
        const pd = (activeJob as any).progressData;
        if (pd && typeof pd === "object") {
          setLiveProgress(pd as LiveProgress);
        }
      }
    } else if (store.pageState === "running") {
      // Job disappeared — completed/failed via poll
      const latestJob = jobs?.[0];
      if (
        latestJob &&
        (latestJob.status === "COMPLETED" ||
          latestJob.status === "FAILED" ||
          latestJob.status === "CANCELLED")
      ) {
        if (!store.completionStats) {
          const lp = store.liveProgress;
          setCompletionStats({
            propertiesFound: (latestJob as any).totalListings ?? lp?.propertiesFound ?? 0,
            duplicates: (latestJob as any).duplicates ?? lp?.duplicates ?? 0,
            errors: (latestJob as any).errors ?? lp?.errors ?? 0,
            elapsed: store.jobStartTime ? Date.now() - store.jobStartTime : 0,
            sites: (latestJob as any).siteIds?.length ?? 0,
          });
        }
        setPageState("complete");
        markAllPipelineSitesDone();
      }
    }
  }, [activeJob, jobs]);

  // ── Socket connection (persistent — only reconnects if auth changes)
  useEffect(() => {
    let cancelled = false;

    const connect = async () => {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token ?? null;

      if (cancelled) return;

      const socket = io(`${SOCKET_URL}/scrape`, {
        auth: { token },
        path: "/ws",
        autoConnect: true,
        reconnection: true,
        reconnectionDelay: 2000,
        reconnectionAttempts: Infinity,
      });

      socket.on("connect", () => {
        console.log("[ScraperSocket] Connected");
        setSocketConnected(true);
        // Rejoin current job room on reconnect
        const jobId = useScraperStore.getState().activeJobId;
        if (jobId) {
          socket.emit("join:job", jobId);
        }
      });

      socket.on("disconnect", () => {
        console.log("[ScraperSocket] Disconnected");
        setSocketConnected(false);
      });

      socketRef.current = socket;
      setSocketReady(true);
    };

    connect();

    return () => {
      cancelled = true;
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
        setSocketReady(false);
      }
    };
  }, []);

  // ── Join/leave job rooms when active job changes
  useEffect(() => {
    const socket = socketRef.current;
    if (!socket) return;

    const jobId = activeJob?.id ?? null;
    if (jobId === currentJobIdRef.current) return;

    if (currentJobIdRef.current) {
      socket.emit("leave:job", currentJobIdRef.current);
    }
    if (jobId) {
      socket.emit("join:job", jobId);
    }
    currentJobIdRef.current = jobId;
  }, [activeJob?.id]);

  // ── Socket event listeners (re-registers when socket becomes ready)
  useEffect(() => {
    const socket = socketRef.current;
    if (!socket || !socketReady) return;

    const handleLog = (data: any) => {
      const msg = data.message ?? String(data);
      addLog(msg, data.level ?? "info");
    };

    const handleProgress = (data: LiveProgress) => {
      setLiveProgress(data);
      if (data.currentSite) {
        updatePipelineSite(data.currentSite, {
          found: data.propertiesFound ?? 0,
          status: "active",
        });
      }
    };

    const handleProperty = (data: any) => {
      const prop: LiveProperty = data.property ?? data;
      addLiveProperty(prop);
    };

    const handleCompleted = (data: any) => {
      const s = data.stats || data;
      const store = useScraperStore.getState();
      const lp = store.liveProgress;
      setCompletionStats({
        propertiesFound: s.totalListings ?? s.propertiesFound ?? lp?.propertiesFound ?? 0,
        duplicates: s.duplicates ?? lp?.duplicates ?? 0,
        errors: s.errors ?? lp?.errors ?? 0,
        elapsed: store.jobStartTime ? Date.now() - store.jobStartTime : 0,
        sites: s.sites ?? 0,
      });
      setPageState("complete");
      markAllPipelineSitesDone();
      queryClient.invalidateQueries({ queryKey: ["scrape-jobs"] });
    };

    const handleError = (data: any) => {
      addLog(data.message ?? "Scraper reported an error", "error");
    };

    const handleJobUpdate = () => {
      queryClient.invalidateQueries({ queryKey: ["scrape-jobs"] });
    };

    socket.on("job:progress", handleProgress);
    socket.on("job:log", handleLog);
    socket.on("scrape_log", handleLog);
    socket.on("job:property", handleProperty);
    socket.on("job:completed", handleCompleted);
    socket.on("job:error", handleError);
    socket.on("job_update", handleJobUpdate);

    return () => {
      socket.off("job:progress", handleProgress);
      socket.off("job:log", handleLog);
      socket.off("scrape_log", handleLog);
      socket.off("job:property", handleProperty);
      socket.off("job:completed", handleCompleted);
      socket.off("job:error", handleError);
      socket.off("job_update", handleJobUpdate);
    };
  }, [socketReady]);

  // Render nothing — this is a headless provider
  return null;
}
