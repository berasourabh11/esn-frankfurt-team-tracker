import Link from "next/link";
import { CalendarDays } from "lucide-react";

import { Button } from "@/components/ui/button";
import { AddEventButton } from "@/features/event-admin/AddEventButton";
import { SubscribeButton } from "@/features/subscription/SubscribeButton";

/** Static introduction — part of the prerendered shell. */
export function UpcomingHero() {
  return (
    <section className="relative isolate overflow-hidden">
      <HeroBackdrop />
      <div className="mx-auto flex max-w-6xl flex-col items-start gap-6 px-4 pt-8 pb-10 sm:px-6 sm:pt-14 sm:pb-12">
        <p className="inline-flex items-center gap-2 rounded-full border border-primary/10 bg-card/80 px-3 py-1 text-xs font-bold tracking-wide text-primary uppercase shadow-sm backdrop-blur">
          <span className="size-2 rounded-full bg-brand-green" aria-hidden="true" />
          Erasmus Student Network Frankfurt
        </p>
        <h1 className="max-w-3xl text-4xl leading-[1.05] font-extrabold tracking-tight text-balance sm:text-6xl">
          What&apos;s happening at{" "}
          <span className="bg-gradient-to-r from-brand-blue via-[#1f6fd1] to-brand-cyan bg-clip-text text-transparent">
            ESN Frankfurt
          </span>
          ?
        </h1>
        <p className="max-w-xl text-lg text-muted-foreground sm:text-xl">
          Discover events, meet new people and make the most of your student life.
        </p>
        <div className="flex flex-wrap gap-3">
          <Button asChild size="lg">
            <Link href="/calendar">
              <CalendarDays />
              Open calendar
            </Link>
          </Button>
          <SubscribeButton variant="outline" size="lg" />
          <AddEventButton variant="secondary" size="lg" />
        </div>
      </div>
    </section>
  );
}

function HeroBackdrop() {
  return (
    <div aria-hidden="true" className="absolute inset-0 -z-10 overflow-hidden">
      <div className="absolute -top-32 -right-24 size-[28rem] rounded-full bg-brand-cyan/20 blur-3xl" />
      <div className="absolute top-24 -right-40 size-[22rem] rounded-full bg-brand-magenta/15 blur-3xl" />
      <div className="absolute -bottom-40 left-1/3 size-[24rem] rounded-full bg-brand-green/15 blur-3xl" />
      <svg
        className="absolute top-10 right-6 hidden h-64 w-64 text-primary/[0.07] md:block"
        viewBox="0 0 100 100"
        fill="currentColor"
      >
        {/* Decorative abstract star, not the ESN logo */}
        <path d="M50 4l9.5 29.2H90L65.2 51.3l9.5 29.2L50 62.4 25.3 80.5l9.5-29.2L10 33.2h30.5z" />
      </svg>
      <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-b from-transparent to-background" />
    </div>
  );
}
