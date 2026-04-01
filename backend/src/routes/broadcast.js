const router = require('express').Router();
const pool   = require('../config/db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { notifyNewBooking } = require('../utils/push');

// POST /api/broadcast — post a broadcast request (clients)
router.post('/', requireAuth, async (req, res, next) => {
  try {
    const { title, category, description, budget, urgency, city } = req.body;
    if (!title || !category) return res.status(400).json({ message: 'title and category required' });

    const { rows: [request] } = await pool.query(
      `INSERT INTO broadcast_requests
         (client_id, title, category, description, budget, urgency, city)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [req.user.id, title, category, description||'', budget||'', urgency||'normal', city||'']
    );

    // Notify matching lawyers via push
    const { rows: matchingLawyers } = await pool.query(
      `SELECT u.id FROM users u
       JOIN lawyer_profiles lp ON lp.user_id=u.id
       WHERE u.role='lawyer' AND lp.is_verified=true
         AND ($1='' OR lp.specialization ILIKE $2)
         AND ($3='' OR lp.city=$3)
       LIMIT 20`,
      [category, `%${category}%`, city||'']
    );

    for (const lawyer of matchingLawyers) {
      await pool.query(
        `INSERT INTO notifications (user_id, type, title, body, link)
         VALUES ($1,'broadcast','طلب جديد في تخصصك',$2,'/lawyer/dashboard')`,
        [lawyer.id, `${req.user.name || 'عميل'} نشر طلباً في ${category}`]
      ).catch(() => {});
    }

    res.status(201).json({ request });
  } catch (err) { next(err); }
});

// GET /api/broadcast — list my requests (client) or available requests (lawyer)
router.get('/', requireAuth, async (req, res, next) => {
  try {
    if (req.user.role === 'lawyer') {
      // Lawyers see active requests in their specialization
      const { rows: [profile] } = await pool.query(
        'SELECT specialization, city FROM lawyer_profiles WHERE user_id=$1', [req.user.id]
      );
      const { rows } = await pool.query(
        `SELECT br.*,
           u.name AS client_name,
           (SELECT COUNT(*) FROM broadcast_bids bb WHERE bb.request_id=br.id) AS bid_count,
           (SELECT bb.status FROM broadcast_bids bb WHERE bb.request_id=br.id AND bb.lawyer_id=$1 LIMIT 1) AS my_bid_status
         FROM broadcast_requests br
         JOIN users u ON u.id=br.client_id
         WHERE br.status='active' AND br.expires_at > NOW()
         ORDER BY br.created_at DESC LIMIT 50`,
        [req.user.id]
      );
      return res.json({ requests: rows });
    }

    // Clients see their own requests with bids
    const { rows } = await pool.query(
      `SELECT br.*,
         (SELECT COUNT(*) FROM broadcast_bids bb WHERE bb.request_id=br.id) AS bid_count,
         (SELECT json_agg(b ORDER BY b.created_at ASC) FROM (
           SELECT bb.*, u.name AS lawyer_name, lp.specialization, lp.avg_rating, lp.wins
           FROM broadcast_bids bb
           JOIN users u ON u.id=bb.lawyer_id
           LEFT JOIN lawyer_profiles lp ON lp.user_id=bb.lawyer_id
           WHERE bb.request_id=br.id
         ) b) AS bids
       FROM broadcast_requests br
       WHERE br.client_id=$1
       ORDER BY br.created_at DESC`,
      [req.user.id]
    );
    res.json({ requests: rows });
  } catch (err) { next(err); }
});

// POST /api/broadcast/:id/bid — lawyer places a bid
router.post('/:id/bid', requireAuth, requireRole('lawyer'), async (req, res, next) => {
  try {
    const { price, note } = req.body;
    if (!price) return res.status(400).json({ message: 'price required' });

    const { rows: [request] } = await pool.query(
      'SELECT * FROM broadcast_requests WHERE id=$1 AND status=$2',
      [req.params.id, 'active']
    );
    if (!request) return res.status(404).json({ message: 'Request not found or closed' });

    const { rows: [bid] } = await pool.query(
      `INSERT INTO broadcast_bids (request_id, lawyer_id, price, note)
       VALUES ($1,$2,$3,$4)
       ON CONFLICT (request_id, lawyer_id) DO UPDATE SET price=$3, note=$4
       RETURNING *`,
      [req.params.id, req.user.id, price, note||'']
    );

    // Notify client
    await pool.query(
      `INSERT INTO notifications (user_id, type, title, body, link)
       VALUES ($1,'broadcast','عرض جديد على طلبك',$2,'/my-requests')`,
      [request.client_id, `${req.user.name} أرسل عرضاً بسعر ${price} جنيه`]
    ).catch(() => {});

    res.status(201).json({ bid });
  } catch (err) { next(err); }
});

// POST /api/broadcast/:id/accept/:bidId — client accepts a bid
router.post('/:id/accept/:bidId', requireAuth, async (req, res, next) => {
  try {
    const { rows: [request] } = await pool.query(
      'SELECT * FROM broadcast_requests WHERE id=$1 AND client_id=$2',
      [req.params.id, req.user.id]
    );
    if (!request) return res.status(403).json({ message: 'Not your request' });

    // Accept this bid
    await pool.query(
      'UPDATE broadcast_bids SET status=$1 WHERE id=$2',
      ['accepted', req.params.bidId]
    );
    // Reject others
    await pool.query(
      'UPDATE broadcast_bids SET status=$1 WHERE request_id=$2 AND id!=$3',
      ['rejected', req.params.id, req.params.bidId]
    );
    // Close request
    await pool.query(
      "UPDATE broadcast_requests SET status='closed' WHERE id=$1",
      [req.params.id]
    );

    // Get accepted lawyer
    const { rows: [bid] } = await pool.query(
      'SELECT bb.*, u.name AS lawyer_name FROM broadcast_bids bb JOIN users u ON u.id=bb.lawyer_id WHERE bb.id=$1',
      [req.params.bidId]
    );

    // Notify accepted lawyer
    if (bid) {
      await pool.query(
        `INSERT INTO notifications (user_id, type, title, body, link)
         VALUES ($1,'broadcast','تم قبول عرضك!','العميل قبل عرضك. تواصل معه الآن.','/messages')`,
        [bid.lawyer_id]
      ).catch(() => {});
    }

    res.json({ ok: true, bid });
  } catch (err) { next(err); }
});

// DELETE /api/broadcast/:id — cancel a request
router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    await pool.query(
      "UPDATE broadcast_requests SET status='closed' WHERE id=$1 AND client_id=$2",
      [req.params.id, req.user.id]
    );
    res.json({ ok: true });
  } catch (err) { next(err); }
});

module.exports = router;
