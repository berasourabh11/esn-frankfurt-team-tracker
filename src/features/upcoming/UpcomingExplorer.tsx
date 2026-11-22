"use client";

import { useCallback, useMemo } from "react";
import Link from "next/link";
import { CalendarX2 } from "lucide-react";

import { EventCard } from "@/components/events/EventCard";
import { Button } from "@/components/ui/button";
import { useBerlinToday } from "@/hooks/useBerlinToday";
import {
  formatMonthYear,
  getWeekRange,
  groupUpcomingEvents,
  isUpcoming,
  overlapsRange,
  type IsoDate,
} from "@/lib/dateUtils";
import { countSubEvents } from "@/lib/eventGroups";
import { pluralize } from "@/lib/utils";
import { useSession } from "@/features/auth/session";
import { formatHostNames } from "@/features/event-team/EventHosts";
import { useEvents } from "@/services/eventClient";
import { useEventInfos } from "@/services/teamClient";
import type { EsnEvent } from "@/types/event";

import { FilterBar } from "./FilterBar";
import { applyFilters, EMPTY_FILTERS, hasActiveFilters, type EventFilters } from "./filters";
import { useEventFilters } from "./useEventFilters";

export function UpcomingExplorer({ initialToday }: { initialToday: IsoDate }) {
  const today = useBerlinToday(initialToday);
  const { events, unavailable } = useEvents();
  const { filters, setFilters } = useEventFilters();

  const upcoming = useMemo(() => events.filter((e) => isUpcoming(e, today)), [events, today]);
  const filtered = useMemo(
    () => applyFilters(upcoming, filters, today),
    [upcoming, filters, today],
  );
  const groups = useMemo(() => groupUpcomingEvents(filtered, today), [filtered, today]);

  const thisWeekCount = useMemo(() => {
    const week = { from: today, to: getWeekRange(today).to };
    return upcoming.filter((e) => overlapsRange(e, week)).length;
  }, [upcoming, today]);

  const onChange = useCallback((update: Partial<EventFilters>) => setFilters(update), [setFilters]);
  const onClear = useCallback(() => setFilters(EMPTY_FILTERS), [setFilters]);
  const filtering = hasActiveFilters(filters);

  return (
    <div className="flex flex-col gap-8">
      <FilterBar filters={filters} onChange={onChange} onClear={onClear} today={today} />

      <p className="text-sm text-muted-foreground" aria-live="polite" role="status">
        {filtering ? (
          <>
            <strong className="text-foreground">{pluralize(filtered.length, "event")}</strong> match
            your filters
          </>
        ) : (
          <>
            <strong className="text-foreground">
              {pluralize(upcoming.length, "upcoming event")}
            </strong>
            {thisWeekCount > 0 && <> · {thisWeekCount} this week</>}
          </>
        )}
      </p>

      {unavailable ? (
        <UnavailableState />
      ) : groups.length === 0 ? (
        <EmptyState filtering={filtering} onClear={onClear} />
      ) : (
        groups.map((group) => (
          <section
            key={group.id}
            aria-labelledby={`group-${group.id}`}
            className="flex flex-col gap-4"
          >
            <div className="flex items-center gap-3">
              <h2
                id={`group-${group.id}`}
                className="text-xl font-extrabold tracking-tight sm:text-2xl"
              >
                {group.label}
              </h2>
              <span className="rounded-full bg-secondary px-2.5 py-0.5 text-xs font-bold text-secondary-foreground">
                {group.events.length}
              </span>
              <span aria-hidden="true" className="h-px flex-1 bg-border" />
            </div>
            {group.id === "later" ? (
              <LaterByMonth events={group.events} today={today} />
            ) : (
              <EventGrid events={group.events} today={today} />
            )}
          </section>
        ))
      )}
    </div>
  );
}

/** Host display names per event slug (team data, loaded in the browser). */
function useHostNames() {
  const { members } = useSession();
  const { data: infos } = useEventInfos();
  return useMemo(() => {
    const map = new Map<string, string>();
    for (const info of infos ?? []) {
      const names = formatHostNames(info.hostIds, members);
      if (names) map.set(info.eventSlug, names);
    }
    return map;
  }, [infos, members]);
}

/** Main-event titles and sub-event counts, so cards can show how events belong together. */
function useEventGroups() {
  const { events } = useEvents();
  return useMemo(
    () => ({
      titles: new Map(events.map((e) => [e.slug, e.title])),
      subEventCounts: countSubEvents(events),
    }),
    [events],
  );
}

function EventGrid({ events, today }: { events: EsnEvent[]; today: IsoDate }) {
  const hostNames = useHostNames();
  const groups = useEventGroups();
  return (
    <ul className="grid gap-4 lg:grid-cols-2">
      {events.map((event) => (
        <li key={event.id} className="flex">
          <EventCard
            event={event}
            today={today}
            hosts={hostNames.get(event.slug)}
            partOf={event.parentSlug ? groups.titles.get(event.parentSlug) : undefined}
            subEventCount={groups.subEventCounts.get(event.slug)}
            className="flex-1"
          />
        </li>
      ))}
    </ul>
  );
}

function LaterByMonth({ events, today }: { events: EsnEvent[]; today: IsoDate }) {
  const months = new Map<string, EsnEvent[]>();
  for (const event of events) {
    const key = event.startDate.slice(0, 7);
    months.set(key, [...(months.get(key) ?? []), event]);
  }
  return (
    <div className="flex flex-col gap-6">
      {[...months.entries()].map(([month, monthEvents]) => (
        <div key={month} className="flex flex-col gap-3">
          <h3 className="text-sm font-bold tracking-wide text-muted-foreground uppercase">
            {formatMonthYear(`${month}-01`)}
          </h3>
          <EventGrid events={monthEvents} today={today} />
        </div>
      ))}
    </div>
  );
}

function UnavailableState() {
  return (
    <div
      role="alert"
      className="rounded-3xl border border-amber-200 bg-amber-50 px-6 py-10 text-center text-amber-900"
    >
      <h2 className="text-lg font-bold">Events are temporarily unavailable</h2>
      <p className="mt-1 text-sm">
        We couldn&apos;t load the event list. Please try again in a moment.
      </p>
    </div>
  );
}

function EmptyState({ filtering, onClear }: { filtering: boolean; onClear: () => void }) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-3xl border border-dashed bg-card px-6 py-16 text-center">
      <span className="flex size-14 items-center justify-center rounded-2xl bg-accent text-accent-foreground">
        <CalendarX2 className="size-7" aria-hidden="true" />
      </span>
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-bold">
          {filtering ? "No events match your filters" : "No upcoming events yet"}
        </h2>
        <p className="max-w-sm text-sm text-muted-foreground">
          {filtering
            ? "Try a different search term, date or category — or clear the filters to see everything."
            : "New events are added regularly. Check back soon or subscribe to the calendar."}
        </p>
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        {filtering && <Button onClick={onClear}>Clear filters</Button>}
        <Button asChild variant="outline">
          <Link href="/calendar">Browse the calendar</Link>
        </Button>
      </div>
    </div>
  );
}
