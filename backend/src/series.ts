import { getBerlinToday, sortEvents } from "../../src/lib/dateUtils";
import {
  expandSeries,
  isSeriesDate,
  occurrenceEvent,
  occurrenceId,
  occurrenceSlug,
  parseOccurrenceSlug,
  seriesHorizon,
} from "../../src/lib/recurrence";

import type { Database } from "./db";
import { getEventRow, insertEvent, toEvent, type EventRow } from "./eventRows";
import { HttpError, compact } from "./http";
import { nowIso } from "./lib/util";
import type { EsnEvent, EventFormValues, EventSeries } from "./shared";

/**
 * Repeating events. A series is one row in `event_series`; its dates are
 * generated on the fly (up to a year ahead). A date is stored in `events`
 * only once it has something of its own (changes, shifts, notes, hosts).
 */

export interface SeriesRow {
  id: string;
  slug: string;
  title: string;
  summary: string;
  description: string;
  category: EsnEvent["category"];
  status: EsnEvent["status"];
  start_date: string;
  end_date: string | null;
  start_time: string | null;
  end_time: string | null;
  location: string | null;
  price_info: string | null;
  registration_url: string | null;
  frequency: "weekly" | "monthly";
  repeat_every: number;
  monthly_by: "weekday" | "day" | null;
  until_date: string | null;
  occurrence_count: number | null;
  excluded_dates: string;
}

export function toSeries(row: SeriesRow, hostIds: string[] = []): EventSeries {
  return {
    ...compact({
      id: row.id,
      slug: row.slug,
      title: row.title,
      summary: row.summary,
      description: row.description,
      category: row.category,
      status: row.status,
      startDate: row.start_date,
      endDate: row.end_date,
      startTime: row.start_time,
      endTime: row.end_time,
      location: row.location,
      priceInfo: row.price_info,
      registrationUrl: row.registration_url,
    }),
    recurrence: compact({
      frequency: row.frequency,
      interval: row.repeat_every,
      monthlyBy: row.monthly_by,
      until: row.until_date,
      count: row.occurrence_count,
    }),
    excludedDates: JSON.parse(row.excluded_dates) as string[],
    hostIds,
  } as EventSeries;
}

export const horizon = () => seriesHorizon(getBerlinToday());

/** All series (or one), with their default hosts. */
export async function loadSeries(db: Database, id?: string): Promise<EventSeries[]> {
  const where = id ? "WHERE id = ?" : "";
  const hostWhere = id ? "WHERE series_id = ?" : "";
  const bind = id ? [id] : [];
  const [rows, hosts] = await Promise.all([
    db
      .prepare(`SELECT * FROM event_series ${where} ORDER BY start_date, title`)
      .bind(...bind)
      .all<SeriesRow>(),
    db
      .prepare(`SELECT series_id, user_id FROM event_series_hosts ${hostWhere} ORDER BY rowid`)
      .bind(...bind)
      .all<{ series_id: string; user_id: string }>(),
  ]);
  const hostIds = new Map<string, string[]>();
  for (const h of hosts.results) {
    hostIds.set(h.series_id, [...(hostIds.get(h.series_id) ?? []), h.user_id]);
  }
  return rows.results.map((r) => toSeries(r, hostIds.get(r.id) ?? []));
}

export async function requireSeries(db: Database, id: string) {
  const [series] = await loadSeries(db, id);
  if (!series) throw new HttpError(404, "This repeating event doesn't exist (anymore).");
  return series;
}

/** Dates of series that aren't stored as their own events. */
export async function listVirtualOccurrences(db: Database): Promise<EsnEvent[]> {
  const [series, stored] = await Promise.all([
    db.prepare("SELECT * FROM event_series").all<SeriesRow>(),
    db
      .prepare("SELECT series_id, series_date FROM events WHERE series_id IS NOT NULL")
      .all<{ series_id: string; series_date: string }>(),
  ]);
  if (series.results.length === 0) return [];
  const storedDates = new Map<string, Set<string>>();
  for (const s of stored.results) {
    if (!storedDates.has(s.series_id)) storedDates.set(s.series_id, new Set());
    storedDates.get(s.series_id)!.add(s.series_date);
  }
  const until = horizon();
  return series.results.flatMap((row) =>
    expandSeries(toSeries(row), until, storedDates.get(row.id)),
  );
}

/** Every event: stored events plus the generated dates of repeating events. */
export async function listAllEvents(db: Database): Promise<EsnEvent[]> {
  const [rows, virtual] = await Promise.all([
    db
      .prepare("SELECT * FROM events ORDER BY start_date, start_time IS NULL, start_time, title")
      .all<EventRow>(),
    listVirtualOccurrences(db),
  ]);
  const events = rows.results.map(toEvent);
  return virtual.length ? sortEvents([...events, ...virtual]) : events;
}

/** A generated (not stored) date of a series, by its slug. */
export async function findVirtualOccurrence(db: Database, slug: string) {
  const parsed = parseOccurrenceSlug(slug);
  if (!parsed) return null;
  const row = await db
    .prepare("SELECT * FROM event_series WHERE slug = ?")
    .bind(parsed.seriesSlug)
    .first<SeriesRow>();
  if (!row) return null;
  const series = toSeries(row);
  if (!isSeriesDate(series, parsed.date, horizon())) return null;
  return { series, date: parsed.date, event: occurrenceEvent(series, parsed.date) };
}

/** Form values of one date of a series (for saving it as its own event). */
export function occurrenceFormValues(series: EventSeries, date: string): EventFormValues {
  const event = occurrenceEvent(series, date);
  return {
    title: event.title,
    summary: event.summary,
    description: event.description,
    category: event.category,
    status: event.status,
    startDate: event.startDate,
    endDate: event.endDate,
    startTime: event.startTime,
    endTime: event.endTime,
    location: event.location,
    priceInfo: event.priceInfo,
    registrationUrl: event.registrationUrl,
  };
}

/**
 * Saves a generated date as its own event (with the series' hosts), e.g.
 * before it gets shifts or is changed on its own. Same id and slug, so
 * links and calendar entries stay the same.
 */
export async function storeOccurrence(
  db: Database,
  series: EventSeries,
  date: string,
  createdBy: string | null,
  values: EventFormValues = occurrenceFormValues(series, date),
) {
  const slug = occurrenceSlug(series.slug, date);
  await db.batch([
    insertEvent(db, values, {
      id: occurrenceId(series.id, date),
      slug,
      createdBy,
      seriesId: series.id,
      seriesDate: date,
    }),
    db
      .prepare(
        "INSERT INTO event_hosts (event_slug, user_id) SELECT ?, user_id FROM event_series_hosts WHERE series_id = ?",
      )
      .bind(slug, series.id),
  ]);
  return (await getEventRow(db, slug))!;
}

/**
 * The stored event for `slug`; a generated date of a repeating event is
 * stored first. For saving things that belong to one date (shifts, notes…).
 */
export async function ensureEventRow(db: Database, slug: string, createdBy: string | null) {
  const row = await getEventRow(db, slug);
  if (row) return row;
  const found = await findVirtualOccurrence(db, slug);
  if (!found) throw new HttpError(404, "This event doesn't exist (anymore).");
  return storeOccurrence(db, found.series, found.date, createdBy);
}

/** Removes one date from its series (it won't be generated again). */
export function excludeDateStatement(db: Database, series: EventSeries, date: string) {
  const excluded = [...new Set([...series.excludedDates, date])].sort();
  return db
    .prepare("UPDATE event_series SET excluded_dates = ?, updated_at = ? WHERE id = ?")
    .bind(JSON.stringify(excluded), nowIso(), series.id);
}
