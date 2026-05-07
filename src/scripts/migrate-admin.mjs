import pkg from 'pg';
const { Pool } = pkg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

console.log('Running admin migration...');

try {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS vehicle_users (
      vehicle_id INTEGER REFERENCES vehicles(id) ON DELETE CASCADE,
      user_id    INTEGER REFERENCES users(id)    ON DELETE CASCADE,
      PRIMARY KEY (vehicle_id, user_id)
    )
  `);
  console.log('✓ vehicle_users table ready');

  const { rowCount } = await pool.query(`
    INSERT INTO vehicle_users (vehicle_id, user_id)
    SELECT id, user_id FROM vehicles WHERE user_id IS NOT NULL
    ON CONFLICT DO NOTHING
  `);
  console.log(`✓ Migrated ${rowCount} existing vehicle-user associations`);

  await pool.query(`ALTER TABLE vehicles DROP COLUMN IF EXISTS user_id`);
  console.log('✓ Dropped vehicles.user_id column');

  console.log('Migration complete!');
} catch (err) {
  console.error('Migration failed:', err.message);
  process.exit(1);
} finally {
  await pool.end();
}
