"use client";

import { useState } from "react";
import { useSites, useToggleSite, useDeleteSite, useAddSite } from "@/hooks/use-sites";
import { Plus, Search, MoreVertical, Trash2, Power, Globe, RefreshCcw, Database, Code, Zap, X, Copy } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function SitesPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  
  // Add Form State
  const [newSiteName, setNewSiteName] = useState("");
  const [newSiteUrl, setNewSiteUrl] = useState("");
  
  const { data: sites, isLoading } = useSites(50);
  const toggleSite = useToggleSite();
  const deleteSite = useDeleteSite();
  const addSite = useAddSite();

  const filteredSites = sites?.filter(site => 
    site.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    site.url.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  const handleToggle = (id: string, currentStatus: boolean) => {
    toggleSite.mutate(id, {
      onSuccess: () => toast.success(`Source ${currentStatus ? 'disabled' : 'enabled'} successfully`),
      onError: () => toast.error("Failed to toggle source status")
    });
  };

  const handleDelete = (id: string) => {
    if (window.confirm("Are you sure you want to completely erase this extraction source configuration?")) {
      deleteSite.mutate(id, {
        onSuccess: () => toast.success("Data source purged successfully"),
        onError: () => toast.error("Failed to purge source")
      });
    }
  };

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSiteName || !newSiteUrl) {
      toast.error("Name and URL are required.");
      return;
    }
    
    addSite.mutate({
      name: newSiteName,
      url: newSiteUrl,
      isActive: true,
      selectors: {},
    }, {
      onSuccess: () => {
        toast.success("New extraction source initialized!");
        setIsAddModalOpen(false);
        setNewSiteName("");
        setNewSiteUrl("");
      },
      onError: (err: any) => {
        toast.error(err.response?.data?.message || "Failed to initialize source.");
      }
    });
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto px-4 md:px-8 py-8 animate-in fade-in duration-700">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 relative">
        <div className="relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent/10 text-accent text-xs font-bold uppercase tracking-widest mb-3">
            <Database className="w-3.5 h-3.5" />
            Node Catalog
          </div>
          <h1 className="font-display text-3xl md:text-4xl font-bold tracking-tight text-foreground">
            Data Sources
          </h1>
          <p className="text-muted-foreground mt-2 max-w-xl text-sm md:text-base">
            Configure target domains, define traversal constraints, and maintain active extraction profiles.
          </p>
        </div>
        
        <div className="flex items-center gap-4 relative z-10">
          <div className="relative max-w-sm flex-1 sm:min-w-[280px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search catalog..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-3 text-sm rounded-xl border bg-background/60 backdrop-blur-md text-foreground transition-all focus:ring-2 focus:ring-primary/50 outline-none hover:border-primary/30 shadow-sm"
            />
          </div>
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-sm font-bold transition-all bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/25 whitespace-nowrap hover:-translate-y-0.5"
          >
            <Plus className="w-4 h-4" /> Add Target
          </button>
        </div>
        
        {/* Background glow */}
        <div className="absolute top-0 right-0 -translate-y-1/2 w-72 h-72 bg-accent/5 rounded-full blur-[100px] pointer-events-none -z-10" />
      </div>

      {/* Toolbar / Stats */}
      <div className="flex items-center gap-4 text-sm text-muted-foreground font-medium border-b border-border/50 pb-4">
        <span><strong className="text-foreground">{filteredSites.length}</strong> configured nodes</span>
        <span className="w-1.5 h-1.5 rounded-full bg-border" />
        <span className="flex items-center gap-1.5">
           <Zap className="w-3.5 h-3.5 text-accent" />
           {sites?.filter(s => s.isActive).length || 0} active
        </span>
      </div>

      {/* Grid List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
        {isLoading ? (
          <div className="col-span-full py-24 flex flex-col items-center justify-center text-muted-foreground">
            <RefreshCcw className="w-8 h-8 animate-spin mb-4 opacity-30" />
            <p className="font-medium">Connecting to registry...</p>
          </div>
        ) : filteredSites.length === 0 ? (
          <div className="col-span-full py-24 flex flex-col items-center justify-center text-muted-foreground">
            <Globe className="w-12 h-12 mb-4 opacity-10" />
            <p className="font-medium text-lg text-foreground mb-1">No Sources Found</p>
            <p className="text-sm">We couldn't find any nodes matching your search.</p>
          </div>
        ) : (
          filteredSites.map((site) => (
            <Card key={site.id} className="bg-background/80 backdrop-blur-xl border border-white/10 shadow-lg hover:shadow-xl transition-all duration-300 group overflow-hidden flex flex-col hover:-translate-y-1">
              <CardHeader className="p-5 pb-0 border-b border-white/5 relative z-10 flex-row items-start justify-between space-y-0 shrink-0">
                <div className="flex items-center gap-3 w-full pr-8">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/20 to-accent/20 flex justify-center items-center shrink-0 border border-white/10 shadow-inner group-hover:scale-110 transition-transform duration-500">
                    <Globe className="w-5 h-5 text-foreground/80 group-hover:text-primary transition-colors" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-foreground text-base truncate pr-2" title={site.name}>
                      {site.name}
                    </p>
                    <a 
                      href={site.url} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="text-xs text-primary/80 hover:text-primary hover:underline truncate block"
                      title={site.url}
                    >
                      {site.url.replace(/^https?:\/\//, '')}
                    </a>
                  </div>
                </div>
                
                <div className="absolute top-4 right-4">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="p-1.5 hover:bg-secondary/80 rounded-lg transition-colors text-muted-foreground hover:text-foreground">
                        <MoreVertical className="w-4 h-4" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-52 p-2">
                       <div className="px-2 py-1.5 text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1">
                         Node Options
                       </div>
                      <DropdownMenuItem 
                        onClick={() => handleToggle(site.id, site.isActive)}
                        className="flex items-center gap-2 cursor-pointer rounded-md"
                      >
                        <Power className="w-4 h-4" />
                        {site.isActive ? 'Suspend polling' : 'Resume polling'}
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onClick={() => {
                          navigator.clipboard.writeText(site.id);
                          toast.success("Node ID copied to clipboard");
                        }}
                        className="flex items-center gap-2 cursor-pointer rounded-md"
                      >
                        <Copy className="w-4 h-4" /> Copy Node ID
                      </DropdownMenuItem>
                      <DropdownMenuSeparator className="my-1" />
                      <DropdownMenuItem 
                        onClick={() => handleDelete(site.id)}
                        className="text-red-500 focus:text-red-500 focus:bg-red-500/10 flex items-center gap-2 cursor-pointer rounded-md"
                      >
                        <Trash2 className="w-4 h-4" /> Purge configuration
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardHeader>
              <CardContent className="p-5 pt-4 flex-1 flex flex-col justify-between gap-6 relative z-10 bg-gradient-to-b from-transparent to-secondary/10">
                 
                 <div className="space-y-4">
                    <div className="flex items-center justify-between">
                       <span className="text-xs font-semibold text-muted-foreground">POLLING STATUS</span>
                       <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider shadow-sm ${
                         site.isActive 
                           ? 'bg-green-500/10 text-green-600 border border-green-500/20' 
                           : 'bg-zinc-500/10 text-zinc-500 border border-zinc-500/20'
                       }`}>
                         <span className={`w-1.5 h-1.5 rounded-full ${site.isActive ? 'bg-green-500 animate-pulse' : 'bg-zinc-500'}`} />
                         {site.isActive ? 'Active' : 'Suspended'}
                       </span>
                    </div>

                    <div className="flex items-center justify-between">
                       <span className="text-xs font-semibold text-muted-foreground">MAPPED GRAPH KEYS</span>
                       <div className="flex items-center gap-1.5 text-sm font-bold text-foreground bg-primary/5 px-2 py-0.5 rounded border border-primary/10">
                         <Code className="w-3.5 h-3.5 text-primary" />
                         {Object.keys(site.selectors || {}).length} keys
                       </div>
                    </div>
                 </div>

                 <div className="pt-4 border-t border-border/50 flex items-center justify-between text-xs text-muted-foreground mt-auto">
                    <span className="font-medium">Last Indexed</span>
                    <span className="flex items-center gap-1.5">
                       <RefreshCcw className="w-3 h-3 opacity-50" />
                       {site.lastScrapedAt 
                         ? formatDistanceToNow(new Date(site.lastScrapedAt), { addSuffix: true })
                         : "Never"
                       }
                    </span>
                 </div>
              </CardContent>
              {/* Background accent */}
              <div className={`absolute -bottom-10 -right-10 w-32 h-32 rounded-full blur-[50px] pointer-events-none transition-opacity duration-700 opacity-0 group-hover:opacity-100 ${site.isActive ? 'bg-green-500/10' : 'bg-zinc-500/10'}`} />
            </Card>
          ))
        )}
      </div>

      {/* Add Source Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-background/80 backdrop-blur-md transition-opacity animate-in fade-in" onClick={() => setIsAddModalOpen(false)} />
          <div className="bg-card w-full max-w-md rounded-3xl shadow-2xl border border-white/10 relative z-10 animate-in zoom-in-95 duration-200 overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-primary to-accent" />
            <div className="p-6">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h3 className="font-display font-bold text-2xl">New Target Node</h3>
                  <p className="text-sm text-muted-foreground mt-1">Register a new domain for extraction.</p>
                </div>
                <button onClick={() => setIsAddModalOpen(false)} className="p-2 rounded-full hover:bg-secondary transition-colors text-muted-foreground">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleAddSubmit} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Internal Name</label>
                  <input
                    type="text"
                    required
                    value={newSiteName}
                    onChange={e => setNewSiteName(e.target.value)}
                    placeholder="e.g. PropertyPro NG"
                    className="w-full px-4 py-3 rounded-xl border bg-secondary/30 focus:bg-background transition-colors focus:ring-2 focus:ring-primary outline-none text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Target URL</label>
                  <input
                    type="url"
                    required
                    value={newSiteUrl}
                    onChange={e => setNewSiteUrl(e.target.value)}
                    placeholder="https://example.com/properties"
                    className="w-full px-4 py-3 rounded-xl border bg-secondary/30 focus:bg-background transition-colors focus:ring-2 focus:ring-primary outline-none text-sm"
                  />
                  <p className="text-[10px] text-muted-foreground pl-1">Must include https:// or http://</p>
                </div>
                
                <div className="pt-4 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setIsAddModalOpen(false)}
                    className="flex-1 px-4 py-3 rounded-xl font-semibold border hover:bg-secondary transition-colors text-sm"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={addSite.isPending}
                    className="flex-1 px-4 py-3 rounded-xl font-bold bg-primary hover:bg-primary/90 text-white transition-all shadow-lg hover:-translate-y-0.5 disabled:opacity-50 text-sm flex items-center justify-center gap-2"
                  >
                    {addSite.isPending ? <RefreshCcw className="w-4 h-4 animate-spin" /> : "Initialize Node"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
