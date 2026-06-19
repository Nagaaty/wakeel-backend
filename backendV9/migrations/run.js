require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const poolConfig = process.env.DATABASE_URL 
  ? { 
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    }
  : {
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 5432,
      database: process.env.DB_NAME || 'wakeel_db',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD,
    };

const pool = new Pool(poolConfig);

async function run() {
  const client = await pool.connect();
  try {
    const files = fs.readdirSync(__dirname)
      .filter(f => f.endsWith('.sql'))
      .sort();

    console.log(`Found ${files.length} SQL migration file(s) to run...`);

    for (const file of files) {
      console.log(`Running migration: ${file}...`);
      const sql = fs.readFileSync(path.join(__dirname, file), 'utf8');
      await client.query(sql);
      console.log(`✅ Completed: ${file}`);
    }
    console.log('✅ All SQL migrations complete');
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
