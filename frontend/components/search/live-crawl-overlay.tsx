"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, Globe } from "lucide-react";

interface LiveCrawlOverlayProps {
  isActive: boolean;
  query: string;
  sitesSearching?: string[];
}

export function LiveCrawlOverlay({ isActive, query, sitesSearching = [] }: LiveCrawlOverlayProps) {
  const [dots, setDots] = useState("");

  useEffect(() => {
    if (!isActive) return;
    const interval = setInterval(() => {
      setDots((prev) => (prev.length >= 3 ? "" : prev + "."));
    }, 500);
    return () => clearInterval(interval);
  }, [isActive]);

  return (
    <AnimatePresence>
      {isActive && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 pointer-events-none"
        >
          <div className="bg-background/95 backdrop-blur-xl border rounded-2xl shadow-2xl px-6 py-4 flex items-center gap-4 pointer-events-auto max-w-sm">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <Globe size={20} className="text-primary animate-spin" style={{ animationDuration: "3s" }} />
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-sm text-foreground">
                Searching the web{dots}
              </p>
              <p className="text-xs text-muted-foreground truncate">
                {sitesSearching.length > 0
                  ? `Crawling ${sitesSearching.join(", ")}`
                  : `Looking for "${query}"`}
              </p>
            </div>
            <Loader2 size={18} className="animate-spin text-primary shrink-0" />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
