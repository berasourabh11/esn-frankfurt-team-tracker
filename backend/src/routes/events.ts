import { Hono } from "hono";
import { z } from "zod";

import { HttpError, activeUser, compact, readBody, requireManager, type AppEnv } from "../http";
import type { Database } from "../db";
import { newId, nowIso, orNull, slugify } from "../lib/util";
import {
  EventFormSchema,
  ImportantLinkSchema,
  type EsnEvent,
  type EventFormValues,
  type EventTeamInfo,
} from "../shared";

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
  }) as EsnEvent;
}

/** Same column values for create and update (mirrors the frontend's eventFromForm). */
function columns(values: EventFormValues) {
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

async function uniqueSlug(db: Database, title: string, date: string) {
  const base = `${slugify(title) || "event"}-${date}`;
  const { results } = await db
    .prepare("SELECT slug FROM events WHERE slug = ? OR slug LIKE ?")
    .bind(base, `${base}-%`)
    .all<{ slug: string }>();
  const taken = new Set(results.map((r) => r.slug));
  if (!taken.has(base)) return base;
  let n = 2;
  while (taken.has(`${base}-${n}`)) n += 1;
  return `${base}-${n}`;
}

export async function getEventRow(db: Database, slug: string) {
  return db.prepare("SELECT * FROM events WHERE slug = ?").bind(slug).first<EventRow>();
}

async function requireEvent(db: Database, slug: string) {
  const row = await getEventRow(db, slug);
  if (!row) throw new HttpError(404, "This event doesn't exist (anymore).");
  return row;
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
  .get("/events", async (c) => {
    const { results } = await c.env.DB.prepare(
      "SELECT * FROM events ORDER BY start_date, start_time IS NULL, start_time, title",
    ).all<EventRow>();
    return c.json(results.map(toEvent));
  })

  // Registered before /events/:slug so "team-info" isn't taken for a slug.
  .get("/events/team-info", async (c) =>
    c.json(await loadTeamInfos(c.env.DB, Boolean(activeUser(c)))),
  )

  .get("/events/:slug", async (c) =>
    c.json(toEvent(await requireEvent(c.env.DB, c.req.param("slug")))),
  )

  .post("/events", async (c) => {
    const user = requireManager(c);
    const values = await readBody(c, EventFormSchema);
    const db = c.env.DB;
    const slug = await uniqueSlug(db, values.title, values.startDate);
    const now = nowIso();
    await db
      .prepare(
        `INSERT INTO events (title, summary, description, category, status, start_date, end_date,
           start_time, end_time, location, price_info, registration_url,
           id, slug, tags, created_by, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '[]', ?, ?, ?)`,
      )
      .bind(...columns(values), newId("e"), slug, user.id, now, now)
      .run();
    return c.json(toEvent(await requireEvent(db, slug)), 201);
  })

  .put("/events/:slug", async (c) => {
    requireManager(c);
    const slug = c.req.param("slug");
    const db = c.env.DB;
    await requireEvent(db, slug);
    const values = await readBody(c, EventFormSchema);
    await db
      .prepare(
        `UPDATE events SET title = ?, summary = ?, description = ?, category = ?, status = ?,
           start_date = ?, end_date = ?, start_time = ?, end_time = ?, location = ?,
           price_info = ?, registration_url = ?, updated_at = ?
         WHERE slug = ?`,
      )
      .bind(...columns(values), nowIso(), slug)
      .run();
    return c.json(toEvent(await requireEvent(db, slug)));
  })

  /** Also removes the event's shifts, tasks, hosts, notes and reviews. */
  .delete("/events/:slug", async (c) => {
    requireManager(c);
    const slug = c.req.param("slug");
    await requireEvent(c.env.DB, slug);
    await c.env.DB.prepare("DELETE FROM events WHERE slug = ?").bind(slug).run();
    return c.body(null, 204);
  })

  .put("/events/:slug/team-info", async (c) => {
    const user = requireManager(c);
    const slug = c.req.param("slug");
    const db = c.env.DB;
    await requireEvent(db, slug);
    const patch = await readBody(c, TeamInfoPatchSchema);
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
