import Link from "next/link";
import { CalendarDays, Clock, Layers, MapPin } from "lucide-react";

import { CategoryBadge } from "@/components/events/CategoryBadge";
import { CategoryIcon } from "@/components/events/CategoryIcon";
import { Badge } from "@/components/ui/badge";
import { getCategoryMeta } from "@/lib/categories";
import { formatEventDateLong, formatTimeRange } from "@/lib/dateUtils";
import type { EsnEvent } from "@/types/event";

/** Full-width event header on the event page. */
export function EventHero({ event, parent }: { event: EsnEvent; parent?: EsnEvent }) {
  const meta = getCategoryMeta(event.category);
  const time = formatTimeRange(event);

  return (
    <header
      className="relative isolate overflow-hidden rounded-3xl px-6 py-8 text-white shadow-[0_24px_60px_-30px_rgb(46_49_146/0.45)] sm:px-10 sm:py-12"
      style={{
        backgroundImage: event.imageUrl
          ? `linear-gradient(180deg, rgb(13 15 58 / 0.2), rgb(13 15 58 / 0.8)), url(${JSON.stringify(event.imageUrl)})`
          : `linear-gradient(135deg, ${meta.color} 0%, color-mix(in oklab, ${meta.color} 50%, #0d0f3a) 100%)`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      {!event.imageUrl && (
        <CategoryIcon
          category={event.category}
          strokeWidth={1.25}
          className="absolute -top-8 -right-8 -z-10 size-64 rotate-[-12deg] opacity-15"
        />
      )}
      <div className="flex flex-wrap items-center gap-2">
        <CategoryBadge category={event.category} className="bg-white/95" />
        {event.status === "tentative" && <Badge variant="warning">To be confirmed</Badge>}
        {event.status === "cancelled" && (
          <Badge variant="outline" className="border-white/60 text-white">
            Cancelled
          </Badge>
        )}
      </div>
      {parent && (
        <Link
          href={`/events/${parent.slug}`}
          className="mt-4 inline-flex max-w-full items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-sm font-semibold backdrop-blur transition hover:bg-white/25 focus-visible:ring-[3px] focus-visible:ring-white/60 focus-visible:outline-none"
        >
          <Layers className="size-4 shrink-0" aria-hidden="true" />
          <span className="truncate">Part of {parent.title}</span>
        </Link>
      )}
      <h1 className="mt-4 max-w-3xl text-3xl leading-tight font-extrabold tracking-tight text-balance sm:text-5xl">
        {event.title}
      </h1>
      <p className="mt-3 max-w-2xl text-lg text-white/90">{event.summary}</p>
      <ul className="mt-6 flex flex-wrap gap-2 text-sm font-semibold">
        <li className="flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 backdrop-blur">
          <CalendarDays className="size-4" aria-hidden="true" />
          {formatEventDateLong(event)}
        </li>
        <li className="flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 backdrop-blur">
          <Clock className="size-4" aria-hidden="true" />
          {time ?? "Time to be announced"}
        </li>
        {event.location && (
          <li className="flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 backdrop-blur">
            <MapPin className="size-4" aria-hidden="true" />
            {event.location}
          </li>
        )}
      </ul>
    </header>
  );
}
