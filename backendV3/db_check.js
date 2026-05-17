const pool = require('./src/config/db');
pool.query("SELECT column_name FROM information_schema.columns WHERE table_name='messages'")
  .then(r => console.log(r.rows))
  .catch(console.error)
  .finally(() => process.exit(0));
