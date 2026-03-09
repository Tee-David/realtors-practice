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
      {/* Left: Hamburger (mobile) + Logo & Page title */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 md:hidden">
          {onOpenSidebar && (
            <button
              onClick={onOpenSidebar}
              className="h-10 w-10 flex items-center justify-center rounded-xl border transition-colors hover:bg-[var(--secondary)] bg-[var(--card)]"
              style={{ borderColor: "var(--border)" }}
              aria-label="Open Map/Sidebar Menu"
            >
              <Menu className="h-5 w-5" style={{ color: "var(--foreground)" }} />
            </button>
          )}
          {/* Mobile Logo next to hamburger */}
          <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-white dark:bg-black/20 p-1 border border-border/50">
             <img 
               src="/REALTORS' PRACTICE LOGO ICON - BLUE.png" 
               alt="Logo" 
               className="w-full h-full object-contain dark:hidden" 
             />
             <img 
               src="/REALTORS' PRACTICE LOGO ICON - WHITE.png" 
               alt="Logo" 
               className="w-full h-full object-contain hidden dark:block" 
             />
          </div>
        </div>

        <h1
          className="hidden md:block text-lg font-semibold font-display truncate max-w-[200px] lg:max-w-none ml-2"
          style={{ color: "var(--foreground)" }}
        >
          {title}
        </h1>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Responsive Tour button (Icon on mobile, text on desktop) */}
        <button
          title="Take Interactive Tour"
          className="flex items-center gap-2 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold bg-primary/10 hover:bg-primary/20 text-primary transition-colors border border-primary/20 backdrop-blur-md"
        >
          {/* Map icon placeholder for tour */}
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.106 5.553a2 2 0 0 0 1.788 0l3.659-1.83A1 1 0 0 1 21 4.619v12.764a1 1 0 0 1-.553.894l-4.553 2.277a2 2 0 0 1-1.788 0l-4.212-2.106a2 2 0 0 0-1.788 0l-3.659 1.83A1 1 0 0 1 3 19.381V6.618a1 1 0 0 1 .553-.894l4.553-2.277a2 2 0 0 1 1.788 0z"/><path d="M15 5.764v15"/><path d="M9 3.236v15"/></svg>
          <span className="hidden sm:inline">Product Tour</span>
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
