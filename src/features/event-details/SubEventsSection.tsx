"use client";

import Link from "next/link";
import { ChevronRight, Clock, Layers, MapPin } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { getCategoryMeta } from "@/lib/categories";
import {
  formatDayOfMonth,
  formatEventDateRange,
  formatMonthShort,
  formatTimeRange,
  formatWeekdayShort,
  isMultiDay,
} from "@/lib/dateUtils";
import { canManageEvents } from "@/features/auth/permissions";
import { useSession } from "@/features/auth/session";
import { AddEventButton } from "@/features/event-admin/AddEventButton";
import type { EsnEvent } from "@/types/event";

/**
 * The programme of a main event: its sub-events in date order, each with its
 * own page. Members who manage events can add sub-events here.
 */
export function SubEventsSection({ event, subEvents }: { event: EsnEvent; subEvents: EsnEvent[] }) {
  const { member } = useSession();
  const canAdd = canManageEvents(member);
  if (subEvents.length === 0 && !canAdd) return null;

  return (
    <section
      aria-labelledby="programme-heading"
      className="rounded-3xl border bg-card p-5 shadow-sm sm:p-7"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2
            id="programme-heading"
            className="flex items-center gap-2 text-xl font-extrabold tracking-tight"
          >
            <Layers className="size-5 text-primary" aria-hidden="true" />
            Programme
          </h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {subEvents.length === 0
              ? "No sub-events yet. Add the parts of this event, e.g. each night of a weekend."
              : `${subEvents.length} event${subEvents.length === 1 ? "" : "s"} as part of ${event.title}.`}
          </p>
        </div>
        <AddEventButton parent={event} size="sm" variant="outline" />
      </div>

      {subEvents.length > 0 && (
        <ol className="mt-5 flex flex-col gap-2">
          {subEvents.map((sub) => (
            <li key={sub.id}>
              <SubEventRow event={sub} />
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function SubEventRow({ event }: { event: EsnEvent }) {
  const meta = getCategoryMeta(event.category);
  const time = formatTimeRange(event);
  return (
    <Link
      href={`/events/${event.slug}`}
      className="group flex items-center gap-3 rounded-2xl border bg-background p-2.5 pr-3 transition hover:border-primary/30 hover:bg-accent/40 focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none"
    >
      <span
        className="flex size-14 shrink-0 flex-col items-center justify-center rounded-xl text-white"
        style={{
          backgroundImage: `linear-gradient(150deg, ${meta.color} 0%, color-mix(in oklab, ${meta.color} 70%, #0d0f3a) 100%)`,
        }}
        aria-hidden="true"
      >
        <span className="text-[0.6rem] font-semibold tracking-[0.12em] uppercase opacity-90">
          {formatWeekdayShort(event.startDate)}
        </span>
        <span className="text-xl leading-none font-extrabold tabular-nums">
          {formatDayOfMonth(event.startDate)}
        </span>
        <span className="text-[0.6rem] font-semibold uppercase opacity-90">
          {formatMonthShort(event.startDate)}
        </span>
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex flex-wrap items-center gap-1.5">
          <span className="font-bold text-balance group-hover:text-primary">{event.title}</span>
          {event.status === "tentative" && <Badge variant="warning">To be confirmed</Badge>}
          {event.status === "cancelled" && <Badge variant="outline">Cancelled</Badge>}
        </span>
        <span className="flex flex-wrap gap-x-3 gap-y-0.5 text-sm text-muted-foreground">
          <span className="sr-only">{formatEventDateRange(event)}, </span>
          {isMultiDay(event) && <span aria-hidden="true">{formatEventDateRange(event)}</span>}
          <span className="flex items-center gap-1">
            <Clock className="size-3.5 shrink-0" aria-hidden="true" />
            {time ?? "Time to be announced"}
          </span>
          {event.location && (
            <span className="flex min-w-0 items-center gap-1">
              <MapPin className="size-3.5 shrink-0" aria-hidden="true" />
              <span className="truncate">{event.location}</span>
            </span>
          )}
        </span>
      </span>
      <ChevronRight
        className="size-5 shrink-0 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-primary"
        aria-hidden="true"
      />
    </Link>
  );
}
