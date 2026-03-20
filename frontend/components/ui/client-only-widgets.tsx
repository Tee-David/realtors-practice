"use client";

import dynamic from "next/dynamic";

const SmoothCursor = dynamic(() => import("./smooth-cursor"), { ssr: false });
const Preloader = dynamic(() => import("./preloader").then(m => m.Preloader), { ssr: false });
const PwaInstallPrompt = dynamic(() => import("./pwa-install-prompt").then(m => m.PwaInstallPrompt), { ssr: false });

export function ClientOnlyWidgets() {
  return (
    <>
      <Preloader />
      <SmoothCursor
        size={16}
        showTrail={true}
        trailLength={6}
        color="black"
        darkColor="white"
        magneticElements="button, a, [role='button'], [data-magnetic]"
        glowEffect={true}
      />
      <PwaInstallPrompt />
    </>
  );
}
