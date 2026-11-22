import { Hono } from "hono";
import { z } from "zod";

import { HttpError, readBody, requireAccount, type AppEnv, type UserRow } from "../http";
import { DUMMY_HASH, MIN_PASSWORD_LENGTH, hashPassword, verifyPassword } from "../lib/password";
import { endOtherSessions, endSession, startSession } from "../lib/session";
import { newId, nowIso } from "../lib/util";
import { RegisterSchema } from "../shared";
import { assertEmailFree, getUser, toMember } from "./members";

/** Simple flood protection: new registrations pause while this many wait for approval. */
const MAX_PENDING = 200;

/** After this many wrong passwords within the window, sign-in is paused. */
const MAX_FAILURES = 10;
const FAILURE_WINDOW_MS = 15 * 60 * 1000;

const LoginSchema = z.object({
  email: z.string().trim().toLowerCase().max(200),
  password: z.string().max(200),
});

const ChangePasswordSchema = z.object({
  currentPassword: z.string().max(200),
  newPassword: z
    .string()
    .min(MIN_PASSWORD_LENGTH, `Use at least ${MIN_PASSWORD_LENGTH} characters`)
    .max(200),
});

export const authRoutes = new Hono<AppEnv>()
  /**
   * Anyone can register. The account is "pending": the person is signed in
   * but only sees "waiting for approval" until a moderator accepts them.
   */
  .post("/auth/register", async (c) => {
    const body = await readBody(c, RegisterSchema);
    const db = c.env.DB;
    const pending = await db
      .prepare("SELECT COUNT(*) AS n FROM users WHERE status = 'pending'")
      .first<{ n: number }>();
    if ((pending?.n ?? 0) >= MAX_PENDING) {
      throw new HttpError(429, "Registrations are paused right now. Please try again later.");
    }
    await assertEmailFree(c, body.email);
    const id = newId("m");
    const now = nowIso();
    await db
      .prepare(
        `INSERT INTO users (id, name, email, role, status, password_hash, created_at, updated_at)
         VALUES (?, ?, ?, 'user', 'pending', ?, ?, ?)`,
      )
      .bind(id, body.name, body.email, await hashPassword(body.password), now, now)
      .run();
    await startSession(c, id);
    return c.json(toMember(await getUser(c, id), { email: true }), 201);
  })

  .post("/auth/login", async (c) => {
    const { email, password } = await readBody(c, LoginSchema);
    const db = c.env.DB;

    const failures = await db
      .prepare("SELECT count, first_at FROM login_failures WHERE email = ?")
      .bind(email)
      .first<{ count: number; first_at: string }>();
    const windowOpen = failures && Date.now() - Date.parse(failures.first_at) < FAILURE_WINDOW_MS;
    if (windowOpen && failures.count >= MAX_FAILURES) {
      throw new HttpError(429, "Too many attempts. Try again in 15 minutes.");
    }

    const user = await db
      .prepare("SELECT * FROM users WHERE email = ?")
      .bind(email)
      .first<UserRow>();
    const ok = await verifyPassword(password, user?.password_hash ?? DUMMY_HASH);

    if (!user || !ok) {
      await db
        .prepare(
          `INSERT INTO login_failures (email, count, first_at) VALUES (?1, 1, ?2)
           ON CONFLICT (email) DO UPDATE SET
             count = CASE WHEN ?3 THEN count + 1 ELSE 1 END,
             first_at = CASE WHEN ?3 THEN first_at ELSE ?2 END`,
        )
        .bind(email, nowIso(), windowOpen ? 1 : 0)
        .run();
      throw new HttpError(401, "Wrong e-mail or password.");
    }

    await db.prepare("DELETE FROM login_failures WHERE email = ?").bind(email).run();
    await startSession(c, user.id);
    return c.json(toMember(user, { email: true }));
  })

  .post("/auth/logout", async (c) => {
    await endSession(c);
    return c.body(null, 204);
  })

  // Also answers for pending accounts (status "pending").
  .get("/auth/me", (c) => c.json(toMember(requireAccount(c), { email: true })))

  .post("/auth/password", async (c) => {
    const user = requireAccount(c);
    const body = await readBody(c, ChangePasswordSchema);
    if (!(await verifyPassword(body.currentPassword, user.password_hash))) {
      throw new HttpError(400, "Your current password is not correct.");
    }
    await c.env.DB.prepare("UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?")
      .bind(await hashPassword(body.newPassword), nowIso(), user.id)
      .run();
    await endOtherSessions(c, c.env.DB, user.id);
    return c.body(null, 204);
  });
