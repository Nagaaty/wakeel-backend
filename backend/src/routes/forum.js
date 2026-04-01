const router = require('express').Router();
const pool   = require('../config/db');
const { requireAuth } = require('../middleware/auth');

// GET  /api/forum/questions
router.get('/questions', async (req, res, next) => {
  try {
    const { cat, search } = req.query;
    let q = `SELECT fq.*, u.name as asked_by,
              (SELECT COUNT(*) FROM forum_answers fa WHERE fa.question_id=fq.id) as answer_count
              FROM forum_questions fq
              LEFT JOIN users u ON u.id=fq.user_id
              WHERE fq.is_visible=true`;
    const params = [];
    if (cat)    { params.push(cat);    q += ` AND fq.category=$${params.length}`; }
    if (search) { params.push('%'+search+'%'); q += ` AND (fq.question ILIKE $${params.length} OR fq.category ILIKE $${params.length})`; }
    q += ' ORDER BY fq.created_at DESC LIMIT 50';
    const { rows } = await pool.query(q, params);
    res.json({ questions: rows });
  } catch (err) { next(err); }
});

// POST /api/forum/questions
router.post('/questions', requireAuth, async (req, res, next) => {
  try {
    const { question, category, anonymous } = req.body;
    if (!question || !category) return res.status(400).json({ message: 'question and category required' });
    const { rows: [row] } = await pool.query(
      `INSERT INTO forum_questions (user_id, question, category, anonymous, is_visible)
       VALUES ($1,$2,$3,$4,true) RETURNING *`,
      [req.user.id, question, category, anonymous !== false]
    );
    res.status(201).json({ question: { ...row, asked_by: anonymous ? 'Anonymous' : req.user.name, answer_count: 0, views: 1 }});
  } catch (err) { next(err); }
});

// POST /api/forum/questions/:id/like
router.post('/questions/:id/like', requireAuth, async (req, res, next) => {
  try {
    const { rows: [row] } = await pool.query(
      `UPDATE forum_questions SET likes_count = COALESCE(likes_count, 0) + 1 WHERE id=$1 RETURNING *`,
      [req.params.id]
    );
    if (!row) return res.status(404).json({ message: 'Post not found' });
    res.json({ question: row });
  } catch (err) { next(err); }
});

// GET /api/forum/questions/:id/answers
router.get('/questions/:id/answers', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT fa.*, u.name as lawyer_name, lp.specialization
       FROM forum_answers fa
       JOIN users u ON u.id=fa.lawyer_id
       LEFT JOIN lawyer_profiles lp ON lp.user_id=fa.lawyer_id
       WHERE fa.question_id=$1 ORDER BY fa.is_accepted DESC, fa.upvotes DESC`,
      [req.params.id]
    );
    res.json({ answers: rows });
  } catch (err) { next(err); }
});

// POST /api/forum/questions/:id/answers  (lawyers only)
router.post('/questions/:id/answers', requireAuth, async (req, res, next) => {
  try {
    const { answer } = req.body;
    if (!answer) return res.status(400).json({ message: 'answer required' });
    const { rows: [row] } = await pool.query(
      `INSERT INTO forum_answers (question_id, lawyer_id, answer) VALUES ($1,$2,$3) RETURNING *`,
      [req.params.id, req.user.id, answer]
    );
    res.status(201).json({ answer: row });
  } catch (err) { next(err); }
});

module.exports = router;
