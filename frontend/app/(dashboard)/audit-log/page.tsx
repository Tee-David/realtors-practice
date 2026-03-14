"use client";

import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { auditLogs as auditLogsApi, users as usersApi } from "@/lib/api";
import {
  FileSearch, Calendar, User, Filter, Activity, X, Download,
  ChevronDown, ChevronRight, Search, Shield, AlertTriangle, Info,
  Terminal, Database, Mail, Settings, Cpu, RefreshCw, LogIn,
  Trash2, Edit, Plus, Eye, Upload, Key, BookMarked, Power,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import ModernLoader from "@/components/ui/modern-loader";

// ─── Constants ─────────────────────────────────────────────────────────────

const ACTION_COLORS: Record<string, { bg: string; text: string; icon: React.ReactNode }> = {
  CREATE:          { bg: "rgba(34,197,94,0.12)",   text: "#16a34a", icon: <Plus className="w-3 h-3" /> },
  UPDATE:          { bg: "rgba(37,99,235,0.12)",   text: "#2563eb", icon: <Edit className="w-3 h-3" /> },
  DELETE:          { bg: "rgba(239,68,68,0.12)",   text: "#dc2626", icon: <Trash2 className="w-3 h-3" /> },
  LOGIN:           { bg: "rgba(139,92,246,0.12)",  text: "#7c3aed", icon: <LogIn className="w-3 h-3" /> },
  LOGOUT:          { bg: "rgba(107,114,128,0.12)", text: "#6b7280", icon: <Power className="w-3 h-3" /> },
  SCRAPE:          { bg: "rgba(234,179,8,0.12)",   text: "#ca8a04", icon: <Cpu className="w-3 h-3" /> },
  EXPORT:          { bg: "rgba(6,182,212,0.12)",   text: "#0891b2", icon: <Download className="w-3 h-3" /> },
  IMPORT:          { bg: "rgba(6,182,212,0.12)",   text: "#0891b2", icon: <Upload className="w-3 h-3" /> },
  VERIFY:          { bg: "rgba(34,197,94,0.12)",   text: "#16a34a", icon: <Shield className="w-3 h-3" /> },
  BULK:            { bg: "rgba(234,179,8,0.12)",   text: "#ca8a04", icon: <RefreshCw className="w-3 h-3" /> },
  SEARCH:          { bg: "rgba(59,130,246,0.12)",  text: "#3b82f6", icon: <Search className="w-3 h-3" /> },
  SETTINGS_CHANGE: { bg: "rgba(168,85,247,0.12)",  text: "#a855f7", icon: <Settings className="w-3 h-3" /> },
  PASSWORD_CHANGE: { bg: "rgba(239,68,68,0.12)",   text: "#dc2626", icon: <Key className="w-3 h-3" /> },
  ROLE_CHANGE:     { bg: "rgba(234,179,8,0.12)",   text: "#ca8a04", icon: <Shield className="w-3 h-3" /> },
  BACKUP:          { bg: "rgba(20,184,166,0.12)",  text: "#0d9488", icon: <Database className="w-3 h-3" /> },
  RESTORE:         { bg: "rgba(20,184,166,0.12)",  text: "#0d9488", icon: <RefreshCw className="w-3 h-3" /> },
  EMAIL:           { bg: "rgba(37,99,235,0.12)",   text: "#2563eb", icon: <Mail className="w-3 h-3" /> },
  VIEW:            { bg: "rgba(107,114,128,0.12)", text: "#6b7280", icon: <Eye className="w-3 h-3" /> },
};

const SEVERITY_COLORS = {
  info:     { bg: "rgba(59,130,246,0.12)",  text: "#3b82f6", icon: <Info className="w-3 h-3" /> },
  warning:  { bg: "rgba(234,179,8,0.12)",   text: "#ca8a04", icon: <AlertTriangle className="w-3 h-3" /> },
  critical: { bg: "rgba(239,68,68,0.12)",   text: "#dc2626", icon: <AlertTriangle className="w-3 h-3" /> },
};

const ACTION_TYPES = [
  "CREATE","UPDATE","DELETE","LOGIN","LOGOUT","SCRAPE","EXPORT","IMPORT",
  "VERIFY","BULK","SEARCH","SETTINGS_CHANGE","PASSWORD_CHANGE","ROLE_CHANGE",
  "BACKUP","RESTORE","EMAIL","VIEW",
];

const ENTITY_TYPES = [
  "PROPERTY","USER","SITE","SCRAPE_JOB","SAVED_SEARCH",
  "SETTINGS","BACKUP","EMAIL_TEMPLATE","AUDIT_LOG","EXPORT","NOTIFICATION",
];

// ─── Helpers ───────────────────────────────────────────────────────────────

function getSeverity(action: string): "info" | "warning" | "critical" {
  if (["DELETE","PASSWORD_CHANGE","ROLE_CHANGE","RESTORE"].includes(action)) return "critical";
  if (["SETTINGS_CHANGE","BULK","BACKUP"].includes(action)) return "warning";
  return "info";
}

function formatActionText(action: string) {
  return action.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
}

function humanTime(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(dateStr).toLocaleDateString("en-NG", { month: "short", day: "numeric" });
}

// ─── Expandable Row ────────────────────────────────────────────────────────

function LogRow({ log, index, isLast }: { log: any; index: number; isLast: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const actionColor = ACTION_COLORS[log.action] || ACTION_COLORS.UPDATE;
  const severity = getSeverity(log.action);
  const severityColor = SEVERITY_COLORS[severity];
  const userName = log.user
    ? `${log.user.firstName || ""} ${log.user.lastName || ""}`.trim() || log.user.email
    : "System";

  return (
    <div className="group">
      <div
        className="flex items-start gap-3 px-4 py-3 rounded-xl transition-all cursor-pointer hover:bg-[var(--secondary)]/60"
        onClick={() => setExpanded(e => !e)}
      >
        {/* Timeline */}
        <div className="flex flex-col items-center shrink-0 pt-0.5">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
            style={{ backgroundColor: actionColor.bg, color: actionColor.text }}
          >
            {actionColor.icon}
          </div>
          {!isLast && <div className="w-px flex-1 my-1 min-h-[12px]" style={{ backgroundColor: "var(--border)" }} />}
        </div>

        {/* Main content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm leading-5" style={{ color: "var(--foreground)" }}>
                <span className="font-semibold">{userName}</span>
                {" "}
                <span style={{ color: "var(--muted-foreground)" }}>{formatActionText(log.action).toLowerCase()}</span>
                {" "}
                <span className="font-medium">{log.entity?.replace(/_/g, " ")}</span>
                {log.entityId && (
                  <span className="text-[11px] ml-1 font-mono" style={{ color: "var(--muted-foreground)" }}>
                    #{log.entityId.slice(0, 8)}
                  </span>
                )}
              </p>
              {log.details && (
                <p className="text-xs mt-0.5 truncate max-w-[340px]" style={{ color: "var(--muted-foreground)" }}>
                  {typeof log.details === "string" ? log.details : (log.details?.description || JSON.stringify(log.details).slice(0, 80))}
                </p>
              )}
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold" style={{ backgroundColor: actionColor.bg, color: actionColor.text }}>
                  {actionColor.icon}{log.action}
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold" style={{ backgroundColor: severityColor.bg, color: severityColor.text }}>
                  {severityColor.icon}{severity}
                </span>
                {log.ipAddress && (
                  <span className="text-[10px] font-mono" style={{ color: "var(--muted-foreground)" }}>
                    {log.ipAddress}
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-[11px] whitespace-nowrap" style={{ color: "var(--muted-foreground)" }}>
                {humanTime(log.createdAt)}
              </span>
              <ChevronRight
                className="w-4 h-4 transition-transform"
                style={{
                  color: "var(--muted-foreground)",
                  transform: expanded ? "rotate(90deg)" : "rotate(0deg)",
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Expanded detail */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="ml-12 mr-4 mb-3 p-4 rounded-xl border text-xs font-mono" style={{ borderColor: "var(--border)", backgroundColor: "var(--secondary)" }}>
              <p className="text-[11px] font-semibold mb-2 font-sans uppercase tracking-wider" style={{ color: "var(--muted-foreground)" }}>Full Event Details</p>
              <pre className="text-xs overflow-x-auto whitespace-pre-wrap break-all" style={{ color: "var(--foreground)" }}>
                {JSON.stringify({
                  id: log.id,
                  action: log.action,
                  entity: log.entity,
                  entityId: log.entityId,
                  userId: log.userId,
                  user: log.user ? { name: userName, email: log.user.email } : null,
                  ipAddress: log.ipAddress,
                  userAgent: log.userAgent,
                  sessionId: log.sessionId,
                  createdAt: log.createdAt,
                  details: log.details,
                }, null, 2)}
              </pre>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Filter Chip ───────────────────────────────────────────────────────────

function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold" style={{ backgroundColor: "rgba(0,1,252,0.1)", color: "var(--primary)" }}>
      {label}
      <button onClick={onRemove} className="hover:opacity-70"><X className="w-3 h-3" /></button>
    </span>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────

export default function AuditLogPage() {
  const [page, setPage] = useState(1);
  const [actionFilter, setActionFilter] = useState("");
  const [entityFilter, setEntityFilter] = useState("");
  const [severityFilter, setSeverityFilter] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [keyword, setKeyword] = useState("");
  const [ipFilter, setIpFilter] = useState("");
  const [sessionFilter, setSessionFilter] = useState("");
  const [showFilters, setShowFilters] = useState(true); // default ON
  const limit = 50;

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["audit-logs", page, actionFilter, entityFilter, severityFilter, startDate, endDate, keyword, ipFilter, sessionFilter],
    queryFn: async () => {
      const params: Record<string, unknown> = { limit, offset: (page - 1) * limit };
      if (actionFilter) params.action = actionFilter;
      if (entityFilter) params.entity = entityFilter;
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;
      const res = await auditLogsApi.list(params);
      return res.data;
    },
  });

  const logs: any[] = data?.data || [];
  const total = data?.meta?.total || 0;
  const totalPages = data?.meta?.totalPages || 1;

  // Client-side filter for keyword / IP / session (backend may not support these)
  const filteredLogs = logs.filter(log => {
    if (severityFilter && getSeverity(log.action) !== severityFilter) return false;
    if (keyword) {
      const haystack = JSON.stringify(log).toLowerCase();
      if (!haystack.includes(keyword.toLowerCase())) return false;
    }
    if (ipFilter && !(log.ipAddress || "").includes(ipFilter)) return false;
    if (sessionFilter && !(log.sessionId || "").includes(sessionFilter)) return false;
    return true;
  });

  const activeFilters = [
    actionFilter && { label: `Action: ${actionFilter}`, clear: () => setActionFilter("") },
    entityFilter && { label: `Entity: ${entityFilter}`, clear: () => setEntityFilter("") },
    severityFilter && { label: `Severity: ${severityFilter}`, clear: () => setSeverityFilter("") },
    startDate && { label: `From: ${startDate}`, clear: () => setStartDate("") },
    endDate && { label: `To: ${endDate}`, clear: () => setEndDate("") },
    keyword && { label: `Keyword: "${keyword}"`, clear: () => setKeyword("") },
    ipFilter && { label: `IP: ${ipFilter}`, clear: () => setIpFilter("") },
    sessionFilter && { label: `Session: ${sessionFilter}`, clear: () => setSessionFilter("") },
  ].filter(Boolean) as { label: string; clear: () => void }[];

  const clearAll = () => {
    setActionFilter(""); setEntityFilter(""); setSeverityFilter("");
    setStartDate(""); setEndDate(""); setKeyword(""); setIpFilter(""); setSessionFilter("");
    setPage(1);
  };

  const exportCsv = useCallback(() => {
    const rows = [
      ["Time", "User", "Action", "Entity", "Entity ID", "IP", "Severity", "Details"],
      ...filteredLogs.map(l => [
        new Date(l.createdAt).toISOString(),
        l.user ? `${l.user.firstName || ""} ${l.user.lastName || ""}`.trim() || l.user.email : "System",
        l.action,
        l.entity || "",
        l.entityId || "",
        l.ipAddress || "",
        getSeverity(l.action),
        typeof l.details === "string" ? l.details : JSON.stringify(l.details || ""),
      ]),
    ];
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `audit-log-${Date.now()}.csv`; a.click();
    URL.revokeObjectURL(url);
  }, [filteredLogs]);

  const inputClass = "w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]";
  const inputStyle = { backgroundColor: "var(--background)", borderColor: "var(--border)", color: "var(--foreground)" };

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>Audit Log</h1>
          <p className="text-sm mt-1" style={{ color: "var(--muted-foreground)" }}>
            Track every important action in the system — who did what, when, and from where.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={exportCsv}
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium border transition-colors"
            style={{ borderColor: "var(--border)", color: "var(--foreground)", backgroundColor: "var(--card)" }}
          >
            <Download className="w-4 h-4" /> Export CSV
          </button>
          <button
            onClick={() => refetch()}
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium border transition-colors"
            style={{ borderColor: "var(--border)", color: "var(--foreground)", backgroundColor: "var(--card)" }}
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border transition-colors"
            style={{ borderColor: showFilters ? "var(--primary)" : "var(--border)", color: showFilters ? "var(--primary)" : "var(--foreground)", backgroundColor: showFilters ? "rgba(0,1,252,0.06)" : "var(--card)" }}
          >
            <Filter className="w-4 h-4" />
            Filters
            {activeFilters.length > 0 && (
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold" style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}>
                {activeFilters.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Active filter chips */}
      {activeFilters.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {activeFilters.map(f => <FilterChip key={f.label} label={f.label} onRemove={f.clear} />)}
          <button onClick={clearAll} className="text-xs font-medium hover:underline" style={{ color: "var(--destructive)" }}>Clear all</button>
        </div>
      )}

      {/* Filter panel */}
      <AnimatePresence>
        {showFilters && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden mb-4"
          >
            <div className="p-4 rounded-xl border" style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}>
              <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "var(--muted-foreground)" }}>Filter by</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">

                {/* Keyword search */}
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: "var(--muted-foreground)" }}>Keyword Search</label>
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: "var(--muted-foreground)" }} />
                    <input value={keyword} onChange={e => { setKeyword(e.target.value); setPage(1); }} className={inputClass + " pl-8"} style={inputStyle} placeholder="Search all events..." />
                  </div>
                </div>

                {/* Action */}
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: "var(--muted-foreground)" }}>Action</label>
                  <select value={actionFilter} onChange={e => { setActionFilter(e.target.value); setPage(1); }} className={inputClass} style={inputStyle}>
                    <option value="">All actions</option>
                    {ACTION_TYPES.map(a => <option key={a} value={a}>{formatActionText(a)}</option>)}
                  </select>
                </div>

                {/* Entity */}
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: "var(--muted-foreground)" }}>Entity Type</label>
                  <select value={entityFilter} onChange={e => { setEntityFilter(e.target.value); setPage(1); }} className={inputClass} style={inputStyle}>
                    <option value="">All entities</option>
                    {ENTITY_TYPES.map(e => <option key={e} value={e}>{e.replace(/_/g, " ")}</option>)}
                  </select>
                </div>

                {/* Severity */}
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: "var(--muted-foreground)" }}>Severity</label>
                  <select value={severityFilter} onChange={e => { setSeverityFilter(e.target.value); setPage(1); }} className={inputClass} style={inputStyle}>
                    <option value="">All severities</option>
                    <option value="info">Info</option>
                    <option value="warning">Warning</option>
                    <option value="critical">Critical</option>
                  </select>
                </div>

                {/* Start Date */}
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: "var(--muted-foreground)" }}>From Date</label>
                  <input type="date" value={startDate} onChange={e => { setStartDate(e.target.value); setPage(1); }} className={inputClass} style={inputStyle} />
                </div>

                {/* End Date */}
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: "var(--muted-foreground)" }}>To Date</label>
                  <input type="date" value={endDate} onChange={e => { setEndDate(e.target.value); setPage(1); }} className={inputClass} style={inputStyle} />
                </div>

                {/* IP Address */}
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: "var(--muted-foreground)" }}>IP Address</label>
                  <input value={ipFilter} onChange={e => { setIpFilter(e.target.value); setPage(1); }} className={inputClass} style={inputStyle} placeholder="e.g. 192.168.1.1" />
                </div>

                {/* Session ID */}
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: "var(--muted-foreground)" }}>Session / Scraper ID</label>
                  <input value={sessionFilter} onChange={e => { setSessionFilter(e.target.value); setPage(1); }} className={inputClass} style={inputStyle} placeholder="Session or scrape job ID" />
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Stats bar */}
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
          {isLoading ? "Loading..." : `${filteredLogs.length} of ${total} events`}
        </p>
        <div className="flex items-center gap-2">
          {(["info", "warning", "critical"] as const).map(s => (
            <button
              key={s}
              onClick={() => setSeverityFilter(severityFilter === s ? "" : s)}
              className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold capitalize transition-all"
              style={{
                backgroundColor: severityFilter === s ? SEVERITY_COLORS[s].bg : "transparent",
                color: severityFilter === s ? SEVERITY_COLORS[s].text : "var(--muted-foreground)",
                border: `1px solid ${severityFilter === s ? SEVERITY_COLORS[s].text + "40" : "var(--border)"}`,
              }}
            >
              {SEVERITY_COLORS[s].icon}{s}
            </button>
          ))}
        </div>
      </div>

      {/* Timeline */}
      <div className="rounded-xl border overflow-hidden" style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}>
        {isLoading ? (
          <ModernLoader words={['Loading audit trail...', 'Fetching system events...', 'Tracing activity logs...', 'Compiling event history...']} />
        ) : filteredLogs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Activity className="w-12 h-12 mb-4" style={{ color: "var(--muted-foreground)", opacity: 0.3 }} />
            <h3 className="text-lg font-semibold mb-1" style={{ color: "var(--foreground)" }}>No audit logs found</h3>
            <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
              {activeFilters.length > 0 ? "Try adjusting your filters" : "Activity will appear here when actions are performed"}
            </p>
          </div>
        ) : (
          <div className="p-3">
            {filteredLogs.map((log, i) => (
              <LogRow key={log.id || i} log={log} index={i} isLast={i === filteredLogs.length - 1} />
            ))}
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-6">
          <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
            Page {page} of {totalPages} · {total} total events
          </p>
          <div className="flex items-center gap-2">
            <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="px-3 py-1.5 rounded-lg text-xs font-medium border disabled:opacity-40 transition-colors hover:bg-[var(--secondary)]" style={{ borderColor: "var(--border)", color: "var(--foreground)" }}>
              ← Previous
            </button>
            <button disabled={page >= totalPages} onClick={() => setPage(page + 1)} className="px-3 py-1.5 rounded-lg text-xs font-medium border disabled:opacity-40 transition-colors hover:bg-[var(--secondary)]" style={{ borderColor: "var(--border)", color: "var(--foreground)" }}>
              Next →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
