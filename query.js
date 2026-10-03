require('dotenv').config({ path: './backendV9/.env' });
const pool = require('./backendV9/src/config/db');
async function run() {
  try {
    const res = await pool.query(`
      SELECT c.id, c.client_id, c.lawyer_id, c.created_at, 
      u1.name as client_name, u1.role as client_role, 
      u2.name as lawyer_name, u2.role as lawyer_role 
      FROM conversations c 
      JOIN users u1 ON c.client_id=u1.id 
      JOIN users u2 ON c.lawyer_id=u2.id;
    `);
    console.log(res.rows);
  } catch(e) {
    console.error(e);
  } finally {
    pool.end();
  }
}
run();
