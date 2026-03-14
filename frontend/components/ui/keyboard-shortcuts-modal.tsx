"use client";

import { useEffect, useRef } from "react";

const isMac =
  typeof navigator !== "undefined" && /Mac|iPod|iPhone|iPad/.test(navigator.userAgent);

const MOD = isMac ? "\u2318" : "Ctrl";

const SHORTCUTS: { keys: string; description: string }[] = [
  { keys: `${MOD} + K`, description: "Open search" },
  { keys: `${MOD} + /`, description: "Show keyboard shortcuts" },
  { keys: "Esc", description: "Close modal / sheet" },
];

interface KeyboardShortcutsModalProps {
  open: boolean;
  onClose: () => void;
}

export function KeyboardShortcutsModal({ open, onClose }: KeyboardShortcutsModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    }
    document.addEventListener("keydown", handleKey, { capture: true });
    return () => document.removeEventListener("keydown", handleKey, { capture: true });
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[2000] flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.55)", backdropFilter: "blur(6px)" }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="w-full max-w-sm rounded-2xl overflow-hidden shadow-2xl"
        style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-4 border-b"
          style={{ borderColor: "var(--border)" }}
        >
          <h2 className="text-base font-bold" style={{ color: "var(--foreground)" }}>
            Keyboard Shortcuts
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-[var(--secondary)] transition-colors"
            aria-label="Close"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ color: "var(--muted-foreground)" }}
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Shortcuts list */}
        <div className="px-6 py-4 space-y-3">
          {SHORTCUTS.map((s) => (
            <div key={s.keys} className="flex items-center justify-between">
              <span
                className="text-sm"
                style={{ color: "var(--foreground)" }}
              >
                {s.description}
              </span>
              <kbd
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-mono font-medium"
                style={{
                  backgroundColor: "var(--secondary)",
                  color: "var(--muted-foreground)",
                  border: "1px solid var(--border)",
                }}
              >
                {s.keys}
              </kbd>
            </div>
          ))}
        </div>

        {/* Footer hint */}
        <div
          className="px-6 py-3 text-center text-[11px] border-t"
          style={{ borderColor: "var(--border)", color: "var(--muted-foreground)" }}
        >
          Press <kbd className="font-mono font-medium">Esc</kbd> to close
        </div>
      </div>
    </div>
  );
}
