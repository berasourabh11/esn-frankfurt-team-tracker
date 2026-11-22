"use client";

import { useState } from "react";
import { CalendarPlus, Check, Download, Share2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { downloadTextFile } from "@/lib/download";
import { buildIcsCalendar, getGoogleCalendarUrl } from "@/lib/ics";
import { siteConfig } from "@/lib/site";
import type { EsnEvent } from "@/types/event";

export function EventActions({ event }: { event: EsnEvent }) {
  const [copied, setCopied] = useState(false);
  const eventUrl = `${siteConfig.url}/events/${event.slug}`;

  async function share() {
    const shareData = { title: event.title, text: event.summary, url: eventUrl };
    if (typeof navigator.share === "function") {
      try {
        await navigator.share(shareData);
        return;
      } catch {
        // User dismissed the share sheet, or it failed: fall back to copying.
      }
    }
    try {
      await navigator.clipboard.writeText(eventUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Copy this link:", eventUrl);
    }
  }

  function downloadIcs() {
    downloadTextFile(
      `${event.slug}.ics`,
      buildIcsCalendar([event], { calendarName: event.title, siteUrl: siteConfig.url }),
      "text/calendar;charset=utf-8",
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button asChild variant="outline" size="sm">
        <a href={getGoogleCalendarUrl(event, siteConfig.url)} target="_blank" rel="noreferrer">
          <CalendarPlus />
          Google Calendar
        </a>
      </Button>
      <Button variant="outline" size="sm" onClick={downloadIcs}>
        <Download />
        Apple / Outlook (.ics)
      </Button>
      <Button variant="outline" size="sm" onClick={share} aria-live="polite">
        {copied ? <Check /> : <Share2 />}
        {copied ? "Link copied" : "Share"}
      </Button>
    </div>
  );
}
