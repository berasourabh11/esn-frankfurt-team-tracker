import { Hono } from "hono";
import { z } from "zod";

import { HttpError, activeUser, readBody, requireManager, type AppEnv } from "../http";
import type { Database } from "../db";
import {
  EVENT_COLUMN_UPDATES,
  eventColumns,
  getEventRow,
  insertEvent,
  toEvent,
  type EventRow,
} from "../eventRows";
import { newId, nowIso, orNull, slugify } from "../lib/util";
import {
  ensureEventRow,
  excludeDateStatement,
  findVirtualOccurrence,
  listAllEvents,
  listVirtualOccurrences,
  requireSeries,
  storeOccurrence,
} from "../series";
import {
  EventFormSchema,
  ImportantLinkSchema,
  type EventFormValues,
  type EventTeamInfo,
} from "../shared";

/**
 * Checks that `parentSlug` can be the main event of `slug` (or of a new
 * event): it exists, isn't a sub-event itself, and nesting stays one level.
 */
async function assertValidParent(db: Database, parentSlug: string | undefined, slug?: string) {
  if (!parentSlug) return;
  if (parentSlug === slug) throw new HttpError(400, "An event can't be part of itself.");
  const parent = await getEventRow(db, parentSlug);
  if (!parent) {
    const repeating = await findVirtualOccurrence(db, parentSlug);
    throw new HttpError(
      400,
      repeating
        ? "A date of a repeating event can't have sub-events."
        : "The main event doesn't exist (anymore).",
    );
  }
  if (parent.series_id) {
    throw new HttpError(400, "A date of a repeating event can't have sub-events.");
  }
  if (parent.parent_slug) {
    throw new HttpError(
      400,
      `“${parent.title}” is a sub-event itself, so it can't have sub-events.`,
    );
  }
  if (slug) {
    const child = await db
      .prepare("SELECT 1 AS found FROM events WHERE parent_slug = ? LIMIT 1")
      .bind(slug)
      .first<{ found: number }>();
    if (child) {
      throw new HttpError(
        400,
        "This event has sub-events of its own, so it can't be part of another event.",
      );
    }
  }
}

async function uniqueSlug(db: Database, title: string, date: string) {
  const name = slugify(title) || "event";
  const base = `${name}-${date}`;
  const [{ results }, series] = await Promise.all([
    db
      .prepare("SELECT slug FROM events WHERE slug = ? OR slug LIKE ?")
      .bind(base, `${base}-%`)
      .all<{ slug: string }>(),
    // A repeating event with the same name uses "{name}-{date}" for its dates.
    db
      .prepare("SELECT 1 AS found FROM event_series WHERE slug = ?")
      .bind(name)
      .first<{ found: number }>(),
  ]);
  const taken = new Set(results.map((r) => r.slug));
  if (series) taken.add(base);
  if (!taken.has(base)) return base;
  let n = 2;
  while (taken.has(`${base}-${n}`)) n += 1;
  return `${base}-${n}`;
}

const NOT_FOUND = "This event doesn't exist (anymore).";

async function requireEvent(db: Database, slug: string) {
  const row = await getEventRow(db, slug);
  if (!row) throw new HttpError(404, NOT_FOUND);
  return row;
}

/** A stored event, or a generated date of a repeating event. */
async function findEvent(db: Database, slug: string) {
  const row = await getEventRow(db, slug);
  if (row) return toEvent(row);
  return (await findVirtualOccurrence(db, slug))?.event ?? null;
}

function assertNoParentForSeriesDate(values: EventFormValues) {
  if (values.parentSlug) {
    throw new HttpError(400, "A date of a repeating event can't be part of another event.");
  }
}

const TeamInfoPatchSchema = z.object({
  hostIds: z.array(z.string().min(1)).max(30).optional(),
  notes: z.string().max(4000, "Keep the notes under 4000 characters").optional(),
  links: z.array(ImportantLinkSchema).max(20, "Add at most 20 links").optional(),
});

interface InfoRow {
  event_slug: string;
  notes: string;
  links: string;
  updated_at: string | null;
  updated_by: string | null;
}

async function loadTeamInfos(db: Database, includePrivate: boolean, slug?: string) {
  const where = slug ? "WHERE event_slug = ?" : "";
  const bind = slug ? [slug] : [];
  const [hosts, infos] = await Promise.all([
    db
      .prepare(`SELECT event_slug, user_id FROM event_hosts ${where} ORDER BY rowid`)
      .bind(...bind)
      .all<{ event_slug: string; user_id: string }>(),
    db
      .prepare(`SELECT * FROM event_team_info ${where}`)
      .bind(...bind)
      .all<InfoRow>(),
  ]);
  const map = new Map<string, EventTeamInfo>();
  const get = (eventSlug: string) => {
    let info = map.get(eventSlug);
    if (!info) {
      info = { eventSlug, hostIds: [], notes: "", links: [] };
      map.set(eventSlug, info);
    }
    return info;
  };
  for (const h of hosts.results) get(h.event_slug).hostIds.push(h.user_id);
  // Generated dates of repeating events get the series' default hosts.
  const seriesHosts = await db
    .prepare("SELECT series_id, user_id FROM event_series_hosts ORDER BY rowid")
    .all<{ series_id: string; user_id: string }>();
  if (seriesHosts.results.length) {
    const bySeries = new Map<string, string[]>();
    for (const h of seriesHosts.results) {
      bySeries.set(h.series_id, [...(bySeries.get(h.series_id) ?? []), h.user_id]);
    }
    for (const e of await listVirtualOccurrences(db)) {
      const hostIds = e.seriesId && bySeries.get(e.seriesId);
      if (hostIds && (!slug || e.slug === slug)) get(e.slug).hostIds = [...hostIds];
    }
  }
  for (const row of infos.results) {
    const info = get(row.event_slug);
    // Notes and links are internal: only signed-in members get them.
    if (!includePrivate) continue;
    info.notes = row.notes;
    info.links = JSON.parse(row.links);
    if (row.updated_at) info.updatedAt = row.updated_at;
    if (row.updated_by) info.updatedBy = row.updated_by;
  }
  return [...map.values()];
}

export const eventRoutes = new Hono<AppEnv>()
  .get("/events", async (c) => c.json(await listAllEvents(c.env.DB)))

  // Registered before /events/:slug so "team-info" isn't taken for a slug.
  .get("/events/team-info", async (c) =>
    c.json(await loadTeamInfos(c.env.DB, Boolean(activeUser(c)))),
  )

  .get("/events/:slug", async (c) => {
    const event = await findEvent(c.env.DB, c.req.param("slug"));
    if (!event) throw new HttpError(404, NOT_FOUND);
    return c.json(event);
  })

  .post("/events", async (c) => {
    const user = requireManager(c);
    const values = await readBody(c, EventFormSchema);
    const db = c.env.DB;
    await assertValidParent(db, values.parentSlug);
    const slug = await uniqueSlug(db, values.title, values.startDate);
    await insertEvent(db, values, { id: newId("e"), slug, createdBy: user.id }).run();
    return c.json(toEvent(await requireEvent(db, slug)), 201);
  })

  /** For a date of a repeating event, this changes that date only. */
  .put("/events/:slug", async (c) => {
    const user = requireManager(c);
    const slug = c.req.param("slug");
    const db = c.env.DB;
    const row = await getEventRow(db, slug);
    if (!row) {
      const found = await findVirtualOccurrence(db, slug);
      if (!found) throw new HttpError(404, NOT_FOUND);
      const values = await readBody(c, EventFormSchema);
      assertNoParentForSeriesDate(values);
      return c.json(toEvent(await storeOccurrence(db, found.series, found.date, user.id, values)));
    }
    const values = await readBody(c, EventFormSchema);
    if (row.series_id) assertNoParentForSeriesDate(values);
    await assertValidParent(db, values.parentSlug, slug);
    await db
      .prepare(
        `UPDATE events SET ${EVENT_COLUMN_UPDATES}, parent_slug = ?, updated_at = ? WHERE slug = ?`,
      )
      .bind(...eventColumns(values), orNull(values.parentSlug), nowIso(), slug)
      .run();
    return c.json(toEvent(await requireEvent(db, slug)));
  })

  /**
   * Also removes the event's shifts, tasks, hosts, notes and reviews. Its
   * sub-events stay, as stand-alone events. For a date of a repeating
   * event, only that date is removed.
   */
  .delete("/events/:slug", async (c) => {
    requireManager(c);
    const slug = c.req.param("slug");
    const db = c.env.DB;
    const row = await getEventRow(db, slug);
    if (row?.series_id && row.series_date) {
      const series = await requireSeries(db, row.series_id);
      await db.batch([
        db.prepare("DELETE FROM events WHERE slug = ?").bind(slug),
        excludeDateStatement(db, series, row.series_date),
      ]);
    } else if (row) {
      await db.prepare("DELETE FROM events WHERE slug = ?").bind(slug).run();
    } else {
      const found = await findVirtualOccurrence(db, slug);
      if (!found) throw new HttpError(404, NOT_FOUND);
      await excludeDateStatement(db, found.series, found.date).run();
    }
    return c.body(null, 204);
  })

  .put("/events/:slug/team-info", async (c) => {
    const user = requireManager(c);
    const slug = c.req.param("slug");
    const db = c.env.DB;
    const patch = await readBody(c, TeamInfoPatchSchema);
    // A generated date of a repeating event is stored first.
    await ensureEventRow(db, slug, user.id);
    const [current] = await loadTeamInfos(db, true, slug);
    const now = nowIso();

    const statements = [
      db
        .prepare(
          `INSERT INTO event_team_info (event_slug, notes, links, updated_at, updated_by)
           VALUES (?1, ?2, ?3, ?4, ?5)
           ON CONFLICT (event_slug) DO UPDATE SET
             notes = ?2, links = ?3, updated_at = ?4, updated_by = ?5`,
        )
        .bind(
          slug,
          patch.notes?.trim() ?? current?.notes ?? "",
          JSON.stringify(patch.links ?? current?.links ?? []),
          now,
          user.id,
        ),
    ];
    if (patch.hostIds) {
      statements.push(db.prepare("DELETE FROM event_hosts WHERE event_slug = ?").bind(slug));
      // Unknown member ids are skipped by the SELECT.
      for (const hostId of new Set(patch.hostIds)) {
        statements.push(
          db
            .prepare(
              "INSERT INTO event_hosts (event_slug, user_id) SELECT ?, id FROM users WHERE id = ?",
            )
            .bind(slug, hostId),
        );
      }
    }
    await db.batch(statements);
    const [info] = await loadTeamInfos(db, true, slug);
    return c.json(info);
  });
