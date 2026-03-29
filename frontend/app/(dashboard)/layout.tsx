"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AppSidebar, MobileSidebar } from "@/components/layout/app-sidebar";
import { MobileBottomNav } from "@/components/layout/mobile-bottom-nav";
import { TopBar } from "@/components/layout/top-bar";
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts";
import { KeyboardShortcutsModal } from "@/components/ui/keyboard-shortcuts-modal";
import dynamic from "next/dynamic";
import { AIAssistantFab } from "@/components/ai/ai-assistant-fab";
import { ScraperSocketProvider } from "@/components/scraper/scraper-socket-provider";
import { useAuth } from "@/hooks/use-auth";
import ModernLoader from "@/components/ui/modern-loader";

const TourProvider = dynamic(() => import("@/components/ui/tour-provider").then(m => ({ default: m.TourProvider })), { ssr: false });

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // ALL hooks must be called unconditionally — never after early returns
  const { loading: authLoading, isAuthenticated } = useAuth();
  const router = useRouter();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const pathname = usePathname() || "";

  const toggleShortcuts = useCallback(() => setShortcutsOpen((v) => !v), []);
  useKeyboardShortcuts({ onToggleHelp: toggleShortcuts });

  const title = useMemo(() => {
    if (pathname.startsWith("/properties")) return "Properties";
    if (pathname.startsWith("/search")) return "Search";
    if (pathname.startsWith("/data-explorer")) return "Data Explorer";
    if (pathname.startsWith("/scraper/sites")) return "Sites";
    if (pathname.startsWith("/scraper")) return "Scraper";
    if (pathname.startsWith("/analytics")) return "Analytics";
    if (pathname.startsWith("/saved-searches")) return "Saved Searches";
    if (pathname.startsWith("/audit-log")) return "Audit Log";
    if (pathname.startsWith("/settings")) return "Settings";
    if (pathname.startsWith("/ai") || pathname.startsWith("/assistant")) return "AI Assistant";
    if (pathname.startsWith("/market")) return "Market Intel";
    if (pathname.startsWith("/notifications")) return "Notifications";
    return "Dashboard";
  }, [pathname]);

  // Redirect to login if not authenticated (after all hooks)
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.replace("/login");
    }
  }, [authLoading, isAuthenticated, router]);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "var(--background)" }}>
        <ModernLoader words={["Authenticating...", "Loading session...", "Almost ready..."]} fullPage={false} />
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: "var(--background)" }}>
      <ScraperSocketProvider />

      <div data-tour="sidebar">
        <AppSidebar />
      </div>

      <TourProvider />

      <TopBar title={title} onOpenSidebar={() => setMobileSidebarOpen(true)} />

      <main className="pt-[76px] md:ml-[60px] md:pt-[56px] p-6 pb-24 md:pb-6 transition-all duration-300">
        {children}
      </main>

      <MobileSidebar
        open={mobileSidebarOpen}
        onOpenChange={setMobileSidebarOpen}
      />

      <KeyboardShortcutsModal open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />

      <AIAssistantFab />

      <MobileBottomNav
        onOpenSidebar={() => setMobileSidebarOpen(true)}
        extraButton={
          (pathname === "/properties" || pathname === "/search" || pathname === "/scraper") ? (
            <button
              onClick={() => {
                if (pathname === "/scraper") {
                  document.dispatchEvent(new CustomEvent("toggle-scraper-config"));
                } else {
                  document.dispatchEvent(new CustomEvent("toggle-mobile-filters"));
                }
              }}
              className="flex items-center justify-center w-10 h-10 rounded-full transition-all"
              style={{
                color: "var(--foreground)",
                backgroundColor: "var(--secondary)",
              }}
              aria-label="Filters"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="4" x2="4" y1="21" y2="14"/><line x1="4" x2="4" y1="10" y2="3"/><line x1="12" x2="12" y1="21" y2="12"/><line x1="12" x2="12" y1="8" y2="3"/><line x1="20" x2="20" y1="21" y2="16"/><line x1="20" x2="20" y1="12" y2="3"/><line x1="2" x2="6" y1="14" y2="14"/><line x1="10" x2="14" y1="8" y2="8"/><line x1="18" x2="22" y1="16" y2="16"/></svg>
            </button>
          ) : undefined
        }
      />
    </div>
  );
}
