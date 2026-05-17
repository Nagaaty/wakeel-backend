const fs = require('fs');

const file = 'src/routes/lawyers.js';
let content = fs.readFileSync(file, 'utf8');

// Patch 1: Replace GET /:id/availability
const startPatch1 = '// GET /api/lawyers/:id/availability — available time slots';
const endPatch1 = '    res.json({ date, slots: available });\n  } catch (err) { next(err); }\n});';

const newPatch1 = `// GET /api/lawyers/:id/availability — available time slots
router.get('/:id/availability', async (req, res, next) => {
  try {
    const { date } = req.query; // YYYY-MM-DD
    if (!date) return res.status(400).json({ message: 'date required' });

    const lawyerId = req.params.id;
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!lawyerId || !UUID_RE.test(lawyerId)) {
      return res.status(400).json({
        message: 'Invalid lawyer ID',
        slots: [],
        available: false,
        enabled_services: [],
      });
    }

    // Idempotent schema upgrades — safe to run on every request
    await pool.query('ALTER TABLE lawyer_profiles ADD COLUMN IF NOT EXISTS has_set_schedule BOOLEAN DEFAULT false').catch(() => {});
    await pool.query('ALTER TABLE lawyer_availability ADD COLUMN IF NOT EXISTS end_time VARCHAR(5)').catch(() => {});
    await pool.query(\`
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
    \`).catch(() => {});
    await pool.query(\`ALTER TABLE lawyer_schedule_overrides ADD COLUMN IF NOT EXISTS service_types JSONB DEFAULT NULL\`).catch(() => {});
    await pool.query(\`
      CREATE TABLE IF NOT EXISTS lawyer_service_defaults (
        lawyer_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        day_of_week   SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
        service_types JSONB NOT NULL DEFAULT '["video","text","phone","inperson","document"]'::jsonb,
        updated_at    TIMESTAMPTZ DEFAULT NOW(),
        PRIMARY KEY (lawyer_id, day_of_week)
      )
    \`).catch(() => {});

    const [y, m, d] = date.split('-');
    const dayOfWeek = new Date(Number(y), Number(m) - 1, Number(d)).getDay();

    // 1) Lawyer's "has set schedule" flag
    const { rows: [profile] } = await pool.query(
      \`SELECT has_set_schedule FROM lawyer_profiles WHERE user_id=$1\`,
      [lawyerId]
    );
    const hasSetSchedule = profile?.has_set_schedule || false;

    // 2) Date override (slots + service_types)
    const { rows: [override] } = await pool.query(
      \`SELECT is_off, slots, service_types FROM lawyer_schedule_overrides
       WHERE lawyer_id=$1 AND override_date=$2\`,
      [lawyerId, date]
    );

    // 3) Booked slots
    const { rows: booked } = await pool.query(
      \`SELECT to_char(scheduled_at AT TIME ZONE 'UTC', 'HH24:MI') as start_time
       FROM bookings
       WHERE lawyer_id=$1
         AND DATE(scheduled_at AT TIME ZONE 'UTC') = $2
         AND status NOT IN ('cancelled','rejected')\`,
      [lawyerId, date]
    );
    const bookedTimes = new Set(booked.map(b => b.start_time?.slice(0, 5)));

    // 4) Resolve enabled services using the SQL function from the migration.
    //    Falls back to "all five" if no row exists.
    const { rows: [{ services: enabledServices }] } = await pool.query(
      \`SELECT resolve_lawyer_services($1, $2::date) AS services\`,
      [lawyerId, date]
    );

    // 5) Build available time slots
    let available = [];
    if (override) {
      if (!override.is_off && override.slots) {
        override.slots.forEach(time =>
          available.push({ time, available: !bookedTimes.has(time) })
        );
      }
    } else {
      const { rows: slots } = await pool.query(
        \`SELECT start_time, end_time FROM lawyer_availability
         WHERE lawyer_id=$1 AND day_of_week=$2
         ORDER BY start_time\`,
        [lawyerId, dayOfWeek]
      );
      for (const slot of slots) {
        const [sh, sm] = slot.start_time.split(':').map(Number);
        const [eh, em] = (slot.end_time || '17:00').split(':').map(Number);
        let curr = sh * 60 + sm;
        const end = eh * 60 + em;
        while (curr + 30 <= end) {
          const h = String(Math.floor(curr / 60)).padStart(2, '0');
          const m = String(curr % 60).padStart(2, '0');
          const time = \`\${h}:\${m}\`;
          available.push({ time, available: !bookedTimes.has(time) });
          curr += 30;
        }
      }
      // System default for new lawyers who haven't onboarded yet
      if (!available.length && !hasSetSchedule && dayOfWeek >= 0 && dayOfWeek <= 4) {
        ['09:00','09:30','10:00','10:30','11:00','11:30',
         '14:00','14:30','15:00','15:30','16:00','16:30'].forEach(time => {
          available.push({ time, available: !bookedTimes.has(time) });
        });
      }
    }

    res.json({
      slots: available,
      enabled_services: enabledServices, // ["video","text",...]
      is_off: override?.is_off || false,
    });
  } catch (err) { next(err); }
});`;

const p1StartIdx = content.indexOf(startPatch1);
const p1EndIdx = content.indexOf(endPatch1, p1StartIdx);
if (p1StartIdx !== -1 && p1EndIdx !== -1) {
  content = content.substring(0, p1StartIdx) + newPatch1 + content.substring(p1EndIdx + endPatch1.length);
}

// Patch 2: Add after POST /me/overrides
const endOfPostOverrides = `    res.json({ ok: true });\n  } catch (err) { next(err); }\n});`;
const newPatch2 = `\n\n// GET /api/lawyers/me/service-availability
router.get('/me/service-availability', requireAuth, async (req, res, next) => {
  try {
    const { rows: defaults } = await pool.query(
      \`SELECT day_of_week, service_types
       FROM lawyer_service_defaults
       WHERE lawyer_id=$1
       ORDER BY day_of_week\`,
      [req.user.id]
    );
    const { rows: overrides } = await pool.query(
      \`SELECT override_date, service_types
       FROM lawyer_schedule_overrides
       WHERE lawyer_id=$1 AND service_types IS NOT NULL\`,
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

const VALID_TYPES = ['video','text','phone','inperson','document'];
function sanitizeTypes(arr) {
  if (!Array.isArray(arr)) return [];
  return [...new Set(arr.filter(t => typeof t === 'string' && VALID_TYPES.includes(t)))];
}

router.post('/me/service-availability', requireAuth, async (req, res, next) => {
  const { defaults, overrides } = req.body || {};
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    if (defaults && typeof defaults === 'object') {
      await client.query('DELETE FROM lawyer_service_defaults WHERE lawyer_id=$1', [req.user.id]);
      for (const [dayStr, types] of Object.entries(defaults)) {
        const day = parseInt(dayStr, 10);
        if (Number.isNaN(day) || day < 0 || day > 6) continue;
        const clean = sanitizeTypes(types);
        await client.query(
          \`INSERT INTO lawyer_service_defaults (lawyer_id, day_of_week, service_types, updated_at)
           VALUES ($1, $2, $3::jsonb, NOW())\`,
          [req.user.id, day, JSON.stringify(clean)]
        );
      }
    }

    if (Array.isArray(overrides)) {
      for (const ov of overrides) {
        if (!ov?.override_date) continue;
        const types = ov.service_types === null ? null : sanitizeTypes(ov.service_types);
        await client.query(
          \`INSERT INTO lawyer_schedule_overrides (lawyer_id, override_date, is_off, slots, service_types)
           VALUES ($1, $2, false, '[]'::jsonb, $3)
           ON CONFLICT (lawyer_id, override_date)
           DO UPDATE SET service_types = EXCLUDED.service_types\`,
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
});`;

const p2Idx = content.indexOf(endOfPostOverrides);
if (p2Idx !== -1) {
  content = content.substring(0, p2Idx + endOfPostOverrides.length) + newPatch2 + content.substring(p2Idx + endOfPostOverrides.length);
}

fs.writeFileSync(file, content);
console.log('Lawyers patches applied');
