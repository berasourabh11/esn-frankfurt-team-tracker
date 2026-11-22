"use client";

import { useEffect, useState } from "react";

import { getBerlinToday, type IsoDate } from "@/lib/dateUtils";

/**
 * Today's date in Europe/Berlin, starting from the server-rendered value and
 * re-checked every minute (and when the tab becomes visible again), so
 * "Today" / "Tomorrow" groups roll over at midnight without a reload.
 */
export function useBerlinToday(initialToday: IsoDate): IsoDate {
  const [today, setToday] = useState(initialToday);

  useEffect(() => {
    const update = () => setToday(getBerlinToday());
    update();
    const interval = window.setInterval(update, 60_000);
    document.addEventListener("visibilitychange", update);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", update);
    };
  }, []);

  return today;
}
