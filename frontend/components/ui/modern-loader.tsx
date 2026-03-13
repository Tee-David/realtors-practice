"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { Loader2, Sparkles } from "lucide-react";

interface ModernLoaderProps {
  words?: string[];
  className?: string;
  fullPage?: boolean;
}

/**
 * A premium, animated loading component that cycles through an array of phrases.
 * Designed to replace standard spinners for high-impact loading states.
 */
export default function ModernLoader({
  words = ["Processing...", "Loading magic...", "Preparing reality..."],
  className,
  fullPage = true,
}: ModernLoaderProps) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (words.length <= 1) return;
    const interval = setInterval(() => {
      setIndex((prev) => (prev + 1) % words.length);
    }, 2500);
    return () => clearInterval(interval);
  }, [words]);

  return (
    <div 
      className={cn(
        "flex flex-col items-center justify-center bg-background/80 backdrop-blur-xl z-[100]",
        fullPage ? "fixed inset-0" : "absolute inset-0 w-full h-full rounded-inherit",
        className
      )}
    >
      <div className="relative flex flex-col items-center gap-10">
        {/* Animated concentric rings - High Premium feel */}
        <div className="relative">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
            className="w-24 h-24 rounded-full border-t-2 border-l-2 border-primary shadow-[0_0_30px_rgba(var(--primary),0.2)]"
          />
          <motion.div
            animate={{ rotate: -360 }}
            transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
            className="absolute inset-3 rounded-full border-b-2 border-r-2 border-accent/40 shadow-[0_0_20px_rgba(var(--accent),0.15)]"
          />
          <motion.div
            animate={{ 
              scale: [1, 1.2, 1],
              opacity: [0.3, 0.7, 0.3]
            }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            className="absolute inset-0 m-auto w-10 h-10 bg-primary/20 rounded-full blur-2xl"
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <motion.div
              animate={{
                scale: [1, 1.1, 1],
                rotate: [0, 10, -10, 0]
              }}
              transition={{ duration: 3, repeat: Infinity }}
            >
              <Sparkles className="w-6 h-6 text-primary shadow-primary" />
            </motion.div>
          </div>
        </div>

        {/* Text Cycling with Smooth Transition */}
        <div className="h-8 flex items-center justify-center overflow-hidden px-4">
          <AnimatePresence mode="wait">
            <motion.div
              key={index}
              initial={{ y: 30, opacity: 0, scale: 0.95 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: -30, opacity: 0, scale: 1.05 }}
              transition={{ duration: 0.6, ease: [0.23, 1, 0.32, 1] }}
              className="flex items-center gap-3"
            >
              <Loader2 className="w-4 h-4 animate-spin text-primary/70" />
              <span className="text-sm font-bold tracking-[0.2em] uppercase text-foreground/90 drop-shadow-sm whitespace-nowrap">
                {words[index]}
              </span>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Progress Visualizer */}
        <div className="relative w-56 h-[2px] bg-secondary/30 rounded-full overflow-hidden">
          <motion.div
            initial={{ x: "-100%" }}
            animate={{ x: "100%" }}
            transition={{ 
              duration: 2.5, 
              repeat: Infinity, 
              ease: "linear" 
            }}
            className="w-1/2 h-full bg-gradient-to-r from-transparent via-primary/60 to-transparent"
          />
          {/* Subtle scanning line */}
          <motion.div
             animate={{ opacity: [0, 1, 0] }}
             transition={{ duration: 1.5, repeat: Infinity }}
             className="absolute inset-0 border-b border-primary/20 blur-[1px]"
          />
        </div>
      </div>
      
      {/* Background Micro-details */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-20">
         <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-[120px]" />
         <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-accent/10 rounded-full blur-[120px]" />
      </div>
    </div>
  );
}
