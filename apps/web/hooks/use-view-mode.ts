"use client";

import { useState, useSyncExternalStore } from "react";

export type ViewMode = "cards" | "list";

const DEFAULT_MODE: ViewMode = "cards";

function readMode(storageKey: string): ViewMode {
  try {
    const saved = localStorage.getItem(storageKey);
    return saved === "cards" || saved === "list" ? saved : DEFAULT_MODE;
  } catch {
    return DEFAULT_MODE;
  }
}

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
}

// localStorage is an external store: the server snapshot is always the default, so hydration matches.
// The local override keeps the toggle working even when writing to storage fails.
export function useViewMode(storageKey: string) {
  const stored = useSyncExternalStore(
    subscribe,
    () => readMode(storageKey),
    () => DEFAULT_MODE,
  );
  const [override, setOverride] = useState<ViewMode | null>(null);

  function change(next: ViewMode) {
    setOverride(next);
    try {
      localStorage.setItem(storageKey, next);
    } catch {}
  }

  return [override ?? stored, change] as const;
}
