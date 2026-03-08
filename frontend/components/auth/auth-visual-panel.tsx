"use client";

import dynamic from "next/dynamic";
import Image from "next/image";

const Globe = dynamic(() => import("@/components/ui/globe"), { ssr: false });

interface AuthVisualPanelProps {
  headline?: string;
  subtext?: string;
  backgroundContent?: React.ReactNode;
}

export function AuthVisualPanel({
  headline = "Hello Realtors'\u00A0Practice! 👋",
  subtext = "Skip repetitive and manual real estate tasks. Get highly productive through automation and save tons of time!",
  backgroundContent,
}: AuthVisualPanelProps) {
  return (
    <div
      className="relative hidden lg:flex flex-col justify-between overflow-hidden rounded-3xl m-4"
      style={{
        background:
          "linear-gradient(160deg, #020024 0%, #06065a 35%, #0001b0 70%, #0001fc 100%)",
      }}
    >
      {/* Abstract line decoration */}
      <div className="absolute inset-0 z-0 overflow-hidden opacity-[0.07]">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="absolute rounded-full"
            style={{
              width: `${300 + i * 120}px`,
              height: `${300 + i * 120}px`,
              border: "1px solid rgba(255,255,255,0.5)",
              top: "50%",
              left: "-10%",
              transform: `translateY(-40%) rotate(${i * 8}deg)`,
            }}
          />
        ))}
      </div>

      {/* Custom background content */}
      {backgroundContent && (
        <div className="absolute inset-0 z-0">{backgroundContent}</div>
      )}

      {/* Top: Logo + Headline */}
      <div className="relative z-10 p-10 pt-12">
        <div className="flex items-center gap-3 mb-14">
          <Image
            src="/hlogo-white.png"
            alt="Realtors' Practice"
            width={200}
            height={50}
            style={{ objectFit: "contain" }}
            priority
          />
        </div>

        <h2
          className="font-display text-[2.75rem] font-bold leading-[1.15] mb-5 mt-6"
          style={{ color: "white" }}
        >
          {headline}
        </h2>
        <p
          className="text-base leading-relaxed max-w-md"
          style={{ color: "rgba(255,255,255,0.55)" }}
        >
          {subtext}
        </p>
      </div>

      {/* Bottom: Massive globe — only top portion visible */}
      {!backgroundContent && (
        <div className="relative z-10 flex items-end justify-center overflow-hidden" style={{ height: "340px" }}>
          <div className="translate-y-[55%]">
            <Globe
              baseColor={[0.15, 0.15, 0.4]}
              markerColor={[0.1, 0.1, 1]}
              glowColor={[0.08, 0.08, 0.5]}
              markers={[
                { location: [6.5244, 3.3792], size: 0.08 },
                { location: [9.0579, 7.4951], size: 0.06 },
                { location: [7.3776, 3.947], size: 0.04 },
                { location: [6.335, 5.6037], size: 0.04 },
                { location: [10.5105, 7.4165], size: 0.04 },
                { location: [4.8156, 7.0498], size: 0.04 },
              ]}
              className="aspect-square w-full max-w-[600px]"
            />
          </div>
          {/* Fade-out gradient at bottom */}
          <div
            className="absolute bottom-0 left-0 right-0 h-20 pointer-events-none"
            style={{
              background:
                "linear-gradient(to top, rgba(2,0,36,0.95), transparent)",
            }}
          />
        </div>
      )}

      {/* Footer */}
      <div className="relative z-10 px-10 pb-6">
        <p
          className="text-xs"
          style={{ color: "rgba(255,255,255,0.25)" }}
        >
          &copy; {new Date().getFullYear()} Realtors&apos; Practice. All rights reserved.
        </p>
      </div>
    </div>
  );
}
