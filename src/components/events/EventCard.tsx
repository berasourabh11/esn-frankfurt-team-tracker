import Link from "next/link";
import { ArrowUpRight, CalendarRange, Clock, Layers, MapPin, UserRound } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  formatEventDateRange,
  formatRelativeDay,
  formatTimeRange,
  isMultiDay,
  type IsoDate,
} from "@/lib/dateUtils";
import { cn } from "@/lib/utils";
import type { EsnEvent } from "@/types/event";

import { CategoryBadge } from "./CategoryBadge";
import { DateBadge } from "./DateBadge";

export function EventCard({
  event,
  today,
  hosts,
  partOf,
  subEventCount = 0,
  className,
}: {
  event: EsnEvent;
  today?: IsoDate;
  /** Display names of the hosts, e.g. "Aisha & Jonas". */
  hosts?: string | null;
  /** Title of the main event, for sub-events. */
  partOf?: string;
  /** For main events: how many sub-events they include. */
  subEventCount?: number;
  className?: string;
}) {
  const time = formatTimeRange(event);
  const relative = today ? formatRelativeDay(event, today) : null;
  const titleId = `event-${event.id}-title`;

  return (
    <article
      aria-labelledby={titleId}
      className={cn(
        "group relative flex overflow-hidden rounded-2xl border bg-card shadow-[0_1px_2px_rgb(16_24_64/0.04)] transition duration-200 focus-within:ring-[3px] focus-within:ring-ring/40 hover:-translate-y-0.5 hover:border-primary/20 hover:shadow-[0_12px_32px_-12px_rgb(46_49_146/0.28)]",
        event.status === "cancelled" && "opacity-70",
        className,
      )}
    >
      <DateBadge
        date={event.startDate}
        category={event.category}
        className="w-20 shrink-0 sm:w-24"
      />

      <div className="flex min-w-0 flex-1 flex-col gap-2 p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-1.5 pr-7">
          <CategoryBadge category={event.category} short />
          {relative && (
            <Badge variant="secondary" className="bg-accent text-accent-foreground">
              {relative}
            </Badge>
          )}
          {event.status === "tentative" && <Badge variant="warning">To be confirmed</Badge>}
          {event.status === "cancelled" && <Badge variant="outline">Cancelled</Badge>}
          {subEventCount > 0 && (
            <Badge variant="outline" className="gap-1">
              <Layers className="size-3" aria-hidden="true" />
              Includes {subEventCount} event{subEventCount === 1 ? "" : "s"}
            </Badge>
          )}
        </div>

        {partOf && (
          <p className="-mb-1 flex min-w-0 items-center gap-1 text-xs font-semibold text-primary">
            <Layers className="size-3.5 shrink-0" aria-hidden="true" />
            <span className="truncate">Part of {partOf}</span>
          </p>
        )}

        <h3 id={titleId} className="text-base leading-snug font-bold text-balance sm:text-lg">
          <Link
            href={`/events/${event.slug}`}
            className="outline-none after:absolute after:inset-0 after:content-['']"
          >
            {event.title}
          </Link>
        </h3>

        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
          {isMultiDay(event) && (
            <li className="flex items-center gap-1.5">
              <CalendarRange className="size-4 shrink-0" aria-hidden="true" />
              {formatEventDateRange(event)}
            </li>
          )}
          <li className="flex items-center gap-1.5">
            <Clock className="size-4 shrink-0" aria-hidden="true" />
            {time ?? <span className="italic">Time to be announced</span>}
          </li>
          {hosts && (
            <li className="flex min-w-0 items-center gap-1.5">
              <UserRound className="size-4 shrink-0" aria-hidden="true" />
              <span className="truncate">Hosted by {hosts}</span>
            </li>
          )}
          {event.location && (
            <li className="flex min-w-0 items-center gap-1.5">
              <MapPin className="size-4 shrink-0" aria-hidden="true" />
              <span className="truncate">{event.location}</span>
            </li>
          )}
        </ul>

        <p className="line-clamp-2 text-sm text-foreground/75">{event.summary}</p>
      </div>

      <ArrowUpRight
        aria-hidden="true"
        className="absolute top-4 right-4 size-5 text-muted-foreground/60 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-primary"
      />
    </article>
  );
}
