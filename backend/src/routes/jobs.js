const router = require('express').Router();
const pool   = require('../config/db');
const { validate, rules } = require('../middleware/validate');
const { requireAuth } = require('../middleware/auth');

// Seed demo jobs if table is empty
async function seedJobsIfEmpty() {
  const { rows } = await pool.query('SELECT COUNT(*) FROM jobs').catch(() => ({ rows: [{ count: '0' }] }));
  if (parseInt(rows[0].count) > 0) return;
  const DEMO = [
    ['Legal Counsel – Corporate Division','CIB Bank','Cairo, Dokki','Full-time',25000,35000,'CIB Bank seeks an experienced corporate lawyer for M&A and regulatory work.','["5+ years corporate law","Bar Association membership","Fluent Arabic/English"]',true],
    ['Family Law Associate','El-Shafei Law Firm','Alexandria','Full-time',12000,18000,'Growing family law firm seeking a motivated associate for divorce and custody cases.','["2+ years family law","Strong Arabic drafting skills"]',false],
    ['In-House Legal Counsel','Orascom Construction','Cairo, New Cairo','Full-time',30000,45000,'Major construction company seeking experienced lawyer for contracts and disputes.','["7+ years legal experience","Construction law preferred"]',false],
    ['Legal Trainee / Intern','Hassan & Partners','Cairo, Downtown','Internship',2000,4000,'Prestigious law firm offering 6-month training for recent graduates.','["Recent law graduate","Academic excellence"]',false],
    ['IP & Technology Lawyer','Telecom Egypt','Cairo, Heliopolis','Full-time',20000,28000,'Telecom Egypt needs IP/Tech lawyer for patents and data protection.','["4+ years IP/tech law","GDPR knowledge"]',true],
    ['Freelance Contract Reviewer','Multiple Clients','Remote','Freelance',500,2000,'Various clients seeking experienced contract reviewers.','["3+ years contract experience"]',false],
  ];
  for (const d of DEMO) {
    await pool.query(
      `INSERT INTO jobs (title,company,location,type,salary_min,salary_max,description,requirements,urgent)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT DO NOTHING`,
      d
    ).catch(() => {});
  }
}

// GET /api/jobs
router.get('/', async (req, res, next) => {
  try {
    await seedJobsIfEmpty();
    const { type, search } = req.query;
    const params = [];
    let where = 'WHERE is_active=true';
    if (type)   { params.push(type);          where += ` AND type=$${params.length}`; }
    if (search) { params.push(`%${search}%`); where += ` AND (title ILIKE $${params.length} OR company ILIKE $${params.length})`; }
    const { rows } = await pool.query(`SELECT * FROM jobs ${where} ORDER BY urgent DESC, created_at DESC`, params);
    res.json({ jobs: rows });
  } catch (err) { next(err); }
});

// GET /api/jobs/:id
router.get('/:id', async (req, res, next) => {
  try {
    const { rows: [job] } = await pool.query('SELECT * FROM jobs WHERE id=$1 AND is_active=true', [req.params.id]);
    if (!job) return res.status(404).json({ message: 'Job not found' });
    res.json({ job });
  } catch (err) { next(err); }
});

// POST /api/jobs/:id/apply
router.post('/:id/apply', requireAuth, async (req, res, next) => {
  try {
    const { coverLetter } = req.body;
    await pool.query(
      `INSERT INTO job_applications (job_id, user_id, cover_letter)
       VALUES ($1,$2,$3) ON CONFLICT (job_id, user_id) DO NOTHING`,
      [req.params.id, req.user.id, coverLetter||'']
    );
    res.json({ ok: true, message: 'تم إرسال طلبك بنجاح!' });
  } catch (err) { next(err); }
});

// POST /api/jobs — post a job (admin or verified lawyer)
router.post('/', requireAuth, async (req, res, next) => {
  try {
    const { title, company, location, type, salary_min, salary_max, description, requirements, urgent } = req.body;
    if (!title || !company) return res.status(400).json({ message: 'title and company required' });
    const { rows: [job] } = await pool.query(
      `INSERT INTO jobs (title,company,location,type,salary_min,salary_max,description,requirements,urgent,posted_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [title, company, location||'', type||'Full-time', salary_min||0, salary_max||0,
       description||'', JSON.stringify(requirements||[]), !!urgent, req.user.id]
    );
    res.status(201).json({ job });
  } catch (err) { next(err); }
});

module.exports = router;
