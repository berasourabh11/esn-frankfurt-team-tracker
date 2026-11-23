-- Repeating events (e.g. a weekly Language Café). A series is stored once,
-- with its rule; the API generates its dates when events are loaded, so a
-- weekly event doesn't need a row per week.
--
-- A date only gets its own row in `events` (series_id + series_date) once it
-- is changed on its own or gets shifts, notes or hosts. Removed dates are
-- listed in excluded_dates. Removing the series removes all its dates.
CREATE TABLE event_series (
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
  frequency        TEXT NOT NULL CHECK (frequency IN ('weekly', 'monthly')),
  repeat_every     INTEGER NOT NULL CHECK (repeat_every BETWEEN 1 AND 12),
  monthly_by       TEXT CHECK (monthly_by IN ('weekday', 'day')),
  until_date       TEXT,
  occurrence_count INTEGER,
  excluded_dates   TEXT NOT NULL DEFAULT '[]',
  created_by       TEXT REFERENCES users (id) ON DELETE SET NULL,
  created_at       TEXT NOT NULL,
  updated_at       TEXT NOT NULL
);

-- Default hosts of every date of a series.
CREATE TABLE event_series_hosts (
  series_id TEXT NOT NULL REFERENCES event_series (id) ON DELETE CASCADE,
  user_id   TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  PRIMARY KEY (series_id, user_id)
);

ALTER TABLE events ADD COLUMN series_id TEXT REFERENCES event_series (id) ON DELETE CASCADE;
ALTER TABLE events ADD COLUMN series_date TEXT;
CREATE UNIQUE INDEX events_series_date_idx ON events (series_id, series_date);
