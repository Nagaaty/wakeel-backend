require('dotenv').config();
const pool = require('../src/config/db');

async function run() {
  try {
    console.log('Migrating forum_questions table for Social features...');
    await pool.query(`
      ALTER TABLE forum_questions ADD COLUMN IF NOT EXISTS image_url VARCHAR(255);
      ALTER TABLE forum_questions ADD COLUMN IF NOT EXISTS likes_count INTEGER DEFAULT 0;
      ALTER TABLE forum_questions ADD COLUMN IF NOT EXISTS shares_count INTEGER DEFAULT 0;
    `);
    console.log('Migration successful.');
  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    process.exit(0);
  }
}

run();
