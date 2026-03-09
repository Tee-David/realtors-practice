"use client";

import { useEffect, useRef, useState } from "react";
import Shepherd from "shepherd.js";
import { defaultSteps, tourOptions, type ShepherdTour } from "./tour-steps";
import { useRouter } from "next/navigation";
import Confetti from "react-confetti-boom";
import "shepherd.js/dist/css/shepherd.css";

const TOUR_SEEN_KEY = "rp-tour-complete";

export function TourProvider() {
  const router = useRouter();
  const tourRef = useRef<ShepherdTour | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const hasAutoStarted = useRef(false);

  useEffect(() => {
    let timeout: NodeJS.Timeout;

    // Use a unique key
    const hasSeenTour = localStorage.getItem(TOUR_SEEN_KEY);

    // Always initialize the tour and listener so manual trigger works
    if (tourRef.current) return;

    const steps = defaultSteps(router);
    
    const tour = new Shepherd.Tour({
      ...tourOptions,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      steps: steps as any
    }) as unknown as ShepherdTour;

    tourRef.current = tour;

    const triggerTour = () => {
      try {
        console.log("Starting Shepherd tour");

        tour.on('start', () => {
          document.dispatchEvent(new CustomEvent('tour-active', { detail: true }));
          document.dispatchEvent(new CustomEvent('expand-sidebar'));
          setShowConfetti(false);
        });

        // Global handler for ALL steps to ensure progress bar persists
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        tour.on('show', (event: any) => {
          const step = event.step;
          let attempts = 0;
          const maxAttempts = 100; // Increased to 5s coverage
          
          const tryInject = () => {
            attempts++;
            const element = step.getElement();
            
            // If element exists, try to find content and inject
            if (element) {
              const content = element.querySelector('.shepherd-content');
              if (content) {
                let progressEl = content.querySelector('.tour-progress');
                if (progressEl) return; // Already injected

                const steps = tour.steps;
                const index = steps.indexOf(step as unknown);
                const total = steps.length;
                const progress = Math.round(((index + 1) / total) * 100);

                const simpleText = [
                  `You're ${progress}% done`,
                  `${progress}% completed`,
                  `Keep going! ${progress}% finished`,
                  `You're ${progress}% through`,
                  `${progress}% done, great job!`
                ];
                const randomText = simpleText[index % simpleText.length];

                progressEl = document.createElement('div');
                progressEl.className = 'tour-progress';
                progressEl.innerHTML = `
                  <div class="tour-progress-wrapper" style="padding: 10px 20px 0;">
                    <div class="tour-progress-bar-container">
                      <div class="tour-progress-bar-fill" style="width: ${progress}%"></div>
                    </div>
                    <div class="tour-progress-text">${randomText}</div>
                  </div>
                `;
                content.insertBefore(progressEl, content.firstChild);
                return;
              }
            }

            // Retry if element not found or content not found
            if (attempts < maxAttempts) {
              setTimeout(tryInject, 50);
            }
          };

          // Start checking immediately
          requestAnimationFrame(tryInject);
        });

        tour.on('complete', () => {
          document.body.classList.remove('shepherd-active');
          localStorage.setItem(TOUR_SEEN_KEY, "true");
          document.dispatchEvent(new CustomEvent('tour-active', { detail: false }));
          
          // Show confetti celebration!
          setShowConfetti(true);
          
          // Delay redirect slightly so they see the celebration
          setTimeout(() => {
            setShowConfetti(false);
            router.push('/');
          }, 3000);
        });
        
        tour.on('cancel', () => {
          document.body.classList.remove('shepherd-active');
          localStorage.setItem(TOUR_SEEN_KEY, "true");
          document.dispatchEvent(new CustomEvent('tour-active', { detail: false }));
          setShowConfetti(false);
        });

        tour.start();
      } catch (error) {
        console.error("Failed to start Shepherd tour:", error);
      }
    };

    // Listen for custom event to manually start tour
    document.addEventListener('start-product-tour', triggerTour);

    // Only start automatically if they haven't seen it
    if (typeof window !== "undefined" && !hasSeenTour && !hasAutoStarted.current) {
      hasAutoStarted.current = true;
      timeout = setTimeout(() => {
        triggerTour();
      }, 3000);
    }

    return () => {
      if (timeout) clearTimeout(timeout);
      document.removeEventListener('start-product-tour', triggerTour);
      if (tourRef.current) {
        tourRef.current = null;
      }
    };
  }, [router]);

  return (
    <>
      {showConfetti && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', zIndex: 2147483647, pointerEvents: 'none' }}>
          <Confetti 
            mode="boom"
            particleCount={500}
            shapeSize={15}
            x={0.5}
            y={0.5}
            deg={270}
            colors={[
              '#ff595e', '#ffca3a', '#8ac926', '#1982c4', '#6a4c93', '#ff924c', '#10b981', '#34d399'
            ]}
          />
        </div>
      )}
    </>
  );
}
