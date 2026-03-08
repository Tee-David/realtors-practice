"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Menu, Wifi, WifiOff, RefreshCw, User } from "lucide-react";
import { ThemeSwitch } from "@/components/ui/theme-switch";
import { useAuth } from "@/hooks/useAuth";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://millenium-potters.onrender.com/api";

interface HeaderProps {
  onMobileMenuClick?: () => void;
}

export function Header({ onMobileMenuClick }: HeaderProps) {
  const { user } = useAuth();
  const [connectionStatus, setConnectionStatus] = useState<"online" | "offline" | "checking">("checking");

  useEffect(() => {
    const checkConnection = async () => {
      const baseUrl = API_URL.replace(/\/api\/?$/, "");
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        const response = await fetch(`${baseUrl}/health`, {
          method: "GET",
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        setConnectionStatus(response.ok ? "online" : "offline");
      } catch {
        setConnectionStatus("offline");
      }
    };

    checkConnection();
    const interval = setInterval(checkConnection, 30000); // Check every 30 seconds
    return () => clearInterval(interval);
  }, []);

  // Get display name from user email (before @)
  const displayName = user?.email?.split("@")[0] || "User";
  const roleLabel = user?.role?.replace("_", " ") || "";

  return (
    <header className="bg-white dark:bg-slate-800 dark:bg-gray-800 border-b border-slate-200 dark:border-slate-700 dark:border-gray-700 px-3 sm:px-4 md:px-6 py-3 sm:py-4 flex-shrink-0 sticky top-0 z-20">
      <div className="flex items-center justify-between">
        {/* Left side - Mobile Menu toggle only */}
        <div className="flex items-center gap-2 sm:gap-4">
          {/* Mobile Menu Button - Only visible on mobile */}
          <button
            id="mobile-menu-trigger"
            onClick={onMobileMenuClick}
            className={cn(
              "md:hidden flex items-center justify-center p-2 rounded-lg hover:bg-slate-100 dark:bg-slate-700 dark:hover:bg-gray-700 transition-colors",
              "min-h-[44px] min-w-[44px]"
            )}
            aria-label="Open mobile menu"
          >
            <Menu className="h-6 w-6 text-slate-600 dark:text-slate-400 dark:text-gray-300" />
          </button>

          {/* Desktop - Take Tour Button */}
          <div className="hidden md:block">
            <button
              onClick={() => window.dispatchEvent(new CustomEvent('start-onboarding-tour'))}
              className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-all text-xs font-semibold border border-emerald-200/50 dark:border-emerald-800/50 shadow-sm animate-pop-trigger"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span>Take Tour</span>
            </button>
          </div>
        </div>

        {/* Right side - User info and Actions */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* User Display - Responsive */}
          <div id="tour-profile-menu" className="flex items-center gap-2">
            <div className="flex items-center justify-center h-8 w-8 rounded-full bg-emerald-100 dark:bg-emerald-900/30">
              <User className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="hidden sm:flex flex-col items-end">
              <span className="text-sm font-medium text-slate-900 dark:text-white dark:text-gray-100 capitalize">
                {displayName}
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400 dark:text-gray-400 capitalize">
                {roleLabel}
              </span>
            </div>
          </div>

          {/* Divider */}
          <div className="hidden sm:block h-8 w-px bg-slate-200 dark:bg-slate-700 dark:bg-gray-700" />

          {/* Connection Status Indicator */}
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium">
            {connectionStatus === "checking" && (
              <span className="flex items-center gap-1 text-slate-500 dark:text-slate-400">
                <RefreshCw className="h-3 w-3 animate-spin" />
                <span className="hidden sm:inline">Checking...</span>
              </span>
            )}
            {connectionStatus === "online" && (
              <span className="flex items-center gap-1 text-emerald-600">
                <Wifi className="h-3 w-3" />
                <span className="hidden sm:inline">Online</span>
              </span>
            )}
            {connectionStatus === "offline" && (
              <span className="flex items-center gap-1 text-red-500">
                <WifiOff className="h-3 w-3" />
                <span className="hidden sm:inline">Offline</span>
              </span>
            )}
          </div>

          <ThemeSwitch />
        </div>
      </div>
    </header>
  );
}
