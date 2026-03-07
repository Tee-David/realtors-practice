export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold" style={{ color: "var(--foreground)" }}>
          Dashboard
        </h1>
        <p className="text-sm mt-1" style={{ color: "var(--muted-foreground)" }}>
          Overview of your property intelligence platform
        </p>
      </div>

      {/* KPI Cards placeholder */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total Properties", value: "—" },
          { label: "New Today", value: "—" },
          { label: "Avg Quality Score", value: "—" },
          { label: "Active Scrapes", value: "—" },
        ].map((kpi) => (
          <div
            key={kpi.label}
            className="rounded-xl p-5 shadow-sm"
            style={{ backgroundColor: "var(--card)" }}
          >
            <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
              {kpi.label}
            </p>
            <p className="text-2xl font-display font-bold mt-1" style={{ color: "var(--foreground)" }}>
              {kpi.value}
            </p>
          </div>
        ))}
      </div>

      {/* Charts placeholder */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-xl p-6 shadow-sm h-64 flex items-center justify-center" style={{ backgroundColor: "var(--card)" }}>
          <p style={{ color: "var(--muted-foreground)" }}>Category chart (Phase 4)</p>
        </div>
        <div className="rounded-xl p-6 shadow-sm h-64 flex items-center justify-center" style={{ backgroundColor: "var(--card)" }}>
          <p style={{ color: "var(--muted-foreground)" }}>Area chart (Phase 4)</p>
        </div>
      </div>
    </div>
  );
}
