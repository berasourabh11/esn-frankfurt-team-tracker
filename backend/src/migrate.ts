import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import type { openSqlite } from "./sqlite";

type LocalDb = ReturnType<typeof openSqlite>;

/**
 * Applies migrations/*.sql in order to a local SQLite database, tracking
 * them in `d1_migrations` like `wrangler d1 migrations apply` does on D1.
 */
export async function applyMigrations(db: LocalDb, dir: string) {
  db.exec(
    "CREATE TABLE IF NOT EXISTS d1_migrations (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE, applied_at TEXT NOT NULL)",
  );
  const { results } = await db.prepare("SELECT name FROM d1_migrations").all<{ name: string }>();
  const applied = new Set(results.map((r) => r.name));
  const files = readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  for (const file of files) {
    if (applied.has(file)) continue;
    // Foreign keys are off while a migration runs, so rebuilding a table
    // (SQLite's way to change constraints) doesn't cascade-delete rows.
    // They are checked again before the migration is committed.
    db.exec("PRAGMA foreign_keys = OFF;");
    db.exec("BEGIN");
    try {
      db.exec(readFileSync(join(dir, file), "utf8"));
      const broken = await db.prepare("PRAGMA foreign_key_check").all();
      if (broken.results.length) {
        throw new Error(`Migration ${file} breaks ${broken.results.length} foreign key(s)`);
      }
      await db
        .prepare("INSERT INTO d1_migrations (name, applied_at) VALUES (?, ?)")
        .bind(file, new Date().toISOString())
        .run();
      db.exec("COMMIT");
      console.log(`Applied migration ${file}`);
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    } finally {
      db.exec("PRAGMA foreign_keys = ON;");
    }
  }
}

/** Loads a seed file once, when the database has no users yet. */
export async function seedIfEmpty(db: LocalDb, file: string) {
  const row = await db.prepare("SELECT COUNT(*) AS n FROM users").first<{ n: number }>();
  if ((row?.n ?? 0) > 0 || !existsSync(file)) return false;
  db.exec("BEGIN");
  try {
    db.exec(readFileSync(file, "utf8"));
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
  return true;
}
