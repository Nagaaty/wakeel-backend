const router = require('express').Router();
const pool   = require('../config/db');

// Diagnostic Ping to verify deployment
router.get('/ping-deploy', async (req, res) => {
  let msg = 'Ok';
  let needsHeal = false;
  try {
    await pool.query('SELECT start_time FROM lawyer_availability LIMIT 1');
  } catch (err) {
    msg = err.message;
    if (err.message.includes('start_time')) needsHeal = true;
  }
  res.json({ deploy_version: 'auto-heal-v3', needsHeal, msg });
});

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
    const conditions = ['u.role=$1', 'u.deleted_at IS NULL', 'lp.is_visible IS NOT FALSE'];
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
              (SELECT json_agg(r ORDER BY r.created_at DESC) FROM reviews r WHERE r.lawyer_id=u.id LIMIT 20) AS reviews,
              (SELECT json_agg(json_build_object('day_of_week', la.day_of_week, 'start_time', la.start_time)) FROM lawyer_availability la WHERE la.lawyer_id=u.id) AS availability_map,
              (SELECT json_agg(json_build_object('override_date', lo.override_date, 'is_off', lo.is_off, 'slots', lo.slots)) FROM lawyer_schedule_overrides lo WHERE lo.lawyer_id=u.id) AS schedule_overrides
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

    // Ensure column & overrides table exist gracefully on first run
    await pool.query('ALTER TABLE lawyer_profiles ADD COLUMN IF NOT EXISTS has_set_schedule BOOLEAN DEFAULT false').catch(() => {});
    await pool.query('ALTER TABLE lawyer_availability ADD COLUMN IF NOT EXISTS end_time VARCHAR(5)').catch(() => {});
    await pool.query(`
      CREATE TABLE IF NOT EXISTS lawyer_schedule_overrides (
        id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        lawyer_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        override_date DATE NOT NULL,
        is_off        BOOLEAN DEFAULT true,
        slots         JSONB DEFAULT '[]'::jsonb,
        created_at    TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(lawyer_id, override_date)
      )
    `).catch(() => {});

    const [y, m, d] = date.split('-');
    const dayOfWeek = new Date(Number(y), Number(m) - 1, Number(d)).getDay();

    // Check if lawyer has EVER saved a schedule
    const { rows: [profile] } = await pool.query(
      `SELECT has_set_schedule FROM lawyer_profiles WHERE user_id=$1`, 
      [req.params.id]
    );
    const hasSetSchedule = profile?.has_set_schedule || false;

    // Check for Date Overrides FIRST
    const { rows: [override] } = await pool.query(
      `SELECT is_off, slots FROM lawyer_schedule_overrides WHERE lawyer_id=$1 AND override_date=$2`,
      [req.params.id, date]
    );

    // Get already-booked slots
    const { rows: booked } = await pool.query(
      `SELECT start_time FROM bookings
       WHERE lawyer_id=$1 AND booking_date=$2 AND status NOT IN ('cancelled','rejected')`,
      [req.params.id, date]
    );
    const bookedTimes = new Set(booked.map(b => b.start_time?.slice(0,5)));

    let available = [];
    if (override) {
      // If overridden, use override slots (or empty if off)
      if (!override.is_off && override.slots) {
         override.slots.forEach(time => available.push({ time, available: !bookedTimes.has(time) }));
      }
    } else {
      // Fallback: Get lawyer's weekly schedule for this day
      const { rows: slots } = await pool.query(
        `SELECT start_time, end_time FROM lawyer_availability
         WHERE lawyer_id=$1 AND day_of_week=$2
         ORDER BY start_time`,
        [req.params.id, dayOfWeek]
      );

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

      // Default Fallback: ONLY if the lawyer has NEVER set a schedule
      if (!available.length && !hasSetSchedule) {
        const defaults = ['09:00','09:30','10:00','10:30','11:00','11:30','14:00','14:30','15:00','15:30','16:00','16:30'];
        defaults.forEach(time => available.push({ time, available: !bookedTimes.has(time) }));
      }
    }

    // Fallback: ONLY if the lawyer has NEVER set a schedule
    if (!available.length && !hasSetSchedule) {
      const defaults = ['09:00','09:30','10:00','10:30','11:00','11:30','14:00','14:30','15:00','15:30','16:00','16:30'];
      defaults.forEach(time => available.push({ time, available: !bookedTimes.has(time) }));
    }

    // Lead Time Protection (2-Hour Buffer)
    const now = new Date();
    const isToday = now.toISOString().split('T')[0] === date;
    
    if (isToday) {
      const currentMinutes = now.getHours() * 60 + now.getMinutes();
      available = available.filter(slot => {
         const [h, m] = slot.time.split(':').map(Number);
         const slotMinutes = h * 60 + m;
         // Require at least 120 minutes (2 hours) notice
         return slotMinutes > currentMinutes + 120;
      });
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
      `INSERT INTO lawyer_profiles (user_id, specialization, city, consultation_fee, experience_years, bio, bar_number, service_prices, is_visible)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,true)
       ON CONFLICT (user_id) DO UPDATE SET
         specialization   = EXCLUDED.specialization,
         city             = EXCLUDED.city,
         consultation_fee = EXCLUDED.consultation_fee,
         experience_years = EXCLUDED.experience_years,
         bio              = EXCLUDED.bio,
         bar_number       = EXCLUDED.bar_number,
         service_prices   = COALESCE(EXCLUDED.service_prices, lawyer_profiles.service_prices),
         is_visible       = true
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

    const client = await pool.connect();
    try {
      // Automatic Schema Healing for legacy deployments missing start_time
      let needsHeal = false;
      try {
        await client.query('SELECT start_time FROM lawyer_availability LIMIT 1');
      } catch (err) {
        if (err.message.includes('start_time')) needsHeal = true;
      }
      if (needsHeal) {
        await client.query('DROP TABLE IF EXISTS lawyer_availability CASCADE');
        await client.query(`
          CREATE TABLE lawyer_availability (
            id          SERIAL PRIMARY KEY,
            lawyer_id   UUID REFERENCES users(id) ON DELETE CASCADE,
            day_of_week SMALLINT NOT NULL,
            start_time  TIME NOT NULL,
            end_time    TIME NOT NULL,
            is_active   BOOLEAN DEFAULT true,
            created_at  TIMESTAMPTZ DEFAULT NOW(),
            UNIQUE(lawyer_id, day_of_week, start_time)
          )
        `);
      }

      await client.query('BEGIN');
      await client.query('ALTER TABLE lawyer_availability ADD COLUMN IF NOT EXISTS end_time VARCHAR(5)').catch(() => {});
      await client.query('DELETE FROM lawyer_availability WHERE lawyer_id=$1', [req.user.id]);

      for (const [day, slots] of Object.entries(schedule)) {
        if (!slots?.length) continue;
        for (const slot of slots) {
          const [h, m] = slot.split(':');
          let endH = String(parseInt(h) + (parseInt(m) === 30 ? 1 : 0)).padStart(2,'0');
          const endM = parseInt(m) === 30 ? '00' : '30';
          if (endH === '24') endH = '23'; // cap at 23:59 equivalent for postgres TIME support safely
          
          await client.query(
            `INSERT INTO lawyer_availability (lawyer_id, day_of_week, start_time, end_time)
             VALUES ($1,$2,$3,$4)`,
            [req.user.id, parseInt(day), slot, `${endH}:${endM}`]
          );
        }
      }

      await client.query('UPDATE lawyer_profiles SET has_set_schedule = true WHERE user_id=$1', [req.user.id]).catch(() => {});
      await client.query('COMMIT');
    } catch (dbErr) {
      await client.query('ROLLBACK');
      console.error("Schedule Insert Transaction Error:", dbErr.message);
      return res.status(500).json({ message: "Failed to save schedule slots: " + dbErr.message });
    } finally {
      client.release();
    }

    res.json({ ok: true });
  } catch (err) { next(err); }
});


// GET /api/lawyers/me/availability — Get raw saved schedule
router.get('/me/availability', requireAuth, async (req, res, next) => {
  try {
    let needsHeal = false;
    try {
      await pool.query('SELECT start_time FROM lawyer_availability LIMIT 1');
    } catch (err) {
      if (err.message.includes('start_time')) needsHeal = true;
    }
    if (needsHeal) {
      await pool.query('DROP TABLE IF EXISTS lawyer_availability CASCADE');
      await pool.query(`
        CREATE TABLE lawyer_availability (
          id          SERIAL PRIMARY KEY,
          lawyer_id   UUID REFERENCES users(id) ON DELETE CASCADE,
          day_of_week SMALLINT NOT NULL,
          start_time  TIME NOT NULL,
          end_time    TIME NOT NULL,
          is_active   BOOLEAN DEFAULT true,
          created_at  TIMESTAMPTZ DEFAULT NOW(),
          UNIQUE(lawyer_id, day_of_week, start_time)
        )
      `);
    }

    const { rows } = await pool.query(
      `SELECT day_of_week, start_time FROM lawyer_availability WHERE lawyer_id=$1`,
      [req.user.id]
    );
    const schedule = {};
    rows.forEach(r => {
      const slot = r.start_time.slice(0, 5); // '09:00'
      if (!schedule[r.day_of_week]) schedule[r.day_of_week] = [];
      schedule[r.day_of_week].push(slot);
    });
    res.json({ schedule });
  } catch (err) { next(err); }
});

// GET /api/lawyers/me/overrides — Get all date overrides
router.get('/me/overrides', requireAuth, async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT override_date, is_off, slots FROM lawyer_schedule_overrides WHERE lawyer_id=$1`,
      [req.user.id]
    );
    res.json(rows);
  } catch (err) { next(err); }
});

// POST /api/lawyers/me/overrides — Save multiple date overrides
router.post('/me/overrides', requireAuth, async (req, res, next) => {
  try {
    const { overrides } = req.body;
    if (!Array.isArray(overrides)) return res.status(400).json({ message: 'overrides array required' });

    // First delete existing overrides for this lawyer to do a clean sync (optional, but requested here usually full sync based on UI)
    // Actually the UI only tracks the month being viewed or manipulated, let's UPSERT instead or specific sync.
    // UI sends ALL Overrides it knows about, so a sync is easiest if we delete and insert.
    // Wait, the UI uses `Promise.all([rawAvailability, overrides])` and keeps a full map `overrides`.
    // It sends `overrides: [{ override_date, is_off, slots }]` of ALL overrides ever created.
    // So wiping and re-inserting is perfect for syncing.
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('DELETE FROM lawyer_schedule_overrides WHERE lawyer_id=$1', [req.user.id]);
      
      for (const ov of overrides) {
        await client.query(
          `INSERT INTO lawyer_schedule_overrides (lawyer_id, override_date, is_off, slots)
           VALUES ($1, $2, $3, $4::jsonb)`,
          [req.user.id, ov.override_date, ov.is_off, JSON.stringify(ov.slots || [])]
        );
      }
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }

    res.json({ ok: true });
  } catch (err) { next(err); }
});

// GET /api/lawyers/me/reviews — Get all reviews for the lawyer
router.get('/me/reviews', requireAuth, async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT r.*, u.name as client_name, b.service_type
       FROM reviews r
       JOIN users u ON r.client_id = u.id
       JOIN bookings b ON r.booking_id = b.id
       WHERE r.lawyer_id=$1
       ORDER BY r.created_at DESC`,
      [req.user.id]
    );
    res.json({ reviews: rows });
  } catch (err) { next(err); }
});

// GET /api/lawyers/me/clients — Get unique clients CRM
router.get('/me/clients', requireAuth, async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT u.id as client_id, u.name, u.phone, u.email,
              COUNT(b.id) as total_cases,
              SUM(b.fee) as total_spent,
              MAX(b.booking_date) as last_booking_date
       FROM bookings b
       JOIN users u ON b.client_id = u.id
       WHERE b.lawyer_id=$1 AND b.status='completed'
       GROUP BY u.id, u.name, u.phone, u.email
       ORDER BY last_booking_date DESC`,
      [req.user.id]
    );
    res.json({ clients: rows });
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
