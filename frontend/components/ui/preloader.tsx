"use client";

import { useEffect, useState } from "react";

export function Preloader() {
  const [show, setShow] = useState(true);

  useEffect(() => {
    // Only show the preloader on the first ever load
    const hasLoaded = sessionStorage.getItem("hasLoadedPreloader");
    if (hasLoaded) {
      setShow(false);
      return;
    }

    let isMounted = true;
    let fallbackTimer: NodeJS.Timeout;

    // Use a CSS-based timeline, hide wrapper after 3.5s
    fallbackTimer = setTimeout(() => {
      if (isMounted) {
        setShow(false);
        sessionStorage.setItem("hasLoadedPreloader", "true");
      }
    }, 3500);

    return () => {
      isMounted = false;
      clearTimeout(fallbackTimer);
    };
  }, []);

  if (!show) return null;

  return (
    <div 
      className="fixed inset-0 z-[9999] flex items-center justify-center text-primary-foreground transition-opacity duration-500"
      style={{ backgroundColor: '#1a1a1a' }}
    >
      <div className="w-full max-w-sm px-8 flex items-center justify-center">
        <svg viewBox="0 0 320 300" xmlns="http://www.w3.org/2000/svg" className="w-48 md:w-64 h-auto text-white">
          <style dangerouslySetInnerHTML={{ __html: `
            .preload-line {
              stroke: currentColor;
              fill: none;
              fill-rule: evenodd;
              stroke-linecap: round;
              stroke-linejoin: round;
              stroke-width: 4;
              stroke-dasharray: 600;
              stroke-dashoffset: 600;
              animation: drawLine 2.5s ease-in-out forwards;
            }
            @keyframes drawLine {
              to {
                stroke-dashoffset: 0;
              }
            }
          `}} />
          <g>
            {/* ═══════════════════════════════ */}
            {/*   TOP ROW: "Realtors'"          */}
            {/* ═══════════════════════════════ */}

            {/* R */}
            <path className="preload-line" d="M16 44 L16 116"/>
            <path className="preload-line" d="M16 44 Q48 44 48 62 Q48 80 16 80"/>
            <path className="preload-line" d="M32 80 L48 116"/>

            {/* e */}
            <path className="preload-line" d="M60 80 Q60 64 76 64 Q92 64 92 80 L60 80"/>
            <path className="preload-line" d="M60 80 Q60 104 76 104 Q86 104 92 96"/>

            {/* a */}
            <path className="preload-line" d="M104 72 Q104 64 116 64 Q132 64 132 80 L132 116"/>
            <path className="preload-line" d="M104 88 L132 88"/>
            <path className="preload-line" d="M104 88 Q104 116 120 116 Q132 116 132 108"/>

            {/* l */}
            <path className="preload-line" d="M144 44 L144 116"/>

            {/* t */}
            <path className="preload-line" d="M160 56 L160 104 Q160 116 172 116"/>
            <path className="preload-line" d="M152 72 L172 72"/>

            {/* o */}
            <path className="preload-line" d="M180 88 Q180 64 196 64 Q212 64 212 88 Q212 116 196 116 Q180 116 180 88 Z"/>

            {/* r */}
            <path className="preload-line" d="M224 72 L224 116"/>
            <path className="preload-line" d="M224 84 Q228 64 244 64"/>

            {/* s */}
            <path className="preload-line" d="M256 68 Q256 64 268 64 Q284 64 284 76 Q284 88 264 88 Q252 88 252 100 Q252 116 272 116 Q284 116 286 112"/>

            {/* ' (apostrophe) */}
            <path className="preload-line" d="M296 44 Q296 44 298 56"/>

            {/* ═══════════════════════════════ */}
            {/*   BOTTOM ROW: "practice."      */}
            {/* ═══════════════════════════════ */}

            {/* p */}
            <path className="preload-line" d="M16 176 L16 260"/>
            <path className="preload-line" d="M16 176 Q16 160 36 160 Q56 160 56 184 Q56 208 36 208 Q16 208 16 192"/>

            {/* r */}
            <path className="preload-line" d="M68 176 L68 220"/>
            <path className="preload-line" d="M68 188 Q72 160 92 160"/>

            {/* a */}
            <path className="preload-line" d="M104 168 Q104 160 116 160 Q136 160 136 180 L136 220"/>
            <path className="preload-line" d="M104 192 L136 192"/>
            <path className="preload-line" d="M104 192 Q104 220 120 220 Q136 220 136 212"/>

            {/* c */}
            <path className="preload-line" d="M164 168 Q148 160 148 190 Q148 220 164 220"/>

            {/* t */}
            <path className="preload-line" d="M176 152 L176 208 Q176 220 188 220"/>
            <path className="preload-line" d="M168 172 L188 172"/>

            {/* i */}
            <path className="preload-line" d="M200 176 L200 220"/>
            <circle className="preload-line" cx="200" cy="164" r="3" fill="currentColor" stroke="none"/>

            {/* c */}
            <path className="preload-line" d="M228 168 Q212 160 212 190 Q212 220 228 220"/>

            {/* e */}
            <path className="preload-line" d="M240 190 Q240 160 260 160 Q280 160 280 180 L240 180"/>
            <path className="preload-line" d="M240 180 Q240 220 260 220 Q272 220 280 212"/>

            {/* . (period) */}
            <circle className="preload-line" cx="292" cy="218" r="3" fill="currentColor" stroke="none"/>
          </g>
        </svg>
      </div>
    </div>
  );
}
