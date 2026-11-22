import { DatabaseSync } from "node:sqlite";

import type { Database, SqlValue, Statement } from "./db";

/**
 * D1-compatible wrapper around Node's built-in SQLite, used for local
 * development and tests. Mirrors D1's behaviour where it matters:
 * foreign keys are enforced, `undefined` is rejected, `batch` is atomic.
 */
export function openSqlite(path = ":memory:"): Database & { exec(sql: string): void } {
  const db = new DatabaseSync(path);
  db.exec("PRAGMA foreign_keys = ON;");
  if (path !== ":memory:") db.exec("PRAGMA journal_mode = WAL;");

  class SqliteStatement implements Statement {
    constructor(
      readonly sql: string,
      readonly values: SqlValue[] = [],
    ) {}
    bind(...values: SqlValue[]) {
      values.forEach((v, i) => {
        if (v === undefined) throw new TypeError(`Bind value ${i + 1} is undefined: ${this.sql}`);
      });
      return new SqliteStatement(this.sql, values);
    }
    async first<T>() {
      const row = db.prepare(this.sql).get(...this.values);
      return row ? ({ ...row } as T) : null;
    }
    async all<T>() {
      return {
        results: db
          .prepare(this.sql)
          .all(...this.values)
          .map((r) => ({ ...r }) as T),
      };
    }
    async run() {
      return this.runSync();
    }
    runSync() {
      const result = db.prepare(this.sql).run(...this.values);
      return { meta: { changes: Number(result.changes) } };
    }
  }

  return {
    prepare: (sql) => new SqliteStatement(sql),
    async batch(statements) {
      db.exec("BEGIN");
      try {
        const out = statements.map((s) => (s as SqliteStatement).runSync());
        db.exec("COMMIT");
        return out;
      } catch (error) {
        db.exec("ROLLBACK");
        throw error;
      }
    },
    exec: (sql) => db.exec(sql),
  };
}
