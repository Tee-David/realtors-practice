"use client";

import { useState } from "react";
import { useSites, useToggleSite, useDeleteSite } from "@/hooks/use-sites";
import { Plus, Search, MoreVertical, Edit2, Trash2, Power, Globe, RefreshCcw } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function SitesPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const { data: sites, isLoading } = useSites(50);
  const toggleSite = useToggleSite();
  const deleteSite = useDeleteSite();

  const filteredSites = sites?.filter(site => 
    site.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    site.url.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  const handleToggle = (id: string, currentStatus: boolean) => {
    toggleSite.mutate(id, {
      onSuccess: () => toast.success(`Site ${currentStatus ? 'disabled' : 'enabled'} successfully`),
      onError: () => toast.error("Failed to toggle site status")
    });
  };

  const handleDelete = (id: string) => {
    if (window.confirm("Are you sure you want to delete this site configuration?")) {
      deleteSite.mutate(id, {
        onSuccess: () => toast.success("Site deleted successfully"),
        onError: () => toast.error("Failed to delete site")
      });
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold" style={{ color: "var(--foreground)" }}>
            Data Sources
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--muted-foreground)" }}>
            Manage the websites that the extraction engine will crawl for property data.
          </p>
        </div>
        
        <button
          onClick={() => toast.info("Coming soon: Add new site form")}
          className="flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all bg-primary hover:bg-primary/90 text-primary-foreground"
        >
          <Plus className="w-4 h-4" /> Add Source
        </button>
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search sources by name or URL..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm rounded-xl border bg-background text-foreground transition-all focus:ring-1 focus:ring-primary outline-none hover:border-border/80"
          />
        </div>
        
        <div className="text-sm text-muted-foreground font-medium bg-secondary/50 px-3 py-1.5 rounded-lg border border-border/50">
          {filteredSites.length} sources total
        </div>
      </div>

      {/* Site List */}
      <Card className="bg-card border-border shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs uppercase bg-secondary/30 text-muted-foreground border-b border-border font-semibold">
              <tr>
                <th className="px-5 py-3.5 whitespace-nowrap">Source Name & URL</th>
                <th className="px-5 py-3.5 whitespace-nowrap">Status</th>
                <th className="px-5 py-3.5 whitespace-nowrap">Selectors</th>
                <th className="px-5 py-3.5 whitespace-nowrap">Last Scrape</th>
                <th className="px-5 py-3.5 whitespace-nowrap text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="px-5 py-12 text-center text-muted-foreground">
                    <RefreshCcw className="w-5 h-5 animate-spin mx-auto mb-2 opacity-50" />
                    Loading data sources...
                  </td>
                </tr>
              ) : filteredSites.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-12 text-center text-muted-foreground italic">
                    No matching sources found.
                  </td>
                </tr>
              ) : (
                filteredSites.map((site) => (
                  <tr key={site.id} className="hover:bg-secondary/20 transition-colors group">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-secondary flex justify-center items-center shrink-0 border border-border/50 shadow-sm text-foreground/70">
                          <Globe className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="font-semibold text-foreground">{site.name}</p>
                          <a 
                            href={site.url} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="text-xs text-primary hover:underline max-w-[200px] truncate block"
                          >
                            {site.url}
                          </a>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        site.isActive 
                          ? 'bg-green-500/10 text-green-600 border border-green-500/20' 
                          : 'bg-zinc-500/10 text-zinc-500 border border-zinc-500/20'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${site.isActive ? 'bg-green-500 animate-pulse' : 'bg-zinc-500'}`} />
                        {site.isActive ? 'Active' : 'Disabled'}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="text-xs text-muted-foreground">
                        {Object.keys(site.selectors || {}).length} mapped keys
                      </div>
                    </td>
                    <td className="px-5 py-4 whitespace-nowrap">
                      <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                        <RefreshCcw className="w-3 h-3 opacity-60" />
                        {site.lastScrapedAt 
                          ? formatDistanceToNow(new Date(site.lastScrapedAt), { addSuffix: true })
                          : "Never"
                        }
                      </div>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="p-2 hover:bg-secondary rounded-lg transition-colors text-muted-foreground hover:text-foreground">
                            <MoreVertical className="w-4 h-4" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          <DropdownMenuItem 
                            onClick={() => handleToggle(site.id, site.isActive)}
                            className="flex items-center gap-2"
                          >
                            <Power className="w-4 h-4" />
                            {site.isActive ? 'Disable site' : 'Enable site'}
                          </DropdownMenuItem>
                          <DropdownMenuItem className="flex items-center gap-2">
                            <Edit2 className="w-4 h-4" /> Edit configuration
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem 
                            onClick={() => handleDelete(site.id)}
                            className="text-red-500 focus:text-red-500 focus:bg-red-500/10 flex items-center gap-2 cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" /> Delete source
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
