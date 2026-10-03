require('dotenv').config();
delete process.env.DATABASE_URL;
const pool = require('./src/config/db');

async function run() {
  try {
    const res = await pool.query("SELECT * FROM firms WHERE invite_code = 'JT3A5F' OR name ILIKE '%wakeel%'");
    console.log('Firms:', JSON.stringify(res.rows, null, 2));
    
    if (res.rows.length > 0) {
      const firmIds = res.rows.map(r => r.id);
      const lawyersRes = await pool.query(
        "SELECT u.name, lp.firm_id, lp.firm_approved FROM users u JOIN lawyer_profiles lp ON lp.user_id = u.id WHERE lp.firm_id = ANY($1)",
        [firmIds]
      );
      console.log('Lawyers linked to these firms:', JSON.stringify(lawyersRes.rows, null, 2));
    }
  } catch (e) {
    console.error(e);
  } finally {
    pool.end();
  }
}
run();
