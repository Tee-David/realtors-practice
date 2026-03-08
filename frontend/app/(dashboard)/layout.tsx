"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { AppSidebar, MobileSidebar } from "@/components/layout/app-sidebar";
import { MobileBottomNav } from "@/components/layout/mobile-bottom-nav";
import { TopBar } from "@/components/layout/top-bar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const pathname = usePathname() || "";

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

  return (
    <div className="min-h-screen" style={{ backgroundColor: "var(--background)" }}>
      {/* Desktop sidebar — hidden on mobile, shown on md+ */}
      <AppSidebar />

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

      {/* Mobile bottom navigation */}
      <MobileBottomNav onOpenSidebar={() => setMobileSidebarOpen(true)} />
    </div>
  );
}
