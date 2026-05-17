const { Pool } = require('pg');

    const poolConfig = process.env.DATABASE_URL 
  ? { 
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    }
  : {
      host:     process.env.DB_HOST     || 'localhost',
      port:     parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME     || 'wakeel_db',
      user:     process.env.DB_USER     || 'postgres',
      password: process.env.DB_PASSWORD || '',
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    };

const pool = new Pool(poolConfig);

pool.on('error', (err) => {
  console.error('Unexpected DB error:', err.message);
});

// 🗄️ Database Agent: Query Profiling Interceptor
// Threshold: 2500ms — Neon cloud DB has ~1000-1400ms baseline RTT.
// Anything under 2500ms is normal network overhead, not a real slow query.
// Schema migration queries are excluded from warnings (expected to be slow on first boot).
const SLOW_QUERY_MS = 2500;
const SKIP_PATTERNS = ['schema_migrations', 'CREATE TABLE IF NOT EXISTS schema_migrations'];

const originalQuery = pool.query.bind(pool);
pool.query = async function (text, params) {
  const start = Date.now();
  const queryText = typeof text === 'string' ? text : (text?.text || '');
  try {
    const res = await originalQuery(text, params);
    const duration = Date.now() - start;
    const isInfra = SKIP_PATTERNS.some(p => queryText.includes(p));
    if (duration > SLOW_QUERY_MS && !isInfra) {
      console.warn(`[DB Agent] ⚠️ Slow query detected (${duration}ms):`, queryText.substring(0, 120));
    }
    return res;
  } catch (error) {
    const duration = Date.now() - start;
    const isInfra = SKIP_PATTERNS.some(p => queryText.includes(p));
    if (!isInfra) {
      console.error(`[DB Agent] ❌ Query failed after ${duration}ms:`, queryText.substring(0, 120));
    }
    throw error;
  }
};


module.exports = pool;
