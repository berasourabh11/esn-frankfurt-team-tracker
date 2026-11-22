import type { Context } from "hono";
import type { z } from "zod";

import type { Env } from "./db";
import type { AccountStatus, MemberRole } from "./shared";

export interface UserRow {
  id: string;
  name: string;
  email: string;
  role: MemberRole;
  status: AccountStatus;
  team: string | null;
  password_hash: string;
  created_at: string;
  updated_at: string;
}

export type AppEnv = { Bindings: Env; Variables: { user: UserRow | null } };
export type AppContext = Context<AppEnv>;

export class HttpError extends Error {
  constructor(
    readonly status: 400 | 401 | 403 | 404 | 409 | 429,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
  }
}

/** Members (role "member") manage events, shifts, tasks, hosts and notes. */
export const isManager = (user: UserRow | null) =>
  user?.status === "active" && (user.role === "member" || user.role === "admin");

export const isModerator = (user: UserRow | null) =>
  user?.status === "active" && (user.role === "moderator" || user.role === "admin");

/** The signed-in user if their account is accepted (pending accounts count as visitors). */
export function activeUser(c: AppContext): UserRow | null {
  const user = c.get("user");
  return user?.status === "active" ? user : null;
}

/** Any signed-in account, including ones still waiting for approval. */
export function requireAccount(c: AppContext): UserRow {
  const user = c.get("user");
  if (!user) throw new HttpError(401, "Please sign in first.");
  return user;
}

/** A signed-in, accepted account (moderator, member or user). */
export function requireUser(c: AppContext): UserRow {
  const user = requireAccount(c);
  if (user.status !== "active") {
    throw new HttpError(403, "Your account is waiting for a moderator to accept it.");
  }
  return user;
}

/** Members: manage events, shifts, tasks, hosts and notes. */
export function requireManager(c: AppContext): UserRow {
  const user = requireUser(c);
  if (!isManager(user)) throw new HttpError(403, "Only members of the ESN team can do this.");
  return user;
}

/** Moderators: accept registrations, decide roles, remove accounts. */
export function requireModerator(c: AppContext): UserRow {
  const user = requireUser(c);
  if (!isModerator(user)) throw new HttpError(403, "Only moderators can manage people.");
  return user;
}

/** Reads and validates a JSON body. */
export async function readBody<S extends z.ZodType>(
  c: AppContext,
  schema: S,
): Promise<z.output<S>> {
  let data: unknown;
  try {
    data = await c.req.json();
  } catch {
    throw new HttpError(400, "Send a JSON body.");
  }
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new HttpError(
      400,
      result.error.issues[0]?.message ?? "Invalid data.",
      result.error.issues,
    );
  }
  return result.data;
}

/** Drops null/undefined values so JSON matches the frontend's optional fields. */
export function compact<T extends Record<string, unknown>>(value: T) {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value)) if (v !== null && v !== undefined) out[k] = v;
  return out as { [K in keyof T]: Exclude<T[K], null> };
}
