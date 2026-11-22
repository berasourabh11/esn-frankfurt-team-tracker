import { Hono } from "hono";
import { z } from "zod";

import {
  HttpError,
  activeUser,
  compact,
  isModerator,
  readBody,
  requireModerator,
  requireUser,
  type AppContext,
  type AppEnv,
  type UserRow,
} from "../http";
import { MIN_PASSWORD_LENGTH, hashPassword } from "../lib/password";
import { endOtherSessions } from "../lib/session";
import { newId, nowIso, orNull } from "../lib/util";
import { MemberRoleSchema, type Member } from "../shared";
import { loadTasks } from "./tasks";

/**
 * People and their roles.
 *   admin     – everything (moderator + member)
 *   moderator – accepts registrations, decides roles, removes accounts
 *   member    – events, shifts/tasks, hosts, notes
 *   user      – join/leave shifts, tick off own tasks, review notes
 * Self-registered accounts are "pending" until a moderator accepts them.
 */
export function toMember(
  row: UserRow,
  { email = false, admin = false }: { email?: boolean; admin?: boolean } = {},
): Member {
  return compact({
    id: row.id,
    name: row.name,
    email: email ? row.email : undefined,
    role: row.role,
    team: row.team,
    status: row.status,
    createdAt: admin ? row.created_at : undefined,
  }) as Member;
}

const MemberFields = {
  name: z.string().trim().min(2, "Enter the member's name").max(80),
  email: z.string().trim().toLowerCase().pipe(z.email("Enter a valid e-mail address")),
  role: MemberRoleSchema,
  team: z.string().trim().max(60).nullable().optional(),
  password: z
    .string()
    .min(MIN_PASSWORD_LENGTH, `Use at least ${MIN_PASSWORD_LENGTH} characters for the password`)
    .max(200),
};

const MemberCreateSchema = z.object(MemberFields);
const MemberUpdateSchema = z.object(MemberFields).partial();
const ApproveSchema = z.object({ role: MemberRoleSchema });

export async function getUser(c: AppContext, id: string) {
  const user = await c.env.DB.prepare("SELECT * FROM users WHERE id = ?").bind(id).first<UserRow>();
  if (!user) throw new HttpError(404, "This person no longer has an account.");
  return user;
}

export async function assertEmailFree(c: AppContext, email: string, exceptId = "") {
  const taken = await c.env.DB.prepare("SELECT id FROM users WHERE email = ? AND id <> ?")
    .bind(email, exceptId)
    .first();
  if (taken) throw new HttpError(409, "That e-mail address already has an account.");
}

/** There is always at least one active moderator, so people can still be accepted. */
async function assertNotLastModerator(c: AppContext, user: UserRow) {
  if (!isModerator(user)) return;
  const row = await c.env.DB.prepare(
    "SELECT COUNT(*) AS n FROM users WHERE role IN ('moderator', 'admin') AND status = 'active'",
  ).first<{ n: number }>();
  if ((row?.n ?? 0) <= 1) {
    throw new HttpError(409, "There must always be at least one moderator.");
  }
}

export const memberRoutes = new Hono<AppEnv>()
  /**
   * - Moderators: everyone, including pending registrations.
   * - Accepted accounts: all accepted people, with e-mail.
   * - Visitors (and pending accounts): event hosts only, without e-mail,
   *   because host names are shown on public event pages.
   */
  .get("/members", async (c) => {
    const user = activeUser(c);
    const moderator = isModerator(user);
    const sql = moderator
      ? "SELECT * FROM users ORDER BY status = 'active', name COLLATE NOCASE"
      : user
        ? "SELECT * FROM users WHERE status = 'active' ORDER BY name COLLATE NOCASE"
        : `SELECT DISTINCT u.* FROM users u JOIN event_hosts h ON h.user_id = u.id
           WHERE u.status = 'active' ORDER BY u.name COLLATE NOCASE`;
    const { results } = await c.env.DB.prepare(sql).all<UserRow>();
    return c.json(results.map((row) => toMember(row, { email: Boolean(user), admin: moderator })));
  })

  .get("/members/:id", async (c) => {
    const viewer = requireUser(c);
    const target = await getUser(c, c.req.param("id"));
    if (target.status !== "active" && !isModerator(viewer)) {
      throw new HttpError(404, "This person no longer has an account.");
    }
    return c.json(toMember(target, { email: true, admin: isModerator(viewer) }));
  })

  /** Moderators can also create accounts directly (accepted right away). */
  .post("/members", async (c) => {
    requireModerator(c);
    const body = await readBody(c, MemberCreateSchema);
    await assertEmailFree(c, body.email);
    const id = newId("m");
    const now = nowIso();
    await c.env.DB.prepare(
      `INSERT INTO users (id, name, email, role, status, team, password_hash, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'active', ?, ?, ?, ?)`,
    )
      .bind(
        id,
        body.name,
        body.email,
        body.role,
        orNull(body.team || null),
        await hashPassword(body.password),
        now,
        now,
      )
      .run();
    return c.json(toMember(await getUser(c, id), { email: true, admin: true }), 201);
  })

  /** Accepts a registration and decides the person's role. */
  .post("/members/:id/approve", async (c) => {
    requireModerator(c);
    const target = await getUser(c, c.req.param("id"));
    const { role } = await readBody(c, ApproveSchema);
    await c.env.DB.prepare(
      "UPDATE users SET status = 'active', role = ?, updated_at = ? WHERE id = ?",
    )
      .bind(role, nowIso(), target.id)
      .run();
    return c.json(toMember(await getUser(c, target.id), { email: true, admin: true }));
  })

  /** Moderators edit anyone; everyone may change their own name and team. */
  .patch("/members/:id", async (c) => {
    const viewer = requireUser(c);
    const target = await getUser(c, c.req.param("id"));
    const body = await readBody(c, MemberUpdateSchema);
    const isSelf = viewer.id === target.id;

    if (!isModerator(viewer)) {
      const ownFields = Object.keys(body).every((k) => k === "name" || k === "team");
      if (!isSelf || !ownFields) throw new HttpError(403, "Only moderators can manage people.");
    }
    if (body.role && body.role !== "moderator" && body.role !== "admin") {
      await assertNotLastModerator(c, target);
    }
    if (body.email) await assertEmailFree(c, body.email, target.id);

    const next = {
      name: body.name ?? target.name,
      email: body.email ?? target.email,
      role: body.role ?? target.role,
      team: body.team === undefined ? target.team : body.team || null,
      password_hash: body.password ? await hashPassword(body.password) : target.password_hash,
    };
    await c.env.DB.prepare(
      `UPDATE users SET name = ?, email = ?, role = ?, team = ?, password_hash = ?, updated_at = ?
       WHERE id = ?`,
    )
      .bind(next.name, next.email, next.role, next.team, next.password_hash, nowIso(), target.id)
      .run();
    // A new password signs the person out on their other devices.
    if (body.password) await endOtherSessions(c, c.env.DB, target.id);
    return c.json(
      toMember(await getUser(c, target.id), { email: true, admin: isModerator(viewer) }),
    );
  })

  /** Removes an account, or rejects a pending registration. */
  .delete("/members/:id", async (c) => {
    const viewer = requireModerator(c);
    const target = await getUser(c, c.req.param("id"));
    if (target.id === viewer.id) throw new HttpError(400, "You can't remove your own account.");
    await assertNotLastModerator(c, target);
    // Sessions, shift assignments and hosting are removed with the person;
    // review notes and created events are kept.
    await c.env.DB.prepare("DELETE FROM users WHERE id = ?").bind(target.id).run();
    return c.body(null, 204);
  })

  .get("/members/:id/tasks", async (c) => {
    requireUser(c);
    const id = c.req.param("id");
    return c.json(
      await loadTasks(c.env.DB, "id IN (SELECT task_id FROM task_assignees WHERE user_id = ?)", [
        id,
      ]),
    );
  });
