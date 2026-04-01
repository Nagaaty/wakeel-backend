const router = require('express').Router();
const pool   = require('../config/db');
const { requireAuth } = require('../middleware/auth');

// GET /api/notifications
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM notifications WHERE user_id=$1 ORDER BY created_at DESC LIMIT 60`,
      [req.user.id]
    );
    res.json({ notifications: rows });
  } catch (err) { next(err); }
});

// POST /api/notifications — create notification (internal use)
router.post('/', requireAuth, async (req, res, next) => {
  try {
    const { userId, type, title, body, link } = req.body;
    const targetId = userId || req.user.id;
    const { rows: [notif] } = await pool.query(
      `INSERT INTO notifications (user_id, type, title, body, link)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [targetId, type||'system', title, body||'', link||'/']
    );
    // Emit via Socket.io if available
    const io = req.app.get('io');
    if (io) io.to(`user:${targetId}`).emit('notification:new', notif);
    res.status(201).json({ notification: notif });
  } catch (err) { next(err); }
});

// PATCH /api/notifications/:id/read
router.patch('/:id/read', requireAuth, async (req, res, next) => {
  try {
    await pool.query(
      `UPDATE notifications SET read_at=NOW() WHERE id=$1 AND user_id=$2`,
      [req.params.id, req.user.id]
    );
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// PATCH /api/notifications/read-all
router.patch('/read-all', requireAuth, async (req, res, next) => {
  try {
    await pool.query(
      `UPDATE notifications SET read_at=NOW() WHERE user_id=$1 AND read_at IS NULL`,
      [req.user.id]
    );
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// GET /api/notifications/unread-count
router.get('/unread-count', requireAuth, async (req, res, next) => {
  try {
    const { rows: [{ count }] } = await pool.query(
      `SELECT COUNT(*) FROM notifications WHERE user_id=$1 AND read_at IS NULL`,
      [req.user.id]
    );
    res.json({ count: parseInt(count) });
  } catch (err) { next(err); }
});

// DELETE /api/notifications/:id
router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    await pool.query(`DELETE FROM notifications WHERE id=$1 AND user_id=$2`, [req.params.id, req.user.id]);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

module.exports = router;
