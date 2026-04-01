const router = require('express').Router();
const pool   = require('../config/db');
const { validate, rules } = require('../middleware/validate');
const { requireAuth } = require('../middleware/auth');

// GET /api/messages/conversations
router.get('/conversations', requireAuth, async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT c.*,
         CASE WHEN c.client_id=$1 THEN lu.name ELSE cu.name END AS other_name,
         CASE WHEN c.client_id=$1 THEN lu.avatar_url ELSE cu.avatar_url END AS other_avatar,
         CASE WHEN c.client_id=$1 THEN c.lawyer_id ELSE c.client_id END AS other_id,
         CASE WHEN c.client_id=$1 THEN lu.is_online ELSE cu.is_online END AS other_online,
         (SELECT COUNT(*) FROM messages m WHERE m.conversation_id=c.id AND m.sender_id!=$1 AND m.read_at IS NULL) AS unread_count
       FROM conversations c
       JOIN users cu ON cu.id=c.client_id
       JOIN users lu ON lu.id=c.lawyer_id
       WHERE c.client_id=$1 OR c.lawyer_id=$1
       ORDER BY c.last_message_at DESC NULLS LAST`,
      [req.user.id]
    );
    res.json({ conversations: rows });
  } catch (err) { next(err); }
});

// GET /api/messages/conversations/:id — get messages in a conversation
router.get('/conversations/:id', requireAuth, async (req, res, next) => {
  try {
    const convId = req.params.id;

    // Verify access
    const { rows: [conv] } = await pool.query(
      'SELECT * FROM conversations WHERE id=$1 AND (client_id=$2 OR lawyer_id=$2)',
      [convId, req.user.id]
    );
    if (!conv) return res.status(404).json({ message: 'Conversation not found' });

    const { page = 1, limit = 50 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const { rows } = await pool.query(
      `SELECT m.*, u.name AS sender_name, u.avatar_url AS sender_avatar
       FROM messages m
       JOIN users u ON u.id=m.sender_id
       WHERE m.conversation_id=$1
       ORDER BY m.created_at DESC
       LIMIT $2 OFFSET $3`,
      [convId, parseInt(limit), offset]
    );

    // Mark messages as read
    await pool.query(
      `UPDATE messages SET read_at=NOW()
       WHERE conversation_id=$1 AND sender_id!=$2 AND read_at IS NULL`,
      [convId, req.user.id]
    );

    res.json({ messages: rows.reverse(), conversationId: convId });
  } catch (err) { next(err); }
});

// POST /api/messages/conversations/:id — send a message (REST fallback for Socket.io)
router.post('/conversations/:id', requireAuth, async (req, res, next) => {
  try {
    const { content, attachmentUrl } = req.body;
    if (!content?.trim() && !attachmentUrl) return res.status(400).json({ message: 'content or attachment required' });

    const { rows: [conv] } = await pool.query(
      'SELECT * FROM conversations WHERE id=$1 AND (client_id=$2 OR lawyer_id=$2)',
      [req.params.id, req.user.id]
    );
    if (!conv) return res.status(404).json({ message: 'Conversation not found' });

    const { rows: [msg] } = await pool.query(
      `INSERT INTO messages (conversation_id, sender_id, content, attachment_url)
       VALUES ($1,$2,$3,$4) RETURNING *`,
      [req.params.id, req.user.id, content?.trim()||'', attachmentUrl||null]
    );

    await pool.query(
      `UPDATE conversations SET last_message=$1, last_message_at=NOW() WHERE id=$2`,
      [content?.slice(0,100)||'📎 مرفق', req.params.id]
    );

    // Emit via Socket.io if available
    const io = req.app.get('io');
    if (io) {
      io.to(`conv:${req.params.id}`).emit('message:new', { ...msg, sender_id: req.user.id });
    }

    res.status(201).json({ message: msg });
  } catch (err) { next(err); }
});

// POST /api/messages/conversations — create a new conversation
router.post('/conversations', requireAuth, async (req, res, next) => {
  try {
    const { lawyerId } = req.body;
    if (!lawyerId) return res.status(400).json({ message: 'lawyerId required' });

    // Get or create
    let { rows: [conv] } = await pool.query(
      'SELECT * FROM conversations WHERE client_id=$1 AND lawyer_id=$2',
      [req.user.id, lawyerId]
    );
    if (!conv) {
      const { rows: [newConv] } = await pool.query(
        'INSERT INTO conversations (client_id, lawyer_id) VALUES ($1,$2) RETURNING *',
        [req.user.id, lawyerId]
      );
      conv = newConv;
    }
    res.status(201).json({ conversation: conv });
  } catch (err) { next(err); }
});

// GET /api/messages/unread-count
router.get('/unread-count', requireAuth, async (req, res, next) => {
  try {
    const { rows: [{ count }] } = await pool.query(
      `SELECT COUNT(*) FROM messages m
       JOIN conversations c ON c.id=m.conversation_id
       WHERE (c.client_id=$1 OR c.lawyer_id=$1) AND m.sender_id!=$1 AND m.read_at IS NULL`,
      [req.user.id]
    );
    res.json({ count: parseInt(count) });
  } catch (err) { next(err); }
});

module.exports = router;
