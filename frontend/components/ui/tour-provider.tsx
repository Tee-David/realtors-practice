"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Shepherd from "shepherd.js";
import { fullAppTour, PAGE_TOURS, tourOptions, type ShepherdTour } from "./tour-steps";
import { TourSelectorModal } from "./tour-selector-modal";
import { useRouter } from "next/navigation";
import "shepherd.js/dist/css/shepherd.css";

const TOUR_SEEN_KEY = "rp-tour-complete";

// ─── Progress bar injection helper ──────────────────────────────────────────

function injectProgress(tour: ShepherdTour, step: unknown & { getElement(): HTMLElement | undefined }) {
  let attempts = 0;
  const tryInject = () => {
    attempts++;
    const el = step.getElement();
    if (el) {
      const content = el.querySelector(".shepherd-content");
      if (content) {
        if (content.querySelector(".tour-progress")) return;
        const steps = tour.steps;
        const idx = steps.indexOf(step as unknown);
        const pct = Math.round(((idx + 1) / steps.length) * 100);
        const texts = [
          `You're ${pct}% done 🚀`,
          `${pct}% complete — keep going!`,
          `Almost there! ${pct}% finished`,
          `You're ${pct}% through the tour`,
          `${pct}% done — great job!`,
        ];
        const prog = document.createElement("div");
        prog.className = "tour-progress";
        prog.innerHTML = `
          <div class="tour-progress-bar-container">
            <div class="tour-progress-bar" style="width:${pct}%"></div>
          </div>
          <div class="tour-progress-text">${texts[idx % texts.length]}</div>
        `;
        content.prepend(prog);
        return;
      }
    }
    if (attempts < 80) setTimeout(tryInject, 50);
  };
  tryInject();
}

// ─── Tour builder ────────────────────────────────────────────────────────────

function buildTour(steps: object[]): ShepherdTour {
  const tour = new Shepherd.Tour({
    ...tourOptions,
    steps: steps as never,
  }) as unknown as ShepherdTour;
  return tour;
}

// ─── Provider ────────────────────────────────────────────────────────────────

export function TourProvider() {
  const router = useRouter();
  const tourRef = useRef<ShepherdTour | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);

  // ── Attach Shepherd events ──────────────────────────────────────────────

  const attachEvents = useCallback((tour: ShepherdTour) => {
    tour.on("start", () => {
      document.dispatchEvent(new CustomEvent("tour-active", { detail: true }));
      document.dispatchEvent(new CustomEvent("expand-sidebar"));
      setShowConfetti(false);
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tour.on("show", (event: any) => {
      injectProgress(tour, event.step);
    });

    tour.on("complete", () => {
      localStorage.setItem(TOUR_SEEN_KEY, "true");
      document.dispatchEvent(new CustomEvent("tour-active", { detail: false }));
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 5000);
    });

    tour.on("cancel", () => {
      document.dispatchEvent(new CustomEvent("tour-active", { detail: false }));
    });
  }, []);

  // ── Start full app tour ─────────────────────────────────────────────────

  const startFullTour = useCallback(() => {
    setShowModal(false);
    if (tourRef.current) {
      try { tourRef.current.cancel(); } catch { /* ignore */ }
    }
    const steps = fullAppTour(router);
    const tour = buildTour(steps as object[]);
    attachEvents(tour);
    tourRef.current = tour;
    setTimeout(() => tour.start(), 300);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router, attachEvents]);

  // ── Start per-page tour ─────────────────────────────────────────────────

  const startPageTour = useCallback((pageKey: string) => {
    setShowModal(false);
    const page = PAGE_TOURS.find(p => p.key === pageKey);
    if (!page) return;
    if (tourRef.current) {
      try { tourRef.current.cancel(); } catch { /* ignore */ }
    }
    // Navigate to the page first
    router.push(page.path);
    setTimeout(() => {
      const steps = page.steps(router);
      const tour = buildTour(steps as object[]);
      attachEvents(tour);
      tourRef.current = tour;
      tour.start();
    }, 600);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router, attachEvents]);

  // ── Listen for external trigger ─────────────────────────────────────────

  useEffect(() => {
    const handler = () => setShowModal(true);
    document.addEventListener("start-tour", handler);
    return () => document.removeEventListener("start-tour", handler);
  }, []);

  // ── Auto-show modal on first visit ──────────────────────────────────────

  useEffect(() => {
    const seen = localStorage.getItem(TOUR_SEEN_KEY);
    if (!seen) {
      const t = setTimeout(() => setShowModal(true), 1800);
      return () => clearTimeout(t);
    }
  }, []);

  return (
    <>
      {showModal && (
        <TourSelectorModal
          onSelectFull={startFullTour}
          onSelectPage={startPageTour}
          onClose={() => setShowModal(false)}
        />
      )}

      {showConfetti && (
        <div className="fixed inset-0 pointer-events-none z-[3000]">
          {/* We keep confetti as a simple CSS fallback since react-confetti-boom might not be installed */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-24 h-24 text-6xl animate-bounce flex items-center justify-center">🎉</div>
          </div>
        </div>
      )}
    </>
  );
}

// ─── Hook for triggering tour anywhere ───────────────────────────────────────

export function useTour() {
  const startTour = () => document.dispatchEvent(new Event("start-tour"));
  return { startTour };
}
