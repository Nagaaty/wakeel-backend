const router = require('express').Router();
const pool   = require('../config/db');

// Diagnostic Ping to verify deployment
router.get('/ping-deploy', (req, res) => res.json({ deploy_version: 'service-pricing-flow-v2' }));

const { requireAuth, requireRole } = require('../middleware/auth');

// ─── Constants ───────────────────────────────────────────────────────────────
const VALID_SERVICE_TYPES = ['video', 'text', 'phone', 'inperson', 'document'];
function sanitizeServiceTypes(arr) {
  if (!Array.isArray(arr)) return [];
  return [...new Set(arr.filter(t => typeof t === 'string' && VALID_SERVICE_TYPES.includes(t)))];
}

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
      karma:     'lp.karma_score DESC NULLS LAST',
      rating:    'lp.avg_rating DESC NULLS LAST',
      price_asc: 'lp.consultation_fee ASC NULLS LAST',
      price_desc:'lp.consultation_fee DESC NULLS LAST',
      experience:'lp.experience_years DESC NULLS LAST',
      reviews:   'lp.total_reviews DESC NULLS LAST',
      newest:    'u.created_at DESC',
    };
    const orderBy = sortMap[sort] || sortMap.karma;

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
              lp.subscription_plan AS sub, lp.karma_score,
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
      `SELECT lp.*,
              u.id, u.name, u.avatar_url, u.is_online, u.last_active_at, u.created_at,
              (SELECT json_agg(r ORDER BY r.created_at DESC) FROM reviews r WHERE r.lawyer_id=u.id LIMIT 20) AS reviews,
              (SELECT json_agg(json_build_object('day_of_week', la.day_of_week, 'start_time', la.start_time)) FROM lawyer_availability la WHERE la.lawyer_id=u.id) AS availability_map,
              (SELECT json_agg(json_build_object('override_date', lo.override_date, 'is_off', lo.is_off, 'slots', lo.slots)) FROM lawyer_schedule_overrides lo WHERE lo.lawyer_id=u.id) AS schedule_overrides,
              (SELECT json_agg(json_build_object('day_of_week', sd.day_of_week, 'service_types', sd.service_types)) FROM lawyer_service_defaults sd WHERE sd.lawyer_id=u.id) AS service_defaults
       FROM users u
       JOIN lawyer_profiles lp ON lp.user_id=u.id
       WHERE u.id=$1 AND u.deleted_at IS NULL`,
      [req.params.id]
    );
    if (!lawyer) return res.status(404).json({ message: 'Lawyer not found' });

    // Normalize service_prices: handle JSONB stored as string AND legacy 'voice'→'phone'
    if (lawyer.service_prices) {
      let sp = lawyer.service_prices;
      if (typeof sp === 'string') {
        try { sp = JSON.parse(sp); } catch { sp = {}; }
      }
      if (sp.voice && !sp.phone) sp.phone = sp.voice;
      delete sp.voice;
      lawyer.service_prices = sp;
    }

    res.json(lawyer);
  } catch (err) { next(err); }
});

// GET /api/lawyers/:id/availability — available time slots + enabled services
router.get('/:id/availability', async (req, res, next) => {
  try {
    const { date } = req.query; // YYYY-MM-DD
    if (!date) return res.status(400).json({ message: 'date required' });

    // Guard: reject NaN / obviously-invalid IDs before they reach the DB
    const lawyerId = req.params.id;
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!lawyerId || lawyerId === 'NaN' || lawyerId === 'undefined' || !UUID_RE.test(lawyerId)) {
      return res.status(400).json({
        message: 'Invalid lawyer ID',
        slots: [],
        available: false,
        enabled_services: [],
      });
    }

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
        service_types JSONB DEFAULT NULL,
        created_at    TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(lawyer_id, override_date)
      )
    `).catch(() => {});
    // Defensive: add service_types col if the table existed before this migration
    await pool.query(`ALTER TABLE lawyer_schedule_overrides ADD COLUMN IF NOT EXISTS service_types JSONB DEFAULT NULL`).catch(() => {});
    // Defensive: ensure the new defaults table exists
    await pool.query(`
      CREATE TABLE IF NOT EXISTS lawyer_service_defaults (
        lawyer_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        day_of_week   SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
        service_types JSONB NOT NULL DEFAULT '["video","text","phone","inperson","document"]'::jsonb,
        updated_at    TIMESTAMPTZ DEFAULT NOW(),
        PRIMARY KEY (lawyer_id, day_of_week)
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

    // Check for Date Overrides FIRST (now includes service_types)
    const { rows: [override] } = await pool.query(
      `SELECT is_off, slots, service_types FROM lawyer_schedule_overrides WHERE lawyer_id=$1 AND override_date=$2`,
      [req.params.id, date]
    );

    // Get already-booked slots
    const { rows: booked } = await pool.query(
      `SELECT to_char(scheduled_at AT TIME ZONE 'UTC', 'HH24:MI') as start_time
       FROM bookings
       WHERE lawyer_id=$1
         AND DATE(scheduled_at AT TIME ZONE 'UTC') = $2
         AND status NOT IN ('cancelled','rejected')`,
      [req.params.id, date]
    );
    const bookedTimes = new Set(booked.map(b => b.start_time?.slice(0,5)));

    // ─── Resolve enabled service types for this date ─────────────────────────
    let enabledServices = ['video','text','phone','inperson','document'];
    try {
      const { rows: [resolved] } = await pool.query(
        `SELECT resolve_lawyer_services($1, $2::date) AS services`,
        [req.params.id, date]
      );
      if (Array.isArray(resolved?.services)) enabledServices = resolved.services;
    } catch (e) {
      // resolver function missing → migration 003 hasn't run yet.
      // Fall back to "all enabled" so the mobile app still works.
      console.warn('[availability] service resolver missing:', e.message);
    }

    // ─── Look up the lawyer's per-service-type prices ────────────────────────
    // Returned alongside enabled_services so the booking screen can render
    // the right chips with the right prices in a single round-trip.
    let servicePrices = {};
    try {
      const { rows: [pr] } = await pool.query(
        `SELECT service_prices, consultation_fee FROM lawyer_profiles WHERE user_id=$1`,
        [req.params.id]
      );
      let sp = pr?.service_prices;
      if (typeof sp === 'string') { try { sp = JSON.parse(sp); } catch { sp = null; } }
      if (sp && typeof sp === 'object') {
        // Migrate legacy 'voice' → 'phone'
        if (sp.voice && !sp.phone) sp.phone = sp.voice;
        delete sp.voice;
        servicePrices = sp;
      }
      // Fill in any missing types from consultation_fee × multiplier
      const base = Number(pr?.consultation_fee) || 400;
      const FALLBACK_MUL = { text: 0.5, phone: 1, video: 1.5, inperson: 2, document: 0.8 };
      for (const t of ['text','phone','video','inperson','document']) {
        if (!servicePrices[t]) servicePrices[t] = Math.round(base * FALLBACK_MUL[t]);
      }
    } catch (e) {
      console.warn('[availability] service prices lookup failed:', e.message);
    }

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
        const [eh, em] = (slot.end_time || '17:00').split(':').map(Number);
        let curr = sh * 60 + sm;
        const end  = eh * 60 + em;
        while (curr + 30 <= end) {
          const h   = String(Math.floor(curr / 60)).padStart(2, '0');
          const mm  = String(curr % 60).padStart(2, '0');
          const time = `${h}:${mm}`;
          available.push({ time, available: !bookedTimes.has(time) });
          curr += 30;
        }
      }

      // Default Fallback: ONLY if the lawyer has NEVER set a schedule
      if (!available.length && !hasSetSchedule && dayOfWeek >= 0 && dayOfWeek <= 4) {
        const defaults = ['09:00','09:30','10:00','10:30','11:00','11:30','14:00','14:30','15:00','15:30','16:00','16:30'];
        defaults.forEach(time => available.push({ time, available: !bookedTimes.has(time) }));
      }
    }

    // Lead Time Protection (2-Hour Buffer)
    const now = new Date();
    const isToday = now.toISOString().split('T')[0] === date;
    if (isToday) {
      const currentMinutes = now.getHours() * 60 + now.getMinutes();
      available = available.filter(slot => {
         const [h, m] = slot.time.split(':').map(Number);
         const slotMinutes = h * 60 + m;
         return slotMinutes > currentMinutes + 120;
      });
    }

    res.json({
      date,
      slots: available,
      enabled_services: enabledServices,
      service_prices: servicePrices,
      is_off: override?.is_off || false,
    });
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

    await pool.query(
      `UPDATE lawyer_profiles SET
         avg_rating    = (SELECT AVG(rating) FROM reviews WHERE lawyer_id=$1 AND is_visible=true),
         total_reviews = (SELECT COUNT(*)     FROM reviews WHERE lawyer_id=$1 AND is_visible=true)
       WHERE user_id=$1`,
      [req.params.id]
    );

    const { updateLawyerKarma } = require('../utils/reputation');
    updateLawyerKarma(req.params.id);

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
      await client.query('ALTER TABLE lawyer_availability ADD COLUMN IF NOT EXISTS end_time VARCHAR(5)').catch(() => {});

      await client.query('BEGIN');
      await client.query('DELETE FROM lawyer_availability WHERE lawyer_id=$1', [req.user.id]);

      for (const [day, slots] of Object.entries(schedule)) {
        if (!slots?.length) continue;
        for (const slot of slots) {
          const [h, m] = slot.split(':');
          let endH = String(parseInt(h) + (parseInt(m) === 30 ? 1 : 0)).padStart(2,'0');
          const endM = parseInt(m) === 30 ? '00' : '30';
          if (endH === '24') endH = '23';

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
    const { rows: [profile] } = await pool.query(
      `SELECT has_set_schedule FROM lawyer_profiles WHERE user_id=$1`,
      [req.user.id]
    );
    const hasSetSchedule = profile?.has_set_schedule || false;

    const { rows } = await pool.query(
      `SELECT day_of_week, start_time FROM lawyer_availability WHERE lawyer_id=$1`,
      [req.user.id]
    );
    const schedule = {};

    if (!hasSetSchedule && rows.length === 0) {
      const defaults = ['09:00','09:30','10:00','10:30','11:00','11:30','14:00','14:30','15:00','15:30','16:00','16:30'];
      [0, 1, 2, 3, 4].forEach(day => { schedule[day] = [...defaults]; });
      [5, 6].forEach(day => { schedule[day] = []; });
    } else {
      rows.forEach(r => {
        const slot = r.start_time.slice(0, 5);
        if (!schedule[r.day_of_week]) schedule[r.day_of_week] = [];
        schedule[r.day_of_week].push(slot);
      });
    }

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

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      // Note: We only delete overrides that have NO service_types set (i.e. pure
      // schedule overrides). Service-type overrides are kept and merged.
      // But the existing UI sends ALL overrides it knows about, so we do a full
      // wipe-and-replace just for the slot/is_off side, and keep service_types
      // intact via a separate UPDATE pass.
      const { rows: existingTypes } = await client.query(
        `SELECT override_date, service_types FROM lawyer_schedule_overrides
         WHERE lawyer_id=$1 AND service_types IS NOT NULL`,
        [req.user.id]
      );
      const typeMap = {};
      existingTypes.forEach(r => {
        const k = typeof r.override_date === 'string'
          ? r.override_date.split('T')[0]
          : r.override_date.toISOString().split('T')[0];
        typeMap[k] = r.service_types;
      });

      await client.query('DELETE FROM lawyer_schedule_overrides WHERE lawyer_id=$1', [req.user.id]);

      for (const ov of overrides) {
        const dateKey = ov.override_date;
        const preservedTypes = typeMap[dateKey] || null;
        await client.query(
          `INSERT INTO lawyer_schedule_overrides (lawyer_id, override_date, is_off, slots, service_types)
           VALUES ($1, $2, $3, $4::jsonb, $5)`,
          [req.user.id, ov.override_date, ov.is_off, JSON.stringify(ov.slots || []),
           preservedTypes ? JSON.stringify(preservedTypes) : null]
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

// ─── NEW: Service-type availability (weekly defaults + date overrides) ───────
// GET /api/lawyers/me/service-availability
router.get('/me/service-availability', requireAuth, async (req, res, next) => {
  try {
    // Defensive create — same idempotent pattern used elsewhere in this file
    await pool.query(`
      CREATE TABLE IF NOT EXISTS lawyer_service_defaults (
        lawyer_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        day_of_week   SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
        service_types JSONB NOT NULL DEFAULT '["video","text","phone","inperson","document"]'::jsonb,
        updated_at    TIMESTAMPTZ DEFAULT NOW(),
        PRIMARY KEY (lawyer_id, day_of_week)
      )
    `).catch(() => {});
    await pool.query(`ALTER TABLE lawyer_schedule_overrides ADD COLUMN IF NOT EXISTS service_types JSONB DEFAULT NULL`).catch(() => {});

    const { rows: defaults } = await pool.query(
      `SELECT day_of_week, service_types
       FROM lawyer_service_defaults
       WHERE lawyer_id=$1
       ORDER BY day_of_week`,
      [req.user.id]
    );
    const { rows: overrides } = await pool.query(
      `SELECT override_date, service_types
       FROM lawyer_schedule_overrides
       WHERE lawyer_id=$1 AND service_types IS NOT NULL`,
      [req.user.id]
    );

    const dMap = {};
    defaults.forEach(d => { dMap[d.day_of_week] = d.service_types; });

    res.json({
      defaults: dMap,
      overrides: overrides.map(o => ({
        override_date: typeof o.override_date === 'string'
          ? o.override_date.split('T')[0]
          : o.override_date.toISOString().split('T')[0],
        service_types: o.service_types,
      })),
    });
  } catch (err) { next(err); }
});

// POST /api/lawyers/me/service-availability
// Body: {
//   defaults?:  { 0: ["video","text",...], 1: [...], ... }   (replaces all)
//   overrides?: [ { override_date, service_types: [...] | null }, ... ]
// }
router.post('/me/service-availability', requireAuth, async (req, res, next) => {
  const { defaults, overrides } = req.body || {};
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS lawyer_service_defaults (
        lawyer_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        day_of_week   SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
        service_types JSONB NOT NULL DEFAULT '["video","text","phone","inperson","document"]'::jsonb,
        updated_at    TIMESTAMPTZ DEFAULT NOW(),
        PRIMARY KEY (lawyer_id, day_of_week)
      )
    `).catch(() => {});
    await client.query(`ALTER TABLE lawyer_schedule_overrides ADD COLUMN IF NOT EXISTS service_types JSONB DEFAULT NULL`).catch(() => {});

    await client.query('BEGIN');

    // Defaults — full replace
    if (defaults && typeof defaults === 'object') {
      await client.query('DELETE FROM lawyer_service_defaults WHERE lawyer_id=$1', [req.user.id]);
      for (const [dayStr, types] of Object.entries(defaults)) {
        const day = parseInt(dayStr, 10);
        if (Number.isNaN(day) || day < 0 || day > 6) continue;
        const clean = sanitizeServiceTypes(types);
        await client.query(
          `INSERT INTO lawyer_service_defaults (lawyer_id, day_of_week, service_types, updated_at)
           VALUES ($1, $2, $3::jsonb, NOW())`,
          [req.user.id, day, JSON.stringify(clean)]
        );
      }
    }

    // Overrides — upsert per date
    if (Array.isArray(overrides)) {
      for (const ov of overrides) {
        if (!ov?.override_date) continue;
        const types = ov.service_types === null ? null : sanitizeServiceTypes(ov.service_types);
        await client.query(
          `INSERT INTO lawyer_schedule_overrides (lawyer_id, override_date, is_off, slots, service_types)
           VALUES ($1, $2, false, '[]'::jsonb, $3)
           ON CONFLICT (lawyer_id, override_date)
           DO UPDATE SET service_types = EXCLUDED.service_types`,
          [req.user.id, ov.override_date, types === null ? null : JSON.stringify(types)]
        );
      }
    }

    await client.query('COMMIT');
    res.json({ ok: true });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
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
