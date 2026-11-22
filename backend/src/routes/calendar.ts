import { Hono } from "hono";

import { buildIcsCalendar } from "../../../src/lib/ics";
import type { AppEnv } from "../http";
import { EVENT_CATEGORIES, type EventCategory } from "../shared";
import { toEvent, type EventRow } from "./events";

/**
 * Public iCalendar feed for calendar apps (Google Calendar, Apple Calendar,
 * Outlook). They subscribe to the URL and re-fetch it regularly, so new,
 * changed and removed events show up in people's calendars by themselves.
 *
 *   GET /api/calendar.ics                       all events
 *   GET /api/calendar.ics?categories=parties,trips   only some categories
 *
 * Each event keeps the same UID, so an edited event is updated in place
 * instead of appearing twice. Cancelled events are left out (and therefore
 * disappear from subscribers' calendars). Team notes are never included.
 */
export const calendarRoutes = new Hono<AppEnv>().get("/calendar.ics", async (c) => {
  const requested = (c.req.query("categories") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter((s): s is EventCategory => (EVENT_CATEGORIES as readonly string[]).includes(s));

  const { results } = await c.env.DB.prepare(
    "SELECT * FROM events ORDER BY start_date, start_time",
  ).all<EventRow>();
  const events = results
    .map(toEvent)
    .filter((e) => requested.length === 0 || requested.includes(e.category));

  const ics = buildIcsCalendar(events, {
    calendarName: "ESN Frankfurt Events",
    calendarDescription: "Events for international students by ESN Frankfurt",
    siteUrl: c.env.SITE_URL,
    refreshInterval: "PT1H",
  });

  return c.body(ics, 200, {
    "Content-Type": "text/calendar; charset=utf-8",
    "Content-Disposition": 'inline; filename="esn-frankfurt.ics"',
    // Calendar apps poll this; a short shared cache keeps it cheap.
    "Cache-Control": "public, max-age=900",
  });
});
