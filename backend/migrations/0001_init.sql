-- ESN Frankfurt: users, roles, sessions, events and team data.
-- D1 enforces foreign keys, so ON DELETE rules below are applied.

CREATE TABLE users (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE COLLATE NOCASE,
  role          TEXT NOT NULL CHECK (role IN ('board', 'organiser', 'volunteer')),
  team          TEXT,
  password_hash TEXT NOT NULL,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);

-- Login sessions. Only a SHA-256 hash of the cookie token is stored.
CREATE TABLE sessions (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX sessions_user_idx ON sessions (user_id);

-- Failed sign-in attempts per e-mail address (brute-force protection).
CREATE TABLE login_failures (
  email      TEXT PRIMARY KEY COLLATE NOCASE,
  count      INTEGER NOT NULL,
  first_at   TEXT NOT NULL
);

CREATE TABLE events (
  id               TEXT PRIMARY KEY,
  slug             TEXT NOT NULL UNIQUE,
  title            TEXT NOT NULL,
  summary          TEXT NOT NULL,
  description      TEXT NOT NULL,
  category         TEXT NOT NULL CHECK (category IN ('social', 'parties', 'trips', 'sports', 'cultural', 'workshops', 'other')),
  status           TEXT NOT NULL CHECK (status IN ('scheduled', 'tentative', 'cancelled')),
  start_date       TEXT NOT NULL,
  end_date         TEXT,
  start_time       TEXT,
  end_time         TEXT,
  location         TEXT,
  price_info       TEXT,
  registration_url TEXT,
  image_url        TEXT,
  tags             TEXT NOT NULL DEFAULT '[]',
  created_by       TEXT REFERENCES users (id) ON DELETE SET NULL,
  created_at       TEXT NOT NULL,
  updated_at       TEXT NOT NULL
);
CREATE INDEX events_start_idx ON events (start_date);

-- Hosts are shown publicly; notes and links only to team members.
CREATE TABLE event_hosts (
  event_slug TEXT NOT NULL REFERENCES events (slug) ON DELETE CASCADE,
  user_id    TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  PRIMARY KEY (event_slug, user_id)
);

CREATE TABLE event_team_info (
  event_slug TEXT PRIMARY KEY REFERENCES events (slug) ON DELETE CASCADE,
  notes      TEXT NOT NULL DEFAULT '',
  links      TEXT NOT NULL DEFAULT '[]',
  updated_at TEXT,
  updated_by TEXT REFERENCES users (id) ON DELETE SET NULL
);

CREATE TABLE tasks (
  id            TEXT PRIMARY KEY,
  event_slug    TEXT NOT NULL REFERENCES events (slug) ON DELETE CASCADE,
  kind          TEXT NOT NULL CHECK (kind IN ('shift', 'task')),
  title         TEXT NOT NULL,
  description   TEXT NOT NULL DEFAULT '',
  date          TEXT,
  start_time    TEXT,
  end_time      TEXT,
  location      TEXT,
  people_needed INTEGER NOT NULL CHECK (people_needed BETWEEN 1 AND 50),
  done          INTEGER NOT NULL DEFAULT 0,
  created_by    TEXT REFERENCES users (id) ON DELETE SET NULL,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);
CREATE INDEX tasks_event_idx ON tasks (event_slug);

CREATE TABLE task_assignees (
  task_id     TEXT NOT NULL REFERENCES tasks (id) ON DELETE CASCADE,
  user_id     TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  assigned_at TEXT NOT NULL,
  PRIMARY KEY (task_id, user_id)
);
CREATE INDEX task_assignees_user_idx ON task_assignees (user_id);

-- Post-event review notes. Notes stay when their author is removed.
CREATE TABLE review_notes (
  id         TEXT PRIMARY KEY,
  event_slug TEXT NOT NULL REFERENCES events (slug) ON DELETE CASCADE,
  kind       TEXT NOT NULL CHECK (kind IN ('went-well', 'improve')),
  text       TEXT NOT NULL,
  author_id  TEXT REFERENCES users (id) ON DELETE SET NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX review_notes_event_idx ON review_notes (event_slug);
