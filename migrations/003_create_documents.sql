CREATE TABLE IF NOT EXISTS documents (
  id         SERIAL PRIMARY KEY,
  vehicle_id INTEGER REFERENCES admin_vehicles(id) ON DELETE SET NULL,
  user_id    INTEGER REFERENCES users(id) ON DELETE SET NULL,
  company_id INTEGER REFERENCES companies(id) ON DELETE SET NULL,
  name       VARCHAR(255) NOT NULL,
  type       VARCHAR(50) DEFAULT 'other',
  notes      TEXT,
  file_url   TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
