CREATE TABLE IF NOT EXISTS telemetry (
  id              BIGSERIAL PRIMARY KEY,
  vehicle_id      INTEGER NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  recorded_at     TIMESTAMPTZ NOT NULL,
  latitude        DOUBLE PRECISION,
  longitude       DOUBLE PRECISION,
  speed           DOUBLE PRECISION,
  odometer_km     DOUBLE PRECISION,
  fuel_level      DOUBLE PRECISION,
  engine_rpm      DOUBLE PRECISION,
  coolant_temp    DOUBLE PRECISION,
  battery_voltage DOUBLE PRECISION,
  ignition_on     BOOLEAN,
  raw             JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (vehicle_id, recorded_at)
);

CREATE INDEX IF NOT EXISTS telemetry_vehicle_time_idx ON telemetry (vehicle_id, recorded_at DESC);
