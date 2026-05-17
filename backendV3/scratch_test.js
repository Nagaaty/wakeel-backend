require('dotenv').config({ path: './.env' });
const pool = require('./src/config/db');

async function test() {
  try {
    const { rows: lawyers } = await pool.query("SELECT id FROM users WHERE role='lawyer' LIMIT 1");
    if (!lawyers.length) {
      console.log('No lawyers found');
      process.exit(0);
    }
    const lawyerId = lawyers[0].id;
    console.log('Testing lawyer:', lawyerId);

    // Simulate what the backend route does
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      
      const defaults = {
        '0': ['video'],
        '1': ['text', 'video']
      };
      
      await client.query('DELETE FROM lawyer_service_defaults WHERE lawyer_id=$1', [lawyerId]);
      for (const [dayStr, types] of Object.entries(defaults)) {
        const day = parseInt(dayStr, 10);
        await client.query(
          `INSERT INTO lawyer_service_defaults (lawyer_id, day_of_week, service_types, updated_at)
           VALUES ($1, $2, $3::jsonb, NOW())`,
          [lawyerId, day, JSON.stringify(types)]
        );
      }
      
      const overrides = [
        { override_date: '2026-05-05', service_types: ['video'] }
      ];
      
      for (const ov of overrides) {
        await client.query(
          `INSERT INTO lawyer_schedule_overrides (lawyer_id, override_date, is_off, slots, service_types)
           VALUES ($1, $2, false, '[]'::jsonb, $3)
           ON CONFLICT (lawyer_id, override_date)
           DO UPDATE SET service_types = EXCLUDED.service_types`,
          [lawyerId, ov.override_date, JSON.stringify(ov.service_types)]
        );
      }
      
      await client.query('COMMIT');
      console.log('Simulation committed successfully');
    } catch (e) {
      await client.query('ROLLBACK');
      console.error('Simulation failed:', e.message);
    } finally {
      client.release();
    }

    // Now query the resolve function!
    console.log('\n--- Checking resolver ---');
    // For 2026-05-05 (Override should apply)
    const { rows: res1 } = await pool.query(`SELECT resolve_lawyer_services($1, '2026-05-05'::date) AS services`, [lawyerId]);
    console.log('Resolver for 2026-05-05:', res1[0].services);

    // For 2026-05-04 (Monday, Day 1, Default should apply)
    const { rows: res2 } = await pool.query(`SELECT resolve_lawyer_services($1, '2026-05-04'::date) AS services`, [lawyerId]);
    console.log('Resolver for 2026-05-04 (Monday):', res2[0].services);
    
    // For 2026-05-06 (Wednesday, Day 3, No default set, should fallback to ALL)
    const { rows: res3 } = await pool.query(`SELECT resolve_lawyer_services($1, '2026-05-06'::date) AS services`, [lawyerId]);
    console.log('Resolver for 2026-05-06 (Wednesday):', res3[0].services);

    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}
test();
