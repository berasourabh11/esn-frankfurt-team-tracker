import { deleteCookie, getCookie, setCookie } from "hono/cookie";

import type { Database } from "../db";
import type { AppContext, UserRow } from "../http";
import { nowIso, randomToken, sha256Hex } from "./util";

/**
 * Cookie sessions. The browser keeps a random token in an HttpOnly cookie;
 * the database only stores its SHA-256 hash, so a leaked database can't be
 * used to sign in.
 */
export const SESSION_COOKIE = "esn_session";
const SESSION_DAYS = 30;

function cookieOptions(c: AppContext) {
  const sameSite = c.env.COOKIE_SAMESITE?.toLowerCase() === "none" ? "None" : "Lax";
  const secure = sameSite === "None" || c.env.COOKIE_SECURE !== "false";
  return { httpOnly: true, secure, sameSite, path: "/" } as const;
}

export async function startSession(c: AppContext, userId: string) {
  const token = randomToken();
  const expires = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await c.env.DB.prepare(
    "INSERT INTO sessions (id, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)",
  )
    .bind(await sha256Hex(token), userId, expires.toISOString(), nowIso())
    .run();
  setCookie(c, SESSION_COOKIE, token, { ...cookieOptions(c), expires });
}

export async function endSession(c: AppContext) {
  const token = getCookie(c, SESSION_COOKIE);
  if (token) {
    await c.env.DB.prepare("DELETE FROM sessions WHERE id = ?")
      .bind(await sha256Hex(token))
      .run();
  }
  deleteCookie(c, SESSION_COOKIE, cookieOptions(c));
}

export async function loadSessionUser(c: AppContext): Promise<UserRow | null> {
  const token = getCookie(c, SESSION_COOKIE);
  if (!token) return null;
  return c.env.DB.prepare(
    `SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.id = ? AND s.expires_at > ?`,
  )
    .bind(await sha256Hex(token), nowIso())
    .first<UserRow>();
}

/** Signs a user out everywhere, optionally keeping the current session. */
export async function endOtherSessions(c: AppContext, db: Database, userId: string) {
  const token = getCookie(c, SESSION_COOKIE);
  const keep = token ? await sha256Hex(token) : "";
  await db.prepare("DELETE FROM sessions WHERE user_id = ? AND id <> ?").bind(userId, keep).run();
}
