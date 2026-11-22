-- Sub-events: an event can belong to a main event (e.g. the nights of a
-- themed weekend). One level only; enforced by the API. Removing the main
-- event keeps its sub-events as stand-alone events.
ALTER TABLE events ADD COLUMN parent_slug TEXT REFERENCES events (slug) ON DELETE SET NULL;
CREATE INDEX events_parent_idx ON events (parent_slug);
