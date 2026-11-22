"use client";

import { useSyncExternalStore } from "react";

import { getBerlinToday, type IsoDate } from "@/lib/dateUtils";

function subscribe(onChange: () => void) {
  const interval = window.setInterval(onChange, 60_000);
  document.addEventListener("visibilitychange", onChange);
  return () => {
    window.clearInterval(interval);
    document.removeEventListener("visibilitychange", onChange);
  };
}

/**
 * Today's Berlin date, read only in the browser. Returns null during
 * prerendering/SSR so static pages never bake in a date.
 */
export function useClientToday(): IsoDate | null {
  return useSyncExternalStore(subscribe, getBerlinToday, () => null);
}
