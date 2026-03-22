"use client";

import { useState, useCallback } from "react";
import { usePathname } from "next/navigation";
import { AppSidebar, MobileSidebar } from "@/components/layout/app-sidebar";
import { MobileBottomNav } from "@/components/layout/mobile-bottom-nav";
import { TopBar } from "@/components/layout/top-bar";
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts";
import { KeyboardShortcutsModal } from "@/components/ui/keyboard-shortcuts-modal";
import dynamic from "next/dynamic";
import { AIChatFab } from "@/components/ai/ai-chat-fab";
import { ScraperSocketProvider } from "@/components/scraper/scraper-socket-provider";

const TourProvider = dynamic(() => import("@/components/ui/tour-provider").then(m => ({ default: m.TourProvider })), { ssr: false });

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const pathname = usePathname() || "";

  const toggleShortcuts = useCallback(() => setShortcutsOpen((v) => !v), []);
  useKeyboardShortcuts({ onToggleHelp: toggleShortcuts });

  let title = "Dashboard";
  if (pathname.startsWith("/properties")) title = "Properties";
  else if (pathname.startsWith("/search")) title = "Search";
  else if (pathname.startsWith("/data-explorer")) title = "Data Explorer";
  else if (pathname.startsWith("/scraper/sites")) title = "Sites";
  else if (pathname.startsWith("/scraper")) title = "Scraper";
  else if (pathname.startsWith("/analytics")) title = "Analytics";
  else if (pathname.startsWith("/saved-searches")) title = "Saved Searches";
  else if (pathname.startsWith("/audit-log")) title = "Audit Log";
  else if (pathname.startsWith("/settings")) title = "Settings";
  else if (pathname.startsWith("/ai")) title = "AI Assistant";
  else if (pathname.startsWith("/market")) title = "Market Intel";
  else if (pathname.startsWith("/notifications")) title = "Notifications";

  return (
    <div className="min-h-screen" style={{ backgroundColor: "var(--background)" }}>
      {/* Persistent scraper socket — survives page navigation */}
      <ScraperSocketProvider />

      {/* Desktop sidebar — hidden on mobile, shown on md+ */}
      <div data-tour="sidebar">
        <AppSidebar />
      </div>

      {/* Guided Tour */}
      <TourProvider />

      {/* Desktop/Mobile top bar */}
      <TopBar title={title} onOpenSidebar={() => setMobileSidebarOpen(true)} />

      {/* Main content area */}
      <main className="pt-[76px] md:ml-[60px] md:pt-[56px] p-6 pb-24 md:pb-6 transition-all duration-300">
        {children}
      </main>

      {/* Mobile sidebar overlay */}
      <MobileSidebar
        open={mobileSidebarOpen}
        onOpenChange={setMobileSidebarOpen}
      />

      {/* Keyboard shortcuts help modal */}
      <KeyboardShortcutsModal open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />

      {/* Floating AI Chat Button */}
      <AIChatFab />

      {/* Mobile bottom navigation */}
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
