CREATE TABLE IF NOT EXISTS vehicle_assignments (
  id         SERIAL PRIMARY KEY,
  vehicle_id INTEGER NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  start_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  end_at     TIMESTAMPTZ,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (end_at IS NULL OR end_at > start_at)
);

-- at most one open assignment (current driver) per vehicle
CREATE UNIQUE INDEX IF NOT EXISTS vehicle_assignments_one_open ON vehicle_assignments (vehicle_id) WHERE end_at IS NULL;
CREATE INDEX IF NOT EXISTS vehicle_assignments_vehicle_idx ON vehicle_assignments (vehicle_id, start_at DESC);
