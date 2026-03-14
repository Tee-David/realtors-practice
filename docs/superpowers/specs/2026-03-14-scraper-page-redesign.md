# Scraper Page Redesign — Live Confidence & Real-time Feedback

**Date:** 2026-03-14
**Problem:** When a scrape job runs, there's no confident indication that anything is actually happening. The UI doesn't show live progress, incoming data, or per-site pipeline status.
**Goal:** Make the scraper page feel alive during execution — live stats, live logs, live property feed, and batch queue visibility.

## Design Principles

- Keep the SideSheet configuration (user preference — do not change)
- Keep the terminal-style live log card aesthetic
- Follow existing design system: CSS variables, Space Grotesk headings, Outfit body, rounded-xl cards, backdrop-blur, gradient accents
- Every visual element must update in real-time via Socket.io
- Remove dramatic naming ("Extraction Engine" → "Scraper", "Terminate Signal" → "Stop Job")

## Page States

### State 1: Idle (no active job)

Compact header + quick-start prompt + execution history + empty terminal.

### State 2: Running (active job)

Full live dashboard: stats counters, pipeline queue, live logs, incoming property feed.

### State 3: Complete (job just finished)

Results summary card with stats + "View Properties" link + property preview.

---

## Layout Structure

```
┌──────────────────────────────────────────────────────────────┐
│  Header                                                      │
│  "Scraper" title · [Connected ●] status · [Configure] / [Stop] │
├──────────────────┬───────────────────────────────────────────┤
│                  │                                           │
│  LEFT COLUMN     │  RIGHT COLUMN                             │
│  (lg:col-span-4) │  (lg:col-span-8)                          │
│                  │                                           │
│  ┌────────────┐  │  ┌─────────────────────────────────────┐  │
│  │ Live Stats │  │  │ Live Terminal Logs                  │  │
│  │ or         │  │  │ (streaming, auto-scroll)            │  │
│  │ Idle Card  │  │  │                                     │  │
│  └────────────┘  │  └─────────────────────────────────────┘  │
│                  │                                           │
│  ┌────────────┐  │  ┌─────────────────────────────────────┐  │
│  │ Pipeline   │  │  │ Incoming Properties Feed            │  │
│  │ Queue      │  │  │ (live cards appearing as scraped)   │  │
│  │ (batch)    │  │  │                                     │  │
│  └────────────┘  │  └─────────────────────────────────────┘  │
│                  │                                           │
│  ┌────────────┐  │                                           │
│  │ Execution  │  │                                           │
│  │ History    │  │                                           │
│  └────────────┘  │                                           │
├──────────────────┴───────────────────────────────────────────┤
│  Scrape Logs (full filterable table — existing component)    │
└──────────────────────────────────────────────────────────────┘
```

---

## Component Details

### 1. Header (simplified)

```tsx
// Badge + title
<div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold uppercase tracking-widest mb-3">
  <Sparkles className="w-3.5 h-3.5" />
  Core Systems
</div>
<h1 className="font-display text-3xl md:text-4xl font-bold">Scraper</h1>
<p className="text-muted-foreground mt-2 text-sm">
  Configure, dispatch, and monitor web scraping jobs.
</p>

// Right side: connection status + action button
// Connected indicator: existing ping animation (keep as-is)
// When idle: "Configure & Run" button opens SideSheet
// When running: "Stop Job" button (red)
```

**Changes from current:**
- Title: "Extraction Engine" → "Scraper"
- Subtitle: shorter, less dramatic
- Remove the blurred background circle decoration
- Merge "Configure Crawler" into a single "Configure & Run" flow

### 2. Saved Config Summary Card (keep, simplify)

Keep the existing config summary card that appears after saving config. Change the dispatch flow:
- SideSheet footer: "Save & Run" (primary) + "Save" (secondary) + "Cancel" (outline)
- "Save & Run" saves config AND immediately dispatches
- "Save" saves config for later (existing behavior)
- This eliminates the two-step confusion

### 3. Live Stats Card (left column — replaces "Current Operation")

**When idle:**
```tsx
<Card>
  <CardContent className="py-8 text-center">
    <Activity className="w-8 h-8 text-muted-foreground/30 mx-auto mb-3" />
    <p className="text-sm font-medium">Ready</p>
    <p className="text-xs text-muted-foreground">No active jobs.</p>
  </CardContent>
</Card>
```

**When running:**
```tsx
<Card>
  <div className="h-1 bg-gradient-to-r from-primary to-accent" /> // animated gradient
  <CardHeader>
    <CardTitle className="flex items-center justify-between">
      Live Activity
      <span className="text-xs bg-blue-500/10 text-blue-500 px-2.5 py-1 rounded-full font-bold">
        <Activity className="w-3 h-3 animate-pulse inline mr-1" /> Running
      </span>
    </CardTitle>
  </CardHeader>
  <CardContent className="space-y-4">
    // Stat rows — each uses AnimatedCounter for smooth number transitions
    <StatRow icon={FileText} label="Pages Fetched" value={stats.pagesFetched} color="blue" />
    <StatRow icon={Home} label="Properties Found" value={stats.propertiesFound} color="green" />
    <StatRow icon={Copy} label="Duplicates" value={stats.duplicates} color="amber" />
    <StatRow icon={AlertCircle} label="Errors" value={stats.errors} color="red" />

    // Current context
    <div className="pt-3 border-t border-border/50 space-y-2">
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">Current Site</span>
        <span className="font-medium truncate ml-2">{stats.currentSite}</span>
      </div>
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">Page</span>
        <span className="font-medium">{stats.currentPage} / {stats.maxPages}</span>
      </div>
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">Elapsed</span>
        <span className="font-mono font-medium">{elapsedTime}</span>
      </div>
    </div>

    // Overall progress bar (existing striped animation)
    <ProgressBar value={stats.processed} max={stats.total} />
  </CardContent>
</Card>
```

**StatRow component:**
```tsx
function StatRow({ icon: Icon, label, value, color }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <div className={`w-7 h-7 rounded-lg bg-${color}-500/10 flex items-center justify-center`}>
          <Icon className={`w-3.5 h-3.5 text-${color}-500`} />
        </div>
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <AnimatedCounter value={value} className="text-lg font-bold font-display" />
    </div>
  );
}
```

**When complete:**
```tsx
<Card>
  <div className="h-1 bg-gradient-to-r from-green-500 to-emerald-400" />
  <CardContent className="py-6 space-y-4">
    <div className="flex items-center gap-2">
      <CheckCircle2 className="w-5 h-5 text-green-500" />
      <span className="font-bold">Job Complete</span>
    </div>

    <div className="grid grid-cols-2 gap-3">
      <MiniStat label="New Properties" value={47} color="green" />
      <MiniStat label="Duplicates" value={3} color="amber" />
      <MiniStat label="Errors" value={2} color="red" />
      <MiniStat label="Duration" value="4m 12s" />
    </div>

    <div className="flex gap-2 pt-2">
      <Link href="/properties?sort=newest" className="flex-1 px-4 py-2.5 rounded-xl bg-primary text-white text-sm font-bold text-center hover:bg-primary/90 transition-all">
        View Properties
      </Link>
      <button onClick={openConfig} className="px-4 py-2.5 rounded-xl border text-sm font-semibold hover:bg-secondary transition-colors">
        New Job
      </button>
    </div>
  </CardContent>
</Card>
```

### 4. Pipeline Queue Card (left column — new, for batch jobs)

Only shown when scraping multiple sites. Shows per-site progress:

```tsx
<Card>
  <CardHeader className="pb-3">
    <CardTitle className="text-sm font-semibold flex items-center gap-2">
      <Layers className="w-4 h-4 text-muted-foreground" />
      Pipeline
    </CardTitle>
  </CardHeader>
  <CardContent className="space-y-1.5">
    {sites.map(site => (
      <div key={site.id} className="flex items-center gap-2.5 py-1.5">
        // Status icon
        {site.status === 'done' && <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />}
        {site.status === 'active' && <RefreshCcw className="w-4 h-4 text-primary animate-spin shrink-0" />}
        {site.status === 'queued' && <Circle className="w-4 h-4 text-muted-foreground/30 shrink-0" />}

        // Site name + favicon
        <img src={faviconUrl} className="w-3.5 h-3.5 rounded-sm shrink-0" />
        <span className={`text-xs flex-1 truncate ${site.status === 'queued' ? 'text-muted-foreground' : 'text-foreground'}`}>
          {site.name}
        </span>

        // Count
        <span className="text-xs font-mono text-muted-foreground">
          {site.found}/{site.max}
        </span>
      </div>
    ))}
  </CardContent>
</Card>
```

### 5. Live Terminal Logs (right column — enhanced existing)

Keep the existing terminal card design (dark console, traffic light dots, monospace font). Enrich the log format:

```
[22:44:01] INFO  npc          Fetching /properties-for-sale (page 3/10)
[22:44:03] INFO  npc          Found 24 listing URLs
[22:44:05] INFO  npc          Extracting: "3 Bed Flat in Lekki Phase 1"
[22:44:06] WARN  npc          Missing price, attempting LLM fallback...
[22:44:07] INFO  npc          LLM extracted: ₦5,000,000
[22:44:09] INFO  npc          ✓ Property saved (14/50)
[22:44:12] WARN  propertypro  Cloudflare challenge detected, switching to Playwright...
[22:44:18] INFO  propertypro  Challenge bypassed, page loaded
[22:44:20] ERROR propertypro  Failed to extract from /listing/12345: timeout
```

**Key changes to log rendering:**
- Add site abbreviation column (color-coded per site)
- Keep existing level coloring (red/yellow/blue/green)
- Add subtle fade-in animation for new lines
- Show the `>>_` cursor blinking at the bottom when waiting for new logs

### 6. Incoming Properties Feed (right column — new)

Below the terminal, a compact scrolling feed of properties as they're scraped:

```tsx
<Card className="border">
  <CardHeader className="pb-3 border-b border-border/50">
    <CardTitle className="text-sm font-semibold flex items-center gap-2">
      <Home className="w-4 h-4 text-muted-foreground" />
      Incoming Properties
      <span className="text-xs bg-green-500/10 text-green-600 px-2 py-0.5 rounded-full font-bold ml-auto">
        {count}
      </span>
    </CardTitle>
  </CardHeader>
  <CardContent className="max-h-[300px] overflow-y-auto divide-y divide-border/30">
    {properties.map(prop => (
      <div key={prop.id} className="py-3 flex items-start gap-3 animate-in fade-in slide-in-from-top-1 duration-300">
        // Thumbnail (if available)
        {prop.image && (
          <img src={prop.image} className="w-12 h-12 rounded-lg object-cover shrink-0" />
        )}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium truncate">{prop.title}</p>
          <div className="flex items-center gap-2 mt-0.5">
            {prop.price && (
              <span className="text-xs font-bold" style={{ color: 'var(--accent)' }}>
                {formatPrice(prop.price)}
              </span>
            )}
            <span className="text-[10px] text-muted-foreground">
              {prop.source} · {timeAgo}
            </span>
          </div>
          <div className="flex items-center gap-1.5 mt-1 text-[10px] text-muted-foreground">
            {prop.bedrooms && <span>{prop.bedrooms} bed</span>}
            {prop.bathrooms && <span>· {prop.bathrooms} bath</span>}
            {prop.area && <span>· {prop.area}</span>}
          </div>
        </div>
      </div>
    ))}
  </CardContent>
</Card>
```

When no job is running, this section is hidden. When a job completes, it stays visible as a preview of what was scraped, with a "View All in Properties →" link at the bottom.

### 7. Execution History (left column — simplify)

Keep existing history card with:
- Status filter chips (All, Completed, Failed, Running)
- Remove the date range picker from the header (it's too cramped)
- Keep the click-to-filter-logs behavior
- Simplify job row: status badge, time ago, property count

### 8. Scrape Logs Table (bottom — keep existing)

Keep the `ScrapeLogsSection` component as-is. It's already well-built with filters, pagination, and detail modals.

### 9. Operation Errors Section — REMOVE

This section is redundant. Failed jobs already show in Execution History, and error details are in the Scrape Logs table. Remove entirely to reduce clutter.

---

## Backend/Socket Changes Needed

### Enriched progress events

The scraper's `report_progress` callback needs additional fields:

```python
await report_progress(
    job_id,
    processed=len(site_properties),
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

### New socket event: `scrape_property`

When a property is successfully extracted, emit it to the frontend:

```python
# In the scrape pipeline after validation
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

Backend broadcasts this via Socket.io on the `/scrape` namespace as `scrape_property` event.

### Enriched log format

Scraper logs should include the site name in the message for terminal display:

```python
await report_log(job_id, "INFO", f"[{site.name}] Fetching page {page_num + 1}: {page_url}")
```

---

## Files to Modify

1. **`frontend/app/(dashboard)/scraper/page.tsx`** — Full rewrite of the page component
2. **`scraper/app.py`** — Enrich `report_progress` calls, add `report_property` calls
3. **`scraper/utils/callback.py`** — Add `report_property()` function
4. **`backend/src/services/scrape.service.ts`** — Handle new `scrape-property` callback, broadcast via socket
5. **`backend/src/routes/internal.routes.ts`** — Add `/internal/scrape-property` route
6. **`backend/src/socketServer.ts`** — Add `broadcastScrapeProperty()` function
7. **`frontend/hooks/use-scrape-jobs.ts`** — Extend `ScrapeJob` interface with richer progress fields

## Files NOT Modified

- `frontend/components/ui/side-sheet.tsx` — untouched
- `frontend/components/ui/bottom-sheet.tsx` — untouched
- `frontend/components/scraper/scrape-logs-section.tsx` — untouched
- `frontend/components/ui/modern-loader.tsx` — still used in terminal during initial connection
