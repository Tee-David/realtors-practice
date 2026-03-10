import { AuthVisualPanel } from "@/components/auth/auth-visual-panel";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen grid lg:grid-cols-2" style={{ backgroundColor: "var(--background)" }}>
      {/* Left: Visual panel — hidden on mobile */}
      <AuthVisualPanel />

      {/* Right: Form area */}
      <div className="flex items-center justify-center p-4 sm:p-8 lg:p-12 overflow-y-auto">
        {children}
      </div>
    </div>
  );
}
