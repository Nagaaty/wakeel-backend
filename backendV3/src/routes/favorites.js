const router = require('express').Router();
const pool   = require('../config/db');
const { requireAuth } = require('../middleware/auth');

// GET /api/favorites — list all saved lawyers
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT f.id, f.lawyer_id, f.created_at,
              u.name AS lawyer_name, u.avatar_url,
              lp.specialization, lp.city, lp.consultation_fee,
              lp.avg_rating, lp.total_reviews, lp.is_verified
       FROM favorites f
       JOIN users u ON u.id = f.lawyer_id
       LEFT JOIN lawyer_profiles lp ON lp.user_id = f.lawyer_id
       WHERE f.user_id = $1
       ORDER BY f.created_at DESC`,
      [req.user.id]
    );
    res.json({ favorites: rows });
  } catch (err) { next(err); }
});

// POST /api/favorites/:lawyerId — add to favorites
router.post('/:lawyerId', requireAuth, async (req, res, next) => {
  try {
    await pool.query(
      `INSERT INTO favorites (user_id, lawyer_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
      [req.user.id, req.params.lawyerId]
    );
    res.json({ ok: true, saved: true });
  } catch (err) { next(err); }
});

// DELETE /api/favorites/:lawyerId — remove from favorites
router.delete('/:lawyerId', requireAuth, async (req, res, next) => {
  try {
    await pool.query(
      `DELETE FROM favorites WHERE user_id=$1 AND lawyer_id=$2`,
      [req.user.id, req.params.lawyerId]
    );
    res.json({ ok: true, saved: false });
  } catch (err) { next(err); }
});

// POST /api/favorites/:lawyerId/toggle — toggle saved state
router.post('/:lawyerId/toggle', requireAuth, async (req, res, next) => {
  try {
    const { rows: [existing] } = await pool.query(
      `SELECT id FROM favorites WHERE user_id=$1 AND lawyer_id=$2`,
      [req.user.id, req.params.lawyerId]
    );
    if (existing) {
      await pool.query(`DELETE FROM favorites WHERE user_id=$1 AND lawyer_id=$2`,
        [req.user.id, req.params.lawyerId]);
      return res.json({ ok: true, saved: false });
    }
    await pool.query(`INSERT INTO favorites (user_id, lawyer_id) VALUES ($1,$2)`,
      [req.user.id, req.params.lawyerId]);
    res.json({ ok: true, saved: true });
  } catch (err) { next(err); }
});

// GET /api/favorites/check/:lawyerId — check if saved
router.get('/check/:lawyerId', requireAuth, async (req, res, next) => {
  try {
    const { rows: [row] } = await pool.query(
      `SELECT id FROM favorites WHERE user_id=$1 AND lawyer_id=$2`,
      [req.user.id, req.params.lawyerId]
    );
    res.json({ saved: !!row });
  } catch (err) { next(err); }
});

module.exports = router;
