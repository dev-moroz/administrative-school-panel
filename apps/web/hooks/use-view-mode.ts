"use client";

import { useState, useSyncExternalStore } from "react";

export type ViewMode = "cards" | "list";

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
}

// localStorage is an external store: the server snapshot is always the fallback, so hydration matches.
// The local override keeps the toggle working even when writing to storage fails.
export function useViewMode<T extends string>(storageKey: string, values: readonly T[], fallback: T) {
  function read(): T {
    try {
      const saved = localStorage.getItem(storageKey);
      return values.includes(saved as T) ? (saved as T) : fallback;
    } catch {
      return fallback;
    }
  }

  const stored = useSyncExternalStore(subscribe, read, () => fallback);
  const [override, setOverride] = useState<T | null>(null);

  function change(next: T) {
    setOverride(next);
    try {
      localStorage.setItem(storageKey, next);
    } catch {}
  }

  return [override ?? stored, change] as const;
}
