import { Hono } from "hono";
import { z } from "zod";

import type { Database, SqlValue } from "../db";
import {
  HttpError,
  compact,
  isManager,
  readBody,
  requireManager,
  requireUser,
  type AppContext,
  type AppEnv,
} from "../http";
import { newId, nowIso, orNull } from "../lib/util";
import {
  ReviewNoteFormSchema,
  TaskFormSchema,
  TaskKindSchema,
  type EventTask,
  type ReviewNote,
  type TaskFormValues,
} from "../shared";
import { ensureEventRow } from "../series";

interface TaskRow {
  id: string;
  event_slug: string;
  kind: EventTask["kind"];
  title: string;
  description: string;
  date: string | null;
  start_time: string | null;
  end_time: string | null;
  location: string | null;
  people_needed: number;
  done: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

function toTask(row: TaskRow, assigneeIds: string[]): EventTask {
  return compact({
    id: row.id,
    eventSlug: row.event_slug,
    kind: row.kind,
    title: row.title,
    description: row.description,
    date: row.date,
    startTime: row.start_time,
    endTime: row.end_time,
    location: row.location,
    peopleNeeded: row.people_needed,
    assigneeIds,
    done: row.done === 1,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }) as EventTask;
}

/** Tasks matching `where` (a condition on the tasks table) with their assignees. */
export async function loadTasks(db: Database, where: string, params: SqlValue[]) {
  const [tasks, assignees] = await Promise.all([
    db
      .prepare(`SELECT * FROM tasks WHERE ${where} ORDER BY date, start_time, title`)
      .bind(...params)
      .all<TaskRow>(),
    db
      .prepare(
        `SELECT task_id, user_id FROM task_assignees
         WHERE task_id IN (SELECT id FROM tasks WHERE ${where}) ORDER BY assigned_at`,
      )
      .bind(...params)
      .all<{ task_id: string; user_id: string }>(),
  ]);
  const byTask = new Map<string, string[]>();
  for (const a of assignees.results) {
    byTask.set(a.task_id, [...(byTask.get(a.task_id) ?? []), a.user_id]);
  }
  return tasks.results.map((t) => toTask(t, byTask.get(t.id) ?? []));
}

async function requireTask(db: Database, id: string) {
  const [task] = await loadTasks(db, "id = ?", [id]);
  if (!task) throw new HttpError(404, "This task no longer exists.");
  return task;
}

/** The event's slug; a generated date of a repeating event is stored first. */
async function requireEventSlug(c: AppContext, userId: string) {
  const slug = c.req.param("slug") ?? "";
  await ensureEventRow(c.env.DB, slug, userId);
  return slug;
}

const optionalText = z.string().nullable().optional();
const TaskPatchSchema = z
  .object({
    kind: TaskKindSchema.optional(),
    title: z.string().optional(),
    description: z.string().optional(),
    date: optionalText,
    startTime: optionalText,
    endTime: optionalText,
    location: optionalText,
    peopleNeeded: z.number().optional(),
    done: z.boolean().optional(),
  })
  .strict();

const formFields = (task: EventTask): Partial<TaskFormValues> => ({
  kind: task.kind,
  title: task.title,
  description: task.description,
  date: task.date,
  startTime: task.startTime,
  endTime: task.endTime,
  location: task.location,
  peopleNeeded: task.peopleNeeded,
});

export const taskRoutes = new Hono<AppEnv>()
  .get("/events/:slug/tasks", async (c) => {
    requireUser(c);
    return c.json(await loadTasks(c.env.DB, "event_slug = ?", [c.req.param("slug")]));
  })

  .post("/events/:slug/tasks", async (c) => {
    const user = requireManager(c);
    const slug = await requireEventSlug(c, user.id);
    const values = await readBody(
      c,
      z.preprocess((v) => ({ description: "", ...(v as object) }), TaskFormSchema),
    );
    const id = newId("t");
    const now = nowIso();
    await c.env.DB.prepare(
      `INSERT INTO tasks (id, event_slug, kind, title, description, date, start_time, end_time,
         location, people_needed, done, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)`,
    )
      .bind(
        id,
        slug,
        values.kind,
        values.title,
        values.description,
        orNull(values.date),
        orNull(values.startTime),
        orNull(values.endTime),
        orNull(values.location || null),
        values.peopleNeeded,
        user.id,
        now,
        now,
      )
      .run();
    return c.json(await requireTask(c.env.DB, id), 201);
  })

  /**
   * Members (role) edit everything. People on the task may only tick it off
   * (`{ "done": true|false }`). `null` clears an optional field.
   */
  .patch("/tasks/:id", async (c) => {
    const user = requireUser(c);
    const task = await requireTask(c.env.DB, c.req.param("id"));
    const patch = await readBody(c, TaskPatchSchema);
    const { done, ...fields } = patch;
    const editsFields = Object.keys(fields).length > 0;

    if (editsFields && !isManager(user)) {
      throw new HttpError(403, "Only members of the ESN team can edit tasks.");
    }
    if (done !== undefined && !isManager(user) && !task.assigneeIds.includes(user.id)) {
      throw new HttpError(403, "Only people on this task can mark it as done.");
    }

    const merged = { ...formFields(task) } as Record<string, unknown>;
    for (const [k, v] of Object.entries(fields)) merged[k] = v === null || v === "" ? undefined : v;
    const result = TaskFormSchema.safeParse(merged);
    if (!result.success) {
      throw new HttpError(
        400,
        result.error.issues[0]?.message ?? "Invalid task.",
        result.error.issues,
      );
    }
    const values = result.data;
    if (values.peopleNeeded < task.assigneeIds.length) {
      throw new HttpError(
        409,
        `${task.assigneeIds.length} people are already assigned. Remove someone first.`,
      );
    }

    await c.env.DB.prepare(
      `UPDATE tasks SET kind = ?, title = ?, description = ?, date = ?, start_time = ?,
         end_time = ?, location = ?, people_needed = ?, done = ?, updated_at = ?
       WHERE id = ?`,
    )
      .bind(
        values.kind,
        values.title,
        values.description,
        orNull(values.date),
        orNull(values.startTime),
        orNull(values.endTime),
        orNull(values.location || null),
        values.peopleNeeded,
        (done ?? task.done) ? 1 : 0,
        nowIso(),
        task.id,
      )
      .run();
    return c.json(await requireTask(c.env.DB, task.id));
  })

  .delete("/tasks/:id", async (c) => {
    requireManager(c);
    const task = await requireTask(c.env.DB, c.req.param("id"));
    await c.env.DB.prepare("DELETE FROM tasks WHERE id = ?").bind(task.id).run();
    return c.body(null, 204);
  })

  /** Anyone accepted can sign themselves up; members (role) can assign anyone. */
  .put("/tasks/:id/assignees/:memberId", async (c) => {
    const user = requireUser(c);
    const memberId = c.req.param("memberId");
    const db = c.env.DB;
    const task = await requireTask(db, c.req.param("id"));

    if (memberId !== user.id && !isManager(user)) {
      throw new HttpError(403, "You can only sign yourself up.");
    }
    if (task.assigneeIds.includes(memberId)) return c.json(task);
    if (task.done && !isManager(user)) throw new HttpError(409, "This task is already done.");
    if (!(await db.prepare("SELECT 1 FROM users WHERE id = ?").bind(memberId).first())) {
      throw new HttpError(404, "Unknown member.");
    }

    // Checks the free spots in the same statement, so two people can't take the last spot.
    const { meta } = await db
      .prepare(
        `INSERT OR IGNORE INTO task_assignees (task_id, user_id, assigned_at)
         SELECT ?1, ?2, ?3 WHERE
           (SELECT COUNT(*) FROM task_assignees WHERE task_id = ?1) <
           (SELECT people_needed FROM tasks WHERE id = ?1)`,
      )
      .bind(task.id, memberId, nowIso())
      .run();
    if (meta.changes === 0) throw new HttpError(409, "All spots are already taken.");
    await db.prepare("UPDATE tasks SET updated_at = ? WHERE id = ?").bind(nowIso(), task.id).run();
    return c.json(await requireTask(db, task.id));
  })

  .delete("/tasks/:id/assignees/:memberId", async (c) => {
    const user = requireUser(c);
    const memberId = c.req.param("memberId");
    if (memberId !== user.id && !isManager(user)) {
      throw new HttpError(403, "You can only take yourself off a task.");
    }
    const db = c.env.DB;
    const task = await requireTask(db, c.req.param("id"));
    await db
      .prepare("DELETE FROM task_assignees WHERE task_id = ? AND user_id = ?")
      .bind(task.id, memberId)
      .run();
    await db.prepare("UPDATE tasks SET updated_at = ? WHERE id = ?").bind(nowIso(), task.id).run();
    return c.json(await requireTask(db, task.id));
  })

  // ─── Post-event review notes ─────────────────────────────────────────────
  .get("/events/:slug/reviews", async (c) => {
    requireUser(c);
    const { results } = await c.env.DB.prepare(
      "SELECT * FROM review_notes WHERE event_slug = ? ORDER BY created_at",
    )
      .bind(c.req.param("slug"))
      .all<ReviewRow>();
    return c.json(results.map(toReview));
  })

  .post("/events/:slug/reviews", async (c) => {
    const user = requireUser(c);
    const slug = await requireEventSlug(c, user.id);
    const { kind, text } = await readBody(c, ReviewNoteFormSchema);
    const id = newId("r");
    await c.env.DB.prepare(
      "INSERT INTO review_notes (id, event_slug, kind, text, author_id, created_at) VALUES (?, ?, ?, ?, ?, ?)",
    )
      .bind(id, slug, kind, text, user.id, nowIso())
      .run();
    const row = await c.env.DB.prepare("SELECT * FROM review_notes WHERE id = ?")
      .bind(id)
      .first<ReviewRow>();
    return c.json(toReview(row!), 201);
  })

  .delete("/reviews/:id", async (c) => {
    const user = requireUser(c);
    const row = await c.env.DB.prepare("SELECT * FROM review_notes WHERE id = ?")
      .bind(c.req.param("id"))
      .first<ReviewRow>();
    if (!row) throw new HttpError(404, "This note no longer exists.");
    if (row.author_id !== user.id && !isManager(user)) {
      throw new HttpError(403, "You can only remove your own notes.");
    }
    await c.env.DB.prepare("DELETE FROM review_notes WHERE id = ?").bind(row.id).run();
    return c.body(null, 204);
  });

interface ReviewRow {
  id: string;
  event_slug: string;
  kind: ReviewNote["kind"];
  text: string;
  author_id: string | null;
  created_at: string;
}

/** Notes of removed members are kept with the placeholder author "former-member". */
function toReview(row: ReviewRow): ReviewNote {
  return {
    id: row.id,
    eventSlug: row.event_slug,
    kind: row.kind,
    text: row.text,
    authorId: row.author_id ?? "former-member",
    createdAt: row.created_at,
  };
}
