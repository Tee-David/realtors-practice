"use client";

import { useState, useCallback, useRef, useEffect } from "react";

/**
 * Hook for synchronizing hover state between the map markers and the results list.
 * When hovering a card → the marker highlights.
 * When hovering a marker → the card scrolls into view.
 */
export function useMarkerSync() {
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const listContainerRef = useRef<HTMLDivElement | null>(null);
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  const registerCardRef = useCallback((id: string, el: HTMLDivElement | null) => {
    if (el) {
      cardRefs.current.set(id, el);
    } else {
      cardRefs.current.delete(id);
    }
  }, []);

  // When a marker is hovered, scroll the corresponding card into view
  const highlightFromMarker = useCallback((id: string | null) => {
    setHighlightedId(id);
    if (id && cardRefs.current.has(id)) {
      const el = cardRefs.current.get(id)!;
      el.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, []);

  // When a card is hovered, just update the highlighted state (marker reacts via prop)
  const highlightFromCard = useCallback((id: string | null) => {
    setHighlightedId(id);
  }, []);

  return {
    highlightedId,
    highlightFromMarker,
    highlightFromCard,
    registerCardRef,
    listContainerRef,
  };
}
