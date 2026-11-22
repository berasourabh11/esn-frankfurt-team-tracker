import { addDaysIso, BERLIN_TZ, getEventEndDate } from "./dateUtils";
import type { EsnEvent } from "@/types/event";

/**
 * Minimal RFC 5545 (iCalendar) generation, used for "Add to calendar", the
 * offline download in the subscription dialog, and the live subscription
 * feed served by the API (backend/, GET /api/calendar.ics).
 */

const VTIMEZONE_BERLIN = [
  "BEGIN:VTIMEZONE",
  `TZID:${BERLIN_TZ}`,
  "BEGIN:DAYLIGHT",
  "TZOFFSETFROM:+0100",
  "TZOFFSETTO:+0200",
  "TZNAME:CEST",
  "DTSTART:19700329T020000",
  "RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU",
  "END:DAYLIGHT",
  "BEGIN:STANDARD",
  "TZOFFSETFROM:+0200",
  "TZOFFSETTO:+0100",
  "TZNAME:CET",
  "DTSTART:19701025T030000",
  "RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU",
  "END:STANDARD",
  "END:VTIMEZONE",
];

export function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

/** Folds lines longer than 75 octets as required by RFC 5545. */
export function foldLine(line: string): string {
  const encoder = new TextEncoder();
  if (encoder.encode(line).length <= 75) return line;
  const parts: string[] = [];
  let current = "";
  for (const char of line) {
    const limit = parts.length === 0 ? 75 : 74; // continuation lines start with a space
    if (encoder.encode(current + char).length > limit) {
      parts.push(current);
      current = char;
    } else {
      current += char;
    }
  }
  parts.push(current);
  return parts.join("\r\n ");
}

const compactDate = (date: string) => date.replaceAll("-", "");
const compactTime = (time: string) => `${time.replace(":", "")}00`;

function addHours(time: string, hours: number): { time: string; dayOffset: number } {
  const [h, m] = time.split(":").map(Number);
  const total = h + hours;
  return {
    time: `${String(total % 24).padStart(2, "0")}:${String(m).padStart(2, "0")}`,
    dayOffset: Math.floor(total / 24),
  };
}

/** Start/end in iCalendar notation. Untimed events become all-day events. */
export function getEventIcsTimes(event: EsnEvent) {
  const endDate = getEventEndDate(event);
  if (!event.startTime) {
    return {
      allDay: true as const,
      start: compactDate(event.startDate),
      // DTEND is exclusive for all-day events.
      end: compactDate(addDaysIso(endDate, 1)),
    };
  }
  let endTime = event.endTime;
  let endDay = endDate;
  if (!endTime) {
    // Unknown end: assume two hours so the event is visible in calendars.
    const shifted = addHours(event.startTime, 2);
    endTime = shifted.time;
    endDay = addDaysIso(endDate, shifted.dayOffset);
  } else if (endTime <= event.startTime && endDate === event.startDate) {
    endDay = addDaysIso(endDate, 1); // ends after midnight
  }
  return {
    allDay: false as const,
    start: `${compactDate(event.startDate)}T${compactTime(event.startTime)}`,
    end: `${compactDate(endDay)}T${compactTime(endTime)}`,
  };
}

export interface BuildIcsOptions {
  calendarName?: string;
  /** Shown by calendar apps under the calendar name. */
  calendarDescription?: string;
  siteUrl?: string;
  now?: Date;
  /**
   * For subscription feeds: how often calendar apps should re-check, as an
   * ISO 8601 duration (e.g. "PT1H"). Apple and Outlook honour it; Google
   * refreshes on its own schedule (several times a day).
   */
  refreshInterval?: string;
}

export function buildIcsCalendar(events: readonly EsnEvent[], options: BuildIcsOptions = {}) {
  const {
    calendarName = "ESN Frankfurt Events",
    calendarDescription,
    siteUrl,
    now = new Date(),
    refreshInterval,
  } = options;
  // UTC timestamp, e.g. 20261120T143700Z
  const stamp = now
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");

  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//ESN Frankfurt//Events Platform//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeIcsText(calendarName)}`,
    `X-WR-TIMEZONE:${BERLIN_TZ}`,
    ...(calendarDescription ? [`X-WR-CALDESC:${escapeIcsText(calendarDescription)}`] : []),
    ...(refreshInterval
      ? [`REFRESH-INTERVAL;VALUE=DURATION:${refreshInterval}`, `X-PUBLISHED-TTL:${refreshInterval}`]
      : []),
    ...VTIMEZONE_BERLIN,
  ];

  const titles = new Map(events.map((e) => [e.slug, e.title]));
  for (const event of events) {
    if (event.status === "cancelled") continue;
    const times = getEventIcsTimes(event);
    const url = siteUrl ? `${siteUrl.replace(/\/+$/, "")}/events/${event.slug}` : undefined;
    const parentTitle = event.parentSlug ? titles.get(event.parentSlug) : undefined;
    const description = [
      parentTitle && `Part of ${parentTitle}.`,
      event.description,
      event.priceInfo && `Price: ${event.priceInfo}`,
      url,
    ]
      .filter(Boolean)
      .join("\n\n");

    lines.push(
      "BEGIN:VEVENT",
      `UID:${event.id}@esn-frankfurt-events`,
      `DTSTAMP:${stamp}`,
      times.allDay
        ? `DTSTART;VALUE=DATE:${times.start}`
        : `DTSTART;TZID=${BERLIN_TZ}:${times.start}`,
      times.allDay ? `DTEND;VALUE=DATE:${times.end}` : `DTEND;TZID=${BERLIN_TZ}:${times.end}`,
      `SUMMARY:${escapeIcsText(event.title)}`,
      `DESCRIPTION:${escapeIcsText(description)}`,
      ...(event.location ? [`LOCATION:${escapeIcsText(event.location)}`] : []),
      ...(url ? [`URL:${url}`] : []),
      `STATUS:${event.status === "tentative" ? "TENTATIVE" : "CONFIRMED"}`,
      "END:VEVENT",
    );
  }

  lines.push("END:VCALENDAR");
  return lines.map(foldLine).join("\r\n") + "\r\n";
}

/** "Add to Google Calendar" link for a single event. */
export function getGoogleCalendarUrl(event: EsnEvent, siteUrl?: string): string {
  const times = getEventIcsTimes(event);
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: event.title,
    dates: `${times.start}/${times.end}`,
    details: siteUrl
      ? `${event.summary}\n\n${siteUrl.replace(/\/+$/, "")}/events/${event.slug}`
      : event.summary,
  });
  if (!times.allDay) params.set("ctz", BERLIN_TZ);
  if (event.location) params.set("location", event.location);
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
