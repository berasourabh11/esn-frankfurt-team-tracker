"use client";

import { useState } from "react";
import type { VariantProps } from "class-variance-authority";
import { Check, Copy, Download, Info, Rss } from "lucide-react";

import { Button, type buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { getBerlinToday, isUpcoming } from "@/lib/dateUtils";
import { downloadTextFile } from "@/lib/download";
import { buildIcsCalendar } from "@/lib/ics";
import { siteConfig } from "@/lib/site";
import { useEvents } from "@/services/eventClient";

import { getSubscriptionLinks } from "./subscriptionLinks";

export function SubscribeButton({
  label = "Subscribe to calendar",
  compact = false,
  labelClassName,
  variant = "brand",
  size,
  className,
}: {
  label?: string;
  /** Icon-only trigger (label still announced to screen readers). */
  compact?: boolean;
  /** e.g. "sr-only sm:not-sr-only" to collapse the label on small screens. */
  labelClassName?: string;
  className?: string;
} & VariantProps<typeof buttonVariants>) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant={variant} size={compact ? "icon" : size} className={className}>
          <Rss />
          <span className={compact ? "sr-only" : labelClassName}>{label}</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md gap-5 p-6 sm:p-7">
        <SubscribePanel />
      </DialogContent>
    </Dialog>
  );
}

function SubscribePanel() {
  const feedUrl = siteConfig.calendarFeedUrl;
  const links = feedUrl ? getSubscriptionLinks(feedUrl, siteConfig.name) : null;
  const { events } = useEvents();
  const [copied, setCopied] = useState(false);

  function downloadAll() {
    const today = getBerlinToday();
    const upcoming = events.filter((e) => isUpcoming(e, today));
    downloadTextFile(
      "esn-frankfurt-events.ics",
      buildIcsCalendar(upcoming, { siteUrl: siteConfig.url }),
      "text/calendar;charset=utf-8",
    );
  }

  async function copyFeed() {
    if (!links) return;
    try {
      await navigator.clipboard.writeText(links.https);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Copy the calendar link:", links.https);
    }
  }

  return (
    <>
      <DialogHeader className="pr-8">
        <span className="flex size-12 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-magenta to-brand-orange text-white shadow-md">
          <Rss className="size-6" aria-hidden="true" />
        </span>
        <DialogTitle>Never miss an ESN event</DialogTitle>
        <DialogDescription>
          Add the ESN Frankfurt calendar to your phone or laptop. New and updated events appear
          automatically.
        </DialogDescription>
      </DialogHeader>

      {links ? (
        <div className="flex flex-col gap-2">
          <Button asChild variant="outline" className="justify-start">
            <a href={links.google} target="_blank" rel="noreferrer">
              Google Calendar
            </a>
          </Button>
          <Button asChild variant="outline" className="justify-start">
            <a href={links.webcal}>Apple Calendar (iPhone, Mac)</a>
          </Button>
          <Button asChild variant="outline" className="justify-start">
            <a href={links.outlook} target="_blank" rel="noreferrer">
              Outlook
            </a>
          </Button>
          <div className="mt-2 flex items-center gap-2 rounded-xl border bg-muted/60 p-1.5 pl-3">
            <code className="min-w-0 flex-1 truncate text-xs">{links.https}</code>
            <Button size="sm" variant="secondary" className="shrink-0" onClick={copyFeed}>
              {copied ? <Check /> : <Copy />}
              {copied ? "Copied" : "Copy link"}
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <p className="flex items-start gap-2 rounded-xl bg-accent p-3 text-sm text-accent-foreground">
            <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            The live subscription link is coming soon. Until then, download the current events and
            import them into any calendar app.
          </p>
          <Button onClick={downloadAll} disabled={events.length === 0}>
            <Download />
            Download upcoming events (.ics)
          </Button>
        </div>
      )}
    </>
  );
}
