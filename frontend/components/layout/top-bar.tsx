"use client";

import { ThemeSwitch } from "@/components/ui/theme-switch";
import { Menu, WandSparkles } from "lucide-react";
import { NotificationBell } from "@/components/layout/notification-bell";
import { useQuery } from "@tanstack/react-query";
import { auth } from "@/lib/api";
import Link from "next/link";

interface TopBarProps {
  title: string;
  onOpenSidebar?: () => void;
}

function UserProfileAvatar() {
  const { data: me } = useQuery({ queryKey: ["auth-me"], queryFn: async () => (await auth.me()).data.data, staleTime: 30 * 60 * 1000 });
  const name = me?.firstName ? `${me.firstName}${me.lastName ? ` ${me.lastName}` : ""}` : me?.email?.split("@")[0] || "User";
  const initials = me?.firstName
    ? `${me.firstName[0]}${me.lastName?.[0] || ""}`.toUpperCase()
    : (me?.email?.[0] || "U").toUpperCase();

  return (
    <Link
      href="/settings"
      className="flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-[var(--secondary)]"
      title="Profile Settings"
    >
      {me?.avatarUrl ? (
        <img src={me.avatarUrl} alt="Avatar" className="shrink-0 rounded-full object-cover" style={{ width: 32, height: 32 }} />
      ) : (
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
      )}
      <span
        className="hidden sm:inline text-sm font-medium"
        style={{ color: "var(--foreground)" }}
      >
        {name}
      </span>
    </Link>
  );
}

export function TopBar({ title, onOpenSidebar }: TopBarProps) {
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
            if (typeof window !== 'undefined' && (window as any).startTour) {
              (window as any).startTour();
            } else {
              document.dispatchEvent(new Event('start-tour'));
            }
          }}
          className="flex items-center justify-center w-9 h-9 sm:w-auto sm:px-3 sm:py-1.5 rounded-xl text-sm font-semibold bg-primary/10 hover:bg-primary/20 text-primary dark:text-white transition-colors border border-primary/20 dark:border-white/20"
        >
          <WandSparkles className="w-4 h-4" strokeWidth={2} />
          <span className="hidden sm:inline ml-2">Product Tour</span>
        </button>

        {/* Theme toggle */}
        <ThemeSwitch />

        {/* Live Notification bell */}
        <NotificationBell />

        {/* User profile */}
        <UserProfileAvatar />
      </div>
    </header>
  );
}
