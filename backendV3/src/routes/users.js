const router = require('express').Router();
const pool   = require('../config/db');
const { requireAuth, optionalAuth } = require('../middleware/auth');

const nodemailer = require('nodemailer');

// GET /api/users/email-test — Diagnostics for Google SMTP
router.get('/email-test', async (req, res, next) => {
  try {
    const transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST, 
      port: parseInt(process.env.EMAIL_PORT || '587'),
      secure: process.env.EMAIL_SECURE === 'true',
      auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
    });
    
    // Explicitly verify the connection using Nodemailer's built-in verification
    await transporter.verify();
    
    res.json({ 
      success: true, 
      message: "SMTP Connection completely successful!",
      config: {
        host: process.env.EMAIL_HOST,
        port: process.env.EMAIL_PORT,
        user: process.env.EMAIL_USER,
        secure: process.env.EMAIL_SECURE,
        passLength: process.env.EMAIL_PASS ? process.env.EMAIL_PASS.length : 0
      }
    });
  } catch (err) {
    res.json({ 
      success: false, 
      error_name: err.name,
      error_message: err.message, 
      error_code: err.code,
      error_command: err.command,
      config: {
        host: process.env.EMAIL_HOST,
        port: process.env.EMAIL_PORT,
        user: process.env.EMAIL_USER,
        hasPassword: !!process.env.EMAIL_PASS
      }
    });
  }
});

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

// GET /api/users/search?q=… — autocomplete people search for forum top bar.
// Returns up to 10 matches (lawyers + clients), prioritizing lawyers and
// verified accounts. Matches are case-insensitive on the user's name.
//
// Used by: ForumSearchBar component (forum top of feed).
router.get('/search', async (req, res, next) => {
  try {
    const q = String(req.query.q || '').trim();
    if (q.length < 2) {
      return res.json({ users: [] });
    }
    // Limit query length to prevent abuse
    const safeQ = q.slice(0, 64);
    const { rows } = await pool.query(
      `SELECT u.id, u.name, u.avatar_url, u.role,
              lp.specialization, lp.city, lp.is_verified,
              CASE
                WHEN u.role = 'lawyer' AND lp.is_verified THEN 3
                WHEN u.role = 'lawyer' THEN 2
                ELSE 1
              END AS rank
       FROM users u
       LEFT JOIN lawyer_profiles lp ON lp.user_id = u.id
       WHERE u.deleted_at IS NULL
         AND u.name ILIKE $1
       ORDER BY rank DESC, u.name ASC
       LIMIT 10`,
      [`%${safeQ}%`]
    );
    res.json({ users: rows });
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

// ─── GET /api/users/:id/activity — unified activity feed (Chunk 4a) ──────────
// Returns the user's recent forum interactions in a single chronological list.
//
// Activity rows are aggregated via UNION ALL across four sources:
//   • posts        — forum_questions where user_id matches AND original_post_id IS NULL
//   • reposts      — forum_questions where user_id matches AND original_post_id IS NOT NULL
//   • comments     — forum_answers where lawyer_id matches
//   • likes        — forum_questions whose liked_by JSONB contains the user id
//
// Privacy:
//   • If the requesting client is the OWNER of the profile → see everything
//   • Otherwise → only return rows when `users.forum_activity_public` is true
//
// Each returned row has a unified shape:
//   { id, action_type, target_post_id, target_post_snippet, target_post_author,
//     created_at, my_post_text? }
//
// Pagination via ?before=<iso> and ?limit (capped at 50, default 25).
router.get('/:id/activity', optionalAuth, async (req, res, next) => {
  try {
    const targetId = req.params.id;
    if (!targetId) return res.status(400).json({ message: 'user id required' });

    // Look up target user + privacy flag
    const { rows: [target] } = await pool.query(
      `SELECT id, role, forum_activity_public FROM users WHERE id=$1 AND deleted_at IS NULL`,
      [targetId]
    );
    if (!target) return res.status(404).json({ message: 'User not found' });

    // Resolve the requester — if a token is present and matches the target
    // user id, they're viewing their own profile and bypass the privacy check.
    let requesterId = null;
    try {
      // We don't require auth on this route, but if a token IS present we
      // try to decode it via the existing middleware-free path. To avoid
      // pulling jwt logic into this file, we rely on the optional middleware.
      // For simplicity here, we read req.user if a previous middleware
      // populated it. If not, we treat as anonymous.
      requesterId = req.user?.id || null;
    } catch { /* anonymous */ }

    const isOwner = requesterId && requesterId.toString() === targetId.toString();
    if (!isOwner && !target.forum_activity_public) {
      return res.json({
        activity: [],
        is_private: true,
        message: 'This user has chosen to keep their forum activity private.',
      });
    }

    const before = req.query.before ? String(req.query.before) : null;
    const limit  = Math.min(Math.max(parseInt(req.query.limit) || 25, 5), 50);

    // The activity feed UNIONs across four sources. We pass two params:
    //   $1 = the target user's UUID  (for direct UUID matches)
    //   $2 = JSONB array containing that same UUID  (for liked_by JSONB contains)
    // If a `before` cursor is present, it becomes $3.
    const userIdJson = JSON.stringify([targetId]);
    const sql2 = `
      WITH activity AS (
        SELECT
          ('post-' || fq.id)::text AS row_id, 'post'::text AS action_type, fq.id AS target_post_id,
          LEFT(COALESCE(fq.question, ''), 240) AS target_post_snippet, NULL::text AS target_post_author,
          fq.created_at AS ts, fq.likes_count AS likes_count,
          (SELECT COUNT(*) FROM forum_answers fa WHERE fa.question_id=fq.id) AS answer_count
        FROM forum_questions fq
        WHERE fq.user_id = $1 AND fq.is_visible = true AND fq.original_post_id IS NULL

        UNION ALL
        SELECT
          ('repost-' || fq.id)::text, 'repost'::text, fq.original_post_id,
          LEFT(COALESCE(orig.question, ''), 240), orig_u.name,
          fq.created_at, 0, 0
        FROM forum_questions fq
        LEFT JOIN forum_questions orig ON orig.id = fq.original_post_id
        LEFT JOIN users orig_u         ON orig_u.id = orig.user_id
        WHERE fq.user_id = $1 AND fq.is_visible = true AND fq.original_post_id IS NOT NULL

        UNION ALL
        SELECT
          ('comment-' || fa.id)::text, 'comment'::text, fa.question_id,
          LEFT(COALESCE(post.question, ''), 240), post_u.name,
          fa.created_at, fa.likes_count, 0
        FROM forum_answers fa
        LEFT JOIN forum_questions post ON post.id = fa.question_id
        LEFT JOIN users post_u         ON post_u.id = post.user_id
        WHERE fa.lawyer_id = $1

        UNION ALL
        SELECT
          ('like-' || fq.id)::text, 'like'::text, fq.id,
          LEFT(COALESCE(fq.question, ''), 240), au.name,
          fq.created_at, fq.likes_count, 0
        FROM forum_questions fq
        LEFT JOIN users au ON au.id = fq.user_id
        WHERE fq.is_visible = true
          AND fq.liked_by @> $2::jsonb
          AND fq.user_id != $1
      )
      SELECT * FROM activity
      WHERE 1=1 ${before ? 'AND ts < $3::timestamptz' : ''}
      ORDER BY ts DESC
      LIMIT ${limit}
    `;

    const params2 = before
      ? [targetId, userIdJson, before]
      : [targetId, userIdJson];

    const { rows } = await pool.query(sql2, params2);
    const nextCursor = rows.length === limit && rows.length > 0
      ? rows[rows.length - 1].ts
      : null;

    res.json({
      activity: rows,
      next_cursor: nextCursor,
      has_more: nextCursor !== null,
      is_private: false,
    });
  } catch (err) { next(err); }
});

// ─── GET /api/users/:id/profile-summary — header stats and config ────────────
// Returns the data needed to render the public profile header in one round
// trip. Combines fields from `users` with role-specific data from
// `lawyer_profiles` when applicable.
router.get('/:id/profile-summary', async (req, res, next) => {
  try {
    const targetId = req.params.id;
    const { rows: [u] } = await pool.query(
      `SELECT u.id, u.name, u.avatar_url, u.cover_url, u.bio, u.role,
              u.created_at, u.is_online, u.last_active_at,
              u.forum_activity_public,
              lp.specialization, lp.city, lp.consultation_fee,
              lp.experience_years, lp.avg_rating, lp.total_reviews,
              lp.is_verified, lp.bar_number, lp.service_prices,
              lp.office, lp.office_lat, lp.office_lng
         FROM users u
         LEFT JOIN lawyer_profiles lp ON lp.user_id = u.id
         WHERE u.id = $1 AND u.deleted_at IS NULL`,
      [targetId]
    );
    if (!u) return res.status(404).json({ message: 'User not found' });

    // Derive lightweight counts
    const { rows: [counts] } = await pool.query(
      `SELECT
         (SELECT COUNT(*) FROM forum_questions WHERE user_id=$1 AND is_visible=true AND original_post_id IS NULL) AS posts_count,
         (SELECT COUNT(*) FROM forum_answers WHERE lawyer_id=$1) AS answers_count`,
      [targetId]
    );

    res.json({
      ...u,
      // Normalize service_prices JSONB-string → object
      service_prices: (() => {
        if (!u.service_prices) return null;
        if (typeof u.service_prices === 'string') {
          try { return JSON.parse(u.service_prices); } catch { return null; }
        }
        return u.service_prices;
      })(),
      posts_count:   parseInt(counts?.posts_count) || 0,
      answers_count: parseInt(counts?.answers_count) || 0,
    });
  } catch (err) { next(err); }
});

module.exports = router;
