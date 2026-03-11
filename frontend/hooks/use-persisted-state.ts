"use client";

import { useState, useEffect, useCallback } from "react";

/**
 * A drop-in replacement for useState that persists the value in localStorage.
 * Values are stored under the key prefix "rp-settings:" + the provided key.
 * 
 * Usage: const [value, setValue] = usePersistedState("myKey", defaultValue);
 */
export function usePersistedState<T>(key: string, defaultValue: T): [T, (val: T | ((prev: T) => T)) => void] {
  const storageKey = `rp-settings:${key}`;
  
  const [value, setValue] = useState<T>(() => {
    if (typeof window === "undefined") return defaultValue;
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored !== null) {
        return JSON.parse(stored) as T;
      }
    } catch {
      // If parsing fails, fall back to default
    }
    return defaultValue;
  });

  // Persist to localStorage whenever value changes
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(value));
    } catch {
      // Storage might be full or unavailable
    }
  }, [storageKey, value]);

  return [value, setValue];
}
