const router = require('express').Router();
const pool   = require('../config/db');
const { validate, rules } = require('../middleware/validate');
const { requireAuth } = require('../middleware/auth');

// GET /api/vault
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT dv.*, b.service_type as case_type
       FROM document_vault dv
       LEFT JOIN bookings b ON b.id = dv.booking_id
       WHERE dv.user_id=$1 ORDER BY dv.created_at DESC`,
      [req.user.id]
    );
    if (rows.length === 0) {
      return res.json({ files: [
        { id:1, name:'Employment Contract Original.pdf', type:'pdf', size:'2.4 MB', date:'2026-03-01', encrypted:true, case_type:'Labor Case' },
        { id:2, name:'Court Hearing Notice.jpg', type:'img', size:'890 KB', date:'2026-03-02', encrypted:true, case_type:'Labor Case' },
        { id:3, name:'Lawyer Notes - Session 1.docx', type:'doc', size:'45 KB', date:'2026-03-05', encrypted:true, case_type:'Labor Case' },
      ]});
    }
    res.json({ files: rows });
  } catch (err) { next(err); }
});

// POST /api/vault  (file metadata — actual file upload would use S3/Cloudflare R2 in production)
router.post('/', requireAuth, async (req, res, next) => {
  try {
    const { name, type, size, booking_id, encrypted } = req.body;
    if (!name) return res.status(400).json({ message: 'filename required' });
    const { rows: [row] } = await pool.query(
      `INSERT INTO document_vault (user_id, booking_id, name, file_type, size, encrypted)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [req.user.id, booking_id||null, name, type||'pdf', size||'0 KB', encrypted!==false]
    );
    res.status(201).json({ file: row });
  } catch (err) { next(err); }
});

// DELETE /api/vault/:id
router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    await pool.query('DELETE FROM document_vault WHERE id=$1 AND user_id=$2', [req.params.id, req.user.id]);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

module.exports = router;
