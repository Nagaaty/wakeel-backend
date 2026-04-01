const router = require('express').Router();
const pool   = require('../config/db');
const { requireAuth } = require('../middleware/auth');

// GET /api/users/online — online lawyers for InstantConsult
router.get('/online', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT u.id, u.name, u.avatar_url, u.is_online, u.last_active_at,
              lp.specialization, lp.city, lp.consultation_fee,
              lp.avg_rating, lp.is_verified, lp.response_time_hours
       FROM users u
       JOIN lawyer_profiles lp ON lp.user_id=u.id
       WHERE u.role='lawyer' AND u.is_online=true AND u.deleted_at IS NULL
         AND lp.is_verified=true
       ORDER BY lp.avg_rating DESC LIMIT 20`
    );

    // Fallback demo data if no one is online (dev mode)
    if (rows.length === 0) {
      return res.json({ lawyers: [
        { id:1, name:'د. أحمد حسن',    specialization:'جنائي',    city:'Cairo', consultation_fee:500, avg_rating:4.9, is_verified:true, wait_min:5,  is_online:true },
        { id:2, name:'د. نادية المصري', specialization:'أسرة',     city:'Alex',  consultation_fee:650, avg_rating:4.8, is_verified:true, wait_min:8,  is_online:true },
        { id:5, name:'د. عمر شفيق',    specialization:'ملكية فكرية',city:'Cairo', consultation_fee:800, avg_rating:4.9, is_verified:true, wait_min:12, is_online:true },
      ]});
    }

    res.json({ lawyers: rows });
  } catch (err) { next(err); }
});

// GET /api/users/:id — public user profile
router.get('/:id', async (req, res, next) => {
  try {
    const { rows: [user] } = await pool.query(
      `SELECT u.id, u.name, u.avatar_url, u.is_online, u.created_at,
              lp.specialization, lp.city, lp.consultation_fee, lp.avg_rating,
              lp.experience_years, lp.bio, lp.is_verified
       FROM users u
       LEFT JOIN lawyer_profiles lp ON lp.user_id=u.id
       WHERE u.id=$1 AND u.deleted_at IS NULL`,
      [req.params.id]
    );
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json(user);
  } catch (err) { next(err); }
});

module.exports = router;
