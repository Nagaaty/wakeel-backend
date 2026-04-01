const router  = require('express').Router();
const pool    = require('../config/db');
const { validate, rules } = require('../middleware/validate');
const { requireAuth } = require('../middleware/auth');

// Schema: court_dates table
// CREATE TABLE IF NOT EXISTS court_dates (
//   id          SERIAL PRIMARY KEY,
//   user_id     INTEGER REFERENCES users(id) ON DELETE CASCADE,
//   title       VARCHAR(200) NOT NULL,
//   court       VARCHAR(200),
//   case_ref    VARCHAR(100),
//   date        DATE NOT NULL,
//   time        VARCHAR(20),
//   type        VARCHAR(30) DEFAULT 'hearing',  -- hearing|deadline|meeting
//   reminder    BOOLEAN DEFAULT true,
//   notes       TEXT,
//   created_at  TIMESTAMPTZ DEFAULT NOW()
// );

// GET  /api/court-dates
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM court_dates WHERE user_id=$1 ORDER BY date ASC',
      [req.user.id]
    );
    // Fallback demo data if empty
    if (rows.length === 0) {
      return res.json({ dates: [
        { id:1, title:'Preliminary Hearing', court:'Cairo Family Court', date:'2026-04-10', time:'10:00 AM', type:'hearing', reminder:true, notes:'Bring ID and marriage certificate' },
        { id:2, title:'Submit Evidence Deadline', court:'Cairo Civil Court', date:'2026-04-15', time:'12:00 PM', type:'deadline', reminder:true, notes:'3 copies required' },
        { id:3, title:'Mediation Meeting', court:'Giza Mediation Center', date:'2026-04-22', time:'2:00 PM', type:'meeting', reminder:true, notes:'Both parties must attend' },
      ]});
    }
    res.json({ dates: rows });
  } catch (err) { next(err); }
});

// POST /api/court-dates
router.post('/', requireAuth, async (req, res, next) => {
  try {
    const { title, court, case_ref, date, time, type, reminder, notes } = req.body;
    if (!title || !date) return res.status(400).json({ message: 'title and date required' });
    const { rows: [row] } = await pool.query(
      `INSERT INTO court_dates (user_id,title,court,case_ref,date,time,type,reminder,notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [req.user.id, title, court||'', case_ref||'', date, time||'', type||'hearing', reminder!==false, notes||'']
    );
    res.status(201).json({ date: row });
  } catch (err) { next(err); }
});

// DELETE /api/court-dates/:id
router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    await pool.query('DELETE FROM court_dates WHERE id=$1 AND user_id=$2', [req.params.id, req.user.id]);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

module.exports = router;
