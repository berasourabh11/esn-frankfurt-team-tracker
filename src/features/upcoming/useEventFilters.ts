"use client";

import { useCallback, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { parseFilters, serializeFilters, type EventFilters } from "./filters";

/**
 * Filters live in the URL (?q=&category=&date=&on=) so that filtered views
 * are shareable, survive reloads and work with the header search.
 */
export function useEventFilters() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const filters = useMemo(
    () => parseFilters(new URLSearchParams(searchParams.toString())),
    [searchParams],
  );

  const setFilters = useCallback(
    (update: Partial<EventFilters> | ((current: EventFilters) => EventFilters)) => {
      const next = typeof update === "function" ? update(filters) : { ...filters, ...update };
      const query = serializeFilters(next).toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [filters, pathname, router],
  );

  return { filters, setFilters };
}
