"use client";

import { useState, useMemo, useEffect } from "react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { useSites, useToggleSite, useDeleteSite, useAddSite, useBulkToggleSites, useBulkDeleteSites, type Site } from "@/hooks/use-sites";
import {
  Plus, Search, MoreVertical, Trash2, Power, Globe, RefreshCcw, Database,
  Code, Zap, X, Copy, CheckSquare, Square, Layers, ListPlus, Download,
  Upload, List, LayoutGrid, ChevronLeft, ChevronRight, ToggleLeft, ToggleRight,
  Check, Grid2X2, Grid3X3
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type ViewMode = "list" | "grid";

const GRID_OPTIONS_DESKTOP = [2, 3, 4, 5, 6] as const;
const GRID_OPTIONS_MOBILE = [1, 2, 3] as const;
const PER_PAGE_OPTIONS = [6, 12, 18, 24, 36] as const;

function getFaviconUrl(baseUrl: string) {
  try {
    const hostname = new URL(baseUrl).hostname;
    return `https://www.google.com/s2/favicons?domain=${hostname}&sz=64`;
  } catch {
    return null;
  }
}

export default function SitesPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedSites, setSelectedSites] = useState<string[]>([]);

  // View state
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [gridCols, setGridCols] = useState(3);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(12);
  const [isMobile, setIsMobile] = useState(false);

  // Add Form State
  const [newSiteName, setNewSiteName] = useState("");
  const [urlProtocol, setUrlProtocol] = useState<"https://" | "http://">("https://");
  const [newSiteUrlPath, setNewSiteUrlPath] = useState("");
  const [bulkUrls, setBulkUrls] = useState("");
  const [addMode, setAddMode] = useState<"single" | "bulk">("single");

  const { data: sitesData, isLoading } = useSites(1, 100);
  const sites: Site[] = sitesData?.sites ?? [];
  const toggleSite = useToggleSite();
  const deleteSite = useDeleteSite();
  const addSite = useAddSite();
  const bulkToggle = useBulkToggleSites();
  const bulkDelete = useBulkDeleteSites();

  // Responsive
  useEffect(() => {
    const check = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (mobile && gridCols > 3) setGridCols(2);
    };
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, [gridCols]);

  // Filter + paginate
  const filteredSites = useMemo(() =>
    sites.filter(site =>
      site.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      site.baseUrl.toLowerCase().includes(searchQuery.toLowerCase())
    ), [sites, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filteredSites.length / perPage));
  const paginatedSites = useMemo(() => {
    const start = (page - 1) * perPage;
    return filteredSites.slice(start, start + perPage);
  }, [filteredSites, page, perPage]);

  // Reset page on search/perPage change
  useEffect(() => { setPage(1); }, [searchQuery, perPage]);

  const handleToggle = (id: string, currentStatus: boolean) => {
    toggleSite.mutate(id, {
      onSuccess: () => toast.success(`Source ${currentStatus ? 'disabled' : 'enabled'}`),
      onError: () => toast.error("Failed to toggle source")
    });
  };

  const handleDelete = (id: string) => {
    if (window.confirm("Remove this site permanently? This cannot be undone.")) {
      deleteSite.mutate(id, {
        onSuccess: () => {
          toast.success("Site removed");
          setSelectedSites(prev => prev.filter(s => s !== id));
        },
        onError: () => toast.error("Failed to remove site")
      });
    }
  };

  /** Generate a clean, valid key from a URL hostname */
  const generateKey = (url: string): string => {
    try {
      return new URL(url).hostname
        .replace(/^www\./, '')
        .replace(/[^a-z0-9]/g, '-')
        .replace(/-+/g, '-')      // collapse multiple hyphens
        .replace(/^-|-$/g, '')     // trim leading/trailing hyphens
        .toLowerCase();
    } catch {
      return url.replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').toLowerCase();
    }
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (addMode === "single") {
      if (!newSiteName || !newSiteUrlPath) {
        toast.error("Name and URL are required.");
        return;
      }
      // Ensure the URL path doesn't accidentally include a protocol
      const cleanPath = newSiteUrlPath.replace(/^https?:\/\//, '');
      const fullUrl = urlProtocol + cleanPath;

      // Validate URL before sending
      try { new URL(fullUrl); } catch {
        toast.error("Invalid URL. Please enter a valid website address.");
        return;
      }

      addSite.mutate({
        name: newSiteName,
        baseUrl: fullUrl,
        key: generateKey(fullUrl),
        enabled: true,
        selectors: {},
      }, {
        onSuccess: () => {
          toast.success("Site added!");
          setIsAddModalOpen(false);
          setNewSiteName("");
          setNewSiteUrlPath("");
        },
        onError: (err: any) => {
          const msg = err.response?.data?.message || err.response?.data?.error || err.message || "Failed to add site.";
          const details = err.response?.data?.details;
          if (details?.length) {
            toast.error(`${msg}: ${details.map((d: any) => `${d.field} — ${d.message}`).join(", ")}`);
          } else {
            toast.error(msg);
          }
        }
      });
    } else {
      const lines = bulkUrls.split(/\n/).map(u => u.trim()).filter(Boolean);
      if (lines.length === 0) { toast.error("Enter at least one source."); return; }
      const toastId = toast.loading(`Adding ${lines.length} sources...`);
      let successCount = 0;
      const errors: string[] = [];
      for (const line of lines) {
        try {
          let nameStr = "", urlStr = "";
          const parts = line.split(',');
          if (parts.length >= 2) { nameStr = parts[0].trim(); urlStr = parts.slice(1).join(',').trim(); }
          else { urlStr = line; }
          if (!urlStr.startsWith('http')) { if (nameStr?.startsWith('http')) { [urlStr, nameStr] = [nameStr, urlStr]; } }
          if (!urlStr.startsWith('http')) urlStr = 'https://' + urlStr;
          try { new URL(urlStr); } catch { errors.push(`Invalid URL: ${line}`); continue; }
          const hostname = new URL(urlStr).hostname.replace(/^www\./, '');
          await addSite.mutateAsync({ name: nameStr || hostname, baseUrl: urlStr, key: generateKey(urlStr), enabled: true, selectors: {} });
          successCount++;
        } catch (err: any) {
          const msg = err.response?.data?.message || err.response?.data?.error || err.message || "Unknown error";
          errors.push(`${line.substring(0, 40)}: ${msg}`);
        }
      }
      toast.dismiss(toastId);
      if (successCount > 0) {
        toast.success(`Added ${successCount} of ${lines.length} sources!`);
        if (errors.length > 0) toast.error(`${errors.length} failed: ${errors[0]}`);
        setIsAddModalOpen(false); setBulkUrls("");
      } else {
        toast.error(errors[0] || "No valid sources could be added. Check URLs and try again.");
      }
    }
  };

  const downloadSampleCsv = () => {
    const csv = "data:text/csv;charset=utf-8,Name,URL\nPropertyPro,https://propertypro.ng\nJiji Nigeria,https://jiji.ng\nProperty24 Nigeria,https://www.property24.com.ng\nBuyLetLive,https://buyletlive.com\nNigeria Property Centre,https://nigeriapropertycentre.com";
    const link = document.createElement("a");
    link.href = encodeURI(csv);
    link.download = "sample-sites.csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      let text = ev.target?.result as string;
      if (text?.toLowerCase().startsWith('name,url')) text = text.substring(text.indexOf('\n') + 1);
      if (text) { setBulkUrls(prev => prev ? prev + "\n" + text.trim() : text.trim()); toast.success("CSV loaded"); }
    };
    reader.readAsText(file);
  };

  const handleSelectAll = () => {
    if (selectedSites.length === paginatedSites.length) setSelectedSites([]);
    else setSelectedSites(paginatedSites.map(s => s.id));
  };

  const handleBulkToggle = (enable: boolean) => {
    bulkToggle.mutate({ ids: selectedSites, enable }, {
      onSuccess: () => { toast.success(`${selectedSites.length} sources ${enable ? 'enabled' : 'disabled'}`); setSelectedSites([]); },
      onError: () => toast.error("Bulk toggle failed")
    });
  };

  const handleBulkDelete = () => {
    if (window.confirm(`Remove ${selectedSites.length} sites permanently?`)) {
      bulkDelete.mutate(selectedSites, {
        onSuccess: () => { toast.success(`${selectedSites.length} sites removed`); setSelectedSites([]); },
        onError: () => toast.error("Bulk delete failed")
      });
    }
  };

  const gridColOptions = isMobile ? GRID_OPTIONS_MOBILE : GRID_OPTIONS_DESKTOP;

  // ===== SITE CARD (Grid View) =====
  const SiteGridCard = ({ site }: { site: Site }) => {
    const isSelected = selectedSites.includes(site.id);
    const faviconUrl = getFaviconUrl(site.baseUrl);
    return (
      <Card className={`bg-background/80 backdrop-blur-xl border shadow-sm hover:shadow-lg transition-all duration-200 group overflow-hidden flex flex-col relative ${isSelected ? 'border-primary ring-1 ring-primary/40' : 'border-border/50 hover:border-border'}`}>
        <div className="p-4 flex flex-col gap-3 flex-1">
          {/* Top row: checkbox + favicon + name + menu */}
          <div className="flex items-start gap-2.5">
            <button
              onClick={() => setSelectedSites(prev => prev.includes(site.id) ? prev.filter(id => id !== site.id) : [...prev, site.id])}
              className="mt-0.5 shrink-0"
            >
              {isSelected ? <CheckSquare className="w-4 h-4 text-primary" /> : <Square className="w-4 h-4 text-muted-foreground/30 group-hover:text-muted-foreground/60 transition-colors" />}
            </button>
            <div className="w-8 h-8 rounded-lg bg-secondary/50 flex items-center justify-center shrink-0 overflow-hidden border border-border/30">
              {faviconUrl ? (
                <img src={faviconUrl} alt="" className="w-5 h-5 rounded-sm" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; (e.target as HTMLImageElement).nextElementSibling && ((e.target as HTMLImageElement).parentElement!.querySelector('.fallback-icon') as HTMLElement)?.style.removeProperty('display'); }} />
              ) : null}
              <Globe className="w-4 h-4 text-muted-foreground/50 fallback-icon" style={faviconUrl ? { display: 'none' } : undefined} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-sm text-foreground truncate leading-tight" title={site.name}>{site.name}</p>
              <a href={site.baseUrl} target="_blank" rel="noopener noreferrer" className="text-[11px] text-primary/70 hover:text-primary hover:underline truncate block leading-tight mt-0.5" title={site.baseUrl}>
                {site.baseUrl.replace(/^https?:\/\//, '')}
              </a>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="p-1 hover:bg-secondary rounded-md transition-colors text-muted-foreground shrink-0">
                  <MoreVertical className="w-3.5 h-3.5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={() => handleToggle(site.id, site.enabled)} className="gap-2 cursor-pointer">
                  <Power className="w-3.5 h-3.5" /> {site.enabled ? 'Disable' : 'Enable'}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => { navigator.clipboard.writeText(site.id); toast.success("ID copied"); }} className="gap-2 cursor-pointer">
                  <Copy className="w-3.5 h-3.5" /> Copy ID
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => handleDelete(site.id)} className="text-red-500 focus:text-red-500 focus:bg-red-500/10 gap-2 cursor-pointer">
                  <Trash2 className="w-3.5 h-3.5" /> Remove
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Status + toggle */}
          <div className="flex items-center justify-between mt-auto pt-2">
            <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider ${site.enabled ? 'text-green-600' : 'text-muted-foreground'}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${site.enabled ? 'bg-green-500 animate-pulse' : 'bg-zinc-400'}`} />
              {site.enabled ? 'Active' : 'Disabled'}
            </span>
            <button
              onClick={() => handleToggle(site.id, site.enabled)}
              className="transition-colors"
              title={site.enabled ? 'Disable site' : 'Enable site'}
            >
              {site.enabled ? <ToggleRight className="w-6 h-6 text-green-500" /> : <ToggleLeft className="w-6 h-6 text-muted-foreground/50" />}
            </button>
          </div>

          {/* Meta */}
          <div className="flex items-center justify-between text-[10px] text-muted-foreground border-t border-border/30 pt-2">
            <span className="flex items-center gap-1">
              <Code className="w-3 h-3" />
              {Object.keys(site.selectors || {}).length} selectors
            </span>
            <span className="flex items-center gap-1">
              <RefreshCcw className="w-3 h-3" />
              {site.lastScrapeAt ? formatDistanceToNow(new Date(site.lastScrapeAt), { addSuffix: true }) : "Never"}
            </span>
          </div>
        </div>
      </Card>
    );
  };

  // ===== SITE ROW (List View) =====
  const SiteListRow = ({ site }: { site: Site }) => {
    const isSelected = selectedSites.includes(site.id);
    const faviconUrl = getFaviconUrl(site.baseUrl);
    return (
      <div className={`flex items-center gap-3 px-4 py-3 border-b border-border/30 hover:bg-secondary/30 transition-colors group ${isSelected ? 'bg-primary/5' : ''}`}>
        {/* Checkbox */}
        <button
          onClick={() => setSelectedSites(prev => prev.includes(site.id) ? prev.filter(id => id !== site.id) : [...prev, site.id])}
          className="shrink-0"
        >
          {isSelected ? <CheckSquare className="w-4 h-4 text-primary" /> : <Square className="w-4 h-4 text-muted-foreground/30 group-hover:text-muted-foreground/60 transition-colors" />}
        </button>

        {/* Favicon */}
        <div className="w-8 h-8 rounded-lg bg-secondary/50 flex items-center justify-center shrink-0 overflow-hidden border border-border/30">
          {faviconUrl ? (
            <img src={faviconUrl} alt="" className="w-5 h-5 rounded-sm" onError={(e) => { (e.target as HTMLImageElement).replaceWith(Object.assign(document.createElement('span'), { innerHTML: '🌐', className: 'text-xs' })); }} />
          ) : <Globe className="w-4 h-4 text-muted-foreground/50" />}
        </div>

        {/* Name + URL */}
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-sm text-foreground truncate">{site.name}</p>
          <a href={site.baseUrl} target="_blank" rel="noopener noreferrer" className="text-[11px] text-primary/70 hover:text-primary hover:underline truncate block">
            {site.baseUrl.replace(/^https?:\/\//, '')}
          </a>
        </div>

        {/* Status badge */}
        <span className={`hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider shrink-0 ${site.enabled ? 'bg-green-500/10 text-green-600 border border-green-500/20' : 'bg-zinc-500/10 text-zinc-500 border border-zinc-500/20'}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${site.enabled ? 'bg-green-500' : 'bg-zinc-400'}`} />
          {site.enabled ? 'Active' : 'Disabled'}
        </span>

        {/* Selectors */}
        <span className="hidden md:flex items-center gap-1 text-xs text-muted-foreground shrink-0">
          <Code className="w-3 h-3" /> {Object.keys(site.selectors || {}).length}
        </span>

        {/* Last scraped */}
        <span className="hidden lg:flex items-center gap-1 text-xs text-muted-foreground shrink-0 w-28 justify-end">
          {site.lastScrapeAt ? formatDistanceToNow(new Date(site.lastScrapeAt), { addSuffix: true }) : "Never"}
        </span>

        {/* Toggle */}
        <button
          onClick={() => handleToggle(site.id, site.enabled)}
          className="shrink-0"
          title={site.enabled ? 'Disable' : 'Enable'}
        >
          {site.enabled ? <ToggleRight className="w-6 h-6 text-green-500" /> : <ToggleLeft className="w-6 h-6 text-muted-foreground/40" />}
        </button>

        {/* Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="p-1 hover:bg-secondary rounded-md text-muted-foreground shrink-0">
              <MoreVertical className="w-4 h-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem onClick={() => { navigator.clipboard.writeText(site.id); toast.success("ID copied"); }} className="gap-2 cursor-pointer">
              <Copy className="w-3.5 h-3.5" /> Copy ID
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => handleDelete(site.id)} className="text-red-500 focus:text-red-500 focus:bg-red-500/10 gap-2 cursor-pointer">
              <Trash2 className="w-3.5 h-3.5" /> Remove
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    );
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 md:px-8 py-8 animate-in fade-in duration-700">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative">
        <div className="relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent/10 text-accent text-xs font-bold uppercase tracking-widest mb-2">
            <Database className="w-3.5 h-3.5" />
            Data Sources
          </div>
          <h1 className="font-display text-2xl md:text-3xl font-bold tracking-tight text-foreground">
            Site Management
          </h1>
          <p className="text-muted-foreground mt-1 max-w-xl text-sm">
            Manage the websites you scrape from. Enable sites to include them in crawl jobs.
          </p>
        </div>
        <button
          onClick={() => setIsAddModalOpen(true)}
          className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/25 whitespace-nowrap hover:-translate-y-0.5 self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" /> Add Site
        </button>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-border/50 pb-4">
        <div className="flex items-center gap-3 flex-wrap">
          {/* Stats */}
          <span className="text-sm text-muted-foreground">
            <strong className="text-foreground">{filteredSites.length}</strong> sites
          </span>
          <span className="w-1 h-1 rounded-full bg-border" />
          <span className="text-sm text-muted-foreground flex items-center gap-1">
            <Zap className="w-3.5 h-3.5 text-green-500" />
            {sites.filter(s => s.enabled).length} active
          </span>

          {/* Select all */}
          {paginatedSites.length > 0 && (
            <>
              <span className="w-1 h-1 rounded-full bg-border" />
              <button onClick={handleSelectAll} className="text-xs font-medium text-primary hover:underline flex items-center gap-1">
                {selectedSites.length === paginatedSites.length ? <CheckSquare className="w-3.5 h-3.5" /> : <Square className="w-3.5 h-3.5" />}
                {selectedSites.length === paginatedSites.length ? "Deselect all" : "Select all"}
              </button>
            </>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 pr-3 py-2 text-sm rounded-lg border bg-background text-foreground focus:ring-2 focus:ring-primary/50 outline-none w-40 sm:w-52"
            />
          </div>

          {/* View toggle */}
          <div className="flex items-center bg-secondary/50 rounded-lg p-0.5 border border-border/30">
            <button
              onClick={() => setViewMode("list")}
              className={`p-1.5 rounded-md transition-colors ${viewMode === 'list' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
              title="List view"
            >
              <List className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode("grid")}
              className={`p-1.5 rounded-md transition-colors ${viewMode === 'grid' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
              title="Grid view"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
          </div>

          {/* Grid columns (only in grid mode) */}
          {viewMode === "grid" && (
            <div className="hidden sm:flex items-center gap-1 bg-secondary/50 rounded-lg p-0.5 border border-border/30">
              {gridColOptions.map(n => (
                <button
                  key={n}
                  onClick={() => setGridCols(n)}
                  className={`px-2 py-1.5 rounded-md text-xs font-bold transition-colors ${gridCols === n ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                >
                  {n}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="py-24 flex flex-col items-center justify-center text-muted-foreground">
          <RefreshCcw className="w-8 h-8 animate-spin mb-4 opacity-30" />
          <p className="font-medium">Loading sites...</p>
        </div>
      ) : filteredSites.length === 0 ? (
        <div className="py-24 flex flex-col items-center justify-center text-muted-foreground">
          <Globe className="w-12 h-12 mb-4 opacity-10" />
          <p className="font-medium text-lg text-foreground mb-1">No Sites Found</p>
          <p className="text-sm">{searchQuery ? "No sites match your search." : "Add your first scraping target to get started."}</p>
        </div>
      ) : viewMode === "list" ? (
        <div className="bg-background rounded-xl border border-border/50 overflow-hidden">
          {/* List header */}
          <div className="flex items-center gap-3 px-4 py-2.5 border-b border-border/50 bg-secondary/30 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            <span className="w-4" />
            <span className="w-8" />
            <span className="flex-1">Site</span>
            <span className="hidden sm:block w-20">Status</span>
            <span className="hidden md:block w-12 text-center">Keys</span>
            <span className="hidden lg:block w-28 text-right">Last Scraped</span>
            <span className="w-6" />
            <span className="w-6" />
          </div>
          {paginatedSites.map(site => <SiteListRow key={site.id} site={site} />)}
        </div>
      ) : (
        <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${isMobile ? 1 : gridCols}, minmax(0, 1fr))` }}>
          {paginatedSites.map(site => <SiteGridCard key={site.id} site={site} />)}
        </div>
      )}

      {/* Pagination */}
      {filteredSites.length > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>Show</span>
            <select
              value={perPage}
              onChange={e => setPerPage(Number(e.target.value))}
              className="bg-background border rounded-lg px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-primary/50"
            >
              {PER_PAGE_OPTIONS.map(n => <option key={n} value={n}>{n}</option>)}
            </select>
            <span>per page</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="p-2 rounded-lg border hover:bg-secondary disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                let pageNum: number;
                if (totalPages <= 5) pageNum = i + 1;
                else if (page <= 3) pageNum = i + 1;
                else if (page >= totalPages - 2) pageNum = totalPages - 4 + i;
                else pageNum = page - 2 + i;
                return (
                  <button
                    key={pageNum}
                    onClick={() => setPage(pageNum)}
                    className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${page === pageNum ? 'bg-primary text-white' : 'hover:bg-secondary text-muted-foreground'}`}
                  >
                    {pageNum}
                  </button>
                );
              })}
            </div>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="p-2 rounded-lg border hover:bg-secondary disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <span className="text-xs text-muted-foreground">
            {(page - 1) * perPage + 1}–{Math.min(page * perPage, filteredSites.length)} of {filteredSites.length}
          </span>
        </div>
      )}

      {/* Add Site Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-background/80 backdrop-blur-md animate-in fade-in" onClick={() => setIsAddModalOpen(false)} />
          <div className="bg-card w-full max-w-md rounded-2xl shadow-2xl border border-border/50 relative z-10 animate-in zoom-in-95 duration-200 overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary to-accent" />
            <div className="p-6">
              <div className="flex justify-between items-start mb-5">
                <div>
                  <h3 className="font-display font-bold text-xl">Add Site</h3>
                  <p className="text-sm text-muted-foreground mt-1">Register a new scraping target.</p>
                </div>
                <button onClick={() => setIsAddModalOpen(false)} className="p-2 rounded-full hover:bg-secondary transition-colors text-muted-foreground">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleAddSubmit} className="space-y-4">
                <div className="flex items-center bg-secondary/30 p-1 rounded-xl mb-4">
                  <button type="button" onClick={() => setAddMode("single")}
                    className={`flex-1 flex justify-center gap-2 py-2 px-3 rounded-lg text-sm font-bold transition-colors ${addMode === "single" ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground'}`}>
                    <Plus className="w-4 h-4" /> Single
                  </button>
                  <button type="button" onClick={() => setAddMode("bulk")}
                    className={`flex-1 flex justify-center gap-2 py-2 px-3 rounded-lg text-sm font-bold transition-colors ${addMode === "bulk" ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground'}`}>
                    <Layers className="w-4 h-4" /> Bulk Import
                  </button>
                </div>

                {addMode === "single" ? (
                  <>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Site Name</label>
                      <input type="text" required value={newSiteName} onChange={e => setNewSiteName(e.target.value)}
                        placeholder="e.g. PropertyPro NG"
                        className="w-full px-4 py-2.5 rounded-xl border bg-secondary/30 focus:bg-background transition-colors focus:ring-2 focus:ring-primary outline-none text-sm" />
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Target URL</label>
                        <button type="button" onClick={() => setUrlProtocol(p => p === "https://" ? "http://" : "https://")}
                          className="text-[10px] font-mono text-muted-foreground hover:text-foreground transition-colors">
                          Switch to {urlProtocol === "https://" ? "http" : "https"}
                        </button>
                      </div>
                      <div className="flex rounded-xl border bg-secondary/30 focus-within:ring-2 focus-within:ring-primary focus-within:bg-background transition-colors overflow-hidden">
                        <span className="bg-secondary/60 border-r px-3 py-2.5 text-xs font-mono text-muted-foreground select-none shrink-0 flex items-center">
                          {urlProtocol}
                        </span>
                        <input type="text" required value={newSiteUrlPath}
                          onChange={e => setNewSiteUrlPath(e.target.value.replace(/^https?:\/\//, ''))}
                          placeholder="example.com/properties"
                          className="flex-1 px-3 py-2.5 bg-transparent outline-none text-sm min-w-0" />
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                        <ListPlus className="w-3.5 h-3.5" /> URLs
                      </label>
                      <div className="flex items-center gap-2">
                        <button type="button" onClick={downloadSampleCsv} className="text-[10px] flex items-center gap-1 font-semibold text-primary hover:underline">
                          <Download className="w-3 h-3" /> Sample
                        </button>
                        <label className="text-[10px] flex items-center gap-1 font-semibold text-primary cursor-pointer hover:underline">
                          <Upload className="w-3 h-3" /> Upload
                          <input type="file" accept=".csv" className="hidden" onChange={handleFileUpload} />
                        </label>
                      </div>
                    </div>
                    <textarea required={addMode === "bulk"} value={bulkUrls} onChange={e => setBulkUrls(e.target.value)}
                      placeholder={"PropertyPro, https://propertypro.ng\nJiji Nigeria, https://jiji.ng\nProperty24, https://property24.com.ng"}
                      className="w-full h-32 px-4 py-3 rounded-xl border bg-secondary/30 focus:bg-background transition-colors focus:ring-2 focus:ring-primary outline-none text-sm resize-none font-mono text-xs leading-relaxed" />
                    <p className="text-[10px] text-muted-foreground pl-1">One per line: <strong>Name, URL</strong>. Name is optional — if omitted, the domain name is used.</p>
                  </div>
                )}

                <div className="pt-3 flex gap-3">
                  <button type="button" onClick={() => setIsAddModalOpen(false)}
                    className="flex-1 px-4 py-2.5 rounded-xl font-semibold border hover:bg-secondary transition-colors text-sm">
                    Cancel
                  </button>
                  <button type="submit" disabled={addSite.isPending}
                    className="flex-1 px-4 py-2.5 rounded-xl font-bold bg-primary hover:bg-primary/90 text-white transition-all shadow-lg hover:-translate-y-0.5 disabled:opacity-50 text-sm flex items-center justify-center gap-2">
                    {addSite.isPending ? <RefreshCcw className="w-4 h-4 animate-spin" /> : "Add Site"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Actions Bar */}
      {selectedSites.length > 0 && (
        <div className="fixed bottom-20 md:bottom-6 xl:bottom-10 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-5 fade-in duration-300">
          <div className="bg-foreground text-background shadow-2xl rounded-full px-4 sm:px-6 py-3 flex items-center gap-3 sm:gap-5 border border-white/20">
            <div className="flex items-center gap-2 font-semibold">
              <span className="bg-background text-foreground w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold">
                {selectedSites.length}
              </span>
              <span className="text-sm hidden sm:inline">selected</span>
            </div>
            <div className="w-px h-5 bg-background/20" />
            <button onClick={() => handleBulkToggle(true)} disabled={bulkToggle.isPending}
              className="px-3 py-1.5 rounded-full hover:bg-background/20 transition-colors text-sm font-semibold flex items-center gap-1.5">
              <Power className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Enable</span>
            </button>
            <button onClick={() => handleBulkToggle(false)} disabled={bulkToggle.isPending}
              className="px-3 py-1.5 rounded-full hover:bg-background/20 transition-colors text-sm font-semibold flex items-center gap-1.5 text-zinc-400">
              <span className="hidden sm:inline">Disable</span>
            </button>
            <div className="w-px h-4 bg-background/20" />
            <button onClick={handleBulkDelete} disabled={bulkDelete.isPending}
              className="px-3 py-1.5 rounded-full hover:bg-red-500/20 text-red-400 transition-colors text-sm font-semibold flex items-center gap-1.5">
              <Trash2 className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Remove</span>
            </button>
            <button onClick={() => setSelectedSites([])} className="ml-1 p-1.5 hover:bg-background/20 rounded-full transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
