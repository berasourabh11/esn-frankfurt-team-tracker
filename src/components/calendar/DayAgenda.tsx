"use client";

import Link from "next/link";
import { CalendarCheck2, ChevronLeft, ChevronRight, Clock, MapPin } from "lucide-react";

import { CategoryIcon } from "@/components/events/CategoryIcon";
import { AddEventButton } from "@/features/event-admin/AddEventButton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getCategoryMeta } from "@/lib/categories";
import {
  addDaysIso,
  formatLongDate,
  formatShortDate,
  formatTimeRange,
  sortEvents,
  type IsoDate,
} from "@/lib/dateUtils";
import { cn, pluralize } from "@/lib/utils";
import type { EsnEvent } from "@/types/event";

/** Agenda for the selected day, shown below the calendar. */
export function DayAgenda({
  date,
  today,
  events,
  nextEvent,
  onSelectDate,
  className,
}: {
  date: IsoDate;
  today: IsoDate;
  events: EsnEvent[];
  /** The next event after `date`, offered when the day is empty. */
  nextEvent?: EsnEvent;
  onSelectDate: (date: IsoDate) => void;
  className?: string;
}) {
  const sorted = sortEvents(events);
  const isToday = date === today;

  return (
    <section
      aria-labelledby="agenda-heading"
      className={cn("flex flex-col rounded-3xl border bg-card shadow-sm", className)}
    >
      <header className="flex items-start justify-between gap-2 border-b p-5">
        <div>
          <p className="text-xs font-bold tracking-wide text-muted-foreground uppercase">
            {isToday ? "Today" : "Selected day"}
          </p>
          <h2
            id="agenda-heading"
            className="text-lg leading-tight font-extrabold"
            aria-live="polite"
          >
            {formatLongDate(date)}
          </h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {sorted.length ? pluralize(sorted.length, "event") : "No events"}
          </p>
        </div>
        <div className="flex gap-1">
          <Button
            variant="outline"
            size="icon-sm"
            aria-label="Previous day"
            onClick={() => onSelectDate(addDaysIso(date, -1))}
          >
            <ChevronLeft />
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            aria-label="Next day"
            onClick={() => onSelectDate(addDaysIso(date, 1))}
          >
            <ChevronRight />
          </Button>
        </div>
      </header>

      {sorted.length ? (
        <ul className="grid gap-2 p-3 sm:grid-cols-2 lg:grid-cols-3">
          {sorted.map((event) => (
            <li key={event.id}>
              <AgendaItem event={event} />
            </li>
          ))}
        </ul>
      ) : (
        <div className="flex flex-col items-center gap-3 px-5 py-10 text-center">
          <span className="flex size-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
            <CalendarCheck2 className="size-6" aria-hidden="true" />
          </span>
          <p className="text-sm text-muted-foreground">Nothing planned for this day yet.</p>
          {nextEvent && (
            <Button variant="outline" size="sm" onClick={() => onSelectDate(nextEvent.startDate)}>
              Next event: {formatShortDate(nextEvent.startDate)}
              <ChevronRight />
            </Button>
          )}
        </div>
      )}
      <div className="border-t p-3 empty:hidden">
        <AddEventButton
          defaultDate={date}
          label="Add event on this day"
          variant="ghost"
          size="sm"
          className="w-full"
        />
      </div>
    </section>
  );
}

function AgendaItem({ event }: { event: EsnEvent }) {
  const meta = getCategoryMeta(event.category);
  const time = formatTimeRange(event);
  return (
    <Link
      href={`/events/${event.slug}`}
      className="group flex gap-3 rounded-2xl p-3 transition hover:bg-muted focus-visible:bg-muted"
    >
      <span
        className="flex size-11 shrink-0 items-center justify-center rounded-xl text-white"
        style={{ backgroundColor: meta.color }}
      >
        <CategoryIcon category={event.category} className="size-5" />
      </span>
      <span className="flex min-w-0 flex-col gap-1">
        <span className="leading-snug font-bold group-hover:text-primary">{event.title}</span>
        <span className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Clock className="size-3.5" aria-hidden="true" />
            {time ?? "Time TBA"}
          </span>
          {event.location && (
            <span className="flex min-w-0 items-center gap-1">
              <MapPin className="size-3.5 shrink-0" aria-hidden="true" />
              <span className="truncate">{event.location}</span>
            </span>
          )}
        </span>
        <span className="flex flex-wrap gap-1">
          <span className="text-xs font-semibold" style={{ color: meta.textColor }}>
            {meta.label}
          </span>
          {event.status === "tentative" && (
            <Badge variant="warning" className="px-1.5 py-0 text-[0.65rem]">
              To be confirmed
            </Badge>
          )}
        </span>
      </span>
    </Link>
  );
}
