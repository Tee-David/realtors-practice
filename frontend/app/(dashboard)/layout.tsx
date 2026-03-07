import { AppSidebar, MobileSidebar } from "@/components/layout/app-sidebar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen" style={{ backgroundColor: "var(--background)" }}>
      <AppSidebar />
      <MobileSidebar />
      <main className="md:ml-[60px] p-6 transition-all duration-300">
        {children}
      </main>
    </div>
  );
}
