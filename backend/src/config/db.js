const { Pool } = require('pg');

const poolConfig = process.env.DATABASE_URL 
  ? { 
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    }
  : {
      host:     process.env.DB_HOST     || 'localhost',
      port:     parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME     || 'wakeel_db',
      user:     process.env.DB_USER     || 'postgres',
      password: process.env.DB_PASSWORD || '',
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    };

const pool = new Pool(poolConfig);

pool.on('error', (err) => {
  console.error('Unexpected DB error:', err.message);
});

// 🗄️ Database Agent: Query Profiling Interceptor
const originalQuery = pool.query.bind(pool);
pool.query = async function (text, params) {
  const start = Date.now();
  try {
    const res = await originalQuery(text, params);
    const duration = Date.now() - start;
    if (duration > 500) {
      console.warn(`[DB Agent] ⚠️ Slow query detected (${duration}ms):`, typeof text === 'string' ? text.substring(0, 100) : text);
    }
    return res;
  } catch (error) {
    const duration = Date.now() - start;
    console.error(`[DB Agent] ❌ Query failed after ${duration}ms:`, typeof text === 'string' ? text.substring(0, 100) : text);
    throw error;
  }
};

module.exports = pool;
