import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { serve } from "@hono/node-server";

import { createApp } from "./app";
import type { Env } from "./db";
import { applyMigrations, seedIfEmpty } from "./migrate";
import { openSqlite } from "./sqlite";

/**
 * Local development server: runs the same app as the Cloudflare Worker on
 * Node, with a SQLite file (.data/esn.sqlite) in place of D1.
 */
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dbFile = process.env.DB_FILE ?? join(root, ".data", "esn.sqlite");
const port = Number(process.env.PORT ?? 8787);

if (dbFile !== ":memory:") mkdirSync(dirname(dbFile), { recursive: true });
const db = openSqlite(dbFile);
await applyMigrations(db, join(root, "migrations"));
if (await seedIfEmpty(db, join(root, "seed", "demo.sql"))) {
  console.log("Loaded demo data (password for every demo account: esn-demo-2026)");
}

const env: Env = {
  DB: db,
  ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS ?? "http://localhost:3000,http://localhost:3100",
  COOKIE_SAMESITE: "Lax",
  SITE_URL: process.env.SITE_URL ?? "http://localhost:3000",
};

const app = createApp();
serve({ fetch: (request) => app.fetch(request, env), port }, (info) => {
  console.log(`ESN Frankfurt API on http://localhost:${info.port} (database: ${dbFile})`);
});
