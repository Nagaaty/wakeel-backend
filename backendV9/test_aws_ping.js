require('dotenv').config();
const pool = require('./src/config/db');

async function checkLawyerBookings() {
  try {
    const res = await pool.query(`
      SELECT u.id, u.name, u.email, COUNT(b.id) as bookings_count
      FROM users u
      JOIN bookings b ON b.lawyer_id = u.id
      GROUP BY u.id, u.name, u.email
    `);
    console.log('Lawyers with bookings in DB:', res.rows);
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    pool.end();
  }
}

checkLawyerBookings();
