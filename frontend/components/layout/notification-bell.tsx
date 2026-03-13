"use client";

import { useState, useRef, useEffect } from "react";
import { Bell, CheckCheck } from "lucide-react";
import { useUnreadCount, useNotifications, useMarkRead, useMarkAllRead } from "@/hooks/use-notifications";
import Link from "next/link";

type FilterTab = "all" | "unread";

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<FilterTab>("all");
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { data: unreadCount = 0 } = useUnreadCount();
  const { data: allData } = useNotifications({ limit: 15, offset: 0 });
  const { data: unreadData } = useNotifications({ limit: 15, offset: 0, read: false });
  const markRead = useMarkRead();
  const markAllRead = useMarkAllRead();

  const notificationsList = activeTab === "all"
    ? (allData?.data?.notifications || [])
    : (unreadData?.data?.notifications || []);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  // Notification type → avatar/icon config
  const typeConfig: Record<string, { emoji: string; color: string; bgColor: string }> = {
    NEW_MATCH: { emoji: "🏠", color: "#2563eb", bgColor: "rgba(37,99,235,0.12)" },
    PRICE_DROP: { emoji: "📉", color: "#16a34a", bgColor: "rgba(22,163,74,0.12)" },
    SCRAPE_COMPLETE: { emoji: "✅", color: "#16a34a", bgColor: "rgba(22,163,74,0.12)" },
    SCRAPE_FAILED: { emoji: "❌", color: "#dc2626", bgColor: "rgba(220,38,38,0.12)" },
    SYSTEM: { emoji: "⚙️", color: "#6b7280", bgColor: "rgba(107,114,128,0.12)" },
  };

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
    <div className="relative" ref={dropdownRef}>
      {/* Bell button */}
      <button
        onClick={() => setOpen(!open)}
        className="relative flex items-center justify-center h-9 w-9 rounded-full transition-colors hover:bg-[var(--secondary)]"
        aria-label="Notifications"
      >
        <Bell className="h-5 w-5" style={{ color: "var(--muted-foreground)" }} />
        {unreadCount > 0 && (
          <span
            className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[18px] h-[18px] rounded-full text-[10px] font-bold px-1"
            style={{
              backgroundColor: "var(--destructive)",
              color: "var(--destructive-foreground)",
            }}
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      {open && (
        <div
          className="absolute right-0 top-full mt-2 w-[calc(100vw-2rem)] max-w-[400px] rounded-2xl border shadow-2xl overflow-hidden z-[1000]"
          style={{
            backgroundColor: "var(--card)",
            borderColor: "var(--border)",
          }}
        >
          {/* ── Header ── */}
          <div className="px-5 pt-5 pb-3">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold" style={{ color: "var(--foreground)" }}>
                Notifications
              </h3>
              {unreadCount > 0 && (
                <button
                  onClick={() => markAllRead.mutate()}
                  className="text-xs font-medium transition-colors hover:opacity-80"
                  style={{ color: "var(--primary)" }}
                >
                  Mark all as read
                </button>
              )}
            </div>

            {/* ── All / Unread tabs ── */}
            <div className="flex items-center gap-1">
              {(["all", "unread"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors capitalize"
                  style={{
                    backgroundColor: activeTab === tab ? "var(--secondary)" : "transparent",
                    color: activeTab === tab ? "var(--foreground)" : "var(--muted-foreground)",
                  }}
                >
                  {tab === "all" ? "All" : "Unread"}
                  {tab === "unread" && unreadCount > 0 && (
                    <span
                      className="ml-1.5 inline-flex items-center justify-center min-w-[18px] h-[18px] rounded-full text-[10px] font-bold px-1"
                      style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}
                    >
                      {unreadCount}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* ── Notification list ── */}
          <div className="overflow-y-auto max-h-[420px]">
            {notificationsList.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 px-4">
                <Bell className="w-10 h-10 mb-3" style={{ color: "var(--muted-foreground)", opacity: 0.3 }} />
                <p className="text-sm font-medium" style={{ color: "var(--muted-foreground)" }}>
                  {activeTab === "unread" ? "No unread notifications" : "No notifications yet"}
                </p>
              </div>
            ) : (
              notificationsList.map((n: any) => {
                const config = typeConfig[n.type] || typeConfig.SYSTEM;

                return (
                  <button
                    key={n.id}
                    onClick={() => {
                      if (!n.read) markRead.mutate(n.id);
                    }}
                    className="w-full flex items-start gap-3 px-5 py-3.5 text-left transition-colors hover:bg-[var(--secondary)]"
                  >
                    {/* Avatar / Icon */}
                    <div className="relative shrink-0">
                      <div
                        className="w-10 h-10 rounded-full flex items-center justify-center text-base"
                        style={{ backgroundColor: config.bgColor }}
                      >
                        {config.emoji}
                      </div>
                      {/* Status badge dot on avatar */}
                      {!n.read && (
                        <div
                          className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2"
                          style={{
                            backgroundColor: "#22c55e",
                            borderColor: "var(--card)",
                          }}
                        />
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm leading-snug" style={{ color: "var(--foreground)" }}>
                          <span className="font-semibold">{n.title}</span>
                        </p>
                        <span className="text-[11px] whitespace-nowrap shrink-0 mt-0.5" style={{ color: "var(--muted-foreground)" }}>
                          {timeAgo(n.createdAt)}
                        </span>
                      </div>
                      <p className="text-xs mt-0.5 line-clamp-2 leading-relaxed" style={{ color: "var(--muted-foreground)" }}>
                        {n.message}
                      </p>

                      {/* Action buttons for actionable notifications */}
                      {n.type === "NEW_MATCH" && n.data?.savedSearchId && (
                        <div className="flex items-center gap-2 mt-2">
                          <span className="text-xs font-medium px-2.5 py-1 rounded-md transition-colors hover:opacity-80" style={{ color: "var(--foreground)", backgroundColor: "var(--secondary)" }}>
                            Review
                          </span>
                          <span className="text-xs font-semibold px-2.5 py-1 rounded-md transition-colors hover:opacity-90" style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}>
                            View Matches
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Unread dot (right side, inspired by second design) */}
                    {!n.read && (
                      <div className="shrink-0 mt-2">
                        <div
                          className="w-2.5 h-2.5 rounded-full"
                          style={{ backgroundColor: "#22c55e" }}
                        />
                      </div>
                    )}
                  </button>
                );
              })
            )}
          </div>

          {/* ── Footer: See all notifications ── */}
          <div className="px-5 py-3 border-t" style={{ borderColor: "var(--border)" }}>
            <Link
              href="/notifications"
              onClick={() => setOpen(false)}
              className="block w-full text-center py-2.5 rounded-xl text-sm font-semibold transition-colors"
              style={{
                backgroundColor: "var(--primary)",
                color: "var(--primary-foreground)",
              }}
            >
              See all notifications
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
