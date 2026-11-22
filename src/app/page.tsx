import { Suspense } from "react";
import { connection } from "next/server";

import { UpcomingExplorer } from "@/features/upcoming/UpcomingExplorer";
import { UpcomingHero } from "@/features/upcoming/UpcomingHero";
import { UpcomingSkeleton } from "@/features/upcoming/UpcomingSkeleton";
import { getBerlinToday } from "@/lib/dateUtils";

export default function UpcomingPage() {
  return (
    <>
      <UpcomingHero />
      <section
        id="events"
        aria-label="Upcoming events"
        className="mx-auto w-full max-w-6xl scroll-mt-20 px-4 sm:px-6"
      >
        {/* The static shell shows the skeleton; the date-dependent feed streams in per request. */}
        <Suspense fallback={<UpcomingSkeleton />}>
          <UpcomingFeed />
        </Suspense>
      </section>
    </>
  );
}

async function UpcomingFeed() {
  // "Today" must be computed per request (Europe/Berlin), never baked into the shell.
  await connection(); // "today" is request-time data
  return <UpcomingExplorer initialToday={getBerlinToday()} />;
}
