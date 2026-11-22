import { TZDate } from "@date-fns/tz";
import {
  addDays,
  differenceInCalendarDays,
  endOfMonth,
  endOfWeek,
  format,
  parseISO,
  startOfWeek,
} from "date-fns";
import { enGB } from "date-fns/locale";

import type { EsnEvent } from "@/types/event";

/**
 * All calendar logic runs in Europe/Berlin. Event dates are stored as plain
 * "YYYY-MM-DD" strings, so after we know which calendar day it is in Berlin,
 * the rest is pure calendar arithmetic that does not depend on the
 * viewer's own timezone.
 */
export const BERLIN_TZ = "Europe/Berlin";

/** "YYYY-MM-DD" */
export type IsoDate = string;

const WEEK_OPTIONS = { weekStartsOn: 1 } as const;

/** Today's date in Berlin, e.g. "2026-11-20". */
export function getBerlinToday(now: Date = new Date()): IsoDate {
  return format(new TZDate(now, BERLIN_TZ), "yyyy-MM-dd");
}

/** Berlin wall-clock time without offset, e.g. "2026-11-20T15:42:00". */
export function getBerlinNowWallClock(now: Date = new Date()): string {
  return format(new TZDate(now, BERLIN_TZ), "yyyy-MM-dd'T'HH:mm:ss");
}

/** ISO 8601 date-time with the correct Berlin offset, e.g. "2026-11-20T18:00:00+01:00". */
export function toBerlinDateTime(date: IsoDate, time: string): string {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  // Pure computation (no "current time" reads), so it is safe during prerendering.
  const wallClockAsUtc = Date.UTC(y, m - 1, d, hh, mm);
  const firstGuess = getBerlinOffsetMinutes(wallClockAsUtc);
  const offset = getBerlinOffsetMinutes(wallClockAsUtc - firstGuess * 60_000);
  const sign = offset >= 0 ? "+" : "-";
  const abs = Math.abs(offset);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date}T${time}:00${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`;
}

const offsetFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: BERLIN_TZ,
  timeZoneName: "longOffset",
});

/** UTC offset of Berlin at the given instant, in minutes (60 in winter, 120 in summer). */
export function getBerlinOffsetMinutes(epochMs: number): number {
  const name = offsetFormatter
    .formatToParts(new Date(epochMs))
    .find((p) => p.type === "timeZoneName")?.value;
  const match = name?.match(/GMT([+-])(\d{2}):(\d{2})/);
  if (!match) return 0;
  const minutes = Number(match[2]) * 60 + Number(match[3]);
  return match[1] === "-" ? -minutes : minutes;
}

/** Parses a calendar date as a local Date at midnight (used only for date math). */
export function toCalendarDate(date: IsoDate): Date {
  return parseISO(date);
}

export function toIsoDate(date: Date): IsoDate {
  return format(date, "yyyy-MM-dd");
}

export function addDaysIso(date: IsoDate, amount: number): IsoDate {
  return toIsoDate(addDays(toCalendarDate(date), amount));
}

export function daysBetween(from: IsoDate, to: IsoDate): number {
  return differenceInCalendarDays(toCalendarDate(to), toCalendarDate(from));
}

export function getEventEndDate(event: Pick<EsnEvent, "startDate" | "endDate">): IsoDate {
  return event.endDate ?? event.startDate;
}

export function isMultiDay(event: Pick<EsnEvent, "startDate" | "endDate">): boolean {
  return getEventEndDate(event) !== event.startDate;
}

/** True when the event has not finished yet (multi-day events count while ongoing). */
export function isUpcoming(event: Pick<EsnEvent, "startDate" | "endDate">, today: IsoDate) {
  return getEventEndDate(event) >= today;
}

/** Whether the event takes place on the given day. */
export function occursOn(event: Pick<EsnEvent, "startDate" | "endDate">, day: IsoDate) {
  return event.startDate <= day && getEventEndDate(event) >= day;
}

/** Whether the event overlaps the inclusive date range. */
export function overlapsRange(
  event: Pick<EsnEvent, "startDate" | "endDate">,
  range: DateRange,
): boolean {
  return event.startDate <= range.to && getEventEndDate(event) >= range.from;
}

export function compareEvents(
  a: Pick<EsnEvent, "startDate" | "startTime" | "title">,
  b: Pick<EsnEvent, "startDate" | "startTime" | "title">,
): number {
  if (a.startDate !== b.startDate) return a.startDate < b.startDate ? -1 : 1;
  // Events with a known time first, chronologically; "time TBA" after them.
  const at = a.startTime ?? "99:99";
  const bt = b.startTime ?? "99:99";
  if (at !== bt) return at < bt ? -1 : 1;
  return a.title.localeCompare(b.title);
}

export function sortEvents<T extends Pick<EsnEvent, "startDate" | "startTime" | "title">>(
  events: readonly T[],
): T[] {
  return [...events].sort(compareEvents);
}

// ─── Ranges ────────────────────────────────────────────────────────────────

export interface DateRange {
  from: IsoDate;
  to: IsoDate;
}

export function getWeekRange(day: IsoDate, weekOffset = 0): DateRange {
  const base = addDays(toCalendarDate(day), weekOffset * 7);
  return {
    from: toIsoDate(startOfWeek(base, WEEK_OPTIONS)),
    to: toIsoDate(endOfWeek(base, WEEK_OPTIONS)),
  };
}

/** The coming (or current) Saturday–Sunday. */
export function getWeekendRange(today: IsoDate): DateRange {
  const { to: sunday } = getWeekRange(today);
  const saturday = addDaysIso(sunday, -1);
  return { from: today > saturday ? today : saturday, to: sunday };
}

export function getRestOfMonthRange(today: IsoDate): DateRange {
  return { from: today, to: toIsoDate(endOfMonth(toCalendarDate(today))) };
}

// ─── Grouping for the Upcoming feed ─────────────────────────────────────────

export type TimeGroupId = "today" | "tomorrow" | "this-week" | "next-week" | "later";

export const TIME_GROUP_LABELS: Record<TimeGroupId, string> = {
  today: "Today",
  tomorrow: "Tomorrow",
  "this-week": "This Week",
  "next-week": "Next Week",
  later: "Later",
};

const TIME_GROUP_ORDER: TimeGroupId[] = ["today", "tomorrow", "this-week", "next-week", "later"];

/**
 * Buckets an event relative to `today` (Berlin). Weeks run Monday–Sunday.
 * Ongoing multi-day events are treated as happening today.
 */
export function getTimeGroup(
  event: Pick<EsnEvent, "startDate" | "endDate">,
  today: IsoDate,
): TimeGroupId {
  const effective = event.startDate < today ? today : event.startDate;
  const diff = daysBetween(today, effective);
  if (diff <= 0) return "today";
  if (diff === 1) return "tomorrow";

  const thisWeek = getWeekRange(today);
  if (effective <= thisWeek.to) return "this-week";
  const nextWeek = getWeekRange(today, 1);
  if (effective <= nextWeek.to) return "next-week";
  return "later";
}

export interface TimeGroup<T> {
  id: TimeGroupId;
  label: string;
  events: T[];
}

export function groupUpcomingEvents<T extends EsnEvent>(
  events: readonly T[],
  today: IsoDate,
): TimeGroup<T>[] {
  const buckets = new Map<TimeGroupId, T[]>();
  for (const event of sortEvents(events)) {
    if (!isUpcoming(event, today)) continue;
    const id = getTimeGroup(event, today);
    const list = buckets.get(id) ?? [];
    list.push(event);
    buckets.set(id, list);
  }
  return TIME_GROUP_ORDER.filter((id) => buckets.has(id)).map((id) => ({
    id,
    label: TIME_GROUP_LABELS[id],
    events: buckets.get(id)!,
  }));
}

// ─── Formatting (British English, 24h clock) ───────────────────────────────

const fmt = (date: IsoDate, pattern: string) =>
  format(toCalendarDate(date), pattern, { locale: enGB });

/** "Fri" */
export const formatWeekdayShort = (date: IsoDate) => fmt(date, "EEE");
/** "20" */
export const formatDayOfMonth = (date: IsoDate) => fmt(date, "d");
/** "Nov" */
export const formatMonthShort = (date: IsoDate) => fmt(date, "MMM");
/** "Friday, 20 November 2026" */
export const formatLongDate = (date: IsoDate) => fmt(date, "EEEE, d MMMM yyyy");
/** "Fri, 20 Nov" */
export const formatShortDate = (date: IsoDate) => fmt(date, "EEE, d MMM");
/** "November 2026" */
export const formatMonthYear = (date: IsoDate) => fmt(date, "MMMM yyyy");

/** "Fri, 20 Nov" or "Thu, 12 Nov – Sun, 15 Nov" */
export function formatEventDateRange(event: Pick<EsnEvent, "startDate" | "endDate">): string {
  if (!isMultiDay(event)) return formatShortDate(event.startDate);
  return `${formatShortDate(event.startDate)} – ${formatShortDate(getEventEndDate(event))}`;
}

/** Long version for the details view. */
export function formatEventDateLong(event: Pick<EsnEvent, "startDate" | "endDate">): string {
  if (!isMultiDay(event)) return formatLongDate(event.startDate);
  return `${formatLongDate(event.startDate)} – ${formatLongDate(getEventEndDate(event))}`;
}

/** "18:00 – 20:00", "From 18:00", or null when no time is known. */
export function formatTimeRange(event: Pick<EsnEvent, "startTime" | "endTime">): string | null {
  if (!event.startTime) return null;
  if (!event.endTime) return `From ${event.startTime}`;
  return `${event.startTime} – ${event.endTime}`;
}

/** A friendly relative label: "Today", "Tomorrow", "In 3 days", "Ongoing". */
export function formatRelativeDay(
  event: Pick<EsnEvent, "startDate" | "endDate">,
  today: IsoDate,
): string | null {
  if (event.startDate < today && isUpcoming(event, today)) return "Happening now";
  const diff = daysBetween(today, event.startDate);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff > 1 && diff < 7) return `In ${diff} days`;
  return null;
}
