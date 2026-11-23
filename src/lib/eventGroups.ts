import type { EsnEvent } from "@/types/event";

import { sortEvents } from "./dateUtils";

/**
 * Main events and their sub-events (e.g. the CriminaLP weekend with its
 * kiosk crawl, party and murder mystery). Only one level deep: a sub-event
 * can't have sub-events of its own.
 */

/** Sub-events of `parentSlug`, in date order. */
export function getSubEvents(events: readonly EsnEvent[], parentSlug: string): EsnEvent[] {
  return sortEvents(events.filter((e) => e.parentSlug === parentSlug));
}

/** The main event `event` belongs to, if it still exists. */
export function getParentEvent(
  events: readonly EsnEvent[],
  event: Pick<EsnEvent, "parentSlug">,
): EsnEvent | undefined {
  return event.parentSlug ? events.find((e) => e.slug === event.parentSlug) : undefined;
}

/** Number of sub-events per main event slug. */
export function countSubEvents(events: readonly EsnEvent[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const e of events) {
    if (e.parentSlug) counts.set(e.parentSlug, (counts.get(e.parentSlug) ?? 0) + 1);
  }
  return counts;
}

/**
 * Events that `current` (or a new event, when undefined) may be placed under:
 * stand-alone or main events other than itself (not dates of repeating events). An event that already has
 * sub-events can't become a sub-event.
 */
export function getParentCandidates(
  events: readonly EsnEvent[],
  current?: Pick<EsnEvent, "slug">,
): EsnEvent[] {
  if (current && events.some((e) => e.parentSlug === current.slug)) return [];
  // Dates of repeating events can't have sub-events.
  return events.filter((e) => !e.parentSlug && !e.seriesId && e.slug !== current?.slug);
}

/** Drops links to main events that no longer exist (e.g. after removing one). */
export function withoutDanglingParents(events: EsnEvent[]): EsnEvent[] {
  const slugs = new Set(events.map((e) => e.slug));
  return events.map((e) => {
    if (!e.parentSlug || slugs.has(e.parentSlug)) return e;
    const { parentSlug: _gone, ...rest } = e;
    void _gone;
    return rest;
  });
}
