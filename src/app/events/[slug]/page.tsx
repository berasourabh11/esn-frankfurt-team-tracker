import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EventWorkspace } from "@/features/event-details/EventWorkspace";
import { getEventEndDate, toBerlinDateTime } from "@/lib/dateUtils";
import { siteConfig } from "@/lib/site";
import { getEventBySlug } from "@/services/events.server";
import type { EsnEvent } from "@/types/event";

// Rendered per request, so new and edited events are always current.
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps<"/events/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const event = await getEventBySlug(slug);
  if (!event) return { title: "Event not found", robots: { index: false } };

  const path = `/events/${event.slug}`;
  return {
    title: event.title,
    description: event.summary,
    alternates: { canonical: path },
    openGraph: {
      type: "article",
      title: event.title,
      description: event.summary,
      url: path,
      siteName: siteConfig.name,
      locale: siteConfig.locale,
    },
    twitter: { card: "summary_large_image", title: event.title, description: event.summary },
  };
}

/**
 * Event page: public details plus the team workspace (shift plan, tasks,
 * post-event review). The shell renders instantly; everything that depends
 * on the URL's slug streams in inside <Suspense>, as Cache Components requires.
 */
export default function EventPage({ params }: PageProps<"/events/[slug]">) {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
      <Button asChild variant="ghost" size="sm" className="mb-4 -ml-2">
        <Link href="/">
          <ArrowLeft />
          All upcoming events
        </Link>
      </Button>
      <Suspense fallback={<EventPageSkeleton />}>
        <EventPageContent params={params} />
      </Suspense>
    </div>
  );
}

async function EventPageContent({ params }: { params: PageProps<"/events/[slug]">["params"] }) {
  const { slug } = await params;
  const event = await getEventBySlug(slug);

  return (
    <>
      {/* Client workspace: applies team edits/removals and renders events created in the team area. */}
      <EventWorkspace slug={slug} serverEvent={event} />
      {event && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: serializeJsonLd(buildEventJsonLd(event)) }}
        />
      )}
    </>
  );
}

function EventPageSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading event">
      <Skeleton className="h-64 rounded-3xl" />
      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_21rem]">
        <Skeleton className="h-80 rounded-3xl" />
        <Skeleton className="h-80 rounded-3xl" />
      </div>
    </div>
  );
}

/** schema.org Event structured data for rich search results. */
function buildEventJsonLd(event: EsnEvent) {
  const toDateTime = (date: string, time?: string) => (time ? toBerlinDateTime(date, time) : date);
  return {
    "@context": "https://schema.org",
    "@type": "Event",
    name: event.title,
    description: event.description,
    startDate: toDateTime(event.startDate, event.startTime),
    endDate: toDateTime(getEventEndDate(event), event.endTime),
    eventStatus:
      event.status === "cancelled"
        ? "https://schema.org/EventCancelled"
        : "https://schema.org/EventScheduled",
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    url: `${siteConfig.url}/events/${event.slug}`,
    ...(event.location && {
      location: {
        "@type": "Place",
        name: event.location,
        address: {
          "@type": "PostalAddress",
          addressLocality: "Frankfurt am Main",
          addressCountry: "DE",
        },
      },
    }),
    organizer: { "@type": "Organization", name: "ESN Frankfurt", url: siteConfig.url },
  };
}

/** Prevents "</script>" injection from event content. */
function serializeJsonLd(data: unknown) {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
