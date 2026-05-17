require('dotenv').config();
const fs = require('fs');
const { Pool } = require('pg');

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

async function run() {
  try {
    // Ensure the base table exists before the migration tries to alter it
    await pool.query(`
      CREATE TABLE IF NOT EXISTS lawyer_schedule_overrides (
        id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        lawyer_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        override_date DATE NOT NULL,
        is_off        BOOLEAN DEFAULT true,
        slots         JSONB DEFAULT '[]'::jsonb,
        created_at    TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(lawyer_id, override_date)
      )
    `);

    const sql = fs.readFileSync('../backendV4/migrations/003_service_type_availability.sql', 'utf8');
    await pool.query(sql);
    console.log('Migration completed successfully.');
  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    pool.end();
  }
}

run();
