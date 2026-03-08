import { AuthVisualPanel } from "@/components/auth/auth-visual-panel";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen grid lg:grid-cols-[65fr_35fr]" style={{ backgroundColor: "var(--background)" }}>
      {/* Left: Visual panel — hidden on mobile */}
      <AuthVisualPanel />

      {/* Right: Form area */}
      <div className="flex items-center justify-center p-6 sm:p-10">
        {children}
      </div>
    </div>
  );
}
