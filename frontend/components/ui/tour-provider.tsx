"use client";

import { useEffect, useRef } from "react";
import { driver } from "driver.js";
import "driver.js/dist/driver.css";

const TOUR_SEEN_KEY = "rp-tour-complete";

export function TourProvider() {
  const hasAutoStarted = useRef(false);

  useEffect(() => {
    let timeout: NodeJS.Timeout;

    const startTour = () => {
      const tourDriver = driver({
        showProgress: true,
        animate: true,
        overlayColor: "rgba(0,0,0,0.55)",
        stagePadding: 8,
        stageRadius: 12,
        popoverClass: "rp-tour-popover",
        steps: [
          {
            popover: {
              title: "Welcome to Realtors' Practice! 🏠",
              description:
                "Let us give you a quick tour of the platform. You can skip at any time.",
            },
          },
          {
            element: "[data-tour='sidebar']",
            popover: {
              title: "Navigation Sidebar",
              description:
                "Hover or click to expand the sidebar. Access all major sections from here — Dashboard, Properties, Scraper, Search, and more.",
              side: "right",
              align: "center",
            },
          },
          {
            element: "[data-tour='kpi-cards']",
            popover: {
              title: "Key Performance Indicators",
              description:
                "See your property stats at a glance — total listings, for-sale, for-rent, and portfolio value.",
              side: "bottom",
              align: "center",
            },
          },
          {
            element: "[data-tour='category-chart']",
            popover: {
              title: "Category Breakdown",
              description:
                "Visualise how your properties are distributed across residential, commercial, land, and more.",
              side: "top",
              align: "center",
            },
          },
          {
            element: "[data-tour='explore-section']",
            popover: {
              title: "Explore Properties",
              description:
                "Browse your latest property cards, switch between sale and rent views, and click any card to see full details.",
              side: "top",
              align: "center",
            },
          },
          {
            popover: {
              title: "You're all set! 🎉",
              description:
                "That's the basics. Explore the sidebar to find Properties, Search, Settings, and more. Happy hunting!",
            },
          },
        ],
        onDestroyStarted: () => {
          localStorage.setItem(TOUR_SEEN_KEY, "true");
          tourDriver.destroy();
        },
      });

      tourDriver.drive();
    };

    // Listen for manual trigger from TopBar
    document.addEventListener('start-product-tour', startTour);

    // Auto-start for first-time users
    if (typeof window !== "undefined" && !localStorage.getItem(TOUR_SEEN_KEY) && !hasAutoStarted.current) {
      hasAutoStarted.current = true;
      timeout = setTimeout(() => {
        startTour();
      }, 1500);
    }

    return () => {
      if (timeout) clearTimeout(timeout);
      document.removeEventListener('start-product-tour', startTour);
    };
  }, []);

  return null; // Renderless component
}
