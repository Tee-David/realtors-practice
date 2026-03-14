"use client";

import { useState } from "react";
import { useNotifications, useMarkRead, useMarkAllRead } from "@/hooks/use-notifications";
import { Bell, CheckCheck, ChevronLeft, ChevronRight } from "lucide-react";
import ModernLoader from "@/components/ui/modern-loader";

type Tab = "all" | "unread";

const typeConfig: Record<string, { emoji: string; bgColor: string }> = {
  NEW_MATCH: { emoji: "🏠", bgColor: "rgba(37,99,235,0.12)" },
  PRICE_DROP: { emoji: "📉", bgColor: "rgba(22,163,74,0.12)" },
  SCRAPE_COMPLETE: { emoji: "✅", bgColor: "rgba(22,163,74,0.12)" },
  SCRAPE_FAILED: { emoji: "❌", bgColor: "rgba(220,38,38,0.12)" },
  SYSTEM: { emoji: "⚙️", bgColor: "rgba(107,114,128,0.12)" },
};

export default function NotificationsPage() {
  const [tab, setTab] = useState<Tab>("all");
  const [page, setPage] = useState(1);
  const limit = 20;
  const offset = (page - 1) * limit;

  const { data, isLoading } = useNotifications({
    limit,
    offset,
    ...(tab === "unread" ? { read: false } : {}),
  });

  const markRead = useMarkRead();
  const markAllRead = useMarkAllRead();

  const notifications = data?.data?.notifications || [];
  const total = data?.meta?.total || 0;
  const unreadCount = data?.data?.unreadCount || 0;
  const totalPages = Math.ceil(total / limit) || 1;

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days === 1) return "Yesterday";
    return `${days}d ago`;
  };

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>
            Notifications
            {unreadCount > 0 && (
              <span className="ml-2 inline-flex items-center justify-center min-w-[24px] h-6 rounded-full text-xs font-bold px-2" style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}>
                {unreadCount}
              </span>
            )}
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--muted-foreground)" }}>{total} total notifications</p>
        </div>
        {unreadCount > 0 && (
          <button
            onClick={() => markAllRead.mutate()}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border transition-colors hover:bg-[var(--secondary)]"
            style={{ borderColor: "var(--border)", color: "var(--primary)" }}
          >
            <CheckCheck className="w-4 h-4" /> Mark all as read
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 p-1 rounded-xl mb-6" style={{ backgroundColor: "var(--secondary)" }}>
        {(["all", "unread"] as const).map((t) => (
          <button
            key={t}
            onClick={() => { setTab(t); setPage(1); }}
            className="flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors capitalize"
            style={{
              backgroundColor: tab === t ? "var(--card)" : "transparent",
              color: tab === t ? "var(--foreground)" : "var(--muted-foreground)",
              boxShadow: tab === t ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
            }}
          >
            {t === "all" ? "All" : `Unread (${unreadCount})`}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="space-y-2">
        {isLoading ? (
          <ModernLoader words={['Fetching notifications...', 'Checking for updates...', 'Loading your alerts...']} />
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 rounded-xl border" style={{ borderColor: "var(--border)" }}>
            <Bell className="w-14 h-14 mb-4" style={{ color: "var(--muted-foreground)", opacity: 0.25 }} />
            <h3 className="text-lg font-semibold mb-1" style={{ color: "var(--foreground)" }}>
              {tab === "unread" ? "All caught up!" : "No notifications yet"}
            </h3>
            <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
              {tab === "unread" ? "You have no unread notifications" : "Notifications will appear here"}
            </p>
          </div>
        ) : (
          notifications.map((n: any) => {
            const config = typeConfig[n.type] || typeConfig.SYSTEM;
            return (
              <button
                key={n.id}
                onClick={() => { if (!n.read) markRead.mutate(n.id); }}
                className="w-full flex items-start gap-4 p-4 rounded-xl border text-left transition-all hover:shadow-md"
                style={{
                  borderColor: n.read ? "var(--border)" : "var(--primary)",
                  backgroundColor: n.read ? "var(--card)" : "var(--primary-foreground)",
                  borderWidth: n.read ? 1 : 2,
                }}
              >
                <div className="relative shrink-0">
                  <div className="w-12 h-12 rounded-full flex items-center justify-center text-xl" style={{ backgroundColor: config.bgColor }}>
                    {config.emoji}
                  </div>
                  {!n.read && (
                    <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2" style={{ backgroundColor: "#22c55e", borderColor: "var(--card)" }} />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>{n.title}</p>
                    <span className="text-[11px] whitespace-nowrap shrink-0" style={{ color: "var(--muted-foreground)" }}>{timeAgo(n.createdAt)}</span>
                  </div>
                  <p className="text-sm mt-1 leading-relaxed" style={{ color: "var(--muted-foreground)" }}>{n.message}</p>
                </div>
                {!n.read && (
                  <div className="shrink-0 mt-2">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: "#22c55e" }} />
                  </div>
                )}
              </button>
            );
          })
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-4 mt-8">
          <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="flex items-center gap-1 px-4 py-2 rounded-lg text-sm font-medium border disabled:opacity-40 transition-colors" style={{ borderColor: "var(--border)", color: "var(--foreground)" }}>
            <ChevronLeft className="w-4 h-4" /> Previous
          </button>
          <span className="text-sm" style={{ color: "var(--muted-foreground)" }}>Page {page} of {totalPages}</span>
          <button disabled={page >= totalPages} onClick={() => setPage(page + 1)} className="flex items-center gap-1 px-4 py-2 rounded-lg text-sm font-medium border disabled:opacity-40 transition-colors" style={{ borderColor: "var(--border)", color: "var(--foreground)" }}>
            Next <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
