import {
  EsnEventSchema,
  MAX_SERIES_OCCURRENCES,
  type EsnEvent,
  type EventSeries,
  type Recurrence,
} from "../types/event";

import { addDaysIso, daysBetween, type IsoDate } from "./dateUtils";

/**
 * Repeating events (series). A series is stored once, with its rule; its
 * dates are generated when events are loaded (see `expandSeries`), up to
 * about a year ahead. Used by the website (demo mode) and the API.
 */

/** How far ahead dates of open-ended series are generated. */
export const SERIES_HORIZON_DAYS = 366;

export function seriesHorizon(today: IsoDate): IsoDate {
  return addDaysIso(today, SERIES_HORIZON_DAYS);
}

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const ORDINALS = ["first", "second", "third", "fourth"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function parts(date: IsoDate) {
  const [y, m, d] = date.split("-").map(Number);
  return { y, m, d };
}

const pad = (n: number) => String(n).padStart(2, "0");
const iso = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`;
const daysInMonth = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();
const weekdayOf = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, d)).getUTCDay();

/**
 * Which weekday of its month a date is: 1–4, or -1 for the last one (a
 * fifth weekday is treated as "last", so the series exists every month).
 */
export function weekOfMonth(date: IsoDate): number {
  const { d } = parts(date);
  const nth = Math.ceil(d / 7);
  return nth >= 5 ? -1 : nth;
}

function nthWeekday(y: number, m: number, weekday: number, nth: number): number {
  if (nth === -1) {
    const last = daysInMonth(y, m);
    return last - ((weekdayOf(y, m, last) - weekday + 7) % 7);
  }
  const first = 1 + ((weekday - weekdayOf(y, m, 1) + 7) % 7);
  return first + (nth - 1) * 7;
}

/**
 * The dates of a series starting on `firstDate`, in order, up to and
 * including `horizon` (and the rule's own end).
 */
export function occurrenceDates(rule: Recurrence, firstDate: IsoDate, horizon: IsoDate): IsoDate[] {
  const end = rule.until && rule.until < horizon ? rule.until : horizon;
  const limit = Math.min(rule.count ?? MAX_SERIES_OCCURRENCES, MAX_SERIES_OCCURRENCES);
  const dates: IsoDate[] = [];

  if (rule.frequency === "weekly") {
    for (let date = firstDate; date <= end && dates.length < limit;) {
      dates.push(date);
      date = addDaysIso(date, 7 * rule.interval);
    }
    return dates;
  }

  const start = parts(firstDate);
  const byWeekday = rule.monthlyBy !== "day";
  const weekday = weekdayOf(start.y, start.m, start.d);
  const nth = weekOfMonth(firstDate);
  // Months without the date (e.g. the 31st) are skipped, like in calendar apps.
  for (let k = 0; dates.length < limit; k += rule.interval) {
    const monthIndex = start.m - 1 + k;
    const y = start.y + Math.floor(monthIndex / 12);
    const m = (monthIndex % 12) + 1;
    if (iso(y, m, 1) > end) break;
    const d = byWeekday ? nthWeekday(y, m, weekday, nth) : start.d;
    if (d > daysInMonth(y, m)) continue;
    const date = iso(y, m, d);
    if (date > end) break;
    if (date >= firstDate) dates.push(date);
  }
  return dates;
}

function formatDate(date: IsoDate) {
  const { y, m, d } = parts(date);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

function ordinalDay(d: number) {
  const suffix =
    d % 10 === 1 && d !== 11
      ? "st"
      : d % 10 === 2 && d !== 12
        ? "nd"
        : d % 10 === 3 && d !== 13
          ? "rd"
          : "th";
  return `${d}${suffix}`;
}

/** Just the rhythm, e.g. "Every week on Wednesday" or "Every month on the last Friday". */
export function describeRhythm(
  rule: Pick<Recurrence, "frequency" | "interval" | "monthlyBy">,
  firstDate: IsoDate,
) {
  const { y, m, d } = parts(firstDate);
  const unit = rule.frequency === "weekly" ? "week" : "month";
  const every = rule.interval === 1 ? `Every ${unit}` : `Every ${rule.interval} ${unit}s`;
  if (rule.frequency === "weekly") return `${every} on ${WEEKDAYS[weekdayOf(y, m, d)]}`;
  if (rule.monthlyBy === "day") return `${every} on the ${ordinalDay(d)}`;
  const nth = weekOfMonth(firstDate);
  return `${every} on the ${nth === -1 ? "last" : ORDINALS[nth - 1]} ${WEEKDAYS[weekdayOf(y, m, d)]}`;
}

/** E.g. "Every 2 weeks on Wednesday, until 17 Dec 2026" or "…, 10 times". */
export function describeRecurrence(rule: Recurrence, firstDate: IsoDate): string {
  const rhythm = describeRhythm(rule, firstDate);
  if (rule.until) return `${rhythm}, until ${formatDate(rule.until)}`;
  if (rule.count) return `${rhythm}, ${rule.count} times`;
  return rhythm;
}

/** "language-cafe" + "2026-12-02" → "language-cafe-2026-12-02". */
export function occurrenceSlug(seriesSlug: string, date: IsoDate) {
  return `${seriesSlug}-${date}`;
}

/** Splits a date's slug into its series slug and date. */
export function parseOccurrenceSlug(slug: string): { seriesSlug: string; date: IsoDate } | null {
  const match = /^(.+)-(\d{4}-\d{2}-\d{2})$/.exec(slug);
  return match ? { seriesSlug: match[1], date: match[2] } : null;
}

/** Stable id of a date, also kept when the date is saved as its own row (calendar UIDs). */
export function occurrenceId(seriesId: string, date: IsoDate) {
  return `${seriesId}-${date}`;
}

/** The event for one date of a series. */
export function occurrenceEvent(series: EventSeries, date: IsoDate): EsnEvent {
  const length = series.endDate ? daysBetween(series.startDate, series.endDate) : 0;
  return EsnEventSchema.parse({
    id: occurrenceId(series.id, date),
    slug: occurrenceSlug(series.slug, date),
    seriesId: series.id,
    title: series.title,
    summary: series.summary,
    description: series.description,
    category: series.category,
    status: series.status,
    startDate: date,
    endDate: length > 0 ? addDaysIso(date, length) : undefined,
    startTime: series.startTime,
    endTime: series.endTime,
    location: series.location,
    priceInfo: series.priceInfo,
    registrationUrl: series.registrationUrl,
    tags: [],
  });
}

/** Whether `date` is one of the series' (not removed) dates. */
export function isSeriesDate(series: EventSeries, date: IsoDate, horizon: IsoDate) {
  if (series.excludedDates.includes(date)) return false;
  return occurrenceDates(
    series.recurrence,
    series.startDate,
    horizon < date ? date : horizon,
  ).includes(date);
}

/**
 * The series' dates as events, without removed dates and without `skip`
 * (dates that are stored as their own events because they were changed).
 */
export function expandSeries(
  series: EventSeries,
  horizon: IsoDate,
  skip: ReadonlySet<IsoDate> = new Set(),
): EsnEvent[] {
  const excluded = new Set(series.excludedDates);
  return occurrenceDates(series.recurrence, series.startDate, horizon)
    .filter((date) => !excluded.has(date) && !skip.has(date))
    .map((date) => occurrenceEvent(series, date));
}
