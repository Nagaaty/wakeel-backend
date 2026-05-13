require('dotenv').config();
const fs = require('fs');
const pool = require('./src/config/db');

async function run() {
  try {
    const sql = fs.readFileSync('./migrations/004_four_types_and_office_coords.sql', 'utf8');
    await pool.query(sql);
    console.log('Migration 004 completed successfully.');
  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    pool.end();
  }
}
run();
