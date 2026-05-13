const router = require('express').Router();
const pool   = require('../config/db');
const { requireAuth, requireRole } = require('../middleware/auth');

// POST /api/promos/validate — check if a code is valid before payment
router.post('/validate', requireAuth, async (req, res, next) => {
  try {
    const { code, amount } = req.body;
    if (!code) return res.status(400).json({ message: 'code required' });

    const { rows: [promo] } = await pool.query(
      `SELECT * FROM promo_codes WHERE UPPER(code)=UPPER($1) AND is_active=true`, [code]
    );

    if (!promo) return res.status(404).json({ valid: false, message: 'Invalid promo code' });
    if (promo.valid_until && new Date(promo.valid_until) < new Date())
      return res.status(400).json({ valid: false, message: 'Promo code has expired' });
    if (promo.max_uses && promo.uses_count >= promo.max_uses)
      return res.status(400).json({ valid: false, message: 'Promo code has reached its usage limit' });
    if (promo.min_amount && amount < promo.min_amount)
      return res.status(400).json({ valid: false, message: `Minimum amount of ${promo.min_amount} EGP required` });

    // Check if user already used this code
    const { rows: [used] } = await pool.query(
      `SELECT id FROM promo_uses WHERE promo_id=$1 AND user_id=$2`, [promo.id, req.user.id]
    );
    if (used) return res.status(400).json({ valid: false, message: 'You have already used this promo code' });

    const discount = promo.discount_type === 'percent'
      ? Math.round((amount || 0) * promo.discount_value / 100)
      : promo.discount_value;

    res.json({
      valid: true,
      promoId: promo.id,
      code: promo.code.toUpperCase(),
      discountType: promo.discount_type,
      discountValue: promo.discount_value,
      discountAmount: discount,
      finalAmount: Math.max(0, (amount || 0) - discount),
      message: promo.discount_type === 'percent'
        ? `${promo.discount_value}% discount applied — save ${discount} EGP`
        : `${promo.discount_value} EGP off applied`,
    });
  } catch (err) { next(err); }
});

// POST /api/promos/apply — record promo use after successful payment
router.post('/apply', requireAuth, async (req, res, next) => {
  try {
    const { promoId, bookingId, discountApplied } = req.body;
    if (!promoId) return res.status(400).json({ message: 'promoId required' });

    await pool.query(
      `INSERT INTO promo_uses (promo_id, user_id, booking_id, discount_applied)
       VALUES ($1,$2,$3,$4) ON CONFLICT (promo_id,user_id) DO NOTHING`,
      [promoId, req.user.id, bookingId || null, discountApplied || 0]
    );
    await pool.query(`UPDATE promo_codes SET uses_count=uses_count+1 WHERE id=$1`, [promoId]);
    res.json({ message: 'Promo applied successfully' });
  } catch (err) { next(err); }
});

// ── Admin routes ─────────────────────────────────────────────────────────────
// GET /api/promos — list all promos (admin)
router.get('/', requireAuth, requireRole('admin'), async (req, res, next) => {
  try {
    const { rows } = await pool.query(`
      SELECT p.*, u.name AS created_by_name,
        (SELECT COUNT(*) FROM promo_uses WHERE promo_id=p.id) AS total_uses,
        (SELECT SUM(discount_applied) FROM promo_uses WHERE promo_id=p.id) AS total_discount_given
      FROM promo_codes p
      LEFT JOIN users u ON u.id=p.created_by
      ORDER BY p.created_at DESC
    `);
    res.json(rows);
  } catch (err) { next(err); }
});

// POST /api/promos — create new promo (admin)
router.post('/', requireAuth, requireRole('admin'), async (req, res, next) => {
  try {
    const { code, discountType, discountValue, minAmount, maxUses, validUntil } = req.body;
    if (!code || !discountValue) return res.status(400).json({ message: 'code and discountValue required' });

    const { rows: [promo] } = await pool.query(`
      INSERT INTO promo_codes (code, discount_type, discount_value, min_amount, max_uses, valid_until, created_by)
      VALUES (UPPER($1), $2, $3, $4, $5, $6, $7) RETURNING *
    `, [code, discountType||'percent', discountValue, minAmount||0, maxUses||null, validUntil||null, req.user.id]);
    res.status(201).json(promo);
  } catch (err) {
    if (err.code === '23505') return res.status(400).json({ message: 'Promo code already exists' });
    next(err);
  }
});

// PATCH /api/promos/:id — toggle active (admin)
router.patch('/:id', requireAuth, requireRole('admin'), async (req, res, next) => {
  try {
    const { isActive } = req.body;
    const { rows: [p] } = await pool.query(
      `UPDATE promo_codes SET is_active=$1 WHERE id=$2 RETURNING *`,
      [isActive, req.params.id]
    );
    if (!p) return res.status(404).json({ message: 'Promo not found' });
    res.json(p);
  } catch (err) { next(err); }
});

// DELETE /api/promos/:id (admin)
router.delete('/:id', requireAuth, requireRole('admin'), async (req, res, next) => {
  try {
    await pool.query(`DELETE FROM promo_codes WHERE id=$1`, [req.params.id]);
    res.json({ message: 'Deleted' });
  } catch (err) { next(err); }
});


// GET /api/promos/admin — list all promo codes (admin only)
router.get('/admin', requireAuth, requireRole('admin'), async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT pc.*, 
              (SELECT COUNT(*) FROM promo_uses pu WHERE pu.promo_id=pc.id) AS use_count
       FROM promo_codes pc ORDER BY pc.created_at DESC`
    );
    res.json({ promos: rows });
  } catch (err) { next(err); }
});

// DELETE /api/promos/:id — delete promo (admin only)
router.delete('/:id', requireAuth, requireRole('admin'), async (req, res, next) => {
  try {
    await pool.query('UPDATE promo_codes SET is_active=false WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

module.exports = router;
