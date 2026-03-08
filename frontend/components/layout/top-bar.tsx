"use client";

import { ThemeSwitch } from "@/components/ui/theme-switch";
import { Bell, Menu } from "lucide-react";

interface TopBarProps {
  title: string;
  notificationCount?: number;
  onOpenSidebar?: () => void;
}

function UserProfileDropdown() {
  const initials = "AD";
  const name = "Admin";

  return (
    <button
      className="flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-[var(--secondary)]"
    >
      <div
        className="flex items-center justify-center shrink-0 rounded-full font-semibold text-xs select-none"
        style={{
          width: 32,
          height: 32,
          backgroundColor: "var(--primary)",
          color: "var(--primary-foreground)",
        }}
      >
        {initials}
      </div>
      <span
        className="hidden sm:inline text-sm font-medium"
        style={{ color: "var(--foreground)" }}
      >
        {name}
      </span>
    </button>
  );
}

export function TopBar({ title, notificationCount, onOpenSidebar }: TopBarProps) {
  return (
    <header
      className="flex fixed top-0 right-0 left-0 md:left-[60px] items-center justify-between px-4 sm:px-6 z-30 border-b"
      style={{
        height: 56,
        backgroundColor: "var(--card)",
        borderColor: "var(--border)",
      }}
    >
      {/* Left: Hamburger (mobile) + Page title */}
      <div className="flex items-center gap-3">
        {onOpenSidebar && (
          <button
            onClick={onOpenSidebar}
            className="md:hidden h-10 w-10 flex items-center justify-center rounded-xl border transition-colors hover:bg-[var(--secondary)] bg-[var(--card)]"
            style={{ borderColor: "var(--border)" }}
            aria-label="Open Map/Sidebar Menu"
          >
            <Menu className="h-5 w-5" style={{ color: "var(--foreground)" }} />
          </button>
        )}
        <h1
          className="text-lg font-semibold font-display"
          style={{ color: "var(--foreground)" }}
        >
          {title}
        </h1>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Tour button */}
        <button
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-90 transition-opacity"
        >
          <span className="sm:hidden">Tour</span>
          <span className="hidden sm:inline">Take Interactive Tour</span>
        </button>

        {/* Theme toggle */}
        <ThemeSwitch />

        {/* Notification bell */}
        <button
          className="relative flex items-center justify-center h-9 w-9 rounded-full transition-colors hover:bg-[var(--secondary)]"
          aria-label="Notifications"
        >
          <Bell
            className="h-5 w-5"
            style={{ color: "var(--muted-foreground)" }}
          />
          {notificationCount != null && notificationCount > 0 && (
            <span
              className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[18px] h-[18px] rounded-full text-[10px] font-bold px-1"
              style={{
                backgroundColor: "var(--destructive)",
                color: "var(--destructive-foreground)",
              }}
            >
              {notificationCount > 99 ? "99+" : notificationCount}
            </span>
          )}
        </button>

        {/* User profile */}
        <UserProfileDropdown />
      </div>
    </header>
  );
}
