"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { properties as propertiesApi, exports as exportsApi } from "@/lib/api";
import { Database, CheckCircle, AlertTriangle, Shield, Download, Search, ChevronDown, Eye, X, ArrowUpDown, RefreshCcw, FileSpreadsheet, FileText } from "lucide-react";
import ModernLoader from "@/components/ui/modern-loader";

type Tab = "all" | "raw" | "enriched" | "flagged";

const TABS: { key: Tab; label: string; icon: React.ReactNode; filter?: Record<string, string> }[] = [
  { key: "all", label: "All", icon: <Database className="w-4 h-4" /> },
  { key: "raw", label: "Raw (Unverified)", icon: <AlertTriangle className="w-4 h-4" />, filter: { verificationStatus: "UNVERIFIED" } },
  { key: "enriched", label: "Enriched (Verified)", icon: <CheckCircle className="w-4 h-4" />, filter: { verificationStatus: "VERIFIED" } },
  { key: "flagged", label: "Flagged", icon: <Shield className="w-4 h-4" />, filter: { verificationStatus: "FLAGGED" } },
];

const COLUMNS = [
  { key: "title", label: "Title", sortable: true },
  { key: "source", label: "Source", sortable: true },
  { key: "listingType", label: "Type", sortable: true },
  { key: "price", label: "Price", sortable: true },
  { key: "area", label: "Area", sortable: true },
  { key: "qualityScore", label: "Quality", sortable: true },
  { key: "verificationStatus", label: "Status", sortable: true },
  { key: "createdAt", label: "Date", sortable: true },
];

export default function DataExplorerPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<Tab>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);
  const [inspectItem, setInspectItem] = useState<any>(null);
  const [sortBy, setSortBy] = useState("createdAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const limit = 25;

  const tabFilter = TABS.find((t) => t.key === activeTab)?.filter || {};

  const { data, isLoading } = useQuery({
    queryKey: ["data-explorer", activeTab, page, sortBy, sortOrder, searchQuery],
    queryFn: async () => {
      const res = await propertiesApi.list({
        ...tabFilter,
        page,
        limit,
        sortBy,
        sortOrder,
        search: searchQuery || undefined,
      });
      return res.data;
    },
  });

  const items = data?.data || [];
  const total = data?.meta?.total || 0;
  const totalPages = data?.meta?.totalPages || 1;

  // Bulk action mutation
  const bulkAction = useMutation({
    mutationFn: async ({ action }: { action: string }) => {
      const ids = Array.from(selectedIds);
      await propertiesApi.bulkAction({ ids, action });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["data-explorer"] });
      setSelectedIds(new Set());
    },
  });

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === items.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(items.map((i: any) => i.id)));
    }
  };

  const handleSort = (col: string) => {
    if (sortBy === col) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(col);
      setSortOrder("desc");
    }
  };

  const [exportMenuOpen, setExportMenuOpen] = useState(false);

  const handleExport = async (format: "csv" | "xlsx" | "pdf" = "csv") => {
    try {
      setExportMenuOpen(false);
      const ids = selectedIds.size > 0 ? Array.from(selectedIds) : undefined;

      let res;
      let mimeType: string;
      let ext: string;

      switch (format) {
        case "xlsx":
          res = await exportsApi.xlsx(ids);
          mimeType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
          ext = "xlsx";
          break;
        case "pdf":
          res = await exportsApi.pdf(ids);
          mimeType = "application/pdf";
          ext = "pdf";
          break;
        default:
          res = await exportsApi.csv(ids);
          mimeType = "text/csv";
          ext = "csv";
      }

      const blob = new Blob([res.data], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `properties-${Date.now()}.${ext}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Export failed:", err);
    }
  };

  const statusBadge = (status: string) => {
    const colors: Record<string, { bg: string; text: string }> = {
      UNVERIFIED: { bg: "rgba(234,179,8,0.15)", text: "#ca8a04" },
      VERIFIED: { bg: "rgba(34,197,94,0.15)", text: "#16a34a" },
      FLAGGED: { bg: "rgba(239,68,68,0.15)", text: "#dc2626" },
      REJECTED: { bg: "rgba(107,114,128,0.15)", text: "#6b7280" },
    };
    const c = colors[status] || colors.UNVERIFIED;
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold" style={{ backgroundColor: c.bg, color: c.text }}>
        {status}
      </span>
    );
  };

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>Data Explorer</h1>
          <p className="text-sm mt-1" style={{ color: "var(--muted-foreground)" }}>
            Inspect, verify, and manage scraped property data
          </p>
        </div>
        <div className="relative">
          <button
            onClick={() => setExportMenuOpen(!exportMenuOpen)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all hover:opacity-90"
            style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}
          >
            <Download className="w-4 h-4" />
            Export {selectedIds.size > 0 ? `(${selectedIds.size})` : "All"}
            <ChevronDown className="w-3.5 h-3.5" />
          </button>
          {exportMenuOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setExportMenuOpen(false)} />
              <div
                className="absolute right-0 top-full mt-1 z-50 w-44 rounded-xl border shadow-lg overflow-hidden"
                style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
              >
                <button
                  onClick={() => handleExport("csv")}
                  className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium hover:opacity-80 transition-colors text-left"
                  style={{ color: "var(--foreground)" }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--secondary)")}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                >
                  <Download className="w-4 h-4" style={{ color: "var(--muted-foreground)" }} />
                  CSV
                </button>
                <button
                  onClick={() => handleExport("xlsx")}
                  className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium hover:opacity-80 transition-colors text-left"
                  style={{ color: "var(--foreground)" }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--secondary)")}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                >
                  <FileSpreadsheet className="w-4 h-4" style={{ color: "#16a34a" }} />
                  Excel (.xlsx)
                </button>
                <button
                  onClick={() => handleExport("pdf")}
                  className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium hover:opacity-80 transition-colors text-left"
                  style={{ color: "var(--foreground)" }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--secondary)")}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                >
                  <FileText className="w-4 h-4" style={{ color: "#dc2626" }} />
                  PDF
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 p-1 rounded-xl mb-4" style={{ backgroundColor: "var(--secondary)" }}>
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => { setActiveTab(tab.key); setPage(1); setSelectedIds(new Set()); }}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            style={{
              backgroundColor: activeTab === tab.key ? "var(--card)" : "transparent",
              color: activeTab === tab.key ? "var(--foreground)" : "var(--muted-foreground)",
              boxShadow: activeTab === tab.key ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
            }}
          >
            {tab.icon}
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Search + Bulk Actions */}
      <div data-tour="bulk-actions" className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "var(--muted-foreground)" }} />
          <input
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
            placeholder="Search properties..."
            className="w-full pl-10 pr-4 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
            style={{ backgroundColor: "var(--background)", borderColor: "var(--border)", color: "var(--foreground)" }}
          />
        </div>

        {selectedIds.size > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium" style={{ color: "var(--muted-foreground)" }}>{selectedIds.size} selected</span>
            <button onClick={() => bulkAction.mutate({ action: "verify" })} className="px-3 py-1.5 rounded-lg text-xs font-semibold" style={{ backgroundColor: "rgba(34,197,94,0.15)", color: "#16a34a" }}>
              Verify
            </button>
            <button onClick={() => bulkAction.mutate({ action: "flag" })} className="px-3 py-1.5 rounded-lg text-xs font-semibold" style={{ backgroundColor: "rgba(234,179,8,0.15)", color: "#ca8a04" }}>
              Flag
            </button>
            <button onClick={() => bulkAction.mutate({ action: "reject" })} className="px-3 py-1.5 rounded-lg text-xs font-semibold" style={{ backgroundColor: "rgba(239,68,68,0.15)", color: "#dc2626" }}>
              Reject
            </button>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="rounded-xl border overflow-hidden" style={{ borderColor: "var(--border)" }}>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr style={{ backgroundColor: "var(--secondary)" }}>
                <th className="w-10 px-3 py-3">
                  <input type="checkbox" checked={items.length > 0 && selectedIds.size === items.length} onChange={toggleSelectAll} className="rounded" />
                </th>
                {COLUMNS.map((col) => (
                  <th
                    key={col.key}
                    onClick={() => col.sortable && handleSort(col.key)}
                    className="px-3 py-3 text-left text-xs font-semibold whitespace-nowrap"
                    style={{ color: "var(--muted-foreground)", cursor: col.sortable ? "pointer" : "default" }}
                  >
                    <span className="flex items-center gap-1">
                      {col.label}
                      {col.sortable && sortBy === col.key && <ArrowUpDown className="w-3 h-3" />}
                    </span>
                  </th>
                ))}
                <th className="w-10 px-3 py-3" />
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={COLUMNS.length + 2}><ModernLoader words={['Querying property database...', 'Enriching data fields...', 'Validating records...', 'Preparing data view...']} /></td></tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={COLUMNS.length + 2} className="text-center py-16">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ backgroundColor: "rgba(0,1,252,0.08)" }}>
                        <Database size={28} style={{ color: "var(--primary)", opacity: 0.5 }} />
                      </div>
                      <div>
                        <p className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>No data to explore</p>
                        <p className="text-xs mt-1" style={{ color: "var(--muted-foreground)" }}>
                          {searchQuery ? "No properties match your search query." : "Scraped property data will appear here once available."}
                        </p>
                      </div>
                      {!searchQuery && (
                        <a
                          href="/scraper"
                          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold mt-1 transition-colors hover:opacity-90"
                          style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}
                        >
                          Go to Scraper
                        </a>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                items.map((item: any) => (
                  <tr key={item.id} className="border-t transition-colors hover:bg-[var(--secondary)]" style={{ borderColor: "var(--border)" }}>
                    <td className="px-3 py-3">
                      <input type="checkbox" checked={selectedIds.has(item.id)} onChange={() => toggleSelect(item.id)} className="rounded" />
                    </td>
                    <td className="px-3 py-3 text-sm font-medium truncate max-w-[200px]" style={{ color: "var(--foreground)" }}>{item.title}</td>
                    <td className="px-3 py-3 text-xs" style={{ color: "var(--muted-foreground)" }}>{item.source}</td>
                    <td className="px-3 py-3">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium" style={{ backgroundColor: "var(--secondary)", color: "var(--foreground)" }}>
                        {item.listingType}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-sm font-medium" style={{ color: "var(--foreground)" }}>
                      {item.price ? `₦${new Intl.NumberFormat().format(item.price)}` : "—"}
                    </td>
                    <td className="px-3 py-3 text-xs" style={{ color: "var(--muted-foreground)" }}>{item.area || "—"}</td>
                    <td className="px-3 py-3">
                      {item.qualityScore != null ? (
                        <span className="text-xs font-bold" style={{ color: item.qualityScore >= 80 ? "#16a34a" : item.qualityScore >= 50 ? "#ca8a04" : "#dc2626" }}>
                          {item.qualityScore}
                        </span>
                      ) : "—"}
                    </td>
                    <td className="px-3 py-3">{statusBadge(item.verificationStatus)}</td>
                    <td className="px-3 py-3 text-xs whitespace-nowrap" style={{ color: "var(--muted-foreground)" }}>
                      {new Date(item.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-3 py-3">
                      <button onClick={() => setInspectItem(item)} className="p-1.5 rounded-lg hover:bg-[var(--secondary)]" title="Inspect">
                        <Eye className="w-4 h-4" style={{ color: "var(--muted-foreground)" }} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
            Showing {(page - 1) * limit + 1}–{Math.min(page * limit, total)} of {total}
          </p>
          <div className="flex items-center gap-2">
            <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="px-3 py-1.5 rounded-lg text-xs font-medium border disabled:opacity-50" style={{ borderColor: "var(--border)", color: "var(--foreground)" }}>
              Previous
            </button>
            <button disabled={page >= totalPages} onClick={() => setPage(page + 1)} className="px-3 py-1.5 rounded-lg text-xs font-medium border disabled:opacity-50" style={{ borderColor: "var(--border)", color: "var(--foreground)" }}>
              Next
            </button>
          </div>
        </div>
      )}

      {/* Inspect Panel */}
      {inspectItem && (
        <div className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-2xl max-h-[80vh] rounded-xl border shadow-2xl overflow-hidden flex flex-col" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
            <div className="flex items-center justify-between px-6 py-4 border-b shrink-0" style={{ borderColor: "var(--border)" }}>
              <h2 className="text-lg font-semibold truncate" style={{ color: "var(--foreground)" }}>{inspectItem.title}</h2>
              <button onClick={() => setInspectItem(null)} className="p-1 rounded-lg hover:bg-[var(--secondary)]">
                <X className="w-5 h-5" style={{ color: "var(--muted-foreground)" }} />
              </button>
            </div>
            <div className="overflow-y-auto flex-1 p-6">
              <pre className="text-xs whitespace-pre-wrap break-all rounded-lg p-4" style={{ backgroundColor: "var(--secondary)", color: "var(--foreground)" }}>
                {JSON.stringify(inspectItem, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
