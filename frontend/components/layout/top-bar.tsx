"use client";

import { ThemeSwitch } from "@/components/ui/theme-switch";
import { Bell, Menu, WandSparkles } from "lucide-react";

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
      className="flex fixed top-0 right-0 left-0 md:left-[60px] items-center justify-between px-4 sm:px-6 z-[900] border-b print:hidden"
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
          <div className="w-20 h-14 flex items-center justify-center -ml-4 pt-1 pointer-events-none">
             <img 
               src="/logo-icon-blue.png" 
               alt="Logo" 
               className="w-full h-full object-contain dark:hidden scale-[1.7]" 
             />
             <img 
               src="/logo-icon-white.png" 
               alt="Logo" 
               className="w-full h-full object-contain hidden dark:block scale-[1.7]" 
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
          onClick={() => {
            // Check if OnboardJS is available and start the tour if possible
            if (typeof window !== 'undefined' && (window as any).startTour) {
              (window as any).startTour();
            } else {
              // Dispatch a custom event that a Tour implementation can listen to
              document.dispatchEvent(new CustomEvent('start-product-tour'));
            }
          }}
          className="flex items-center justify-center w-9 h-9 sm:w-auto sm:px-3 sm:py-1.5 rounded-xl text-sm font-semibold bg-primary/10 hover:bg-primary/20 text-primary transition-colors border border-primary/20"
        >
          <WandSparkles className="w-4 h-4" strokeWidth={2} />
          <span className="hidden sm:inline ml-2">Product Tour</span>
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
