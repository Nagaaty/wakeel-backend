const axios = require('axios');
const { Pool } = require('pg');
require('dotenv').config({ path: './.env' });

async function test() {
  try {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const { rows: lawyers } = await pool.query("SELECT id FROM users WHERE role='lawyer' LIMIT 1");
    if (!lawyers.length) {
      console.log('No lawyers found');
      process.exit(0);
    }
    const lawyerId = lawyers[0].id;
    console.log('Testing lawyer:', lawyerId);

    // Call local endpoint
    const res = await axios.get(`http://localhost:5000/api/lawyers/${lawyerId}/availability?date=2026-05-04`);
    console.log('API Response:', res.data);
    
    // Call for the override date
    const res2 = await axios.get(`http://localhost:5000/api/lawyers/${lawyerId}/availability?date=2026-05-05`);
    console.log('API Response (override):', res2.data);

    process.exit(0);
  } catch (err) {
    console.error('Error:', err.response ? err.response.data : err.message);
    process.exit(1);
  }
}
test();
