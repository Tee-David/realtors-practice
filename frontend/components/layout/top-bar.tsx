"use client";

import { AnimatedThemeToggler } from "@/components/ui/animated-theme-toggler";
import { Bell } from "lucide-react";

interface TopBarProps {
  title: string;
  notificationCount?: number;
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
        className="text-sm font-medium"
        style={{ color: "var(--foreground)" }}
      >
        {name}
      </span>
    </button>
  );
}

export function TopBar({ title, notificationCount }: TopBarProps) {
  return (
    <header
      className="hidden md:flex fixed top-0 right-0 items-center justify-between px-6 z-30 border-b"
      style={{
        height: 56,
        left: 60,
        backgroundColor: "var(--card)",
        borderColor: "var(--border)",
      }}
    >
      {/* Left: Page title */}
      <h1
        className="text-lg font-semibold font-display"
        style={{ color: "var(--foreground)" }}
      >
        {title}
      </h1>

      {/* Right: Actions */}
      <div className="flex items-center gap-3">
        {/* Theme toggle */}
        <AnimatedThemeToggler />

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
