require('dotenv').config();
const pool = require('./src/config/db');

async function run() {
  try {
    const res = await pool.query(`
      SELECT u.name, lp.firm_id, lp.firm_approved, f.name AS firm_name, f.is_verified AS firm_verified, f.invite_code 
      FROM users u 
      JOIN lawyer_profiles lp ON lp.user_id = u.id 
      LEFT JOIN firms f ON lp.firm_id = f.id
    `);
    console.log(JSON.stringify(res.rows, null, 2));
  } catch (e) {
    console.error(e);
  } finally {
    pool.end();
  }
}
run();
