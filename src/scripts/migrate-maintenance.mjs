import pkg from 'pg';
const { Pool } = pkg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

console.log('Running maintenance migration...');
try {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS maintenance (
      id               SERIAL PRIMARY KEY,
      vehicle_id       INTEGER REFERENCES vehicles(id) ON DELETE CASCADE,
      type             VARCHAR(50) NOT NULL,
      date             DATE,
      km_at_service    INTEGER,
      next_service_km  INTEGER,
      notes            TEXT,
      created_at       TIMESTAMP DEFAULT NOW()
    )
  `);
  console.log('✓ maintenance table ready');
} catch (err) {
  console.error('Migration failed:', err.message);
  process.exit(1);
} finally {
  await pool.end();
}
