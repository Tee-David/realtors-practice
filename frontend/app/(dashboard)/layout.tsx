"use client";

import { useState } from "react";
import { AppSidebar, MobileSidebar } from "@/components/layout/app-sidebar";
import { MobileBottomNav } from "@/components/layout/mobile-bottom-nav";
import { TopBar } from "@/components/layout/top-bar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen" style={{ backgroundColor: "var(--background)" }}>
      {/* Desktop sidebar — hidden on mobile, shown on md+ */}
      <AppSidebar />

      {/* Desktop top bar — hidden on mobile, shown on md+ */}
      <TopBar title="Dashboard" />

      {/* Main content area */}
      <main className="pt-16 md:ml-[60px] md:pt-[56px] p-6 pb-24 md:pb-6 transition-all duration-300">
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
