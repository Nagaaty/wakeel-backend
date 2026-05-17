const router = require('express').Router();
const pool   = require('../config/db');
const { requireAuth } = require('../middleware/auth');

// GET /api/referral/my-code
router.get('/my-code', requireAuth, async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      'SELECT referral_code, referral_count, referral_earnings FROM users WHERE id=$1',
      [req.user.id]
    );
    const user = rows[0];
    if (!user.referral_code) {
      // Generate code
      const code = 'WK-' + req.user.name.slice(0,2).toUpperCase() + Math.random().toString(36).slice(2,7).toUpperCase();
      await pool.query('UPDATE users SET referral_code=$1 WHERE id=$2', [code, req.user.id]);
      return res.json({ code, referrals: 0, earnings: 0 });
    }
    res.json({ code: user.referral_code, referrals: user.referral_count || 0, earnings: user.referral_earnings || 0 });
  } catch (err) { next(err); }
});

// POST /api/referral/apply  — apply a referral code at registration
router.post('/apply', requireAuth, async (req, res, next) => {
  try {
    const { code } = req.body;
    const { rows } = await pool.query('SELECT id FROM users WHERE referral_code=$1', [code]);
    if (!rows.length) return res.status(404).json({ message: 'Invalid referral code' });
    const referrerId = rows[0].id;
    if (referrerId === req.user.id) return res.status(400).json({ message: 'Cannot use your own code' });
    // Give 50 EGP credit to new user, 100 EGP to referrer after first consultation
    await pool.query('UPDATE users SET referred_by=$1 WHERE id=$2', [referrerId, req.user.id]);
    await pool.query('UPDATE users SET referral_count=referral_count+1 WHERE id=$1', [referrerId]);
    res.json({ ok: true, credit: 50, message: 'You got 50 EGP credit!' });
  } catch (err) { next(err); }
});

module.exports = router;
