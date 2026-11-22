import { CalendarDays, Clock, Euro, ExternalLink, Info, MapPin } from "lucide-react";

import { Button } from "@/components/ui/button";
import { formatEventDateLong, formatTimeRange } from "@/lib/dateUtils";
import { cn } from "@/lib/utils";
import type { EsnEvent } from "@/types/event";

import { EventActions } from "./EventActions";

/** Key facts, registration and calendar/share actions (sidebar on desktop). */
export function EventFacts({
  event,
  hosts,
  className,
}: {
  event: EsnEvent;
  /** "Hosted by" block (client-side team data). */
  hosts?: React.ReactNode;
  className?: string;
}) {
  const time = formatTimeRange(event);
  return (
    <section
      aria-labelledby="event-facts"
      className={cn(
        "flex flex-col gap-5 rounded-3xl border bg-card p-5 shadow-sm sm:p-6",
        className,
      )}
    >
      <h2 id="event-facts" className="sr-only">
        Event details
      </h2>
      <dl className="flex flex-col gap-4">
        <Fact icon={<CalendarDays />} label="Date">
          {formatEventDateLong(event)}
        </Fact>
        <Fact icon={<Clock />} label="Time">
          {time ?? <span className="text-muted-foreground italic">To be announced</span>}
        </Fact>
        <Fact icon={<MapPin />} label="Location">
          {event.location ?? <span className="text-muted-foreground italic">To be announced</span>}
        </Fact>
        {event.priceInfo && (
          <Fact icon={<Euro />} label="Price">
            {event.priceInfo}
          </Fact>
        )}
      </dl>
      {hosts}

      {event.registrationUrl ? (
        <Button asChild variant="brand" size="lg" className="w-full">
          <a href={event.registrationUrl} target="_blank" rel="noreferrer">
            Register now
            <ExternalLink />
          </a>
        </Button>
      ) : (
        <p className="flex items-start gap-2 rounded-2xl bg-muted/70 p-3 text-sm text-muted-foreground">
          <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          No registration link yet. If registration is needed, details will be shared here and in
          the ESN Frankfurt channels.
        </p>
      )}

      <div>
        <p className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          Add to your calendar or share
        </p>
        <EventActions event={event} />
      </div>
    </section>
  );
}

function Fact({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground [&_svg]:size-5">
        {icon}
      </span>
      <div className="min-w-0">
        <dt className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          {label}
        </dt>
        <dd className="font-semibold">{children}</dd>
      </div>
    </div>
  );
}
