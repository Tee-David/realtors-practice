
/**
 * tour-steps.ts
 * Modular Shepherd.js step definitions — one export per page + fullAppTour.
 * Easy to update: find the page's export and add/modify steps.
 */

export interface ShepherdTour {
  back(): void;
  next(): void;
  cancel(): void;
  complete(): void;
  start(): void;
  on(event: string, handler: (data: unknown) => void): void;
  steps: unknown[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getElement(): HTMLElement | undefined;
}

export const tourOptions = {
  defaultStepOptions: {
    cancelIcon: { enabled: true },
    classes: "rp-tour-step",
    scrollTo: { behavior: "smooth", block: "center" } as ScrollIntoViewOptions,
    modalOverlayOpeningPadding: 12,
    modalOverlayOpeningRadius: 16,
  },
  useModalOverlay: true,
};

// ─── Helpers ────────────────────────────────────────────────────────────────

const btn = {
  back:  (ctx: "tour") => ({ classes: "rp-btn-secondary", text: "← Back",  action: function(this: ShepherdTour) { this.back();   } }),
  next:  (ctx: "tour") => ({ classes: "rp-btn-primary",   text: "Next →",  action: function(this: ShepherdTour) { this.next();   } }),
  skip:  ()  => ({ classes: "rp-btn-skip",      text: "Skip Tour",         action: function(this: ShepherdTour) { this.cancel(); } }),
  done:  ()  => ({ classes: "rp-btn-primary",   text: "🎉 Done!",          action: function(this: ShepherdTour) { this.complete(); } }),
  start: ()  => ({ classes: "rp-btn-primary",   text: "Let's Go 🚀",      action: function(this: ShepherdTour) { this.next();   } }),
  exit:  ()  => ({ classes: "rp-btn-secondary", text: "Exit",             action: function(this: ShepherdTour) { this.cancel(); } }),
};

const nav = (hasBack = true): object[] =>
  hasBack
    ? [btn.back("tour"), btn.next("tour"), btn.skip()]
    : [btn.exit(), btn.start(), btn.skip()];

const endNav = (): object[] => [btn.back("tour"), btn.done()];

const attach = (sel: string, pos: "bottom" | "top" | "right" | "left" = "bottom") => {
  if (typeof window === "undefined") return undefined;
  // On mobile, prefer bottom/top positioning since left/right can overflow
  const mobilePos = pos === "left" || pos === "right" ? "bottom" : pos;
  const finalPos = window.innerWidth < 768 ? mobilePos : pos;
  return { element: sel, on: finalPos };
};

// Rich step text builder
function richText(icon: string, heading: string, body: string, tip?: string): string {
  return `
    <div class="rp-step-body">
      <div class="rp-step-icon">${icon}</div>
      <p class="rp-step-heading">${heading}</p>
      <p class="rp-step-text">${body}</p>
      ${tip ? `<div class="rp-step-tip">💡 ${tip}</div>` : ""}
    </div>
  `;
}

// ─── Dashboard Steps ────────────────────────────────────────────────────────

export const dashboardSteps = (_router: unknown) => [
  {
    id: "dash-welcome",
    title: "Dashboard Overview",
    text: richText("📊", "Your Command Centre", "The dashboard gives you a live pulse on your entire property portfolio — KPIs, charts, and recent activity at a glance."),
    buttons: nav(false),
  },
  {
    id: "dash-kpis",
    title: "KPI Cards",
    text: richText("🔢", "Key Metrics", "These cards show your total properties, for-sale count, for-rent count, and total portfolio value. They update in real time.", "Trends show % change vs last period."),
    attachTo: attach("[data-tour='kpi-cards']"),
    buttons: nav(),
  },
  {
    id: "dash-chart",
    title: "Revenue Analytics",
    text: richText("📈", "Interactive Chart", "Switch between Sales and Rents views. Use the time range selector (7d/30d/1y) to zoom in or out.", "Hover over the chart for exact values."),
    attachTo: attach("[data-tour='revenue-chart']"),
    buttons: nav(),
  },
  {
    id: "dash-categories",
    title: "Category Breakdown",
    text: richText("🏗️", "Property Mix", "See how your listings are split across Residential, Commercial, Land, Shortlet, and Industrial categories.", "Wider bars = more listings in that category."),
    attachTo: attach("[data-tour='category-chart']", "top"),
    buttons: nav(),
  },
  {
    id: "dash-recent",
    title: "Recent Properties",
    text: richText("🏡", "Quick Property Access", "The table shows your 12 most recent listings. Click any row to open the full detail view.", "Toggle the Sale/Rent tab to filter."),
    attachTo: attach("[data-tour='explore-section']", "top"),
    buttons: endNav(),
  },
];

// ─── Properties Steps ────────────────────────────────────────────────────────

export const propertiesSteps = (_router: unknown) => [
  {
    id: "props-welcome",
    title: "Properties Page",
    text: richText("🏠", "Your Full Inventory", "Browse, filter, search, and manage every property in your database — from here you can do it all."),
    buttons: nav(false),
  },
  {
    id: "props-search",
    title: "Search Bar",
    text: richText("🔍", "Powerful Search", "Type naturally: '3 bed flat Lekki' or use the voice button to speak your query. The AI understands Nigerian property language.", "Try: '2 bedroom apartment VI under 5M'"),
    attachTo: attach("[data-tour='search-bar']"),
    buttons: nav(),
  },
  {
    id: "props-filters",
    title: "Filter Panel",
    text: richText("⚙️", "Advanced Filters", "Filter by listing type, category, price range, bedrooms, area, and more. Filters update the results instantly.", "Click 'More Filters' to unlock advanced options."),
    attachTo: attach("[data-tour='filter-panel']", "right"),
    buttons: nav(),
  },
  {
    id: "props-grid",
    title: "Grid / List / Map",
    text: richText("🗺️", "Three Views", "Switch between grid cards, a compact list, and an interactive map. On mobile, the map slides up from the bottom.", "The column picker lets you choose 2–6 columns."),
    attachTo: attach("[data-tour='view-toggle']"),
    buttons: nav(),
  },
  {
    id: "props-card",
    title: "Property Card",
    text: richText("🖼️", "Quick Actions", "Each card shows the image, title, price, type, and location. Hover to reveal quick-action buttons: view, compare, save.", "Click the card to open the full detail page."),
    attachTo: attach("[data-tour='property-card']"),
    buttons: endNav(),
  },
];

// ─── Property Detail Steps ────────────────────────────────────────────────────

export const propertyDetailSteps = (_router: unknown) => [
  {
    id: "detail-gallery",
    title: "Image Gallery",
    text: richText("📸", "Full Gallery", "Click the main image to open a fullscreen lightbox. Swipe or use arrow keys to browse all photos."),
    attachTo: attach("[data-tour='property-gallery']"),
    buttons: nav(false),
  },
  {
    id: "detail-info",
    title: "Property Details",
    text: richText("📋", "Rich Data", "Bedrooms, bathrooms, area, price, listing type, and all scraped fields are shown here. Collapsible sections keep it clean."),
    attachTo: attach("[data-tour='property-details']"),
    buttons: nav(),
  },
  {
    id: "detail-agent",
    title: "Agent Card",
    text: richText("👤", "Contact the Agent", "The right sidebar shows the agent's name, phone, WhatsApp, email, and verified badge. One tap to reach them."),
    attachTo: attach("[data-tour='agent-card']", "left"),
    buttons: nav(),
  },
  {
    id: "detail-source",
    title: "Source Intelligence",
    text: richText("🌐", "Data Provenance", "Know exactly where this listing came from — site name, original URL, scrape timestamp, and data freshness."),
    attachTo: attach("[data-tour='source-card']", "left"),
    buttons: nav(),
  },
  {
    id: "detail-quality",
    title: "Data Quality",
    text: richText("⭐", "Enrichment Score", "See the data quality score and missing fields. Click 'Send for Enrichment' to queue it for AI improvement.", "Versions are tracked — every edit creates a new version."),
    attachTo: attach("[data-tour='quality-card']", "left"),
    buttons: endNav(),
  },
];

// ─── Search Steps ────────────────────────────────────────────────────────────

export const searchSteps = (_router: unknown) => [
  {
    id: "search-bar",
    title: "AI-Powered Search",
    text: richText("🧠", "Natural Language Search", "Type a full sentence like '3 bedroom flat in Lekki under ₦30M with parking'. The AI extracts your intent automatically."),
    attachTo: attach("[data-tour='search-bar']"),
    buttons: nav(false),
  },
  {
    id: "search-voice",
    title: "Voice Input",
    text: richText("🎙️", "Speak Your Query", "Click the mic icon and describe what you're looking for. It will transcribe and search automatically."),
    attachTo: attach("[data-tour='voice-btn']"),
    buttons: nav(),
  },
  {
    id: "search-filters",
    title: "Filter Chips",
    text: richText("🏷️", "Quick Filters", "Use the filter chips below the search bar for fast access to common filters: listing type, price range, and bedrooms."),
    attachTo: attach("[data-tour='search-chips']"),
    buttons: nav(),
  },
  {
    id: "search-recent",
    title: "Recent Searches",
    text: richText("🕐", "Search History", "Your last 5 searches are saved locally. Click any to re-run it instantly."),
    buttons: nav(),
  },
  {
    id: "search-save",
    title: "Save a Search",
    text: richText("🔖", "Never Miss a Match", "After searching, click 'Save Search' to get notified when matching properties appear. Perfect for ongoing monitoring.", "You can manage all saved searches in the Saved Searches page."),
    buttons: endNav(),
  },
];

// ─── Scraper Steps ────────────────────────────────────────────────────────────

export const scraperSteps = (_router: unknown) => [
  {
    id: "scraper-welcome",
    title: "Scraper Command Center",
    text: richText("⚙️", "Live Data Collection", "This is your scraping command center. Monitor live progress, view terminal logs, and watch properties stream in as they're discovered.", "The connection indicator shows whether the real-time socket is active."),
    buttons: nav(false),
  },
  {
    id: "scraper-controls",
    title: "Configure & Run",
    text: richText("▶️", "Launch a Scrape", "Click 'Configure' to select your target sites, set scrape mode (passive or active), and optionally schedule a run. Then hit Dispatch to start.", "Your configuration is saved locally so you can re-run quickly."),
    attachTo: attach("[data-tour='scraper-controls']"),
    buttons: nav(),
  },
  {
    id: "scraper-stats",
    title: "Live Stats",
    text: richText("📊", "Real-Time Progress", "Watch pages fetched, properties found, duplicates skipped, and errors — all updating live with animated counters as the scraper works.", "When complete, you'll see a full summary with a link to view your new properties."),
    attachTo: attach("[data-tour='scraper-stats']"),
    buttons: nav(),
  },
  {
    id: "scraper-terminal",
    title: "Live Terminal",
    text: richText("🖥️", "Stream Logs", "A real terminal-style log viewer shows every action the scraper takes — page fetches, property extractions, errors, and more. Logs stream in real-time via Socket.io.", "Logs are colour-coded by level: blue for info, amber for warnings, red for errors."),
    attachTo: attach("[data-tour='scraper-terminal']", "left"),
    buttons: nav(),
  },
  {
    id: "scraper-feed",
    title: "Incoming Properties",
    text: richText("🏠", "Live Property Feed", "As properties are scraped, they appear here instantly — title, price, location, and thumbnail. This lets you verify data quality in real-time.", "Properties are saved to the database automatically after validation."),
    attachTo: attach("[data-tour='scraper-feed']", "left"),
    buttons: endNav(),
  },
];

// ─── Saved Searches Steps ────────────────────────────────────────────────────

export const savedSearchesSteps = (_router: unknown) => [
  {
    id: "ss-list",
    title: "Saved Searches",
    text: richText("🔖", "Your Watchlists", "Each card is a saved filter set. When new properties match, you'll get an in-app or email alert automatically."),
    buttons: nav(false),
  },
  {
    id: "ss-create",
    title: "Create a Search",
    text: richText("➕", "New Saved Search", "Click 'New Search' to set up filters: listing type (Buy/Rent/Lease/Shortlet/Land), property type (Flat/Duplex/etc.), price range, bedrooms, location, and more."),
    attachTo: attach("[data-tour='new-search-btn']"),
    buttons: nav(),
  },
  {
    id: "ss-matches",
    title: "View Matches",
    text: richText("✅", "Matching Properties", "Click 'View Matches' on any card to see all properties that currently match that search."),
    buttons: nav(),
  },
  {
    id: "ss-notify",
    title: "Notification Settings",
    text: richText("🔔", "Alert Modes", "Each search can send in-app alerts, email alerts, or both. You control how often and how you're notified."),
    buttons: endNav(),
  },
];

// ─── Data Explorer Steps ────────────────────────────────────────────────────

export const dataExplorerSteps = (_router: unknown) => [
  {
    id: "de-tabs",
    title: "Data Explorer",
    text: richText("🗂️", "Segmented Data Views", "Switch between All, Raw, Enriched, and Flagged tabs to see different data quality segments."),
    buttons: nav(false),
  },
  {
    id: "de-bulk",
    title: "Bulk Actions",
    text: richText("⚡", "Mass Operations", "Select multiple properties and run bulk actions: approve, reject, merge duplicates, send for enrichment, or export to CSV."),
    attachTo: attach("[data-tour='bulk-actions']"),
    buttons: nav(),
  },
  {
    id: "de-enrich",
    title: "Enrichment Queue",
    text: richText("🤖", "AI Enrichment", "Properties with low data quality can be sent for enrichment. The AI will attempt to fill missing fields from alternate sources."),
    buttons: nav(),
  },
  {
    id: "de-compare",
    title: "Compare Properties",
    text: richText("⚖️", "Side-by-Side View", "Select two or more properties and hit Compare to see all their fields side by side in a detailed table."),
    buttons: endNav(),
  },
];

// ─── Analytics Steps ────────────────────────────────────────────────────────

export const analyticsSteps = (_router: unknown) => [
  {
    id: "an-kpis",
    title: "Analytics at a Glance",
    text: richText("📊", "Portfolio KPIs", "Total properties, new this week, average price, and most active scraping site — all at the top."),
    buttons: nav(false),
  },
  {
    id: "an-time",
    title: "Time Range Selector",
    text: richText("📅", "Zoom In or Out", "Switch between 7 days, 30 days, 90 days, or 12 months to see how your data has grown over time."),
    attachTo: attach("[data-tour='time-range']"),
    buttons: nav(),
  },
  {
    id: "an-charts",
    title: "Five Charts",
    text: richText("📉", "Deep Insights", "Properties over time, listing type split, category breakdown, top areas, and status distribution — all interactive."),
    buttons: endNav(),
  },
];

// ─── Audit Log Steps ────────────────────────────────────────────────────────

export const auditLogSteps = (_router: unknown) => [
  {
    id: "al-intro",
    title: "Audit Log",
    text: richText("📋", "Full Activity Trail", "Every important action in the system is logged here — who did what, when, from which IP, and how severe."),
    buttons: nav(false),
  },
  {
    id: "al-filters",
    title: "Powerful Filters",
    text: richText("🔽", "Filter Everything", "Filter by action type, entity, severity (info/warning/critical), date range, keyword, IP address, or session ID.", "Filters are on by default so you can start narrowing immediately."),
    attachTo: attach("[data-tour='audit-filters']"),
    buttons: nav(),
  },
  {
    id: "al-rows",
    title: "Expandable Rows",
    text: richText("🔍", "Full Event Details", "Click any log row to expand it and see the complete JSON event payload — perfect for debugging."),
    buttons: nav(),
  },
  {
    id: "al-export",
    title: "Export CSV",
    text: richText("⬇️", "Download Logs", "Export the current filtered view as a CSV for reporting or compliance."),
    attachTo: attach("[data-tour='export-csv-btn']"),
    buttons: endNav(),
  },
];

// ─── Settings Steps ────────────────────────────────────────────────────────

export const settingsSteps = (_router: unknown) => [
  {
    id: "settings-nav",
    title: "Settings Sidebar",
    text: richText("⚙️", "9 Settings Sections", "Use the left sidebar (or the list on mobile) to navigate: Profile, Security, Notifications, Appearance, Data & Display, Email, Backups, About, and Users."),
    buttons: nav(false),
  },
  {
    id: "settings-profile",
    title: "Profile",
    text: richText("👤", "Your Identity", "Update your name, phone, bio, and avatar. Your email is locked for security — contact support to change it."),
    buttons: nav(),
  },
  {
    id: "settings-security",
    title: "Security",
    text: richText("🔒", "Stay Secure", "Change your password, link/unlink your Google account, view active sessions, and revoke unknown devices."),
    buttons: nav(),
  },
  {
    id: "settings-misc",
    title: "Other Settings",
    text: richText("✨", "Customise Everything", "Tweak your notification preferences, app theme, map provider, email delivery settings, and set up automatic backups.", "Each section has its own Save button."),
    buttons: endNav(),
  },
];

// ─── Full App Tour ────────────────────────────────────────────────────────────

export const fullAppTour = (router: { push: (path: string) => void }) => [
  // Welcome
  {
    id: "full-welcome",
    title: "Welcome to Realtors' Practice! 🏠",
    text: richText("🚀", "Full Platform Tour", "We'll walk you through every section of the app — from the Dashboard all the way to Settings. This takes about 3 minutes.", "You can press Skip Tour at any time."),
    buttons: nav(false),
  },

  // Sidebar
  {
    id: "full-sidebar",
    title: "Navigation Sidebar",
    text: richText("🧭", "Your Navigation Hub", "Hover or click to expand the sidebar. All major sections are here — Dashboard, Properties, Scraper, Search, Analytics, Saved Searches, Audit Log, and Settings."),
    attachTo: attach("[data-tour='sidebar']", "right"),
    buttons: nav(),
  },

  // Dashboard
  ...dashboardSteps(router).slice(1).map(s => ({ ...s, id: "full-" + s.id, buttons: nav() })),

  // Navigate to Properties
  {
    id: "full-nav-props",
    title: "Properties Page",
    text: richText("🏠", "Your Full Inventory", "Next, let's look at the Properties page where you manage all your listings."),
    buttons: [
      btn.back("tour"),
      { classes: "rp-btn-primary", text: "Go to Properties →", action: function(this: ShepherdTour) { router.push("/properties"); setTimeout(() => this.next(), 1200); } },
      btn.skip(),
    ],
  },

  // Properties
  ...propertiesSteps(router).slice(1).map(s => ({ ...s, id: "full-" + s.id, buttons: nav() })),

  // Navigate to Search
  {
    id: "full-nav-search",
    title: "Intelligent Search",
    text: richText("🔍", "Powerful Search", "Let's explore the AI-powered search experience."),
    buttons: [
      btn.back("tour"),
      { classes: "rp-btn-primary", text: "Go to Search →", action: function(this: ShepherdTour) { router.push("/search"); setTimeout(() => this.next(), 1200); } },
      btn.skip(),
    ],
  },

  // Search
  ...searchSteps(router).slice(1).map(s => ({ ...s, id: "full-" + s.id, buttons: nav() })),

  // Navigate to Scraper
  {
    id: "full-nav-scraper",
    title: "Scraper Command Center",
    text: richText("⚙️", "The Scraper", "Now let's see how you collect new property data."),
    buttons: [
      btn.back("tour"),
      { classes: "rp-btn-primary", text: "Go to Scraper →", action: function(this: ShepherdTour) { router.push("/scraper"); setTimeout(() => this.next(), 1200); } },
      btn.skip(),
    ],
  },

  // Scraper
  ...scraperSteps(router).slice(1).map(s => ({ ...s, id: "full-" + s.id, buttons: nav() })),

  // Navigate to Saved Searches
  {
    id: "full-nav-saved-searches",
    title: "Saved Searches",
    text: richText("🔖", "Your Watchlists", "Set up alerts for properties that match your criteria."),
    buttons: [
      btn.back("tour"),
      { classes: "rp-btn-primary", text: "Go to Saved Searches →", action: function(this: ShepherdTour) { router.push("/saved-searches"); setTimeout(() => this.next(), 1200); } },
      btn.skip(),
    ],
  },

  // Saved Searches
  ...savedSearchesSteps(router).slice(1).map(s => ({ ...s, id: "full-" + s.id, buttons: nav() })),

  // Navigate to Data Explorer
  {
    id: "full-nav-data-explorer",
    title: "Data Explorer",
    text: richText("🗂️", "Deep Data Access", "Inspect, filter, and manage your raw and enriched property data."),
    buttons: [
      btn.back("tour"),
      { classes: "rp-btn-primary", text: "Go to Data Explorer →", action: function(this: ShepherdTour) { router.push("/data-explorer"); setTimeout(() => this.next(), 1200); } },
      btn.skip(),
    ],
  },

  // Data Explorer
  ...dataExplorerSteps(router).slice(1).map(s => ({ ...s, id: "full-" + s.id, buttons: nav() })),

  // Navigate to Analytics
  {
    id: "full-nav-analytics",
    title: "Analytics",
    text: richText("📊", "Portfolio Insights", "Let's check out your analytics dashboard."),
    buttons: [
      btn.back("tour"),
      { classes: "rp-btn-primary", text: "Go to Analytics →", action: function(this: ShepherdTour) { router.push("/analytics"); setTimeout(() => this.next(), 1200); } },
      btn.skip(),
    ],
  },

  // Analytics
  ...analyticsSteps(router).slice(1).map(s => ({ ...s, id: "full-" + s.id, buttons: nav() })),

  // Navigate to Audit Log
  {
    id: "full-nav-audit-log",
    title: "Audit Log",
    text: richText("📋", "Activity Trail", "See every action taken in the system."),
    buttons: [
      btn.back("tour"),
      { classes: "rp-btn-primary", text: "Go to Audit Log →", action: function(this: ShepherdTour) { router.push("/audit-log"); setTimeout(() => this.next(), 1200); } },
      btn.skip(),
    ],
  },

  // Audit Log
  ...auditLogSteps(router).slice(1).map(s => ({ ...s, id: "full-" + s.id, buttons: nav() })),

  // Navigate to Settings
  {
    id: "full-nav-settings",
    title: "Settings",
    text: richText("⚙️", "Customise Your Experience", "Finally, let's walk through Settings."),
    buttons: [
      btn.back("tour"),
      { classes: "rp-btn-primary", text: "Go to Settings →", action: function(this: ShepherdTour) { router.push("/settings"); setTimeout(() => this.next(), 1200); } },
      btn.skip(),
    ],
  },

  // Settings
  ...settingsSteps(router).slice(1).map(s => ({ ...s, id: "full-" + s.id, buttons: nav() })),

  // Finish
  {
    id: "full-finish",
    title: "You're all set! 🎉",
    text: richText("🏆", "Tour Complete!", "You now know your way around Realtors' Practice. Start by adding a scraping site or running a search. Happy hunting!", "You can restart this tour anytime from the help menu."),
    buttons: [btn.back("tour"), btn.done()],
  },
];

// ─── Page Tour Map ────────────────────────────────────────────────────────────

export const PAGE_TOURS = [
  { key: "dashboard",     label: "Dashboard",      emoji: "📊", steps: dashboardSteps,     path: "/" },
  { key: "properties",    label: "Properties",     emoji: "🏠", steps: propertiesSteps,    path: "/properties" },
  { key: "detail",        label: "Property Detail", emoji: "📋", steps: propertyDetailSteps, path: "/properties" },
  { key: "search",        label: "Search",         emoji: "🔍", steps: searchSteps,        path: "/search" },
  { key: "scraper",       label: "Scraper",        emoji: "⚙️", steps: scraperSteps,       path: "/scraper" },
  { key: "saved-searches", label: "Saved Searches", emoji: "🔖", steps: savedSearchesSteps, path: "/saved-searches" },
  { key: "data-explorer", label: "Data Explorer",  emoji: "🗂️", steps: dataExplorerSteps,  path: "/data-explorer" },
  { key: "analytics",     label: "Analytics",      emoji: "📈", steps: analyticsSteps,     path: "/analytics" },
  { key: "audit-log",     label: "Audit Log",      emoji: "📋", steps: auditLogSteps,      path: "/audit-log" },
  { key: "settings",      label: "Settings",       emoji: "⚙️", steps: settingsSteps,      path: "/settings" },
];

// Legacy export for backward compat
export const defaultSteps = fullAppTour;
