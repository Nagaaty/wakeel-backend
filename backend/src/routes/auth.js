const rateLimit = require('express-rate-limit');

// Login rate limiter: 5 attempts per 15 minutes per IP+email
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  keyGenerator: (req) => `${req.ip}_${(req.body.email || '').toLowerCase()}`,
  handler: (req, res) => {
    const retryAfter = Math.ceil(req.rateLimit.resetTime / 1000 - Date.now() / 1000);
    res.status(429).json({
      message: 'Too many login attempts. Please try again later.',
      retryAfter,
      attemptsRemaining: 0,
    });
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.body.email?.endsWith('@demo.com'), // skip demo accounts
});

const router  = require('express').Router();
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const crypto  = require('crypto');
const pool    = require('../config/db');
const { requireAuth } = require('../middleware/auth');
const { sendWelcomeEmail, sendPasswordReset, sendOTPEmail } = require('../utils/email');
const { sendPhoneOTP, sendEmailOTP, verifyOTP } = require('../utils/otp');

const JWT_SECRET  = process.env.JWT_SECRET || 'wakeel-dev-secret';
const JWT_EXPIRES = '30d';

function makeToken(user) {
  return jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: JWT_EXPIRES });
}

function safeUser(u) {
  const { password_hash, two_fa_secret, ...safe } = u;
  return safe;
}

// POST /api/auth/register
router.post('/register', async (req, res, next) => {
  try {
    const { name, email, phone, password, role = 'client', referralCode } = req.body;
    if (!name || !email || !password) return res.status(400).json({ message: 'name, email and password required' });
    if (password.length < 8) return res.status(400).json({ message: 'Password must be at least 8 characters' });

    // Check duplicate
    const { rows: [existing] } = await pool.query('SELECT id FROM users WHERE email=$1', [email.toLowerCase()]);
    if (existing) return res.status(409).json({ message: 'Email already registered' });

    const hash = await bcrypt.hash(password, 12);
    const { rows: [user] } = await pool.query(
      `INSERT INTO users (name, email, phone, password_hash, role)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [name.trim(), email.toLowerCase().trim(), phone || null, hash, role]
    );

    // ── Auto-create lawyer_profiles so they appear in client search immediately ──
    if (role === 'lawyer') {
      await pool.query(
        `INSERT INTO lawyer_profiles (user_id, is_visible, is_verified, avg_rating, total_reviews, wins, losses, consultation_fee)
         VALUES ($1, true, false, 0, 0, 0, 0, 400)
         ON CONFLICT (user_id) DO NOTHING`,
        [user.id]
      );
    }

    // Apply referral code
    if (referralCode) {
      const { rows: [referrer] } = await pool.query('SELECT id FROM users WHERE referral_code=$1', [referralCode]);
      if (referrer && referrer.id !== user.id) {
        await pool.query('UPDATE users SET referred_by=$1 WHERE id=$2', [referrer.id, user.id]);
        await pool.query('UPDATE users SET referral_count=referral_count+1 WHERE id=$1', [referrer.id]);
      }
    }

    // Generate referral code for new user
    const refCode = 'WK-' + name.slice(0,2).toUpperCase() + Math.random().toString(36).slice(2,7).toUpperCase();
    await pool.query('UPDATE users SET referral_code=$1 WHERE id=$2', [refCode, user.id]);

    // Send welcome email (non-blocking)
    sendWelcomeEmail({ to: user.email, name: user.name, role: user.role }).catch(console.error);

    // Send email OTP for verification — await so we can return devOtp if email not configured
    let devOtp = null;
    try {
      const otpResult = await sendEmailOTP(user.email, user.name, user.id, 'verify');
      if (otpResult?.skipped) {
        const { rows: [otpRow] } = await pool.query(
          `SELECT code FROM otp_codes WHERE phone=$1 AND purpose='verify' AND used_at IS NULL ORDER BY created_at DESC LIMIT 1`,
          [user.email]
        );
        devOtp = otpRow?.code;
      }
    } catch {}

    const token = makeToken(user);
    res.status(201).json({ token, user: safeUser(user), ...(devOtp ? { devOtp } : {}) });
  } catch (err) { next(err); }
});


// POST /api/auth/login
router.post('/login', loginLimiter, async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ message: 'email and password required' });

    const { rows: [user] } = await pool.query(
      `SELECT u.*, lp.is_verified, lp.specialization, lp.price AS consultation_fee, lp.rating AS avg_rating, lp.city
       FROM users u
       LEFT JOIN lawyer_profiles lp ON lp.user_id = u.id
       WHERE u.email=$1 AND u.deleted_at IS NULL`,
      [email.toLowerCase()]
    );

    if (!user) return res.status(401).json({ message: 'Invalid email or password', attemptsRemaining: req.rateLimit ? req.rateLimit.remaining - 1 : null });

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok)  return res.status(401).json({ message: 'Invalid email or password', attemptsRemaining: req.rateLimit ? req.rateLimit.remaining - 1 : null });

    // Update last active
    await pool.query('UPDATE users SET last_active_at=NOW() WHERE id=$1', [user.id]);

    const token = makeToken(user);
    res.json({ token, user: safeUser(user) });
  } catch (err) { next(err); }
});

// GET /api/auth/me
router.get('/me', requireAuth, async (req, res, next) => {
  try {
    const { rows: [user] } = await pool.query(
      `SELECT u.*, lp.is_verified, lp.specialization, lp.price AS consultation_fee, lp.rating AS avg_rating, lp.city, lp.experience AS experience_years
       FROM users u
       LEFT JOIN lawyer_profiles lp ON lp.user_id = u.id
       WHERE u.id=$1 AND u.deleted_at IS NULL`,
      [req.user.id]
    );
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json(safeUser(user));
  } catch (err) { next(err); }
});

// PATCH /api/auth/me
router.patch('/me', requireAuth, async (req, res, next) => {
  try {
    const { name, phone, bio, avatar_url, cover_url } = req.body;
    const { rows: [user] } = await pool.query(
      `UPDATE users SET
         name       = COALESCE($1, name),
         phone      = COALESCE($2, phone),
         bio        = COALESCE($3, bio),
         avatar_url = COALESCE($4, avatar_url),
         cover_url  = COALESCE($5, cover_url)
       WHERE id=$6 RETURNING *`,
      [name, phone, bio, avatar_url, cover_url, req.user.id]
    );
    res.json(safeUser(user));
  } catch (err) { next(err); }
});

// DELETE /api/auth/me  — soft-delete (GDPR-safe)
router.delete('/me', requireAuth, async (req, res, next) => {
  try {
    await pool.query(
      `UPDATE users SET
         deleted_at    = NOW(),
         email         = CONCAT('deleted_', id, '@wakeel.deleted'),
         phone         = NULL,
         name          = 'Deleted User',
         avatar_url    = NULL,
         cover_url     = NULL,
         password_hash = 'DELETED'
       WHERE id=$1`,
      [req.user.id]
    );
    res.json({ ok: true, message: 'Account deleted' });
  } catch (err) { next(err); }
});

// POST /api/auth/change-password
router.post('/change-password', requireAuth, async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) return res.status(400).json({ message: 'Both passwords required' });
    if (newPassword.length < 8) return res.status(400).json({ message: 'New password must be at least 8 characters' });

    const { rows: [user] } = await pool.query('SELECT * FROM users WHERE id=$1', [req.user.id]);
    const ok = await bcrypt.compare(currentPassword, user.password_hash);
    if (!ok) return res.status(401).json({ message: 'Current password incorrect' });

    const hash = await bcrypt.hash(newPassword, 12);
    await pool.query('UPDATE users SET password_hash=$1 WHERE id=$2', [hash, req.user.id]);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// POST /api/auth/forgot-password
router.post('/forgot-password', async (req, res, next) => {
  try {
    const { email } = req.body;
    const { rows: [user] } = await pool.query('SELECT * FROM users WHERE email=$1', [email?.toLowerCase()]);
    // Always return 200 to prevent email enumeration
    if (user) {
      await sendEmailOTP(email, user.name, user.id, 'reset').catch(console.error);
    }
    res.json({ ok: true, message: 'If that email exists, an OTP was sent' });
  } catch (err) { next(err); }
});

// POST /api/auth/reset-password
router.post('/reset-password', async (req, res, next) => {
  try {
    const { token, newPassword, email } = req.body;
    if (!token || !newPassword || !email) return res.status(400).json({ message: 'token, email and newPassword required' });

    const result = await verifyOTP(email.toLowerCase(), token, 'reset');
    if (!result.valid) return res.status(400).json({ message: result.reason === 'wrong_code' ? 'Invalid OTP code' : 'Expired token' });

    const hash = await bcrypt.hash(newPassword, 12);
    await pool.query('UPDATE users SET password_hash=$1 WHERE id=$2', [hash, result.userId]);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// POST /api/auth/send-otp  — send phone OTP
router.post('/send-otp', requireAuth, async (req, res, next) => {
  try {
    const { phone, purpose = 'verify' } = req.body;
    const target = phone || req.user.phone || req.user.email;
    if (!target) return res.status(400).json({ message: 'phone required' });
    let result;
    if (!phone && req.user.email) {
      result = await sendEmailOTP(req.user.email, req.user.name || 'User', req.user.id, purpose);
    } else {
      result = await sendPhoneOTP(target, req.user.id, purpose);
    }
    if (result?.skipped) {
      const { rows: [otp] } = await pool.query(
        `SELECT code FROM otp_codes WHERE phone=$1 AND purpose=$2 AND used_at IS NULL ORDER BY created_at DESC LIMIT 1`,
        [target, purpose]
      );
      return res.json({ ok: true, message: 'OTP sent (dev mode)', devOtp: otp?.code });
    }
    res.json({ ok: true, message: 'OTP sent' });
  } catch (err) { next(err); }
});


// POST /api/auth/send-otp-public  — send OTP without login
router.post('/send-otp-public', async (req, res, next) => {
  try {
    const { phone, email, purpose = 'verify' } = req.body;
    const target = email || phone;
    if (!target) return res.status(400).json({ message: 'phone or email required' });
    let result;
    if (email) {
      result = await sendEmailOTP(email, 'Wakeel User', null, purpose);
    } else {
      result = await sendPhoneOTP(target, null, purpose);
    }
    // Dev fallback: if email not configured, return OTP in response so app can display it
    if (result?.skipped) {
      const { rows: [otp] } = await pool.query(
        `SELECT code FROM otp_codes WHERE phone=$1 AND purpose=$2 AND used_at IS NULL ORDER BY created_at DESC LIMIT 1`,
        [target, purpose]
      );
      return res.json({ ok: true, message: 'OTP sent (dev: check Render logs)', devOtp: otp?.code });
    }
    res.json({ ok: true, message: 'OTP sent' });
  } catch (err) { next(err); }
});

// POST /api/auth/verify-otp-public — verify without login
router.post('/verify-otp-public', async (req, res, next) => {
  try {
    const { code, phone, email, purpose = 'verify' } = req.body;
    const target = email || phone;
    const result = await verifyOTP(target, code, purpose);
    if (!result.valid) return res.status(400).json({ message: result.reason });
    res.json({ ok: true, verified: true });
  } catch (err) { next(err); }
});

// POST /api/auth/verify-otp
router.post('/verify-otp', requireAuth, async (req, res, next) => {
  try {
    const { code, phone, purpose = 'verify' } = req.body;
    const target = phone || req.user.phone || req.user.email;
    const result = await verifyOTP(target, code, purpose);
    if (!result.valid) return res.status(400).json({ message: result.reason });

    if (purpose === 'verify' && phone) {
      await pool.query('UPDATE users SET phone=$1, phone_verified=true WHERE id=$2', [phone, req.user.id]);
    }
    if (purpose === 'verify' && !phone) {
      await pool.query('UPDATE users SET email_verified=true WHERE id=$1', [req.user.id]);
    }

    res.json({ ok: true, verified: true });
  } catch (err) { next(err); }
});

// POST /api/auth/logout  — blacklist token
router.post('/logout', requireAuth, async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (token) {
      const hash      = require('crypto').createHash('sha256').update(token).digest('hex');
      const expiresAt = new Date(Date.now() + 30 * 24 * 3600 * 1000); // 30 days
      await pool.query(
        `INSERT INTO blacklist_tokens (token_hash, user_id, expires_at) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`,
        [hash, req.user.id, expiresAt]
      ).catch(() => {});
    }
    await pool.query(`UPDATE users SET is_online=false WHERE id=$1`, [req.user.id]).catch(() => {});
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// DELETE /api/auth/me  — soft delete account
router.delete('/me', requireAuth, async (req, res, next) => {
  try {
    const { password } = req.body;
    const { rows: [user] } = await pool.query('SELECT * FROM users WHERE id=$1', [req.user.id]);
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ message: 'Password incorrect' });
    await pool.query(`UPDATE users SET deleted_at=NOW(), email=email||'_deleted_'||id WHERE id=$1`, [req.user.id]);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

module.exports = router;
