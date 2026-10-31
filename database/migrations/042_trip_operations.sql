BEGIN;
CREATE TABLE IF NOT EXISTS trip_operation_items (
 id BIGSERIAL PRIMARY KEY,
 trip_id INTEGER NOT NULL REFERENCES viajes(id_viajes),
 kind TEXT NOT NULL CHECK (kind IN ('companion','trailer')),
 name TEXT NOT NULL,
 trailer_id INTEGER REFERENCES vehiculos(id_vehiculos),
 inspection JSONB,
 initial_key TEXT,
 added_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
 added_latitude DOUBLE PRECISION,
 added_longitude DOUBLE PRECISION,
 removed_at TIMESTAMPTZ,
 removed_latitude DOUBLE PRECISION,
 removed_longitude DOUBLE PRECISION,
 UNIQUE(trip_id, initial_key)
);
CREATE UNIQUE INDEX IF NOT EXISTS trip_operation_active_trailer ON trip_operation_items(trip_id,trailer_id)
 WHERE kind='trailer' AND removed_at IS NULL;
CREATE TABLE IF NOT EXISTS trip_operation_events (
 id BIGSERIAL PRIMARY KEY,
 event_key TEXT NOT NULL UNIQUE,
 trip_id INTEGER NOT NULL REFERENCES viajes(id_viajes),
 item_id BIGINT NOT NULL REFERENCES trip_operation_items(id),
 event_type TEXT NOT NULL CHECK (event_type IN ('COMPANION_ADDED','COMPANION_DROPPED_OFF','TRAILER_ATTACHED','TRAILER_DETACHED')),
 payload JSONB NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
 sent_at TIMESTAMPTZ,
 attempts INTEGER NOT NULL DEFAULT 0,
 next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
 last_error TEXT
);
CREATE INDEX IF NOT EXISTS trip_operation_events_pending ON trip_operation_events(next_attempt_at) WHERE sent_at IS NULL;
COMMIT;
