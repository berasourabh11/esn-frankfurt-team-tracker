import { apiRequest } from "@/lib/api";
import { sortEvents } from "@/lib/dateUtils";
import { withoutDanglingParents } from "@/lib/eventGroups";
import { slugify } from "@/lib/utils";
import { EsnEventSchema, type EsnEvent, type EventFormValues } from "@/types/event";

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
 * and the backend becomes the source of truth (no local overlay).
 */
export interface EventChanges {
  created: EsnEvent[];
  /** Full replacements for server events, by slug. */
  updated: Record<string, EsnEvent>;
  deleted: string[];
}

export const EMPTY_CHANGES: EventChanges = { created: [], updated: {}, deleted: [] };

export interface EventAdminService {
  /** Whether changes must be overlaid on server data on the client. */
  readonly overlay: boolean;
  getChanges(): Promise<EventChanges>;
  createEvent(values: EventFormValues, existingSlugs: readonly string[]): Promise<EsnEvent>;
  updateEvent(current: EsnEvent, values: EventFormValues): Promise<EsnEvent>;
  deleteEvent(slug: string): Promise<void>;
}

/** Applies the local change log to the server events. */
export function applyEventChanges(events: readonly EsnEvent[], changes: EventChanges): EsnEvent[] {
  const deleted = new Set(changes.deleted);
  const merged = events
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
    parentSlug: values.parentSlug,
  });
}

export const EVENT_CHANGES_STORAGE_KEY = "esn-frankfurt:event-changes:v1";

export function createLocalEventAdminService(
  storage: KeyValueStorage = window.localStorage,
): EventAdminService {
  function read(): EventChanges {
    try {
      const raw = storage.getItem(EVENT_CHANGES_STORAGE_KEY);
      if (!raw) return { ...EMPTY_CHANGES, updated: {} };
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
      };
    } catch {
      return { ...EMPTY_CHANGES, updated: {} };
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
        created: changes.created.filter((e) => e.slug !== slug),
        updated,
        // Local-only events simply disappear; server events are hidden.
        deleted: wasLocal ? changes.deleted : [...new Set([...changes.deleted, slug])],
      });
    },
  };
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
  };
}
