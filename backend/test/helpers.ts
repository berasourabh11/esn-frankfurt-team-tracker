import { readFileSync } from "node:fs";
import { join } from "node:path";

import { createApp } from "../src/app";
import type { Env } from "../src/db";
import { applyMigrations } from "../src/migrate";
import { openSqlite } from "../src/sqlite";

const root = join(import.meta.dirname, "..");
export const FRONTEND = "http://localhost:3000";
export const DEMO_PASSWORD = "esn-demo-2026";

/** A fresh in-memory database with the demo seed, and a client for the app. */
export async function setup() {
  const db = openSqlite(":memory:");
  await applyMigrations(db, join(root, "migrations"));
  db.exec(readFileSync(join(root, "seed", "demo.sql"), "utf8"));
  const env: Env = { DB: db, ALLOWED_ORIGINS: FRONTEND, SITE_URL: FRONTEND };
  const app = createApp();

  async function call(
    method: string,
    path: string,
    {
      body,
      cookie,
      origin = FRONTEND,
    }: { body?: unknown; cookie?: string; origin?: string | null } = {},
  ) {
    const headers: Record<string, string> = { Accept: "application/json" };
    if (body !== undefined) headers["Content-Type"] = "application/json";
    if (cookie) headers.Cookie = cookie;
    if (origin) headers.Origin = origin;
    const response = await app.request(
      `http://api.test${path}`,
      { method, headers, body: body === undefined ? undefined : JSON.stringify(body) },
      env,
    );
    const text = await response.text();
    return {
      status: response.status,
      headers: response.headers,
      data: text ? JSON.parse(text) : null,
    };
  }

  /** Signs in and returns the session cookie ("esn_session=…"). */
  async function login(email: string, password = DEMO_PASSWORD) {
    const response = await app.request(
      "http://api.test/api/auth/login",
      {
        method: "POST",
        headers: { "Content-Type": "application/json", Origin: FRONTEND },
        body: JSON.stringify({ email, password }),
      },
      env,
    );
    if (response.status !== 200) throw new Error(`Login failed: ${response.status}`);
    return response.headers.get("set-cookie")!.split(";")[0];
  }

  /** Plain GET without JSON parsing (e.g. the .ics feed). */
  async function raw(path: string) {
    const response = await app.request(`http://api.test${path}`, {}, env);
    return { status: response.status, headers: response.headers, text: await response.text() };
  }

  return { db, call, login, raw };
}

export const emails = {
  moderator: "lena@esn-frankfurt.example",
  member: "aisha@esn-frankfurt.example",
  user: "lucas@esn-frankfurt.example",
  user2: "yuki@esn-frankfurt.example",
};
