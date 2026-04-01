const router = require('express').Router();
const pool   = require('../config/db');
const { requireAuth, requireRole } = require('../middleware/auth');

// GET /api/lawyers — search with filters + pagination
router.get('/', async (req, res, next) => {
  try {
    const {
      search, cat, city, minPrice, maxPrice, minRating,
      available, verified, sort = 'rating',
      page = 1, limit = 20,
    } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const params = [];
    const conditions = ['u.role=$1', 'u.deleted_at IS NULL', 'lp.is_visible=true'];
    params.push('lawyer');

    if (search) {
      params.push(`%${search}%`);
      conditions.push(`(u.name ILIKE $${params.length} OR lp.specialization ILIKE $${params.length} OR lp.bio ILIKE $${params.length})`);
    }
    if (cat) {
      params.push(`%${cat}%`);
      conditions.push(`lp.specialization ILIKE $${params.length}`);
    }
    if (city) {
      params.push(city);
      conditions.push(`lp.city=$${params.length}`);
    }
    if (minPrice) {
      params.push(parseFloat(minPrice));
      conditions.push(`lp.consultation_fee >= $${params.length}`);
    }
    if (maxPrice) {
      params.push(parseFloat(maxPrice));
      conditions.push(`lp.consultation_fee <= $${params.length}`);
    }
    if (minRating) {
      params.push(parseFloat(minRating));
      conditions.push(`lp.avg_rating >= $${params.length}`);
    }
    if (verified === 'true') conditions.push('lp.is_verified=true');
    if (available === 'true') conditions.push('u.is_online=true');

    const sortMap = {
      rating:    'lp.avg_rating DESC NULLS LAST',
      price_asc: 'lp.consultation_fee ASC NULLS LAST',
      price_desc:'lp.consultation_fee DESC NULLS LAST',
      experience:'lp.experience_years DESC NULLS LAST',
      reviews:   'lp.total_reviews DESC NULLS LAST',
      newest:    'u.created_at DESC',
    };
    const orderBy = sortMap[sort] || sortMap.rating;

    const where = conditions.join(' AND ');

    // Count total
    const { rows: [{ count }] } = await pool.query(
      `SELECT COUNT(*) FROM users u JOIN lawyer_profiles lp ON lp.user_id=u.id WHERE ${where}`,
      params
    );

    // Fetch page
    params.push(parseInt(limit), offset);
    const { rows } = await pool.query(
      `SELECT u.id, u.name, u.avatar_url, u.is_online, u.last_active_at,
              lp.specialization, lp.city, lp.consultation_fee, lp.experience_years,
              lp.avg_rating, lp.total_reviews, lp.wins, lp.losses,
              lp.is_verified, lp.response_time_hours, lp.bio, lp.bar_number,
              lp.subscription_plan AS sub,
              COALESCE(lp.wins,0) + COALESCE(lp.losses,0) AS total_cases
       FROM users u
       JOIN lawyer_profiles lp ON lp.user_id=u.id
       WHERE ${where}
       ORDER BY ${orderBy}
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    res.json({
      lawyers: rows,
      total:   parseInt(count),
      page:    parseInt(page),
      pages:   Math.ceil(parseInt(count) / parseInt(limit)),
    });
  } catch (err) { next(err); }
});

// GET /api/lawyers/:id — full lawyer profile
router.get('/:id', async (req, res, next) => {
  try {
    const { rows: [lawyer] } = await pool.query(
      `SELECT u.id, u.name, u.avatar_url, u.is_online, u.last_active_at, u.created_at,
              lp.*,
              (SELECT json_agg(r ORDER BY r.created_at DESC) FROM reviews r WHERE r.lawyer_id=u.id AND r.is_visible=true LIMIT 20) AS reviews
       FROM users u
       JOIN lawyer_profiles lp ON lp.user_id=u.id
       WHERE u.id=$1 AND u.deleted_at IS NULL`,
      [req.params.id]
    );
    if (!lawyer) return res.status(404).json({ message: 'Lawyer not found' });
    res.json(lawyer);
  } catch (err) { next(err); }
});

// GET /api/lawyers/:id/availability — available time slots
router.get('/:id/availability', async (req, res, next) => {
  try {
    const { date } = req.query; // YYYY-MM-DD
    if (!date) return res.status(400).json({ message: 'date required' });

    const dayOfWeek = new Date(date).getDay();

    // Get lawyer's schedule for this day
    const { rows: slots } = await pool.query(
      `SELECT start_time, end_time FROM lawyer_availability
       WHERE lawyer_id=$1 AND day_of_week=$2 AND is_active=true
       ORDER BY start_time`,
      [req.params.id, dayOfWeek]
    );

    // Get already-booked slots
    const { rows: booked } = await pool.query(
      `SELECT start_time FROM bookings
       WHERE lawyer_id=$1 AND booking_date=$2 AND status NOT IN ('cancelled','rejected')`,
      [req.params.id, date]
    );
    const bookedTimes = new Set(booked.map(b => b.start_time?.slice(0,5)));

    // Generate 30-minute slots from availability windows
    const available = [];
    for (const slot of slots) {
      const [sh, sm] = slot.start_time.split(':').map(Number);
      const [eh, em] = slot.end_time.split(':').map(Number);
      let curr = sh * 60 + sm;
      const end  = eh * 60 + em;
      while (curr + 30 <= end) {
        const h   = String(Math.floor(curr / 60)).padStart(2, '0');
        const m   = String(curr % 60).padStart(2, '0');
        const time = `${h}:${m}`;
        available.push({ time, available: !bookedTimes.has(time) });
        curr += 30;
      }
    }

    // If no schedule set, return default slots
    if (!available.length) {
      const defaults = ['09:00','09:30','10:00','10:30','11:00','11:30','14:00','14:30','15:00','15:30','16:00','16:30'];
      defaults.forEach(time => available.push({ time, available: !bookedTimes.has(time) }));
    }

    res.json({ date, slots: available });
  } catch (err) { next(err); }
});

// GET /api/lawyers/me/profile — lawyer's own profile
router.get('/me/profile', requireAuth, async (req, res, next) => {
  try {
    const { rows: [profile] } = await pool.query(
      'SELECT * FROM lawyer_profiles WHERE user_id=$1', [req.user.id]
    );
    res.json(profile || {});
  } catch (err) { next(err); }
});

// POST /api/lawyers/me/profile — save profile
router.post('/me/profile', requireAuth, async (req, res, next) => {
  try {
    const { specialization, city, consultation_fee, experience_years, bio, bar_number, service_prices } = req.body;
    const { rows: [profile] } = await pool.query(
      `INSERT INTO lawyer_profiles (user_id, specialization, city, consultation_fee, experience_years, bio, bar_number, service_prices)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT (user_id) DO UPDATE SET
         specialization   = EXCLUDED.specialization,
         city             = EXCLUDED.city,
         consultation_fee = EXCLUDED.consultation_fee,
         experience_years = EXCLUDED.experience_years,
         bio              = EXCLUDED.bio,
         bar_number       = EXCLUDED.bar_number,
         service_prices   = COALESCE(EXCLUDED.service_prices, lawyer_profiles.service_prices)
       RETURNING *`,
      [req.user.id, specialization, city, consultation_fee, experience_years, bio, bar_number,
       service_prices ? JSON.stringify(service_prices) : null]
    );
    res.json(profile);
  } catch (err) { next(err); }
});

// POST /api/lawyers/:id/review — submit a review
router.post('/:id/review', requireAuth, async (req, res, next) => {
  try {
    const { rating, comment, outcome } = req.body;
    if (!rating || rating < 1 || rating > 5) return res.status(400).json({ message: 'rating 1-5 required' });

    // Verify client had a completed booking with this lawyer
    const { rows: [booking] } = await pool.query(
      `SELECT id FROM bookings WHERE client_id=$1 AND lawyer_id=$2 AND status='completed' LIMIT 1`,
      [req.user.id, req.params.id]
    );
    if (!booking) return res.status(403).json({ message: 'You can only review lawyers you have consulted with' });

    const { rows: [review] } = await pool.query(
      `INSERT INTO reviews (lawyer_id, client_id, booking_id, rating, comment, outcome)
       VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (client_id, lawyer_id) DO UPDATE SET rating=$4, comment=$5, outcome=$6, updated_at=NOW()
       RETURNING *`,
      [req.params.id, req.user.id, booking.id, rating, comment||null, outcome||null]
    );

    // Update lawyer's avg_rating
    await pool.query(
      `UPDATE lawyer_profiles SET
         avg_rating    = (SELECT AVG(rating) FROM reviews WHERE lawyer_id=$1 AND is_visible=true),
         total_reviews = (SELECT COUNT(*)     FROM reviews WHERE lawyer_id=$1 AND is_visible=true)
       WHERE user_id=$1`,
      [req.params.id]
    );

    res.status(201).json({ review });
  } catch (err) { next(err); }
});

// Save lawyer availability schedule
router.post('/me/availability', requireAuth, async (req, res, next) => {
  try {
    const { schedule } = req.body; // { 0: ['09:00','10:00'], 1: [...], ... }
    if (!schedule) return res.status(400).json({ message: 'schedule required' });

    // Delete old schedule
    await pool.query('DELETE FROM lawyer_availability WHERE lawyer_id=$1', [req.user.id]);

    // Insert new schedule
    for (const [day, slots] of Object.entries(schedule)) {
      if (!slots?.length) continue;
      for (const slot of slots) {
        const [h, m] = slot.split(':');
        const endH = String(parseInt(h) + (parseInt(m) === 30 ? 1 : 0)).padStart(2,'0');
        const endM = parseInt(m) === 30 ? '00' : '30';
        await pool.query(
          `INSERT INTO lawyer_availability (lawyer_id, day_of_week, start_time, end_time)
           VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING`,
          [req.user.id, parseInt(day), slot, `${endH}:${endM}`]
        ).catch(() => {});
      }
    }

    res.json({ ok: true });
  } catch (err) { next(err); }
});


// GET /api/lawyers/:id/public — public profile for share links (no auth needed)
router.get('/:id/public', async (req, res, next) => {
  try {
    const { rows: [lawyer] } = await pool.query(
      `SELECT u.name, u.id,
              lp.specialization, lp.city, lp.consultation_fee,
              lp.experience_years, lp.avg_rating, lp.total_reviews,
              lp.wins, lp.losses, lp.is_verified, lp.bio, lp.bar_number
       FROM users u
       JOIN lawyer_profiles lp ON lp.user_id = u.id
       WHERE u.id=$1 AND u.deleted_at IS NULL AND u.role='lawyer'`,
      [req.params.id]
    );
    if (!lawyer) return res.status(404).json({ message: 'Lawyer not found' });

    // Return Open Graph meta for link preview
    res.json({
      ...lawyer,
      shareUrl:    `https://wakeel.eg/lawyers/${lawyer.id}`,
      deepLink:    `wakeel://lawyers/${lawyer.id}`,
      ogTitle:     `${lawyer.name} — وكيل قانوني | Wakeel`,
      ogDesc:      `${lawyer.specialization} · ${lawyer.city} · من ${lawyer.consultation_fee} ج.م · ${lawyer.total_reviews} تقييم`,
      ogImage:     `https://wakeel.eg/og/lawyers/${lawyer.id}.png`,
    });
  } catch (err) { next(err); }
});

module.exports = router;
