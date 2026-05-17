const router = require('express').Router();
const pool   = require('../config/db');
const { requireAuth, optionalAuth } = require('../middleware/auth');



// ── GET /api/jobs ────────────────────────────────────────────────────────────
router.get('/', optionalAuth, async (req, res, next) => {
  try {
    const { type, search, page = 1, limit = 20 } = req.query;
    const offset = (parseInt(String(page)) - 1) * parseInt(String(limit));

    const conditions = ['j.is_active = true'];
    const params = [];

    if (type) { params.push(type); conditions.push(`j.type = $${params.length}`); }
    if (search) {
      params.push(`%${search}%`);
      const n = params.length;
      conditions.push(`(j.title ILIKE $${n} OR j.company ILIKE $${n})`);
    }

    const where = conditions.join(' AND ');
    const countParams = [...params];
    params.push(parseInt(String(limit)), offset);

    // Simple query — no complex subqueries that can cause type errors
    const { rows: jobs } = await pool.query(`
      SELECT j.*,
        u.name       AS poster_name,
        u.avatar_url AS poster_avatar,
        (SELECT COUNT(*)::int FROM job_applications ja WHERE ja.job_id = j.id) AS applicant_count,
        (SELECT COUNT(*)::int FROM job_saves        js WHERE js.job_id = j.id) AS save_count,
        false AS is_saved,
        false AS has_applied
      FROM jobs j
      LEFT JOIN users u ON u.id::text = j.posted_by::text
      WHERE ${where}
      ORDER BY j.urgent DESC, j.created_at DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}
    `, params);

    // If user is logged in, enrich is_saved / has_applied in JS (no SQL type issues)
    const uid = req.user?.id ? String(req.user.id) : null;
    if (uid && jobs.length > 0) {
      const ids = jobs.map(j => j.id);
      const [savedRows, appliedRows] = await Promise.all([
        pool.query(`SELECT job_id FROM job_saves WHERE user_id=$1 AND job_id=ANY($2)`, [uid, ids]).catch(() => ({ rows: [] })),
        pool.query(`SELECT job_id FROM job_applications WHERE user_id=$1 AND job_id=ANY($2)`, [uid, ids]).catch(() => ({ rows: [] })),
      ]);
      const savedSet   = new Set(savedRows.rows.map(r => r.job_id));
      const appliedSet = new Set(appliedRows.rows.map(r => r.job_id));
      jobs.forEach(j => {
        j.is_saved    = savedSet.has(j.id);
        j.has_applied = appliedSet.has(j.id);
      });
    }

    const { rows: [{ total }] } = await pool.query(
      `SELECT COUNT(*)::int AS total FROM jobs j WHERE ${where}`, countParams
    );

    res.json({ jobs, total });
  } catch (err) {
    console.error('[GET /api/jobs]', err.message);
    next(err);
  }
});

// ── GET /api/jobs/saved ──────────────────────────────────────────────────────
router.get('/saved', requireAuth, async (req, res, next) => {
  try {

    const uid = String(req.user.id);
    const { rows: jobs } = await pool.query(`
      SELECT j.*, u.name AS poster_name, u.avatar_url AS poster_avatar,
        true AS is_saved, false AS has_applied,
        (SELECT COUNT(*)::int FROM job_applications WHERE job_id=j.id) AS applicant_count,
        0 AS save_count
      FROM job_saves s
      JOIN jobs j ON j.id = s.job_id
      LEFT JOIN users u ON u.id::text = j.posted_by::text
      WHERE s.user_id = $1 AND j.is_active = true
      ORDER BY j.created_at DESC
    `, [uid]);
    res.json({ jobs });
  } catch (err) { next(err); }
});

// ── GET /api/jobs/my ─────────────────────────────────────────────────────────
router.get('/my', requireAuth, async (req, res, next) => {
  try {

    const uid = String(req.user.id);
    const { rows: jobs } = await pool.query(`
      SELECT j.*, false AS is_saved, false AS has_applied,
        (SELECT COUNT(*)::int FROM job_applications WHERE job_id=j.id) AS applicant_count,
        0 AS save_count
      FROM jobs j WHERE j.posted_by = $1 ORDER BY j.created_at DESC
    `, [uid]);
    res.json({ jobs });
  } catch (err) { next(err); }
});

// ── GET /api/jobs/:id ────────────────────────────────────────────────────────
router.get('/:id', optionalAuth, async (req, res, next) => {
  try {
    const { rows: [job] } = await pool.query(`
      SELECT j.*, u.name AS poster_name, u.avatar_url AS poster_avatar,
        false AS is_saved, false AS has_applied,
        (SELECT COUNT(*)::int FROM job_applications WHERE job_id=j.id) AS applicant_count,
        0 AS save_count
      FROM jobs j
      LEFT JOIN users u ON u.id::text = j.posted_by::text
      WHERE j.id = $1
    `, [req.params.id]);
    if (!job) return res.status(404).json({ message: 'Job not found' });
    res.json({ job });
  } catch (err) { next(err); }
});

// ── POST /api/jobs/:id/apply ─────────────────────────────────────────────────
router.post('/:id/apply', requireAuth, async (req, res, next) => {
  try {

    const uid = String(req.user.id);
    await pool.query(
      `INSERT INTO job_applications (job_id, user_id, cover_letter, cv_url)
       VALUES ($1,$2,$3,$4) ON CONFLICT (job_id, user_id) DO NOTHING`,
      [req.params.id, uid, req.body.coverLetter || '', req.body.cv_url || '']
    );
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// ── POST /api/jobs/:id/save ──────────────────────────────────────────────────
router.post('/:id/save', requireAuth, async (req, res, next) => {
  try {

    const uid = String(req.user.id);
    const { rows: [ex] } = await pool.query(
      'SELECT 1 FROM job_saves WHERE job_id=$1 AND user_id=$2', [req.params.id, uid]
    );
    if (ex) {
      await pool.query('DELETE FROM job_saves WHERE job_id=$1 AND user_id=$2', [req.params.id, uid]);
      res.json({ saved: false });
    } else {
      await pool.query('INSERT INTO job_saves (job_id, user_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [req.params.id, uid]);
      res.json({ saved: true });
    }
  } catch (err) { next(err); }
});

// ── POST /api/jobs — post a new job ─────────────────────────────────────────
router.post('/', requireAuth, async (req, res, next) => {
  try {

    const { title, company, location, type, salary_min, salary_max, description, requirements, urgent, post_to_forum } = req.body;
    console.log('[Jobs POST] user:', req.user?.id, 'title:', title);
    if (!title || !company) return res.status(400).json({ message: 'Title and company are required' });
    const { rows: [job] } = await pool.query(
      `INSERT INTO jobs (title,company,location,type,salary_min,salary_max,description,requirements,urgent,posted_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [title, company, location || '', type || 'Full-time',
       parseInt(salary_min) || 0, parseInt(salary_max) || 0,
       description || '', JSON.stringify(requirements || []), !!urgent, String(req.user.id)]
    );

    if (post_to_forum) {
      try {
        const forumTitle = `[فرصة عمل] مطلوب ${title} لدى ${company}`;
        const forumContent = `نبحث عن ${title} للانضمام إلى ${company}.\n\nالموقع: ${location || 'غير محدد'}\nالنوع: ${type || 'دوام كامل'}\n\nالتفاصيل:\n${description || 'تفضل بزيارة قسم الوظائف للتفاصيل'}\n\nللتقديم، يرجى التوجه إلى قسم الوظائف وتقديم سيرتك الذاتية.`;
        await pool.query(
          `INSERT INTO forum_questions (lawyer_id, title, content) VALUES ($1, $2, $3)`,
          [req.user.id, forumTitle, forumContent]
        );
      } catch (err) {
        console.warn('Failed to auto-post job to forum:', err);
      }
    }

    res.status(201).json({ job });
  } catch (err) {
    console.error('[Jobs POST error]', err.message);
    next(err);
  }
});

// ── DELETE /api/jobs/:id ─────────────────────────────────────────────────────
router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    const uid = String(req.user.id);
    const { rows: [job] } = await pool.query('SELECT posted_by FROM jobs WHERE id=$1', [req.params.id]);
    if (!job) return res.status(404).json({ message: 'Not found' });
    if (job.posted_by !== uid && req.user.role !== 'admin') return res.status(403).json({ message: 'Forbidden' });
    await pool.query('UPDATE jobs SET is_active=false WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// ── GET /api/jobs/:id/applicants ─────────────────────────────────────────────
router.get('/:id/applicants', requireAuth, async (req, res, next) => {
  try {
    const uid = String(req.user.id);
    const { rows: [job] } = await pool.query('SELECT posted_by FROM jobs WHERE id=$1', [req.params.id]);
    if (!job) return res.status(404).json({ message: 'Not found' });
    if (job.posted_by !== uid && req.user.role !== 'admin') return res.status(403).json({ message: 'Forbidden' });
    const { rows } = await pool.query(`
      SELECT ja.*, u.name, u.email, u.avatar_url
      FROM job_applications ja JOIN users u ON u.id::text = ja.user_id
      WHERE ja.job_id = $1 ORDER BY ja.created_at DESC
    `, [req.params.id]);
    res.json({ applicants: rows });
  } catch (err) { next(err); }
});

module.exports = router;
