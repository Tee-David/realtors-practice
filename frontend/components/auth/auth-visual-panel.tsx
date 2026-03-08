"use client";

import dynamic from "next/dynamic";
import Image from "next/image";

const Globe = dynamic(() => import("@/components/ui/globe"), { ssr: false });

interface AuthVisualPanelProps {
  headline?: string;
  subtext?: string;
  /** Override the background content (e.g. FloatingLines, Beams) */
  backgroundContent?: React.ReactNode;
}

export function AuthVisualPanel({
  headline = "Nigerian Property Intelligence",
  subtext = "Scrape, validate, enrich, and explore real estate listings across Nigeria — all in one platform.",
  backgroundContent,
}: AuthVisualPanelProps) {
  return (
    <div
      className="relative hidden lg:flex flex-col justify-between overflow-hidden rounded-3xl m-4"
      style={{
        background: "linear-gradient(160deg, #020024 0%, #06065a 35%, #0001b0 70%, #0001fc 100%)",
      }}
    >
      {/* Custom background content (FloatingLines, Beams, etc.) */}
      {backgroundContent && (
        <div className="absolute inset-0 z-0">
          {backgroundContent}
        </div>
      )}

      {/* Top: Logo + Headline */}
      <div className="relative z-10 p-10 pt-12">
        <div className="flex items-center gap-3 mb-12">
          <Image
            src="/logo-icon-white.png"
            alt="RP"
            width={40}
            height={40}
          />
          <span
            className="font-display text-base font-semibold tracking-wide"
            style={{ color: "rgba(255,255,255,0.8)" }}
          >
            Realtors&apos; Practice
          </span>
        </div>

        <h2
          className="font-display text-4xl font-bold leading-tight mb-4"
          style={{ color: "white" }}
        >
          {headline}
        </h2>
        <p
          className="text-base leading-relaxed max-w-sm"
          style={{ color: "rgba(255,255,255,0.6)" }}
        >
          {subtext}
        </p>

        {/* Stats row */}
        <div className="flex gap-8 mt-8">
          {[
            { value: "36", label: "States covered" },
            { value: "10k+", label: "Properties" },
            { value: "15+", label: "Data sources" },
          ].map((stat) => (
            <div key={stat.label}>
              <p className="font-display text-2xl font-bold" style={{ color: "white" }}>{stat.value}</p>
              <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.4)" }}>{stat.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom: Globe (default if no custom background) */}
      {!backgroundContent && (
        <div className="relative z-10 flex items-end justify-center -mb-24 pointer-events-auto">
          <Globe
            baseColor={[0.15, 0.15, 0.4]}
            markerColor={[0.1, 0.1, 1]}
            glowColor={[0.08, 0.08, 0.5]}
            markers={[
              { location: [6.5244, 3.3792], size: 0.08 },
              { location: [9.0579, 7.4951], size: 0.06 },
              { location: [7.3776, 3.947], size: 0.04 },
              { location: [6.3350, 5.6037], size: 0.04 },
              { location: [10.5105, 7.4165], size: 0.04 },
              { location: [4.8156, 7.0498], size: 0.04 },
            ]}
            className="aspect-square w-full max-w-[480px]"
          />
          <div
            className="absolute bottom-0 left-0 right-0 h-32"
            style={{
              background: "linear-gradient(to top, rgba(2,0,36,0.9), transparent)",
            }}
          />
        </div>
      )}
    </div>
  );
}
