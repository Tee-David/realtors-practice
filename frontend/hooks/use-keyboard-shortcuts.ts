"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";

/**
 * Side-effect-only hook that registers global keyboard shortcuts.
 *
 * Shortcuts:
 *  - Cmd/Ctrl+K  — navigate to /search (or focus search input if already there)
 *  - Cmd/Ctrl+/  — toggle keyboard-shortcuts help modal
 *  - Escape      — close any open modal/sheet (dispatches custom event)
 */
export function useKeyboardShortcuts({
  onToggleHelp,
}: {
  onToggleHelp: () => void;
}) {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const mod = e.metaKey || e.ctrlKey;

      // Ignore shortcuts when typing in an input/textarea/contenteditable
      const tag = (e.target as HTMLElement)?.tagName;
      const isEditable =
        tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement)?.isContentEditable;

      // Cmd/Ctrl + K — search
      if (mod && e.key === "k") {
        e.preventDefault();
        if (pathname === "/search") {
          // Focus the first search input on the page
          const input = document.querySelector<HTMLInputElement>(
            'input[type="search"], input[type="text"], input[name="q"], input[placeholder*="earch"]'
          );
          input?.focus();
        } else {
          router.push("/search");
        }
        return;
      }

      // Cmd/Ctrl + / — toggle help modal
      if (mod && e.key === "/") {
        e.preventDefault();
        onToggleHelp();
        return;
      }

      // Escape — close modals/sheets (only when not in an input)
      if (e.key === "Escape" && !isEditable) {
        document.dispatchEvent(new CustomEvent("keyboard-escape"));
        return;
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [router, pathname, onToggleHelp]);
}
