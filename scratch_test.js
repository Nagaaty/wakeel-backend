require('dotenv').config({ path: './backendV3/.env' });
const pool = require('./backendV3/src/config/db');

async function test() {
  try {
    const { rows: lawyers } = await pool.query("SELECT id FROM users WHERE role='lawyer' LIMIT 1");
    if (!lawyers.length) {
      console.log('No lawyers found');
      process.exit(0);
    }
    const lawyerId = lawyers[0].id;
    console.log('Testing lawyer:', lawyerId);

    const { rows } = await pool.query(`SELECT resolve_lawyer_services($1, '2026-05-05'::date) AS services`, [lawyerId]);
    console.log('Result:', rows);
    
    // Also check overrides for this lawyer
    const { rows: ov } = await pool.query("SELECT * FROM lawyer_schedule_overrides WHERE lawyer_id=$1", [lawyerId]);
    console.log('Overrides:', ov);

    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}
test();
