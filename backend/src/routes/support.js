const router = require('express').Router();
const pool   = require('../config/db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { sendWhatsApp } = require('../utils/whatsapp');

// ─── Support Ticket System ───────────────────────────────────────────────────
// Endpoints:
//   POST   /api/support/tickets              → create ticket (any user)
//   GET    /api/support/tickets              → list own tickets (client/lawyer)
//   GET    /api/support/tickets/:id          → get ticket + messages
//   POST   /api/support/tickets/:id/messages → reply to ticket
//   PATCH  /api/support/tickets/:id/status   → update status (admin/agent)
//   GET    /api/support/admin/tickets        → all tickets (admin only)
//   POST   /api/support/tickets/:id/ai-reply → get AI draft reply (admin)
// ─────────────────────────────────────────────────────────────────────────────

// POST /api/support/tickets — create a new ticket
router.post('/tickets', requireAuth, async (req, res, next) => {
  try {
    const { subject, category, body, bookingId, priority } = req.body;
    if (!subject || !body) return res.status(400).json({ message: 'subject and body required' });

    const { rows: [ticket] } = await pool.query(`
      INSERT INTO support_tickets
        (user_id, booking_id, subject, category, priority, status, user_name, user_email, user_phone)
      VALUES ($1,$2,$3,$4,$5,'open',$6,$7,$8)
      RETURNING *
    `, [
      req.user.id,
      bookingId || null,
      subject,
      category || 'general',
      priority || 'normal',
      req.user.name,
      req.user.email,
      req.user.phone || null,
    ]);

    // Save first message
    await pool.query(
      `INSERT INTO ticket_messages (ticket_id, sender_id, sender_role, body) VALUES ($1,$2,'user',$3)`,
      [ticket.id, req.user.id, body]
    );

    // Notify admins via DB notification
    const { rows: admins } = await pool.query(`SELECT id FROM users WHERE role='admin'`);
    for (const admin of admins) {
      await pool.query(
        `INSERT INTO notifications (user_id, title, body, type) VALUES ($1,$2,$3,'support')`,
        [admin.id, `🎫 New Ticket: ${subject}`, `From ${req.user.name} — ${category}`]
      ).catch(() => {});
    }

    // WhatsApp confirmation to user
    if (req.user.phone) {
      sendWhatsApp(req.user.phone,
        `✅ *Wakeel.eg Support*\n\nYour ticket has been received.\n🎫 Ticket ID: ${ticket.id.slice(0,8).toUpperCase()}\n📋 Subject: ${subject}\n\nOur team will respond within 2 hours. You can check status at wakeel.eg/support`
      ).catch(() => {});
    }

    res.status(201).json({ ticket, message: 'Ticket created successfully' });
  } catch (err) { next(err); }
});

// GET /api/support/tickets — list user's own tickets
router.get('/tickets', requireAuth, async (req, res, next) => {
  try {
    const { rows } = await pool.query(`
      SELECT t.*,
        (SELECT COUNT(*) FROM ticket_messages WHERE ticket_id=t.id) AS message_count,
        (SELECT body FROM ticket_messages WHERE ticket_id=t.id ORDER BY created_at DESC LIMIT 1) AS last_message
      FROM support_tickets t
      WHERE t.user_id=$1
      ORDER BY t.created_at DESC
    `, [req.user.id]);
    res.json(rows);
  } catch (err) { next(err); }
});

// GET /api/support/tickets/:id — get single ticket with all messages
router.get('/tickets/:id', requireAuth, async (req, res, next) => {
  try {
    const { rows: [ticket] } = await pool.query(
      `SELECT * FROM support_tickets WHERE id=$1 AND (user_id=$2 OR $3)`,
      [req.params.id, req.user.id, req.user.role === 'admin']
    );
    if (!ticket) return res.status(404).json({ message: 'Ticket not found' });

    const { rows: messages } = await pool.query(`
      SELECT m.*, u.name AS sender_name
      FROM ticket_messages m
      LEFT JOIN users u ON u.id = m.sender_id
      WHERE m.ticket_id=$1
      ORDER BY m.created_at ASC
    `, [req.params.id]);

    res.json({ ticket, messages });
  } catch (err) { next(err); }
});

// POST /api/support/tickets/:id/messages — reply to ticket
router.post('/tickets/:id/messages', requireAuth, async (req, res, next) => {
  try {
    const { body } = req.body;
    if (!body) return res.status(400).json({ message: 'body required' });

    const { rows: [ticket] } = await pool.query(
      `SELECT * FROM support_tickets WHERE id=$1`,
      [req.params.id]
    );
    if (!ticket) return res.status(404).json({ message: 'Ticket not found' });

    // Only ticket owner or admin can reply
    const isOwner = ticket.user_id === req.user.id;
    const isAdmin = req.user.role === 'admin';
    if (!isOwner && !isAdmin) return res.status(403).json({ message: 'Forbidden' });

    const role = isAdmin ? 'agent' : 'user';

    const { rows: [msg] } = await pool.query(
      `INSERT INTO ticket_messages (ticket_id, sender_id, sender_role, body) VALUES ($1,$2,$3,$4) RETURNING *`,
      [req.params.id, req.user.id, role, body]
    );

    // Update ticket updated_at and status
    const newStatus = isAdmin && ticket.status === 'open' ? 'in_progress' : ticket.status;
    await pool.query(
      `UPDATE support_tickets SET updated_at=NOW(), status=$1 WHERE id=$2`,
      [newStatus, req.params.id]
    );

    // Notify the other party
    const notifyUserId = isAdmin ? ticket.user_id : null;
    if (notifyUserId) {
      await pool.query(
        `INSERT INTO notifications (user_id, title, body, type) VALUES ($1,$2,$3,'support')`,
        [notifyUserId, '💬 Support Reply', `Your ticket "${ticket.subject}" has a new reply`]
      ).catch(() => {});
      // WhatsApp to client
      const { rows: [u] } = await pool.query('SELECT phone FROM users WHERE id=$1', [notifyUserId]);
      if (u?.phone) sendWhatsApp(u.phone, `💬 *Wakeel.eg Support*\n\nNew reply on your ticket: "${ticket.subject}"\n\nReply: ${body.slice(0,100)}...`).catch(() => {});
    }

    res.status(201).json({ message: msg, status: newStatus });
  } catch (err) { next(err); }
});

// PATCH /api/support/tickets/:id/status — update ticket status (admin)
router.patch('/tickets/:id/status', requireAuth, requireRole('admin'), async (req, res, next) => {
  try {
    const { status } = req.body;
    const validStatuses = ['open', 'in_progress', 'resolved', 'closed'];
    if (!validStatuses.includes(status)) return res.status(400).json({ message: 'Invalid status' });

    const resolvedAt = status === 'resolved' ? 'NOW()' : 'NULL';
    const { rows: [ticket] } = await pool.query(
      `UPDATE support_tickets SET status=$1, updated_at=NOW(), resolved_at=${resolvedAt} WHERE id=$2 RETURNING *`,
      [status, req.params.id]
    );
    if (!ticket) return res.status(404).json({ message: 'Ticket not found' });

    // Notify user of resolution
    if (status === 'resolved' && ticket.user_id) {
      await pool.query(
        `INSERT INTO notifications (user_id, title, body, type) VALUES ($1,$2,$3,'support')`,
        [ticket.user_id, '✅ Ticket Resolved', `Your ticket "${ticket.subject}" has been resolved`]
      ).catch(() => {});
    }
    res.json(ticket);
  } catch (err) { next(err); }
});

// GET /api/support/admin/tickets — all tickets for admin
router.get('/admin/tickets', requireAuth, requireRole('admin'), async (req, res, next) => {
  try {
    const { status, priority, page = 1, limit = 20 } = req.query;
    const conditions = [];
    const params = [];
    if (status)   { params.push(status);   conditions.push(`t.status=$${params.length}`); }
    if (priority) { params.push(priority); conditions.push(`t.priority=$${params.length}`); }
    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

    params.push(parseInt(limit));
    params.push((parseInt(page) - 1) * parseInt(limit));

    const { rows } = await pool.query(`
      SELECT t.*, u.name AS user_name, u.email AS user_email, u.phone AS user_phone,
        (SELECT COUNT(*) FROM ticket_messages WHERE ticket_id=t.id) AS message_count,
        (SELECT body FROM ticket_messages WHERE ticket_id=t.id ORDER BY created_at DESC LIMIT 1) AS last_message,
        (SELECT created_at FROM ticket_messages WHERE ticket_id=t.id ORDER BY created_at DESC LIMIT 1) AS last_message_at
      FROM support_tickets t
      LEFT JOIN users u ON u.id = t.user_id
      ${where}
      ORDER BY
        CASE t.priority WHEN 'urgent' THEN 1 WHEN 'high' THEN 2 WHEN 'normal' THEN 3 ELSE 4 END,
        t.created_at DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}
    `, params);

    const { rows: [{ count }] } = await pool.query(`SELECT COUNT(*) FROM support_tickets ${where}`, params.slice(0, -2));
    res.json({ tickets: rows, total: parseInt(count) });
  } catch (err) { next(err); }
});

// POST /api/support/tickets/:id/ai-reply — get AI draft (for admin to send)
router.post('/tickets/:id/ai-reply', requireAuth, requireRole('admin'), async (req, res, next) => {
  try {
    const { rows: [ticket] } = await pool.query('SELECT * FROM support_tickets WHERE id=$1', [req.params.id]);
    if (!ticket) return res.status(404).json({ message: 'Ticket not found' });

    const { rows: messages } = await pool.query(
      'SELECT body, sender_role FROM ticket_messages WHERE ticket_id=$1 ORDER BY created_at ASC',
      [req.params.id]
    );

    const key = process.env.ANTHROPIC_API_KEY;
    if (!key || key === 'your_anthropic_api_key') {
      return res.json({ reply: 'Thank you for contacting Wakeel.eg support. We have reviewed your issue and our team will assist you shortly.' });
    }

    const conversation = messages.map(m => `${m.sender_role === 'user' ? 'User' : 'Agent'}: ${m.body}`).join('\n');
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514', max_tokens: 300,
        system: 'You are a customer service agent for Wakeel.eg, an Egyptian legal marketplace. Write a professional, empathetic reply to the customer. Be concise and helpful. Reply in the same language as the customer.',
        messages: [{ role: 'user', content: `Ticket subject: ${ticket.subject}\nCategory: ${ticket.category}\n\nConversation:\n${conversation}\n\nWrite a helpful agent reply:` }]
      })
    });
    const data = await r.json();
    res.json({ reply: data.content?.[0]?.text || 'Thank you for your message. We will assist you shortly.' });
  } catch (err) { next(err); }
});

module.exports = router;

// ── Rate a resolved ticket (user) ─────────────────────────────────────────────
router.post('/tickets/:id/rate', requireAuth, async (req, res, next) => {
  try {
    const { rating, comment } = req.body;
    if (!rating || rating < 1 || rating > 5) return res.status(400).json({ message: 'Rating must be 1-5' });

    const { rows:[ticket] } = await pool.query(
      `UPDATE support_tickets SET rating=$1, rating_comment=$2 WHERE id=$3 AND user_id=$4 RETURNING *`,
      [rating, comment||null, req.params.id, req.user.id]
    );
    if (!ticket) return res.status(404).json({ message: 'Ticket not found' });
    res.json({ message: 'Rating saved', ticket });
  } catch (err) { next(err); }
});

// ── Assign ticket to agent (admin) ────────────────────────────────────────────
router.patch('/tickets/:id/assign', requireAuth, requireRole('admin'), async (req, res, next) => {
  try {
    const { agentId } = req.body;
    const { rows:[t] } = await pool.query(
      `UPDATE support_tickets SET assigned_to=$1, status='in_progress', updated_at=NOW() WHERE id=$2 RETURNING *`,
      [agentId || req.user.id, req.params.id]
    );
    if (!t) return res.status(404).json({ message: 'Ticket not found' });
    res.json(t);
  } catch (err) { next(err); }
});

// ── SLA check — mark breached tickets (run periodically or on request) ────────
router.post('/sla/check', requireAuth, requireRole('admin'), async (req, res, next) => {
  try {
    const { rowCount } = await pool.query(`
      UPDATE support_tickets
      SET sla_breached = true
      WHERE status IN ('open','in_progress')
        AND first_response_at IS NULL
        AND created_at < NOW() - (sla_hours || ' hours')::INTERVAL
        AND sla_breached = false
    `);
    res.json({ breached: rowCount, message: `${rowCount} tickets marked as SLA breached` });
  } catch (err) { next(err); }
});

// ── Admin SLA metrics ─────────────────────────────────────────────────────────
router.get('/admin/metrics', requireAuth, requireRole('admin'), async (req, res, next) => {
  try {
    const { rows:[counts] } = await pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE status='open')                     AS open_count,
        COUNT(*) FILTER (WHERE status='in_progress')              AS in_progress_count,
        COUNT(*) FILTER (WHERE status='resolved')                 AS resolved_count,
        COUNT(*) FILTER (WHERE sla_breached=true AND status NOT IN ('resolved','closed')) AS sla_breached_count,
        COUNT(*) FILTER (WHERE first_response_at IS NULL AND status='open'
          AND created_at < NOW() - INTERVAL '2 hours')            AS overdue_count,
        ROUND(AVG(EXTRACT(EPOCH FROM (first_response_at - created_at))/3600) FILTER (WHERE first_response_at IS NOT NULL), 2) AS avg_first_response_hrs,
        ROUND(AVG(EXTRACT(EPOCH FROM (resolved_at - created_at))/3600) FILTER (WHERE resolved_at IS NOT NULL), 2) AS avg_resolution_hrs,
        ROUND(AVG(rating) FILTER (WHERE rating IS NOT NULL), 2)  AS avg_rating,
        COUNT(*) FILTER (WHERE rating IS NOT NULL)                AS rated_count,
        COUNT(*) FILTER (WHERE source='chat_escalation')          AS chat_escalations,
        COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours') AS tickets_today,
        COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days')   AS tickets_this_week
      FROM support_tickets
    `);

    // Priority breakdown
    const { rows: byPriority } = await pool.query(`
      SELECT priority, COUNT(*) AS count, COUNT(*) FILTER (WHERE status='open') AS open
      FROM support_tickets GROUP BY priority ORDER BY COUNT(*) DESC
    `);

    // Category breakdown
    const { rows: byCategory } = await pool.query(`
      SELECT category, COUNT(*) AS count FROM support_tickets GROUP BY category ORDER BY COUNT(*) DESC LIMIT 8
    `);

    // Recent SLA breaches
    const { rows: breaches } = await pool.query(`
      SELECT t.id, t.subject, t.priority, t.created_at, u.name AS user_name
      FROM support_tickets t
      LEFT JOIN users u ON u.id=t.user_id
      WHERE t.sla_breached=true AND t.status NOT IN ('resolved','closed')
      ORDER BY t.created_at ASC LIMIT 5
    `);

    res.json({ ...counts, byPriority, byCategory, breaches });
  } catch (err) { next(err); }
});

// ── Update first_response_at when agent first replies (auto-called in messages route) ──
// (internal — called from the messages route above via direct pool query)
