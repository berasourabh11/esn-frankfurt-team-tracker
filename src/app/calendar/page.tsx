import { Suspense } from "react";
import type { Metadata } from "next";
import { connection } from "next/server";

import { Skeleton } from "@/components/ui/skeleton";
import { CalendarView } from "@/features/calendar/CalendarView";
import { AddEventButton } from "@/features/event-admin/AddEventButton";
import { getBerlinToday } from "@/lib/dateUtils";

export const metadata: Metadata = {
  title: "Event calendar",
  description:
    "Monthly calendar of ESN Frankfurt events: parties, trips, sports, cultural events and more for international students.",
  alternates: { canonical: "/calendar" },
};

export default function CalendarPage() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <p className="text-xs font-bold tracking-wide text-brand-magenta uppercase">Calendar</p>
          <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">Plan your month</h1>
          <p className="text-muted-foreground">
            Pick a day to see what&apos;s on. Tap an event for its details and team notes.
          </p>
        </div>
        <AddEventButton />
      </header>
      <Suspense fallback={<CalendarSkeleton />}>
        <CalendarLoader />
      </Suspense>
    </div>
  );
}

async function CalendarLoader() {
  await connection(); // "today" is request-time data
  return <CalendarView initialToday={getBerlinToday()} />;
}

function CalendarSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-label="Loading calendar">
      <Skeleton className="h-[44rem] rounded-[2rem]" />
      <Skeleton className="h-56 rounded-3xl" />
    </div>
  );
}
