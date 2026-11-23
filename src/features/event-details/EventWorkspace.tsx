"use client";

import Link from "next/link";
import { CalendarX2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EventAdminBar } from "@/features/event-admin/EventAdminBar";
import { EventHosts } from "@/features/event-team/EventHosts";
import { EventTeamPanel } from "@/features/event-team/EventTeamPanel";
import { getParentEvent, getSubEvents } from "@/lib/eventGroups";
import { describeRhythm } from "@/lib/recurrence";
import { useEvents, useResolvedEvent, useSeries } from "@/services/eventClient";
import type { EsnEvent } from "@/types/event";

import { EventFacts } from "./EventFacts";
import { EventHero } from "./EventHero";
import { SubEventsSection } from "./SubEventsSection";

/**
 * The event page body. Starts from the server-rendered event (good for SEO
 * and first paint) and applies team changes made in the browser: edits,
 * removal, or events created locally that the server doesn't know yet.
 */
export function EventWorkspace({
  slug,
  serverEvent,
}: {
  slug: string;
  serverEvent: EsnEvent | null;
}) {
  const resolved = useResolvedEvent(slug, serverEvent);
  const { events } = useEvents();
  const { series } = useSeries();

  if (resolved.state === "loading" && !resolved.event) {
    return <Skeleton className="h-72 rounded-3xl" aria-label="Loading event" />;
  }
  if (resolved.state === "removed" || resolved.state === "missing") {
    return <Unavailable removed={resolved.state === "removed"} />;
  }

  const event = resolved.event!;
  const parent = getParentEvent(events, event);
  const ofSeries = event.seriesId ? series.find((s) => s.id === event.seriesId) : undefined;

  return (
    <>
      <div className="mb-4 flex justify-end empty:hidden">
        <EventAdminBar event={event} />
      </div>
      <EventHero
        event={event}
        parent={parent}
        repeats={ofSeries && describeRhythm(ofSeries.recurrence, ofSeries.startDate)}
      />
      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_21rem] lg:items-start">
        {/* Facts come first on mobile, in the sidebar on desktop. */}
        <EventFacts
          event={event}
          hosts={<EventHosts eventSlug={event.slug} />}
          className="lg:sticky lg:top-[calc(var(--header-height)+1.5rem)] lg:order-2"
        />
        <div className="flex min-w-0 flex-col gap-6 lg:order-1">
          {/* The hero already shows the summary; only repeat it when there is more to say. */}
          {event.description.trim() !== event.summary.trim() && (
            <section
              aria-labelledby="about-event"
              className="rounded-3xl border bg-card p-5 shadow-sm sm:p-7"
            >
              <h2 id="about-event" className="text-xl font-extrabold tracking-tight">
                About this event
              </h2>
              <div className="mt-3 space-y-3 leading-relaxed text-foreground/85">
                {event.description.split(/\n{2,}/).map((paragraph, i) => (
                  <p key={i}>{paragraph}</p>
                ))}
              </div>
            </section>
          )}
          {/* Sub-events can't have their own sub-events. */}
          {!event.parentSlug && !event.seriesId && (
            <SubEventsSection event={event} subEvents={getSubEvents(events, event.slug)} />
          )}
          <EventTeamPanel
            event={{
              slug: event.slug,
              title: event.title,
              startDate: event.startDate,
              endDate: event.endDate,
            }}
          />
        </div>
      </div>
    </>
  );
}

function Unavailable({ removed }: { removed: boolean }) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 py-16 text-center">
      <span className="flex size-14 items-center justify-center rounded-2xl bg-accent text-accent-foreground">
        <CalendarX2 className="size-7" aria-hidden="true" />
      </span>
      <h1 className="text-2xl font-extrabold">
        {removed ? "This event was removed" : "We couldn't find that event"}
      </h1>
      <p className="text-muted-foreground">
        {removed
          ? "The organisers removed this event. Have a look at what else is coming up."
          : "The event may have been removed or the link is incorrect."}
      </p>
      <Button asChild>
        <Link href="/">See upcoming events</Link>
      </Button>
    </div>
  );
}
