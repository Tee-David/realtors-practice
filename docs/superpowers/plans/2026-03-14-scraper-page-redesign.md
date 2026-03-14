# Scraper Page Redesign Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the scraper page feel alive during execution — live stats, live logs, live property feed, pipeline queue, and completion summary.

**Architecture:** Backend receives enriched progress data and new per-property events from Python scraper via HTTP callbacks, then broadcasts via Socket.io to the frontend. Frontend page is rewritten with three states (idle, running, complete) and new components for live stats, pipeline queue, and incoming property feed.

**Tech Stack:** Next.js 16, React 19, Socket.io, Express, Python FastAPI, Prisma, Tailwind CSS v4, shadcn/ui

---

## File Structure

### Files to Create
- None (all changes are modifications to existing files)

### Files to Modify
1. `scraper/utils/callback.py` — Add `report_property()`, enrich `report_progress()` signature
2. `scraper/app.py` — Wire enriched progress + property reporting into pipeline
3. `backend/src/routes/internal.routes.ts` — Add `/internal/scrape-property` route
4. `backend/src/socketServer.ts` — Add `broadcastScrapeProperty()`, enrich progress type
5. `backend/src/services/scrape.service.ts` — Add `handleProperty()`, enrich `handleProgress()` signature
6. `frontend/hooks/use-scrape-jobs.ts` — Extend `ScrapeJob` interface with richer progress fields
7. `frontend/app/(dashboard)/scraper/page.tsx` — Full rewrite with new layout and components

### Files NOT Modified
- `frontend/components/ui/side-sheet.tsx`
- `frontend/components/ui/bottom-sheet.tsx`
- `frontend/components/scraper/scrape-logs-section.tsx`
- `frontend/components/ui/modern-loader.tsx`

---

## Chunk 1: Backend + Scraper Pipeline (Tasks 1–4)

### Task 1: Add `report_property()` to scraper callbacks

**Files:**
- Modify: `scraper/utils/callback.py`

- [ ] **Step 1: Add `report_property()` function**

Add this function after the existing `report_log()` function at the bottom of the file:

```python
async def report_property(
    job_id: str,
    property_data: dict[str, Any],
) -> None:
    """Report a single scraped property to the API (for live property feed via Socket.io)."""
    url = f"{_base_url()}/internal/scrape-property"
    payload = {"jobId": job_id, "property": property_data}
    try:
        resp = await _client.post(url, json=payload, headers=_headers())
        resp.raise_for_status()
    except Exception:
        pass  # Don't block pipeline for feed failures
```

- [ ] **Step 2: Enrich `report_progress()` signature**

Replace the existing `report_progress()` function with this version that accepts additional fields:

```python
async def report_progress(
    job_id: str,
    processed: int,
    total: int,
    current_site: str | None = None,
    message: str | None = None,
    current_page: int | None = None,
    max_pages: int | None = None,
    pages_fetched: int | None = None,
    properties_found: int | None = None,
    duplicates: int | None = None,
    errors: int | None = None,
) -> None:
    """Report scrape job progress to the API server."""
    url = f"{_base_url()}/internal/scrape-progress"
    payload: dict[str, Any] = {
        "jobId": job_id,
        "processed": processed,
        "total": total,
    }
    if current_site:
        payload["currentSite"] = current_site
    if message:
        payload["message"] = message
    if current_page is not None:
        payload["currentPage"] = current_page
    if max_pages is not None:
        payload["maxPages"] = max_pages
    if pages_fetched is not None:
        payload["pagesFetched"] = pages_fetched
    if properties_found is not None:
        payload["propertiesFound"] = properties_found
    if duplicates is not None:
        payload["duplicates"] = duplicates
    if errors is not None:
        payload["errors"] = errors
    try:
        resp = await _client.post(url, json=payload, headers=_headers())
        resp.raise_for_status()
    except Exception as e:
        logger.warning(f"Failed to report progress for job {job_id}: {e}")
```

- [ ] **Step 3: Update import in `app.py`**

In `scraper/app.py`, update the import line to include `report_property`:

```python
from utils.callback import report_progress, report_results, report_error, report_log, report_property
```

- [ ] **Step 4: Commit**

```bash
git add scraper/utils/callback.py scraper/app.py
git commit -m "feat(scraper): add report_property callback and enrich report_progress"
```

---

### Task 2: Wire enriched progress + property reporting into scraper pipeline

**Files:**
- Modify: `scraper/app.py:200-480` (the `_run_scrape_job_inner` function)

- [ ] **Step 1: Add page-tracking counters**

In `_run_scrape_job_inner`, after the existing counter declarations (line ~206), add:

```python
    total_pages_fetched = 0
```

- [ ] **Step 2: Increment page counter after each page fetch**

After the `html = await fetcher.fetch(page_url, ...)` block succeeds (after the empty-response check at ~line 269), add:

```python
                        total_pages_fetched += 1
```

- [ ] **Step 3: Enrich `report_progress()` call with new fields**

Replace the existing `report_progress()` call (~line 442-447) with:

```python
                                await report_progress(
                                    job_id,
                                    processed=len(all_properties) + len(site_properties),
                                    total=request.maxListingsPerSite * len(request.sites),
                                    current_site=site.name,
                                    current_page=page_num + 1,
                                    max_pages=site.maxPages,
                                    pages_fetched=total_pages_fetched,
                                    properties_found=len(all_properties) + len(site_properties),
                                    duplicates=deduplicator.duplicate_count,
                                    errors=total_errors,
                                )
```

- [ ] **Step 4: Add `report_property()` call after successful validation**

After `site_properties.append(validated)` (~line 439), add property reporting:

```python
                                # Report property to frontend for live feed
                                await report_property(job_id, {
                                    "title": validated.get("title"),
                                    "price": validated.get("price"),
                                    "location": validated.get("area") or validated.get("state"),
                                    "bedrooms": validated.get("bedrooms"),
                                    "bathrooms": validated.get("bathrooms"),
                                    "image": (validated.get("images") or [None])[0],
                                    "source": site.name,
                                })
```

- [ ] **Step 5: Include site name in log messages**

Update the log messages to include site name for terminal display. Change:
- `f"Fetching page {page_num + 1}: {page_url}"` → `f"[{site.name}] Fetching page {page_num + 1}: {page_url}"`
- `f"Found {len(listing_urls)} new listings on page {page_num + 1}"` → `f"[{site.name}] Found {len(listing_urls)} new listings on page {page_num + 1}"`
- `f"No more listings found on page {page_num + 1}"` → `f"[{site.name}] No more listings found on page {page_num + 1}"`
- `f"Error processing {listing_url}: {str(e)}"` → `f"[{site.name}] Error processing {listing_url}: {str(e)}"`

- [ ] **Step 6: Commit**

```bash
git add scraper/app.py
git commit -m "feat(scraper): wire enriched progress, property feed, and site-tagged logs"
```

---

### Task 3: Add `/internal/scrape-property` route and broadcast function

**Files:**
- Modify: `backend/src/routes/internal.routes.ts`
- Modify: `backend/src/socketServer.ts`
- Modify: `backend/src/services/scrape.service.ts`

- [ ] **Step 1: Add `broadcastScrapeProperty()` to socketServer.ts**

Add this function after `broadcastScrapeComplete()` (~line 151):

```typescript
export function broadcastScrapeProperty(
  jobId: string,
  property: Record<string, unknown>
): void {
  if (!scrapeNamespace) return;
  scrapeNamespace.to(`job:${jobId}`).emit("job:property", {
    jobId,
    property,
    timestamp: new Date().toISOString(),
  });
}
```

- [ ] **Step 2: Update `broadcastScrapeProgress()` type to accept enriched fields**

Replace the existing `broadcastScrapeProgress()` function:

```typescript
export function broadcastScrapeProgress(
  jobId: string,
  data: {
    processed: number;
    total: number;
    currentSite?: string;
    message?: string;
    currentPage?: number;
    maxPages?: number;
    pagesFetched?: number;
    propertiesFound?: number;
    duplicates?: number;
    errors?: number;
  }
): void {
  if (!scrapeNamespace) return;
  scrapeNamespace.to(`job:${jobId}`).emit("job:progress", {
    jobId,
    ...data,
    timestamp: new Date().toISOString(),
  });
}
```

- [ ] **Step 3: Add `handleProperty()` to scrape.service.ts**

Add this method after `handleProgress()`:

```typescript
  /**
   * Handle a single scraped property — broadcast for live feed.
   */
  static async handleProperty(
    jobId: string,
    property: Record<string, unknown>
  ) {
    broadcastScrapeProperty(jobId, property);
  }
```

And update the import at the top of scrape.service.ts to include `broadcastScrapeProperty`:

```typescript
import {
  broadcastScrapeLog,
  broadcastScrapeProgress,
  broadcastScrapeComplete,
  broadcastScrapeError,
  broadcastScrapeProperty,
} from "../socketServer";
```

- [ ] **Step 4: Update `handleProgress()` to accept enriched fields**

Replace the method signature:

```typescript
  static async handleProgress(
    jobId: string,
    data: {
      processed: number;
      total: number;
      currentSite?: string;
      message?: string;
      currentPage?: number;
      maxPages?: number;
      pagesFetched?: number;
      propertiesFound?: number;
      duplicates?: number;
      errors?: number;
    }
  ) {
    broadcastScrapeProgress(jobId, data);
  }
```

- [ ] **Step 5: Add `/internal/scrape-property` route**

In `internal.routes.ts`, add this route after the `/scrape-log` route:

```typescript
/**
 * POST /internal/scrape-property
 * Receive a single scraped property for live feed display.
 */
router.post("/scrape-property", async (req: Request, res: Response) => {
  try {
    const { jobId, property } = req.body;
    if (!jobId || !property) {
      return res.status(400).json({ error: "jobId and property required" });
    }

    await ScrapeService.handleProperty(jobId, property);
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: "Internal error" });
  }
});
```

- [ ] **Step 6: Update `/internal/scrape-progress` route to pass all fields**

Replace the existing progress route handler body:

```typescript
router.post("/scrape-progress", async (req: Request, res: Response) => {
  try {
    const { jobId, processed, total, currentSite, message, currentPage, maxPages, pagesFetched, propertiesFound, duplicates, errors } = req.body;
    if (!jobId) {
      return res.status(400).json({ error: "jobId required" });
    }

    await ScrapeService.handleProgress(jobId, {
      processed, total, currentSite, message,
      currentPage, maxPages, pagesFetched, propertiesFound, duplicates, errors,
    });
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: "Internal error" });
  }
});
```

- [ ] **Step 7: Commit**

```bash
git add backend/src/socketServer.ts backend/src/services/scrape.service.ts backend/src/routes/internal.routes.ts
git commit -m "feat(backend): add scrape-property broadcast and enriched progress pipeline"
```

---

### Task 4: Extend frontend ScrapeJob hook with richer types

**Files:**
- Modify: `frontend/hooks/use-scrape-jobs.ts`

- [ ] **Step 1: Update the `ScrapeJob` interface**

Replace the existing `ScrapeJob` interface with one that matches what the backend actually returns:

```typescript
export interface ScrapeJob {
  id: string;
  type: string;
  status: "PENDING" | "RUNNING" | "COMPLETED" | "FAILED" | "CANCELLED";
  siteIds: string[];
  sites?: { id: string; name: string }[];
  totalListings: number;
  newListings: number;
  duplicates: number;
  errors: number;
  durationMs: number | null;
  startedAt: string | null;
  completedAt: string | null;
  searchQuery: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy?: { id: string; email: string; firstName: string | null };
  _count?: { logs: number };
  // Legacy fields (frontend may still reference these)
  totalItems: number;
  processedItems: number;
  successfulItems: number;
  failedItems: number;
  startTime: string | null;
  endTime: string | null;
  errorMessage: string | null;
}
```

- [ ] **Step 2: Add live progress and property interfaces**

Add these interfaces after `ScrapeJob`:

```typescript
export interface LiveProgress {
  jobId: string;
  processed: number;
  total: number;
  currentSite?: string;
  currentPage?: number;
  maxPages?: number;
  pagesFetched?: number;
  propertiesFound?: number;
  duplicates?: number;
  errors?: number;
  timestamp: string;
}

export interface LiveProperty {
  title?: string;
  price?: number;
  location?: string;
  bedrooms?: number;
  bathrooms?: number;
  image?: string;
  source?: string;
  timestamp: string;
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/hooks/use-scrape-jobs.ts
git commit -m "feat(frontend): extend ScrapeJob types with live progress and property interfaces"
```

---

## Chunk 2: Frontend Scraper Page Rewrite (Tasks 5–7)

### Task 5: Rewrite scraper page — Header + Left Column components

**Files:**
- Modify: `frontend/app/(dashboard)/scraper/page.tsx`

This is the largest task. The full page rewrite replaces the existing ~886-line file. We split the rewrite across Tasks 5–7 for review, but it's a single file.

- [ ] **Step 1: Replace imports and type definitions**

Replace the import block and interfaces at the top of the file with:

```tsx
"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useScrapeJobs, useStartScrape, useStopScrape, type LiveProgress, type LiveProperty } from "@/hooks/use-scrape-jobs";
import { useSocket } from "@/hooks/use-socket";
import {
  Play, Square, Terminal, Activity, CheckCircle2, AlertCircle,
  Clock, Sparkles, Settings2, X, Home, FileText, Copy,
  Layers, Circle, RefreshCcw,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { useSites, type Site } from "@/hooks/use-sites";
import Link from "next/link";
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

// --- Helper components ---

function AnimatedCounter({ value, className }: { value: number; className?: string }) {
  const [displayed, setDisplayed] = useState(value);
  const ref = useRef(value);

  useEffect(() => {
    if (value === ref.current) return;
    const start = ref.current;
    const diff = value - start;
    const duration = 400;
    const startTime = performance.now();

    const tick = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayed(Math.round(start + diff * eased));
      if (progress < 1) requestAnimationFrame(tick);
      else ref.current = value;
    };
    requestAnimationFrame(tick);
  }, [value]);

  return <span className={className}>{displayed.toLocaleString()}</span>;
}

function StatRow({ icon: Icon, label, value, color }: {
  icon: React.ElementType; label: string; value: number; color: string;
}) {
  const colorMap: Record<string, string> = {
    blue: "bg-blue-500/10 text-blue-500",
    green: "bg-green-500/10 text-green-500",
    amber: "bg-amber-500/10 text-amber-500",
    red: "bg-red-500/10 text-red-500",
  };
  const [bg, text] = (colorMap[color] || colorMap.blue).split(" ");
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <div className={`w-7 h-7 rounded-lg ${bg} flex items-center justify-center`}>
          <Icon className={`w-3.5 h-3.5 ${text}`} />
        </div>
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <AnimatedCounter value={value} className="text-lg font-bold font-display" />
    </div>
  );
}

function MiniStat({ label, value, color }: { label: string; value: string | number; color?: string }) {
  const textColor = color === "green" ? "text-green-500" : color === "amber" ? "text-amber-500" : color === "red" ? "text-red-500" : "text-foreground";
  return (
    <div className="bg-secondary/30 rounded-lg p-2.5 text-center">
      <p className={`text-lg font-bold font-display ${textColor}`}>{value}</p>
      <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">{label}</p>
    </div>
  );
}

function formatElapsed(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}m ${sec.toString().padStart(2, "0")}s`;
}

function formatPrice(price: number): string {
  if (price >= 1_000_000) return `₦${(price / 1_000_000).toFixed(1)}M`;
  if (price >= 1_000) return `₦${(price / 1_000).toFixed(0)}K`;
  return `₦${price.toLocaleString()}`;
}
```

- [ ] **Step 2: Write the main component state and socket setup**

Continue the file with the main component declaration, state, and socket event wiring. This replaces the old `export default function ScraperPage()` entirely. The full component body continues in steps 3–7 of this task and Tasks 6–7.

```tsx
export default function ScraperPage() {
  // --- State ---
  const { data: jobs, refetch: refetchJobs } = useScrapeJobs();
  const { data: sitesData } = useSites();
  const sites = sitesData || [];
  const startScrape = useStartScrape();
  const stopScrape = useStopScrape();

  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);

  // Saved config
  const [savedConfig, setSavedConfig] = useState<ScrapeConfig | null>(null);
  const [scrapeMode, setScrapeMode] = useState<"PASSIVE_BULK" | "ACTIVE_INTENT">("PASSIVE_BULK");
  const [selectedSiteIds, setSelectedSiteIds] = useState<string[]>([]);
  const [searchQueryParam, setSearchQueryParam] = useState("");
  const [maxDepth, setMaxDepth] = useState(50);
  const [scheduleTime, setScheduleTime] = useState("");

  // Live state
  const [liveProgress, setLiveProgress] = useState<LiveProgress | null>(null);
  const [liveProperties, setLiveProperties] = useState<LiveProperty[]>([]);
  const [logs, setLogs] = useState<{ id: string; level: string; message: string; timestamp: string }[]>([]);
  const [jobStartTime, setJobStartTime] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [completionStats, setCompletionStats] = useState<Record<string, unknown> | null>(null);
  const [pipelineSites, setPipelineSites] = useState<{ id: string; name: string; status: "queued" | "active" | "done"; found: number; max: number }[]>([]);

  const logsEndRef = useRef<HTMLDivElement>(null);
  const logsSectionRef = useRef<HTMLDivElement>(null);

  // Socket
  const { socket, isConnected } = useSocket({ namespace: "/scrape" });

  // Active job
  const activeJob = useMemo(() => jobs?.find((j) => j.status === "RUNNING" || j.status === "PENDING"), [jobs]);
  const justCompleted = useMemo(() => {
    if (activeJob) return null;
    return completionStats ? completionStats : null;
  }, [activeJob, completionStats]);

  // Page state: "idle" | "running" | "complete"
  const pageState = activeJob ? "running" : justCompleted ? "complete" : "idle";

  // Mobile detection
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // Load saved config
  useEffect(() => {
    const config = loadSavedConfig();
    if (config) {
      setSavedConfig(config);
      setScrapeMode(config.scrapeMode);
      setSelectedSiteIds(config.selectedSiteIds);
      setSearchQueryParam(config.searchQueryParam);
      setMaxDepth(config.maxDepth);
      setScheduleTime(config.scheduleTime);
    }
  }, []);

  // Auto-scroll logs
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  // Elapsed timer
  useEffect(() => {
    if (!activeJob || !jobStartTime) return;
    const interval = setInterval(() => setElapsed(Date.now() - jobStartTime), 1000);
    return () => clearInterval(interval);
  }, [activeJob, jobStartTime]);

  // Socket event listeners
  useEffect(() => {
    if (!socket) return;

    // Join active job room
    if (activeJob) {
      socket.emit("join:job", activeJob.id);
    }

    const onProgress = (data: LiveProgress) => {
      setLiveProgress(data);
      // Update pipeline site status
      if (data.currentSite) {
        setPipelineSites((prev) =>
          prev.map((s) =>
            s.name === data.currentSite
              ? { ...s, status: "active" as const, found: data.propertiesFound || s.found }
              : s.status === "active" && s.name !== data.currentSite
                ? { ...s, status: "done" as const }
                : s
          )
        );
      }
    };

    const onLog = (data: { id?: string; level: string; message: string; timestamp: string }) => {
      setLogs((prev) => [...prev, { id: data.id || crypto.randomUUID(), level: data.level?.toLowerCase(), message: data.message, timestamp: data.timestamp }]);
    };

    const onProperty = (data: { property: LiveProperty; timestamp: string }) => {
      setLiveProperties((prev) => [{ ...data.property, timestamp: data.timestamp }, ...prev].slice(0, 100));
    };

    const onComplete = (data: { stats: Record<string, unknown> }) => {
      setCompletionStats(data.stats);
      setLiveProgress(null);
      setJobStartTime(null);
      refetchJobs();
      toast.success("Scrape job completed!");
    };

    const onError = (data: { error: string }) => {
      toast.error(`Scrape failed: ${data.error}`);
      setLiveProgress(null);
      setJobStartTime(null);
      refetchJobs();
    };

    socket.on("job:progress", onProgress);
    socket.on("job:log", onLog);
    socket.on("scrape_log", onLog);
    socket.on("job:property", onProperty);
    socket.on("job:completed", onComplete);
    socket.on("job:error", onError);
    socket.on("job_update", () => refetchJobs());

    return () => {
      socket.off("job:progress", onProgress);
      socket.off("job:log", onLog);
      socket.off("scrape_log", onLog);
      socket.off("job:property", onProperty);
      socket.off("job:completed", onComplete);
      socket.off("job:error", onError);
      socket.off("job_update");
      if (activeJob) socket.emit("leave:job", activeJob.id);
    };
  }, [socket, activeJob, refetchJobs]);
```

- [ ] **Step 3: Write config save/dispatch handlers**

Continue the component with handler functions:

```tsx
  // --- Handlers ---
  const handleSaveConfig = useCallback(() => {
    const config: ScrapeConfig = { scrapeMode, selectedSiteIds, searchQueryParam, maxDepth, scheduleTime };
    localStorage.setItem(SAVED_CONFIG_KEY, JSON.stringify(config));
    setSavedConfig(config);
    setIsConfigOpen(false);
    toast.success("Configuration saved");
  }, [scrapeMode, selectedSiteIds, searchQueryParam, maxDepth, scheduleTime]);

  const handleSaveAndRun = useCallback(async () => {
    handleSaveConfig();
    if (selectedSiteIds.length === 0) {
      toast.error("Select at least one site");
      return;
    }
    try {
      // Initialize pipeline sites
      const pSites = selectedSiteIds.map((id) => {
        const site = sites.find((s: Site) => s.id === id);
        return { id, name: site?.name || id, status: "queued" as const, found: 0, max: maxDepth };
      });
      setPipelineSites(pSites);
      setLogs([]);
      setLiveProperties([]);
      setCompletionStats(null);
      setJobStartTime(Date.now());

      await startScrape.mutateAsync({
        type: scrapeMode,
        siteIds: selectedSiteIds,
        searchQuery: searchQueryParam || undefined,
        maxListingsPerSite: maxDepth,
      });
      setIsConfigOpen(false);
      toast.success("Scrape job started!");
      refetchJobs();
    } catch (err: any) {
      toast.error(err?.message || "Failed to start scrape");
    }
  }, [handleSaveConfig, selectedSiteIds, sites, maxDepth, scrapeMode, searchQueryParam, startScrape, refetchJobs]);

  const handleDispatch = useCallback(async () => {
    if (!savedConfig || savedConfig.selectedSiteIds.length === 0) {
      toast.error("No saved configuration. Open config first.");
      return;
    }
    const pSites = savedConfig.selectedSiteIds.map((id) => {
      const site = sites.find((s: Site) => s.id === id);
      return { id, name: site?.name || id, status: "queued" as const, found: 0, max: savedConfig.maxDepth };
    });
    setPipelineSites(pSites);
    setLogs([]);
    setLiveProperties([]);
    setCompletionStats(null);
    setJobStartTime(Date.now());

    try {
      await startScrape.mutateAsync({
        type: savedConfig.scrapeMode,
        siteIds: savedConfig.selectedSiteIds,
        searchQuery: savedConfig.searchQueryParam || undefined,
        maxListingsPerSite: savedConfig.maxDepth,
      });
      toast.success("Scrape job started!");
      refetchJobs();
    } catch (err: any) {
      toast.error(err?.message || "Failed to start scrape");
    }
  }, [savedConfig, sites, startScrape, refetchJobs]);

  const handleStop = useCallback(async () => {
    if (!activeJob) return;
    try {
      await stopScrape.mutateAsync(activeJob.id);
      toast.info("Stop signal sent");
      refetchJobs();
    } catch {
      toast.error("Failed to stop job");
    }
  }, [activeJob, stopScrape, refetchJobs]);

  const toggleSite = useCallback((id: string) => {
    setSelectedSiteIds((prev) => prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]);
  }, []);
```

- [ ] **Step 4: Commit progress (partial — page will be incomplete until Task 7)**

No commit yet — we continue building the JSX in Tasks 6 and 7.

---

### Task 6: Rewrite scraper page — Config SideSheet content

**Files:**
- Modify: `frontend/app/(dashboard)/scraper/page.tsx` (continued)

- [ ] **Step 1: Write the config sheet content JSX**

Continue the component with the config content (rendered inside the SideSheet/BottomSheet):

```tsx
  // --- Config content (shared between SideSheet and BottomSheet) ---
  const configContent = (
    <div className="h-full flex flex-col">
      {/* Config Header */}
      <div className="p-5 border-b border-border/50 flex items-center justify-between bg-gradient-to-r from-primary/5 to-transparent">
        <div>
          <h2 className="font-display font-bold text-lg">Configure Scraper</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Set up and dispatch a scrape job</p>
        </div>
        <button onClick={() => setIsConfigOpen(false)} className="p-2 rounded-xl hover:bg-secondary transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-6 scroller">
        {/* Mode Selection */}
        <div>
          <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 block">Scrape Mode</label>
          <div className="grid grid-cols-2 gap-2">
            {(["PASSIVE_BULK", "ACTIVE_INTENT"] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setScrapeMode(mode)}
                className={`p-3 rounded-xl border text-left transition-all ${
                  scrapeMode === mode
                    ? "border-primary bg-primary/5 shadow-sm"
                    : "border-border/50 hover:border-border hover:bg-secondary/30"
                }`}
              >
                <span className="text-sm font-semibold block">{mode === "PASSIVE_BULK" ? "Bulk Scrape" : "Active Search"}</span>
                <span className="text-[10px] text-muted-foreground">{mode === "PASSIVE_BULK" ? "Scrape listing pages" : "Search-based scraping"}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Site Selection */}
        <div>
          <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 block">
            Sites ({selectedSiteIds.length}/{sites.length})
          </label>
          <div className="space-y-1.5 max-h-[200px] overflow-y-auto scroller">
            {sites.map((site: Site) => (
              <button
                key={site.id}
                onClick={() => toggleSite(site.id)}
                className={`w-full flex items-center gap-3 p-2.5 rounded-xl border transition-all text-left ${
                  selectedSiteIds.includes(site.id)
                    ? "border-primary/50 bg-primary/5"
                    : "border-border/30 hover:bg-secondary/30"
                }`}
              >
                <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors ${
                  selectedSiteIds.includes(site.id) ? "border-primary bg-primary" : "border-border"
                }`}>
                  {selectedSiteIds.includes(site.id) && <CheckCircle2 className="w-3 h-3 text-white" />}
                </div>
                <div className="min-w-0">
                  <span className="text-sm font-medium block truncate">{site.name}</span>
                  <span className="text-[10px] text-muted-foreground truncate block">{site.baseUrl}</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Search Query (for ACTIVE_INTENT) */}
        {scrapeMode === "ACTIVE_INTENT" && (
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 block">Search Query</label>
            <input
              type="text"
              value={searchQueryParam}
              onChange={(e) => setSearchQueryParam(e.target.value)}
              placeholder="e.g. 3 bedroom flat in Lekki"
              className="w-full px-3 py-2.5 rounded-xl border border-border/50 bg-secondary/20 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50"
            />
          </div>
        )}

        {/* Max Listings */}
        <div>
          <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 block">
            Max Listings Per Site: {maxDepth}
          </label>
          <input
            type="range"
            min={10}
            max={500}
            step={10}
            value={maxDepth}
            onChange={(e) => setMaxDepth(Number(e.target.value))}
            className="w-full accent-primary"
          />
          <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
            <span>10</span><span>250</span><span>500</span>
          </div>
        </div>

        {/* Schedule (optional) */}
        <div>
          <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
            <Clock className="w-3 h-3" /> Schedule (Optional)
          </label>
          <DateTimePicker
            value={scheduleTime ? new Date(scheduleTime) : undefined}
            onChange={(d) => setScheduleTime(d ? d.toISOString() : "")}
            placeholder="Select date and time"
          />
        </div>
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-border/50 flex gap-2 bg-card shrink-0">
        <button
          onClick={handleSaveAndRun}
          disabled={selectedSiteIds.length === 0 || startScrape.isPending}
          className="flex-1 py-2.5 rounded-xl bg-primary text-white text-sm font-bold hover:bg-primary/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
        >
          {startScrape.isPending ? "Starting..." : "Save & Run"}
        </button>
        <button
          onClick={handleSaveConfig}
          className="px-4 py-2.5 rounded-xl border border-border text-sm font-semibold hover:bg-secondary transition-colors"
        >
          Save
        </button>
        <button
          onClick={() => setIsConfigOpen(false)}
          className="px-4 py-2.5 rounded-xl border border-border/50 text-sm text-muted-foreground hover:bg-secondary transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
```

- [ ] **Step 2: No commit yet — continue to Task 7**

---

### Task 7: Rewrite scraper page — Main JSX layout and return

**Files:**
- Modify: `frontend/app/(dashboard)/scraper/page.tsx` (continued)

- [ ] **Step 1: Write the return JSX**

This is the main page layout with all sections:

```tsx
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold uppercase tracking-widest mb-3">
            <Sparkles className="w-3.5 h-3.5" />
            Core Systems
          </div>
          <h1 className="font-display text-3xl md:text-4xl font-bold">Scraper</h1>
          <p className="text-muted-foreground mt-2 text-sm">
            Configure, dispatch, and monitor web scraping jobs.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Connection status */}
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <div className={`w-2 h-2 rounded-full ${isConnected ? "bg-green-500 animate-pulse" : "bg-red-500"}`} />
            {isConnected ? "Connected" : "Disconnected"}
          </div>
          {/* Action button */}
          {activeJob ? (
            <button
              onClick={handleStop}
              className="px-4 py-2.5 rounded-xl bg-red-500 text-white text-sm font-bold hover:bg-red-600 transition-all shadow-sm flex items-center gap-2"
            >
              <Square className="w-3.5 h-3.5" /> Stop Job
            </button>
          ) : (
            <button
              onClick={() => setIsConfigOpen(true)}
              className="px-4 py-2.5 rounded-xl bg-primary text-white text-sm font-bold hover:bg-primary/90 transition-all shadow-sm flex items-center gap-2"
            >
              <Settings2 className="w-3.5 h-3.5" /> Configure & Run
            </button>
          )}
        </div>
      </div>

      {/* Saved Config Summary */}
      {savedConfig && !activeJob && pageState === "idle" && (
        <Card className="border border-border/50">
          <CardContent className="py-4 px-5 flex items-center justify-between">
            <div className="flex items-center gap-3 text-sm">
              <Settings2 className="w-4 h-4 text-muted-foreground" />
              <span className="font-medium">{savedConfig.selectedSiteIds.length} site(s)</span>
              <span className="text-muted-foreground">·</span>
              <span className="text-muted-foreground">{savedConfig.scrapeMode === "PASSIVE_BULK" ? "Bulk" : "Active"}</span>
              <span className="text-muted-foreground">·</span>
              <span className="text-muted-foreground">Max {savedConfig.maxDepth}/site</span>
            </div>
            <button
              onClick={handleDispatch}
              disabled={startScrape.isPending}
              className="px-4 py-2 rounded-xl bg-primary text-white text-xs font-bold hover:bg-primary/90 transition-all disabled:opacity-50 flex items-center gap-1.5"
            >
              <Play className="w-3 h-3" /> Run Now
            </button>
          </CardContent>
        </Card>
      )}

      {/* Main 2-column grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* LEFT COLUMN */}
        <div className="lg:col-span-4 space-y-4">
          {/* Live Stats / Idle / Complete Card */}
          {pageState === "idle" && (
            <Card>
              <CardContent className="py-8 text-center">
                <Activity className="w-8 h-8 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-sm font-medium">Ready</p>
                <p className="text-xs text-muted-foreground">No active jobs.</p>
              </CardContent>
            </Card>
          )}

          {pageState === "running" && (
            <Card className="overflow-hidden">
              <div className="h-1 bg-gradient-to-r from-primary to-accent animate-pulse" />
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center justify-between text-sm">
                  Live Activity
                  <span className="text-xs bg-blue-500/10 text-blue-500 px-2.5 py-1 rounded-full font-bold">
                    <Activity className="w-3 h-3 animate-pulse inline mr-1" /> Running
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <StatRow icon={FileText} label="Pages Fetched" value={liveProgress?.pagesFetched || 0} color="blue" />
                <StatRow icon={Home} label="Properties Found" value={liveProgress?.propertiesFound || 0} color="green" />
                <StatRow icon={Copy} label="Duplicates" value={liveProgress?.duplicates || 0} color="amber" />
                <StatRow icon={AlertCircle} label="Errors" value={liveProgress?.errors || 0} color="red" />

                <div className="pt-3 border-t border-border/50 space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Current Site</span>
                    <span className="font-medium truncate ml-2">{liveProgress?.currentSite || "—"}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Page</span>
                    <span className="font-medium">{liveProgress?.currentPage || 0} / {liveProgress?.maxPages || "?"}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Elapsed</span>
                    <span className="font-mono font-medium">{formatElapsed(elapsed)}</span>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="h-2 rounded-full bg-secondary/50 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-primary to-accent transition-all duration-500"
                    style={{ width: `${liveProgress?.total ? Math.min(100, ((liveProgress.processed || 0) / liveProgress.total) * 100) : 0}%` }}
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {pageState === "complete" && completionStats && (
            <Card className="overflow-hidden">
              <div className="h-1 bg-gradient-to-r from-green-500 to-emerald-400" />
              <CardContent className="py-6 space-y-4">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-green-500" />
                  <span className="font-bold">Job Complete</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <MiniStat label="New Properties" value={completionStats.newListings as number || 0} color="green" />
                  <MiniStat label="Duplicates" value={completionStats.duplicates as number || 0} color="amber" />
                  <MiniStat label="Errors" value={completionStats.errors as number || 0} color="red" />
                  <MiniStat label="Total" value={completionStats.totalListings as number || 0} />
                </div>
                <div className="flex gap-2 pt-2">
                  <Link href="/properties?sort=newest" className="flex-1 px-4 py-2.5 rounded-xl bg-primary text-white text-sm font-bold text-center hover:bg-primary/90 transition-all">
                    View Properties
                  </Link>
                  <button onClick={() => setIsConfigOpen(true)} className="px-4 py-2.5 rounded-xl border text-sm font-semibold hover:bg-secondary transition-colors">
                    New Job
                  </button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Pipeline Queue (batch jobs only) */}
          {pageState === "running" && pipelineSites.length > 1 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Layers className="w-4 h-4 text-muted-foreground" />
                  Pipeline
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1.5">
                {pipelineSites.map((site) => (
                  <div key={site.id} className="flex items-center gap-2.5 py-1.5">
                    {site.status === "done" && <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />}
                    {site.status === "active" && <RefreshCcw className="w-4 h-4 text-primary animate-spin shrink-0" />}
                    {site.status === "queued" && <Circle className="w-4 h-4 text-muted-foreground/30 shrink-0" />}
                    <span className={`text-xs flex-1 truncate ${site.status === "queued" ? "text-muted-foreground" : "text-foreground"}`}>
                      {site.name}
                    </span>
                    <span className="text-xs font-mono text-muted-foreground">{site.found}/{site.max}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Execution History */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Clock className="w-4 h-4 text-muted-foreground" />
                History
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 max-h-[300px] overflow-y-auto scroller">
              {!jobs || jobs.length === 0 ? (
                <p className="text-xs text-muted-foreground py-4 text-center">No jobs yet</p>
              ) : (
                jobs.slice(0, 15).map((job) => (
                  <button
                    key={job.id}
                    onClick={() => setSelectedJobId(job.id)}
                    className={`w-full flex items-center gap-2 py-2 px-2 rounded-lg text-left transition-colors hover:bg-secondary/50 ${selectedJobId === job.id ? "bg-secondary/50" : ""}`}
                  >
                    <div className={`w-2 h-2 rounded-full shrink-0 ${
                      job.status === "COMPLETED" ? "bg-green-500" :
                      job.status === "FAILED" ? "bg-red-500" :
                      job.status === "RUNNING" ? "bg-blue-500 animate-pulse" :
                      job.status === "CANCELLED" ? "bg-amber-500" :
                      "bg-muted-foreground/30"
                    }`} />
                    <span className="text-xs flex-1 truncate">{formatDistanceToNow(new Date(job.createdAt), { addSuffix: true })}</span>
                    <span className="text-[10px] font-mono text-muted-foreground">{job.totalListings || job.totalItems || 0}</span>
                  </button>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        {/* RIGHT COLUMN */}
        <div className="lg:col-span-8 space-y-4">
          {/* Live Terminal Logs */}
          <Card className="bg-white dark:bg-[#0A0A0B] border border-border dark:border-white/10 shadow-xl overflow-hidden rounded-2xl">
            <CardHeader className="pb-3 border-b border-border dark:border-white/10 bg-slate-50/80 dark:bg-[#0A0A0B]/80 backdrop-blur-xl shrink-0">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xs font-mono font-medium flex items-center gap-2 text-slate-500 dark:text-zinc-400">
                  <Terminal className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">scraper:~$ live-logs</span>
                  <span className="sm:hidden">logs</span>
                </CardTitle>
                <div className="flex items-center gap-1.5 opacity-50">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
                  <div className="w-2.5 h-2.5 rounded-full bg-yellow-500" />
                  <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-4 min-h-[350px] max-h-[500px] overflow-y-auto font-mono text-xs bg-white dark:bg-[#0A0A0B] text-slate-700 dark:text-zinc-300 scroller">
              {logs.length === 0 ? (
                <div className="h-full min-h-[300px] flex flex-col items-center justify-center text-slate-400 dark:text-zinc-700">
                  <Terminal className="w-10 h-10 mb-4 opacity-20" />
                  <p className="italic text-sm">
                    {pageState === "running" ? "Waiting for logs..." : "No logs yet. Start a job to see live output."}
                  </p>
                </div>
              ) : (
                <div className="space-y-1.5 pb-4">
                  {logs.map((log) => (
                    <div key={log.id} className="flex items-start gap-2 sm:gap-3 hover:bg-white/[0.02] p-0.5 -mx-0.5 rounded transition-colors">
                      <span className="text-zinc-500 shrink-0 select-none hidden sm:inline text-[11px]">
                        {new Date(log.timestamp).toLocaleTimeString([], { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                      </span>
                      <span className={`shrink-0 uppercase w-10 text-[10px] font-bold tracking-wider pt-0.5 ${
                        log.level === "error" ? "text-red-400" :
                        log.level === "warn" ? "text-yellow-400" :
                        log.level === "debug" ? "text-zinc-500" :
                        "text-blue-400"
                      }`}>
                        {log.level}
                      </span>
                      <span className={`flex-1 break-all text-[11px] leading-relaxed ${
                        log.level === "error" ? "text-red-300" :
                        log.level === "warn" ? "text-yellow-200" :
                        "text-zinc-300"
                      }`}>
                        {log.message}
                      </span>
                    </div>
                  ))}
                  {pageState === "running" && (
                    <div className="flex items-center gap-1 text-zinc-600 pt-1">
                      <span className="animate-pulse">{">>"}_</span>
                    </div>
                  )}
                  <div ref={logsEndRef} />
                </div>
              )}
            </CardContent>
          </Card>

          {/* Incoming Properties Feed */}
          {(pageState === "running" || (pageState === "complete" && liveProperties.length > 0)) && (
            <Card className="border">
              <CardHeader className="pb-3 border-b border-border/50">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Home className="w-4 h-4 text-muted-foreground" />
                  Incoming Properties
                  <span className="text-xs bg-green-500/10 text-green-600 px-2 py-0.5 rounded-full font-bold ml-auto">
                    {liveProperties.length}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="max-h-[300px] overflow-y-auto divide-y divide-border/30 scroller">
                {liveProperties.length === 0 ? (
                  <div className="py-6 text-center text-xs text-muted-foreground">
                    Waiting for properties...
                  </div>
                ) : (
                  liveProperties.map((prop, i) => (
                    <div key={i} className="py-3 flex items-start gap-3">
                      {prop.image && (
                        <img src={prop.image} alt="" className="w-12 h-12 rounded-lg object-cover shrink-0" />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{prop.title || "Untitled"}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          {prop.price && (
                            <span className="text-xs font-bold" style={{ color: "var(--accent)" }}>
                              {formatPrice(prop.price)}
                            </span>
                          )}
                          <span className="text-[10px] text-muted-foreground">
                            {prop.source}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 mt-1 text-[10px] text-muted-foreground">
                          {prop.bedrooms && <span>{prop.bedrooms} bed</span>}
                          {prop.bathrooms && <span>· {prop.bathrooms} bath</span>}
                          {prop.location && <span>· {prop.location}</span>}
                        </div>
                      </div>
                    </div>
                  ))
                )}
                {pageState === "complete" && liveProperties.length > 0 && (
                  <div className="py-3 text-center">
                    <Link href="/properties?sort=newest" className="text-xs font-semibold text-primary hover:underline">
                      View All in Properties →
                    </Link>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Scrape Logs Table */}
      <div ref={logsSectionRef}>
        <ScrapeLogsSection jobId={selectedJobId} onClearJobFilter={() => setSelectedJobId(null)} />
      </div>

      {/* Config Sheets */}
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
```

- [ ] **Step 2: Verify imports — remove unused, ensure all are present**

Check that these imports are at the top and that no unused imports remain:
- `Link` from `next/link` (used for "View Properties")
- Remove old imports: `Play, Coffee, SlidersHorizontal, Globe2, Search, Check, ChevronRight, Pencil, Save, RotateCcw, Dialog, DialogContent, DialogHeader, DialogTitle, AdvancedDateRangePicker, ModernLoader`

- [ ] **Step 3: Verify the file compiles**

Run:
```bash
cd frontend && npx tsc --noEmit app/\(dashboard\)/scraper/page.tsx 2>&1 | head -30
```

Expected: No errors (or only pre-existing errors from other files).

- [ ] **Step 4: Commit the full page rewrite**

```bash
git add frontend/app/\(dashboard\)/scraper/page.tsx frontend/hooks/use-scrape-jobs.ts
git commit -m "feat(frontend): rewrite scraper page with live stats, pipeline queue, and property feed"
```

---

## Chunk 3: Integration Verification (Task 8)

### Task 8: End-to-end verification

- [ ] **Step 1: Start backend and verify compilation**

```bash
cd backend && npm run build
```

Expected: Clean compile with no errors.

- [ ] **Step 2: Start frontend and verify page loads**

```bash
cd frontend && npm run dev
```

Navigate to `http://localhost:3000/scraper`. Verify:
- Header shows "Scraper" title with connection indicator
- "Configure & Run" button opens SideSheet
- Idle card shows "Ready / No active jobs"
- History section loads previous jobs
- Scrape Logs table renders below

- [ ] **Step 3: Test a real scrape job**

1. Click "Configure & Run"
2. Select a site, set max listings to 10
3. Click "Save & Run"
4. Verify:
   - Live Stats card appears with counters ticking up
   - Pipeline queue shows site status
   - Terminal logs stream in with `[site_name]` prefixes
   - Incoming Properties feed shows scraped properties
5. Wait for completion
6. Verify completion card with stats and "View Properties" link

- [ ] **Step 4: Commit any fixes needed**

If any fixes were needed during verification, commit them:
```bash
git add -A
git commit -m "fix: address issues found during scraper page integration testing"
```
