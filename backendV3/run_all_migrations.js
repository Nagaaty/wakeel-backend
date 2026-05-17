require('dotenv').config();
const fs = require('fs');
const pool = require('./src/config/db');

async function run() {
  try {
    // 1. Ensure base table exists
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
    
    // 2. Run 003
    const sql003 = fs.readFileSync('./migrations/003_service_type_availability.sql', 'utf8');
    await pool.query(sql003);
    console.log('Migration 003 completed successfully.');

    // 3. Run 004
    const sql004 = fs.readFileSync('./migrations/004_four_types_and_office_coords.sql', 'utf8');
    await pool.query(sql004);
    console.log('Migration 004 completed successfully.');

  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    pool.end();
  }
}
run();
