require('dotenv').config({ path: './.env' });
const pool = require('./src/config/db');
async function run() {
  try {
    await pool.query(`DELETE FROM conversations WHERE client_id = lawyer_id;`);
    console.log("Deleted self-conversations");
  } catch(e) {
    console.error(e);
  } finally {
    pool.end();
  }
}
run();
