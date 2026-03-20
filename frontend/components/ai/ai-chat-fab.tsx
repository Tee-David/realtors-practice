"use client";

import { useState } from "react";
import { MessageSquareText, X, Sparkles, Send, ArrowRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";

const SUGGESTED_PROMPTS = [
  "Find a 3-bed flat in Lekki under 5M",
  "What's the average price in Ikoyi?",
  "Analyze my latest scrape results",
  "Show trending neighborhoods",
];

export function AIChatFab() {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* FAB Button */}
      <motion.button
        onClick={() => setOpen(!open)}
        className="fixed bottom-24 md:bottom-6 right-4 md:right-6 z-[998] w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-colors print:hidden"
        style={{
          background: open ? "var(--foreground)" : "linear-gradient(135deg, var(--primary), #3333ff)",
          color: open ? "var(--background)" : "#fff",
        }}
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.95 }}
        aria-label={open ? "Close AI chat" : "Open AI chat"}
      >
        <AnimatePresence mode="wait" initial={false}>
          {open ? (
            <motion.div key="close" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }} transition={{ duration: 0.15 }}>
              <X className="w-6 h-6" />
            </motion.div>
          ) : (
            <motion.div key="open" initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.5, opacity: 0 }} transition={{ duration: 0.15 }}>
              <MessageSquareText className="w-6 h-6" />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.button>

      {/* Chat Panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            className="fixed bottom-40 md:bottom-24 right-4 md:right-6 z-[997] w-[340px] max-w-[calc(100vw-2rem)] rounded-2xl border shadow-2xl overflow-hidden print:hidden"
            style={{
              backgroundColor: "var(--card)",
              borderColor: "var(--border)",
            }}
          >
            {/* Header */}
            <div
              className="px-5 py-4 flex items-center gap-3"
              style={{
                background: "linear-gradient(135deg, rgba(0,1,252,0.06), rgba(255,102,0,0.04))",
                borderBottom: "1px solid var(--border)",
              }}
            >
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ background: "linear-gradient(135deg, var(--primary), #3333ff)" }}
              >
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="text-sm font-semibold font-display" style={{ color: "var(--foreground)" }}>
                  AI Assistant
                </h3>
                <div className="flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                  <span className="text-[10px] font-medium" style={{ color: "var(--muted-foreground)" }}>
                    Coming soon
                  </span>
                </div>
              </div>
            </div>

            {/* Body */}
            <div className="p-5 space-y-4">
              <div className="text-center space-y-2">
                <p className="text-sm font-medium" style={{ color: "var(--foreground)" }}>
                  Ask me anything about properties
                </p>
                <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
                  Search, analyze, and explore properties with AI
                </p>
              </div>

              {/* Suggested prompts */}
              <div className="space-y-2">
                {SUGGESTED_PROMPTS.map((prompt) => (
                  <button
                    key={prompt}
                    className="w-full text-left px-3 py-2.5 rounded-xl text-xs font-medium transition-colors hover:opacity-80 border border-dashed"
                    style={{
                      borderColor: "var(--border)",
                      color: "var(--foreground)",
                      backgroundColor: "var(--secondary)",
                    }}
                    onClick={() => {}}
                  >
                    {prompt}
                  </button>
                ))}
              </div>

              {/* Fake input */}
              <div
                className="flex items-center gap-2 px-3 py-2.5 rounded-xl border"
                style={{
                  borderColor: "var(--border)",
                  backgroundColor: "var(--secondary)",
                  opacity: 0.6,
                }}
              >
                <span className="text-xs flex-1" style={{ color: "var(--muted-foreground)" }}>
                  Type a message...
                </span>
                <Send className="w-4 h-4" style={{ color: "var(--muted-foreground)" }} />
              </div>

              {/* CTA */}
              <Link
                href="/ai"
                className="flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-xl text-xs font-semibold transition-colors hover:opacity-90"
                style={{
                  backgroundColor: "var(--primary)",
                  color: "var(--primary-foreground)",
                }}
                onClick={() => setOpen(false)}
              >
                View AI roadmap
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
