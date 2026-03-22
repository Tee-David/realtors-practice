"use client";

import { create } from "zustand";
import type { LiveProgress, LiveProperty } from "@/hooks/use-scrape-jobs";

export interface LogEntry {
  id: number;
  message: string;
  timestamp: string;
  level: string;
}

export interface CompletionStats {
  propertiesFound: number;
  duplicates: number;
  errors: number;
  elapsed: number;
  sites: number;
}

export type PageState = "idle" | "running" | "complete";

export interface PipelineSite {
  found: number;
  status: "queued" | "active" | "done";
}

interface ScraperState {
  // Live state
  logs: LogEntry[];
  liveProgress: LiveProgress | null;
  liveProperties: LiveProperty[];
  completionStats: CompletionStats | null;
  pageState: PageState;
  latestLogMessage: string | null;
  pipelineSites: Record<string, PipelineSite>;

  // Active job tracking
  activeJobId: string | null;
  jobStartTime: number | null;
  isSocketConnected: boolean;

  // Actions
  addLog: (msg: string, level?: string) => void;
  setLiveProgress: (p: LiveProgress) => void;
  addLiveProperty: (p: LiveProperty) => void;
  setCompletionStats: (s: CompletionStats) => void;
  setPageState: (s: PageState) => void;
  setLatestLogMessage: (msg: string | null) => void;
  updatePipelineSite: (name: string, data: PipelineSite) => void;
  markAllPipelineSitesDone: () => void;
  setActiveJobId: (id: string | null) => void;
  setJobStartTime: (t: number | null) => void;
  setSocketConnected: (v: boolean) => void;

  // Reset (for new scrape session)
  resetLiveState: () => void;
}

const INITIAL_LIVE_STATE = {
  logs: [] as LogEntry[],
  liveProgress: null as LiveProgress | null,
  liveProperties: [] as LiveProperty[],
  completionStats: null as CompletionStats | null,
  pageState: "idle" as PageState,
  latestLogMessage: null as string | null,
  pipelineSites: {} as Record<string, PipelineSite>,
};

export const useScraperStore = create<ScraperState>((set) => ({
  ...INITIAL_LIVE_STATE,
  activeJobId: null,
  jobStartTime: null,
  isSocketConnected: false,

  addLog: (msg, level = "info") =>
    set((state) => {
      const entry: LogEntry = {
        id: Date.now() + Math.random(),
        message: msg,
        timestamp: new Date().toISOString(),
        level,
      };
      return {
        logs: [...state.logs, entry].slice(-200),
        latestLogMessage: msg,
      };
    }),

  setLiveProgress: (p) => set({ liveProgress: p }),

  addLiveProperty: (p) =>
    set((state) => ({
      liveProperties: [p, ...state.liveProperties].slice(0, 100),
    })),

  setCompletionStats: (s) => set({ completionStats: s }),

  setPageState: (s) => set({ pageState: s }),

  setLatestLogMessage: (msg) => set({ latestLogMessage: msg }),

  updatePipelineSite: (name, data) =>
    set((state) => ({
      pipelineSites: { ...state.pipelineSites, [name]: data },
    })),

  markAllPipelineSitesDone: () =>
    set((state) => {
      const next = { ...state.pipelineSites };
      Object.keys(next).forEach((k) => {
        next[k] = { ...next[k], status: "done" };
      });
      return { pipelineSites: next };
    }),

  setActiveJobId: (id) => set({ activeJobId: id }),

  setJobStartTime: (t) => set({ jobStartTime: t }),

  setSocketConnected: (v) => set({ isSocketConnected: v }),

  resetLiveState: () => set(INITIAL_LIVE_STATE),
}));
