import type { Database } from "./db";
import { compact } from "./http";
import { nowIso, orNull } from "./lib/util";
import type { EsnEvent, EventFormValues } from "./shared";

/** A row of the `events` table. */
export interface EventRow {
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
  image_url: string | null;
  tags: string;
  parent_slug: string | null;
  /** Set when this is a date of a repeating event that was saved on its own. */
  series_id: string | null;
  series_date: string | null;
}

export function toEvent(row: EventRow): EsnEvent {
  return compact({
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
    imageUrl: row.image_url,
    tags: JSON.parse(row.tags) as string[],
    parentSlug: row.parent_slug,
    seriesId: row.series_id,
  }) as EsnEvent;
}

/**
 * The form's column values, in the order of `EVENT_COLUMNS` (the same for
 * events and series; mirrors the frontend's eventFromForm).
 */
export function eventColumns(values: EventFormValues) {
  return [
    values.title,
    values.summary,
    values.description?.trim() || values.summary,
    values.category,
    values.status,
    values.startDate,
    values.endDate && values.endDate !== values.startDate ? values.endDate : null,
    orNull(values.startTime),
    orNull(values.endTime),
    orNull(values.location || null),
    orNull(values.priceInfo || null),
    orNull(values.registrationUrl),
  ] as const;
}

export const EVENT_COLUMNS =
  "title, summary, description, category, status, start_date, end_date, start_time, end_time, location, price_info, registration_url";

/** `title = ?, summary = ?, …` for UPDATE statements. */
export const EVENT_COLUMN_UPDATES = EVENT_COLUMNS.split(", ")
  .map((c) => `${c} = ?`)
  .join(", ");

export function insertEvent(
  db: Database,
  values: EventFormValues,
  identity: {
    id: string;
    slug: string;
    createdBy: string | null;
    seriesId?: string;
    seriesDate?: string;
  },
) {
  const now = nowIso();
  return db
    .prepare(
      `INSERT INTO events (${EVENT_COLUMNS}, parent_slug, id, slug, tags, created_by,
         created_at, updated_at, series_id, series_date)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '[]', ?, ?, ?, ?, ?)`,
    )
    .bind(
      ...eventColumns(values),
      orNull(values.parentSlug),
      identity.id,
      identity.slug,
      identity.createdBy,
      now,
      now,
      orNull(identity.seriesId),
      orNull(identity.seriesDate),
    );
}

export async function getEventRow(db: Database, slug: string) {
  return db.prepare("SELECT * FROM events WHERE slug = ?").bind(slug).first<EventRow>();
}
