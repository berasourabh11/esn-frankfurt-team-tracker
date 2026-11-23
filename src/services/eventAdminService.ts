import { apiRequest } from "@/lib/api";
import { getBerlinToday, sortEvents } from "@/lib/dateUtils";
import { withoutDanglingParents } from "@/lib/eventGroups";
import {
  expandSeries,
  isSeriesDate,
  occurrenceEvent,
  parseOccurrenceSlug,
  seriesHorizon,
} from "@/lib/recurrence";
import { slugify } from "@/lib/utils";
import {
  EsnEventSchema,
  EventSeriesSchema,
  type EsnEvent,
  type EventFormValues,
  type EventSeries,
  type Recurrence,
} from "@/types/event";

import type { KeyValueStorage } from "./teamService";

/**
 * Creating, editing and removing events (team members with the organiser
 * or board role).
 *
 * Local (demo) mode keeps a change log in the browser and overlays it on the
 * server-provided events, so the feed, calendar and event pages reflect
 * changes immediately. With the API (/backend), changes are sent to:
 *   POST   /api/events
 *   PUT    /api/events/{slug}
 *   DELETE /api/events/{slug}
 *   POST/PUT/DELETE /api/series[/{id}]   (repeating events)
 * and the backend becomes the source of truth (no local overlay).
 */
export interface EventChanges {
  created: EsnEvent[];
  /** Full replacements for server events (and dates of local series), by slug. */
  updated: Record<string, EsnEvent>;
  deleted: string[];
  /** Repeating events created in this browser (demo mode). */
  series: EventSeries[];
}

export const EMPTY_CHANGES: EventChanges = { created: [], updated: {}, deleted: [], series: [] };

/** A repeating event as entered in the form. */
export interface SeriesInput {
  values: EventFormValues;
  recurrence: Recurrence;
  hostIds: string[];
}

export interface EventAdminService {
  /** Whether changes must be overlaid on server data on the client. */
  readonly overlay: boolean;
  getChanges(): Promise<EventChanges>;
  createEvent(values: EventFormValues, existingSlugs: readonly string[]): Promise<EsnEvent>;
  updateEvent(current: EsnEvent, values: EventFormValues): Promise<EsnEvent>;
  deleteEvent(slug: string): Promise<void>;
  listSeries(): Promise<EventSeries[]>;
  /** Returns the first date of the new series. */
  createSeries(input: SeriesInput, existingSlugs: readonly string[]): Promise<EsnEvent>;
  /** Changes every date (dates changed on their own from today on follow it). */
  updateSeries(id: string, input: SeriesInput): Promise<EventSeries>;
  deleteSeries(id: string): Promise<void>;
}

/** The dates of locally created series, as events. */
function localSeriesEvents(changes: Pick<EventChanges, "series">): EsnEvent[] {
  if (changes.series.length === 0) return [];
  const horizon = seriesHorizon(getBerlinToday());
  return changes.series.flatMap((s) => expandSeries(s, horizon));
}

/** A date of a locally created series, by slug. */
export function findLocalSeriesEvent(changes: EventChanges, slug: string): EsnEvent | null {
  const parsed = parseOccurrenceSlug(slug);
  const series = parsed && changes.series.find((s) => s.slug === parsed.seriesSlug);
  if (!parsed || !series) return null;
  return isSeriesDate(series, parsed.date, seriesHorizon(getBerlinToday()))
    ? occurrenceEvent(series, parsed.date)
    : null;
}

/** Applies the local change log to the server events. */
export function applyEventChanges(events: readonly EsnEvent[], changes: EventChanges): EsnEvent[] {
  const deleted = new Set(changes.deleted);
  const merged = [...events, ...localSeriesEvents(changes)]
    .filter((e) => !deleted.has(e.slug))
    .map((e) => changes.updated[e.slug] ?? e);
  const known = new Set(merged.map((e) => e.slug));
  for (const created of changes.created) {
    if (!deleted.has(created.slug) && !known.has(created.slug)) merged.push(created);
  }
  return sortEvents(withoutDanglingParents(merged));
}

/** A unique, URL-friendly slug such as "pub-quiz-2026-12-10" (or "-2", "-3", …). */
export function createUniqueSlug(title: string, date: string, existing: readonly string[]) {
  const base = `${slugify(title) || "event"}-${date}`;
  const taken = new Set(existing);
  if (!taken.has(base)) return base;
  let n = 2;
  while (taken.has(`${base}-${n}`)) n += 1;
  return `${base}-${n}`;
}

/**
 * A slug for a new series: its dates are "{slug}-{date}", so it must not
 * match existing events with the same name (or other series).
 */
export function createUniqueSeriesSlug(
  title: string,
  existingSlugs: readonly string[],
  seriesSlugs: readonly string[],
) {
  const base = slugify(title) || "event";
  const used = new Set(seriesSlugs);
  for (const slug of existingSlugs) {
    const parsed = parseOccurrenceSlug(slug);
    if (parsed) used.add(parsed.seriesSlug);
  }
  if (!used.has(base)) return base;
  let n = 2;
  while (used.has(`${base}-${n}`)) n += 1;
  return `${base}-${n}`;
}

/** Turns validated form values into a full event, keeping identity and tags of `base`. */
export function eventFromForm(
  values: EventFormValues,
  identity: { id: string; slug: string },
  base?: EsnEvent,
): EsnEvent {
  const description = values.description?.trim() || values.summary;
  return EsnEventSchema.parse({
    id: identity.id,
    slug: identity.slug,
    title: values.title,
    summary: values.summary,
    description,
    category: values.category,
    status: values.status,
    startDate: values.startDate,
    endDate: values.endDate && values.endDate !== values.startDate ? values.endDate : undefined,
    startTime: values.startTime,
    endTime: values.endTime,
    location: values.location || undefined,
    priceInfo: values.priceInfo || undefined,
    registrationUrl: values.registrationUrl,
    imageUrl: base?.imageUrl,
    tags: base?.tags ?? [],
    // Dates of repeating events stay part of their series.
    parentSlug: base?.seriesId ? undefined : values.parentSlug,
    seriesId: base?.seriesId,
  });
}

export const EVENT_CHANGES_STORAGE_KEY = "esn-frankfurt:event-changes:v1";

export function createLocalEventAdminService(
  storage: KeyValueStorage = window.localStorage,
): EventAdminService {
  function read(): EventChanges {
    try {
      const raw = storage.getItem(EVENT_CHANGES_STORAGE_KEY);
      if (!raw) return { ...EMPTY_CHANGES, updated: {}, series: [] };
      const data = JSON.parse(raw) as Partial<EventChanges>;
      const parseAll = (list: unknown[] | undefined) =>
        (list ?? []).flatMap((e) => {
          const r = EsnEventSchema.safeParse(e);
          return r.success ? [r.data] : [];
        });
      const updated: Record<string, EsnEvent> = {};
      for (const [slug, e] of Object.entries(data.updated ?? {})) {
        const r = EsnEventSchema.safeParse(e);
        if (r.success) updated[slug] = r.data;
      }
      return {
        created: parseAll(data.created),
        updated,
        deleted: (data.deleted ?? []).filter((s): s is string => typeof s === "string"),
        series: (data.series ?? []).flatMap((e) => {
          const r = EventSeriesSchema.safeParse(e);
          return r.success ? [r.data] : [];
        }),
      };
    } catch {
      return { ...EMPTY_CHANGES, updated: {}, series: [] };
    }
  }

  function write(changes: EventChanges) {
    try {
      storage.setItem(EVENT_CHANGES_STORAGE_KEY, JSON.stringify(changes));
    } catch {
      // Storage unavailable: changes last for this page view only.
    }
  }

  return {
    overlay: true,
    async getChanges() {
      return read();
    },
    async createEvent(values, existingSlugs) {
      const changes = read();
      const slug = createUniqueSlug(values.title, values.startDate, [
        ...existingSlugs,
        ...changes.created.map((e) => e.slug),
        ...changes.deleted,
      ]);
      const event = eventFromForm(values, { id: slug, slug });
      write({ ...changes, created: [...changes.created, event] });
      return event;
    },
    async updateEvent(current, values) {
      const changes = read();
      const event = eventFromForm(values, { id: current.id, slug: current.slug }, current);
      if (changes.created.some((e) => e.slug === current.slug)) {
        write({
          ...changes,
          created: changes.created.map((e) => (e.slug === current.slug ? event : e)),
        });
      } else {
        write({ ...changes, updated: { ...changes.updated, [current.slug]: event } });
      }
      return event;
    },
    async deleteEvent(slug) {
      const changes = read();
      const wasLocal = changes.created.some((e) => e.slug === slug);
      const { [slug]: _removed, ...updated } = changes.updated;
      void _removed;
      write({
        ...changes,
        created: changes.created.filter((e) => e.slug !== slug),
        updated,
        // Local-only events simply disappear; server events (and dates of
        // series) are hidden.
        deleted: wasLocal ? changes.deleted : [...new Set([...changes.deleted, slug])],
      });
    },
    async listSeries() {
      return read().series;
    },
    async createSeries({ values, recurrence, hostIds }, existingSlugs) {
      const changes = read();
      const slug = createUniqueSeriesSlug(values.title, existingSlugs, [
        ...changes.series.map((s) => s.slug),
        ...changes.created.map((e) => e.slug),
      ]);
      const series = seriesFromForm({ values, recurrence, hostIds }, { id: `s-${slug}`, slug });
      write({ ...changes, series: [...changes.series, series] });
      return occurrenceEvent(series, series.startDate);
    },
    async updateSeries(id, input) {
      const changes = read();
      const current = changes.series.find((s) => s.id === id);
      if (!current) throw new Error("This repeating event doesn't exist (anymore).");
      const series = seriesFromForm(input, current);
      // Dates changed on their own follow the series from today on.
      const today = getBerlinToday();
      const updated = Object.fromEntries(
        Object.entries(changes.updated).filter(
          ([, e]) => e.seriesId !== id || (parseOccurrenceSlug(e.slug)?.date ?? "") < today,
        ),
      );
      write({
        ...changes,
        updated,
        series: changes.series.map((s) => (s.id === id ? series : s)),
      });
      return series;
    },
    async deleteSeries(id) {
      const changes = read();
      const series = changes.series.find((s) => s.id === id);
      const ofSeries = (slug: string) =>
        Boolean(series && parseOccurrenceSlug(slug)?.seriesSlug === series.slug);
      write({
        ...changes,
        updated: Object.fromEntries(
          Object.entries(changes.updated).filter(([slug]) => !ofSeries(slug)),
        ),
        deleted: changes.deleted.filter((slug) => !ofSeries(slug)),
        series: changes.series.filter((s) => s.id !== id),
      });
    },
  };
}

/** A series from the form (demo mode), keeping removed dates of `base`. */
function seriesFromForm(
  { values, recurrence, hostIds }: SeriesInput,
  base: { id: string; slug: string; excludedDates?: string[] },
): EventSeries {
  const event = eventFromForm({ ...values, parentSlug: undefined }, base);
  return EventSeriesSchema.parse({
    ...event,
    recurrence,
    excludedDates: base.excludedDates ?? [],
    hostIds,
  });
}

export function createHttpEventAdminService({
  baseUrl,
  fetchImpl = fetch,
}: {
  baseUrl: string;
  fetchImpl?: typeof fetch;
}): EventAdminService {
  const send = (path: string, method: string, body?: unknown) =>
    apiRequest(baseUrl, path, { method, body, fetchImpl });
  return {
    overlay: false,
    async getChanges() {
      return EMPTY_CHANGES;
    },
    async createEvent(values) {
      return EsnEventSchema.parse(await send("/api/events", "POST", values));
    },
    async updateEvent(current, values) {
      return EsnEventSchema.parse(
        await send(`/api/events/${encodeURIComponent(current.slug)}`, "PUT", values),
      );
    },
    async deleteEvent(slug) {
      await send(`/api/events/${encodeURIComponent(slug)}`, "DELETE");
    },
    async listSeries() {
      const data = await send("/api/series", "GET");
      return (Array.isArray(data) ? data : []).flatMap((s) => {
        const r = EventSeriesSchema.safeParse(s);
        return r.success ? [r.data] : [];
      });
    },
    async createSeries({ values, recurrence, hostIds }) {
      const data = (await send("/api/series", "POST", {
        event: values,
        recurrence,
        hostIds,
      })) as { firstEvent: unknown };
      return EsnEventSchema.parse(data.firstEvent);
    },
    async updateSeries(id, { values, recurrence, hostIds }) {
      return EventSeriesSchema.parse(
        await send(`/api/series/${encodeURIComponent(id)}`, "PUT", {
          event: values,
          recurrence,
          hostIds,
        }),
      );
    },
    async deleteSeries(id) {
      await send(`/api/series/${encodeURIComponent(id)}`, "DELETE");
    },
  };
}
