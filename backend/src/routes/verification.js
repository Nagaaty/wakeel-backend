const router  = require('express').Router();
const pool    = require('../config/db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { sendWhatsApp } = require('../utils/whatsapp');

// ── Admin: list lawyers pending verification ──────────────────────────────────
router.get('/pending', requireAuth, requireRole('admin'), async (req, res, next) => {
  try {
    const { status = 'pending' } = req.query;
    const { rows } = await pool.query(`
      SELECT u.id, u.name, u.email, u.phone, u.created_at,
             lp.bar_id, lp.specialization, lp.city, lp.experience,
             lp.verification_status, lp.verification_note, lp.verified_at,
             lp.bio, lp.title, lp.rating, lp.review_count
      FROM users u
      JOIN lawyer_profiles lp ON lp.user_id = u.id
      WHERE u.role = 'lawyer'
        AND lp.verification_status = $1
      ORDER BY u.created_at DESC
    `, [status]);
    res.json(rows);
  } catch (err) { next(err); }
});

// ── Admin: approve a lawyer ───────────────────────────────────────────────────
router.post('/:id/approve', requireAuth, requireRole('admin'), async (req, res, next) => {
  try {
    const { note } = req.body;
    await pool.query(`
      UPDATE lawyer_profiles
      SET verification_status='approved', is_verified=true,
          verified_at=NOW(), verification_note=$1
      WHERE user_id=$2
    `, [note || 'Bar ID verified. Welcome to Wakeel!', req.params.id]);

    // Notify lawyer
    await pool.query(`
      INSERT INTO notifications (user_id, title, body, type)
      VALUES ($1, '✅ Account Verified!',
        'Congratulations! Your Bar Association ID has been verified. Your profile is now live and visible to clients.', 'verification')
    `, [req.params.id]);

    const { rows: [u] } = await pool.query('SELECT phone, name FROM users WHERE id=$1', [req.params.id]);
    if (u?.phone) sendWhatsApp(u.phone,
      `✅ *Wakeel.eg — Verification Approved*\n\nMarhaba ${u.name}! 🎉\n\nYour Bar Association ID has been verified. Your profile is now *live* and visible to clients.\n\nLog in now to complete your profile and start receiving bookings: wakeel.eg`
    ).catch(() => {});

    res.json({ message: 'Lawyer approved successfully' });
  } catch (err) { next(err); }
});

// ── Admin: reject a lawyer ────────────────────────────────────────────────────
router.post('/:id/reject', requireAuth, requireRole('admin'), async (req, res, next) => {
  try {
    const { reason } = req.body;
    if (!reason) return res.status(400).json({ message: 'Rejection reason is required' });

    await pool.query(`
      UPDATE lawyer_profiles
      SET verification_status='rejected', is_verified=false, verification_note=$1
      WHERE user_id=$2
    `, [reason, req.params.id]);

    await pool.query(`
      INSERT INTO notifications (user_id, title, body, type)
      VALUES ($1, '❌ Verification Issue',
        $2, 'verification')
    `, [req.params.id, `Your verification was not approved: ${reason}. Please update your profile and resubmit.`]);

    const { rows: [u] } = await pool.query('SELECT phone, name FROM users WHERE id=$1', [req.params.id]);
    if (u?.phone) sendWhatsApp(u.phone,
      `❌ *Wakeel.eg — Verification Update*\n\n${u.name}, your account verification needs attention:\n\n${reason}\n\nPlease log in and update your Bar ID details to resubmit.`
    ).catch(() => {});

    res.json({ message: 'Lawyer rejected' });
  } catch (err) { next(err); }
});

// ── Admin: suspend a lawyer ───────────────────────────────────────────────────
router.post('/:id/suspend', requireAuth, requireRole('admin'), async (req, res, next) => {
  try {
    const { reason } = req.body;
    await pool.query(`
      UPDATE lawyer_profiles SET verification_status='suspended', is_verified=false, verification_note=$1
      WHERE user_id=$2
    `, [reason || 'Account suspended by admin', req.params.id]);
    await pool.query(`UPDATE users SET status='suspended' WHERE id=$1`, [req.params.id]);
    res.json({ message: 'Lawyer suspended' });
  } catch (err) { next(err); }
});

// ── Lawyer: toggle availability (online/offline) ──────────────────────────────
router.patch('/availability', requireAuth, requireRole('lawyer'), async (req, res, next) => {
  try {
    const { isAvailable } = req.body;

    // Must be verified to go online
    const { rows: [lp] } = await pool.query(
      'SELECT verification_status FROM lawyer_profiles WHERE user_id=$1', [req.user.id]
    );
    if (lp?.verification_status !== 'approved') {
      return res.status(403).json({ message: 'Your account must be verified before you can accept consultations.' });
    }

    await pool.query(`
      UPDATE lawyer_profiles
      SET is_available=$1, available_since=CASE WHEN $1=true THEN NOW() ELSE NULL END
      WHERE user_id=$2
    `, [isAvailable, req.user.id]);

    res.json({ isAvailable, message: isAvailable ? 'You are now Online — clients can book you instantly!' : 'You are now Offline' });
  } catch (err) { next(err); }
});

// ── Lawyer: update per-service pricing ───────────────────────────────────────
router.patch('/service-prices', requireAuth, requireRole('lawyer'), async (req, res, next) => {
  try {
    const { priceChat, priceVoice, priceVideo, priceCaseStudy, priceContract, priceMemo, priceCourt, priceInperson } = req.body;
    await pool.query(`
      UPDATE lawyer_profiles SET
        price_chat=$1, price_voice=$2, price_video=$3,
        price_case_study=$4, price_contract=$5, price_memo=$6,
        price_court=$7, price_inperson=$8, updated_at=NOW()
      WHERE user_id=$9
    `, [priceChat, priceVoice, priceVideo, priceCaseStudy, priceContract, priceMemo, priceCourt, priceInperson, req.user.id]);
    res.json({ message: 'Service prices updated' });
  } catch (err) { next(err); }
});

// ── Public: get available lawyers (for instant booking) ──────────────────────
router.get('/available-now', async (req, res, next) => {
  try {
    const { category, limit = 10 } = req.query;
    const params = [true];
    let where = `lp.is_available=$1 AND lp.verification_status='approved'`;
    if (category) { params.push(category); where += ` AND lp.specialization ILIKE $${params.length}`; }

    const { rows } = await pool.query(`
      SELECT u.id, u.name, lp.title, lp.specialization, lp.city,
             lp.price, lp.price_chat, lp.price_voice, lp.price_video,
             lp.rating, lp.experience, lp.is_verified, lp.available_since,
             lp.response_time, lp.languages
      FROM users u
      JOIN lawyer_profiles lp ON lp.user_id=u.id
      WHERE ${where}
      ORDER BY lp.available_since DESC NULLS LAST, lp.rating DESC
      LIMIT $${params.length + 1}
    `, [...params, limit]);
    res.json(rows);
  } catch (err) { next(err); }
});

module.exports = router;
