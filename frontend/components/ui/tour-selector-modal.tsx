"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ChevronRight, Sparkles } from "lucide-react";
import { PAGE_TOURS } from "./tour-steps";

interface TourSelectorModalProps {
  onSelectFull: () => void;
  onSelectPage: (pageKey: string) => void;
  onClose: () => void;
}

const spring = { type: "spring" as const, stiffness: 300, damping: 24 };
const springFast = { type: "spring" as const, stiffness: 320, damping: 22 };

export function TourSelectorModal({ onSelectFull, onSelectPage, onClose }: TourSelectorModalProps) {
  const [showPages, setShowPages] = useState(false);

  return (
    <AnimatePresence>
      <motion.div
        key="overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[2000] flex items-center justify-center p-4"
        style={{ backgroundColor: "rgba(0,0,0,0.65)", backdropFilter: "blur(8px)" }}
        onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      >
        <AnimatePresence mode="wait">
          {!showPages ? (
            /* ── Mode Selection ── */
            <motion.div
              key="mode-select"
              initial={{ opacity: 0, scale: 0.92, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0, transition: spring }}
              exit={{ opacity: 0, scale: 0.92, y: 20, transition: { duration: 0.18 } }}
              className="w-full max-w-md rounded-3xl overflow-hidden shadow-2xl"
              style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}
            >
              {/* Header */}
              <div className="relative px-8 pt-8 pb-4 text-center">
                <button
                  onClick={onClose}
                  className="absolute top-4 right-4 p-2 rounded-xl hover:bg-[var(--secondary)] transition-colors"
                >
                  <X className="w-4 h-4" style={{ color: "var(--muted-foreground)" }} />
                </button>
                <motion.div
                  animate={{ rotate: [0, 5, -5, 0] }}
                  transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                  className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
                  style={{ background: "linear-gradient(135deg, #5227FF, #8b5cf6)" }}
                >
                  <Sparkles className="w-8 h-8 text-white" />
                </motion.div>
                <h2 className="text-xl font-bold" style={{ color: "var(--foreground)" }}>
                  Welcome to Realtors&apos; Practice!
                </h2>
                <p className="text-sm mt-1.5 max-w-[300px] mx-auto" style={{ color: "var(--muted-foreground)" }}>
                  Let&apos;s show you around. Choose how you&apos;d like to explore the platform.
                </p>
              </div>

              {/* Options */}
              <div className="px-6 pb-6 space-y-3">
                <motion.button
                  whileHover={{ scale: 1.02, y: -1 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={onSelectFull}
                  className="w-full flex items-center gap-4 p-5 rounded-2xl text-left group"
                  style={{ background: "linear-gradient(135deg, #5227FF 0%, #7c3aed 100%)", boxShadow: "0 8px 32px rgba(82,39,255,0.35)" }}
                >
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 text-2xl" style={{ backgroundColor: "rgba(255,255,255,0.2)" }}>🚀</div>
                  <div className="flex-1">
                    <p className="text-base font-bold text-white">Full App Tour</p>
                    <p className="text-[13px] mt-0.5" style={{ color: "rgba(255,255,255,0.7)" }}>~30 steps across every page — the complete experience</p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-white opacity-60 group-hover:opacity-100 transition-opacity" />
                </motion.button>

                <motion.button
                  whileHover={{ scale: 1.02, y: -1 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setShowPages(true)}
                  className="w-full flex items-center gap-4 p-5 rounded-2xl text-left border-2 group"
                  style={{ borderColor: "var(--border)", backgroundColor: "var(--secondary)" }}
                >
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 text-2xl" style={{ backgroundColor: "var(--card)" }}>🗺️</div>
                  <div className="flex-1">
                    <p className="text-base font-bold" style={{ color: "var(--foreground)" }}>Tour a Single Page</p>
                    <p className="text-[13px] mt-0.5" style={{ color: "var(--muted-foreground)" }}>Choose one specific section to explore</p>
                  </div>
                  <ChevronRight className="w-5 h-5 group-hover:translate-x-0.5 transition-transform" style={{ color: "var(--muted-foreground)" }} />
                </motion.button>

                <button onClick={onClose} className="w-full py-2.5 text-sm font-medium hover:underline" style={{ color: "var(--muted-foreground)" }}>
                  Skip for now
                </button>
              </div>
            </motion.div>
          ) : (
            /* ── Page List ── */
            <motion.div
              key="page-select"
              initial={{ opacity: 0, scale: 0.92, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0, transition: spring }}
              exit={{ opacity: 0, scale: 0.92, y: 20, transition: { duration: 0.18 } }}
              className="w-full max-w-lg rounded-3xl overflow-hidden shadow-2xl"
              style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}
            >
              <div className="px-6 pt-6 pb-4 border-b flex items-center gap-3" style={{ borderColor: "var(--border)" }}>
                <button onClick={() => setShowPages(false)} className="p-2 rounded-xl hover:bg-[var(--secondary)] transition-colors">
                  <ChevronRight className="w-4 h-4 rotate-180" style={{ color: "var(--muted-foreground)" }} />
                </button>
                <div>
                  <h2 className="text-base font-bold" style={{ color: "var(--foreground)" }}>Choose a Page to Tour</h2>
                  <p className="text-[11px]" style={{ color: "var(--muted-foreground)" }}>Pick any section — we&apos;ll guide you through it</p>
                </div>
                <button onClick={onClose} className="p-2 rounded-xl hover:bg-[var(--secondary)] ml-auto transition-colors">
                  <X className="w-4 h-4" style={{ color: "var(--muted-foreground)" }} />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2.5 p-5">
                {PAGE_TOURS.map((page, i) => (
                  <motion.button
                    key={page.key}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0, transition: { ...springFast, delay: i * 0.04 } }}
                    whileHover={{ scale: 1.03, y: -2 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => onSelectPage(page.key)}
                    className="flex items-center gap-3 p-4 rounded-2xl border text-left"
                    style={{ borderColor: "var(--border)", backgroundColor: "var(--secondary)" }}
                  >
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0" style={{ backgroundColor: "var(--card)" }}>
                      {page.emoji}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold truncate" style={{ color: "var(--foreground)" }}>{page.label}</p>
                      <p className="text-[10px] mt-0.5" style={{ color: "var(--muted-foreground)" }}>
                        {page.steps({} as never).length} steps
                      </p>
                    </div>
                  </motion.button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </AnimatePresence>
  );
}
