import { Hono } from "hono";

import { getBerlinToday } from "../../../src/lib/dateUtils";
import { isSeriesDate, occurrenceEvent } from "../../../src/lib/recurrence";
import type { Database, Statement } from "../db";
import { EVENT_COLUMN_UPDATES, EVENT_COLUMNS, eventColumns } from "../eventRows";
import { readBody, requireManager, type AppEnv } from "../http";
import { newId, nowIso, orNull, slugify } from "../lib/util";
import { horizon, loadSeries, occurrenceFormValues, requireSeries } from "../series";
import { SeriesFormSchema, type SeriesFormValues } from "../shared";

/**
 * Repeating events:
 *   GET    /api/series        all series (rule, removed dates, default hosts)
 *   GET    /api/series/:id
 *   POST   /api/series        { event, recurrence, hostIds } → { series, firstEvent }
 *   PUT    /api/series/:id    changes every date (past dates saved on their own keep theirs)
 *   DELETE /api/series/:id    removes every date
 * Single dates are changed and removed through /api/events/:slug.
 */

/**
 * The series' slug, the start of each date's slug ("{slug}-{date}"). It
 * avoids slugs of existing events, so dates never clash with them.
 */
async function uniqueSeriesSlug(db: Database, title: string) {
  const base = slugify(title) || "event";
  const datePattern = "[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]";
  for (let n = 1; ; n += 1) {
    const slug = n === 1 ? base : `${base}-${n}`;
    const clash = await db
      .prepare(
        `SELECT 1 AS found FROM event_series WHERE slug = ?1
         UNION ALL SELECT 1 FROM events WHERE slug GLOB ?1 || '-${datePattern}'
         LIMIT 1`,
      )
      .bind(slug)
      .first<{ found: number }>();
    if (!clash) return slug;
  }
}

function ruleColumns({ recurrence: r }: SeriesFormValues) {
  return [
    r.frequency,
    r.interval,
    r.frequency === "monthly" ? (r.monthlyBy ?? "weekday") : null,
    orNull(r.until),
    orNull(r.count),
  ] as const;
}

const RULE_COLUMNS = "frequency, repeat_every, monthly_by, until_date, occurrence_count";

function hostStatements(db: Database, seriesId: string, hostIds: string[]): Statement[] {
  return [
    db.prepare("DELETE FROM event_series_hosts WHERE series_id = ?").bind(seriesId),
    // Unknown member ids are skipped by the SELECT.
    ...[...new Set(hostIds)].map((hostId) =>
      db
        .prepare(
          "INSERT INTO event_series_hosts (series_id, user_id) SELECT ?, id FROM users WHERE id = ?",
        )
        .bind(seriesId, hostId),
    ),
  ];
}

export const seriesRoutes = new Hono<AppEnv>()
  .get("/series", async (c) => c.json(await loadSeries(c.env.DB)))

  .get("/series/:id", async (c) => c.json(await requireSeries(c.env.DB, c.req.param("id"))))

  .post("/series", async (c) => {
    const user = requireManager(c);
    const values = await readBody(c, SeriesFormSchema);
    const db = c.env.DB;
    const id = newId("s");
    const slug = await uniqueSeriesSlug(db, values.event.title);
    const now = nowIso();
    await db.batch([
      db
        .prepare(
          `INSERT INTO event_series (${EVENT_COLUMNS}, ${RULE_COLUMNS}, id, slug, created_by,
             created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(...eventColumns(values.event), ...ruleColumns(values), id, slug, user.id, now, now),
      ...hostStatements(db, id, values.hostIds),
    ]);
    const series = await requireSeries(db, id);
    return c.json({ series, firstEvent: occurrenceEvent(series, series.startDate) }, 201);
  })

  .put("/series/:id", async (c) => {
    requireManager(c);
    const db = c.env.DB;
    const current = await requireSeries(db, c.req.param("id"));
    const values = await readBody(c, SeriesFormSchema);
    const id = current.id;
    await db.batch([
      db
        .prepare(
          `UPDATE event_series SET ${EVENT_COLUMN_UPDATES},
             ${RULE_COLUMNS.split(", ")
               .map((col) => `${col} = ?`)
               .join(", ")}, updated_at = ?
           WHERE id = ?`,
        )
        .bind(...eventColumns(values.event), ...ruleColumns(values), nowIso(), id),
      ...hostStatements(db, id, values.hostIds),
    ]);
    const series = await requireSeries(db, id);

    // Dates saved on their own (because of shifts, notes or changes): from
    // today on they follow the new details; ones that no longer fit the new
    // rule stay as separate events, so their shifts and notes aren't lost.
    const { results } = await db
      .prepare(
        "SELECT slug, series_date FROM events WHERE series_id = ? AND series_date >= ? ORDER BY series_date",
      )
      .bind(id, getBerlinToday())
      .all<{ slug: string; series_date: string }>();
    const until = horizon();
    const statements: Statement[] = [];
    for (const row of results) {
      if (isSeriesDate(series, row.series_date, until)) {
        statements.push(
          db
            .prepare(`UPDATE events SET ${EVENT_COLUMN_UPDATES}, updated_at = ? WHERE slug = ?`)
            .bind(
              ...eventColumns(occurrenceFormValues(series, row.series_date)),
              nowIso(),
              row.slug,
            ),
          db.prepare("DELETE FROM event_hosts WHERE event_slug = ?").bind(row.slug),
          db
            .prepare(
              "INSERT INTO event_hosts (event_slug, user_id) SELECT ?, user_id FROM event_series_hosts WHERE series_id = ?",
            )
            .bind(row.slug, id),
        );
      } else {
        statements.push(
          db
            .prepare("UPDATE events SET series_id = NULL, series_date = NULL WHERE slug = ?")
            .bind(row.slug),
        );
      }
    }
    if (statements.length) await db.batch(statements);
    return c.json(series);
  })

  .delete("/series/:id", async (c) => {
    requireManager(c);
    const db = c.env.DB;
    const series = await requireSeries(db, c.req.param("id"));
    // Dates saved on their own are removed with it (ON DELETE CASCADE).
    await db.prepare("DELETE FROM event_series WHERE id = ?").bind(series.id).run();
    return c.body(null, 204);
  });
