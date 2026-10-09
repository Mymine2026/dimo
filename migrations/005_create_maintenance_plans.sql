CREATE TABLE IF NOT EXISTS maintenance_plans (
  id              SERIAL PRIMARY KEY,
  vehicle_id      INTEGER NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  name            VARCHAR(80) NOT NULL,
  interval_km     INTEGER,
  interval_months INTEGER,
  last_done_km    INTEGER,
  last_done_date  DATE,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (interval_km IS NOT NULL OR interval_months IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS maintenance_plans_vehicle_idx ON maintenance_plans (vehicle_id);
