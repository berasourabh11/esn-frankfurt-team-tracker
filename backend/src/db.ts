/**
 * The subset of Cloudflare D1's API the app uses. In production this is the
 * real D1 binding; locally (Node) it is a SQLite file with the same API
 * (see `sqlite.ts`). D1 is SQLite, so the SQL is identical in both.
 */
export type SqlValue = string | number | null;

export interface Statement {
  bind(...values: SqlValue[]): Statement;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<{ results: T[] }>;
  run(): Promise<{ meta: { changes: number } }>;
}

export interface Database {
  prepare(sql: string): Statement;
  /** Runs statements in one transaction (all succeed or none). */
  batch(statements: Statement[]): Promise<unknown[]>;
}

export interface Env {
  DB: Database;
  /** Comma-separated frontend origins allowed to call the API. */
  ALLOWED_ORIGINS?: string;
  /** "Lax" (default) or "None" when the frontend is on another site. */
  COOKIE_SAMESITE?: string;
  /** "false" only for plain-http setups other than localhost. */
  COOKIE_SECURE?: string;
  /** The website address, used for event links in the calendar feed. */
  SITE_URL?: string;
}
