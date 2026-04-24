const router = require('express').Router();
const pool   = require('../config/db');
const { validate, rules } = require('../middleware/validate');
const { requireAuth, requireRole } = require('../middleware/auth');
const { sendBookingConfirmation }    = require('../utils/email');
const { sendBookingConfirmationWA, sendLawyerNewBookingWA } = require('../utils/sms');
const { notifyNewBooking, notifyBookingConfirmed }          = require('../utils/push');

// POST /api/bookings — create booking
router.post('/', requireAuth, async (req, res, next) => {
  try {
    const { lawyerId, bookingDate, startTime, endTime, serviceType, notes, documents, fee, urgency } = req.body;
    if (!lawyerId || !bookingDate || !startTime || fee === undefined || fee === null) {
      console.log('Booking Validation Error:', { body: req.body });
      return res.status(400).json({ message: 'lawyerId, bookingDate, startTime and fee required' });
    }

    const { rows: [lawyer] } = await pool.query(
      `SELECT u.*, lp.price AS consultation_fee, lp.is_verified
       FROM users u LEFT JOIN lawyer_profiles lp ON lp.user_id=u.id
       WHERE u.id=$1`,
      [lawyerId]
    );
    if (!lawyer) {
      return res.status(404).json({ message: 'Lawyer not found' });
    }

    // Determine Scheduled Timestamp
    const scheduledAt = `${bookingDate}T${startTime}:00`;

    // Check no double-booking
    const { rows: [clash] } = await pool.query(
      `SELECT id FROM bookings WHERE lawyer_id=$1 AND scheduled_at = $2::TIMESTAMP
       AND status NOT IN ('cancelled','rejected')`,
      [lawyerId, scheduledAt]
    );
    if (clash) return res.status(409).json({ message: 'This time slot is already booked' });

    // Get or create conversation
    let { rows: [conv] } = await pool.query(
      `SELECT id FROM conversations WHERE client_id=$1 AND lawyer_id=$2`,
      [req.user.id, lawyerId]
    );
    if (!conv) {
      const { rows: [newConv] } = await pool.query(
        `INSERT INTO conversations (client_id, lawyer_id) VALUES ($1,$2) RETURNING *`,
        [req.user.id, lawyerId]
      );
      conv = newConv;
    }

    // Map frontend service IDs → DB enum ('VIDEO','CHAT','PHONE')
    const SVC_MAP = {
      video:    'VIDEO',
      text:     'CHAT',
      inperson: 'PHONE', // closest available; schema only has VIDEO/CHAT/PHONE
      document: 'CHAT',
    };
    const dbType = SVC_MAP[(serviceType || 'video').toLowerCase()] || 'VIDEO';

    const { rows: [booking] } = await pool.query(
      `INSERT INTO bookings
         (client_id, lawyer_id, scheduled_at,
          type, status, amount, notes)
       VALUES ($1,$2,$3::TIMESTAMP,$4,'pending',$5,$6) 
       RETURNING *, TO_CHAR(scheduled_at, 'YYYY-MM-DD') AS booking_date, TO_CHAR(scheduled_at, 'HH24:MI') AS start_time, LOWER(type) AS service_type`,
      [req.user.id, lawyerId, scheduledAt, dbType, fee, notes||null]
    );

    // Get client info
    const { rows: [client] } = await pool.query('SELECT name, email, phone FROM users WHERE id=$1', [req.user.id]);

    // Notify lawyer — push + WhatsApp
    await notifyNewBooking(lawyerId, {
      clientName: client.name, date: bookingDate, time: startTime,
    }).catch(console.error);

    if (lawyer.phone) {
      await sendLawyerNewBookingWA({
        phone:      lawyer.phone,
        lawyerName: lawyer.name,
        clientName: client.name,
        date:       bookingDate,
        time:       startTime,
        fee,
      }).catch(console.error);
    }

    // NOTE: DB notification is intentionally NOT sent here.
    // The lawyer receives their confirmed notification after payment succeeds (payments.js).
    // Sending one here (pending state) would be a duplicate.

    res.status(201).json({ booking, conversationId: conv.id });
  } catch (err) { next(err); }
});

// GET /api/bookings — list bookings
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const { status, upcoming } = req.query;
    const isLawyer = req.user.role === 'lawyer';

    let q = `
      SELECT b.*,
        b.amount AS fee,
        CASE WHEN b.status IN ('confirmed','completed') THEN 'paid' ELSE 'pending' END AS payment_status,
        TO_CHAR(b.scheduled_at, 'YYYY-MM-DD') AS booking_date,
        TO_CHAR(b.scheduled_at, 'HH24:MI') AS start_time,
        LOWER(b.type) AS service_type,
        cu.name AS client_name, cu.email AS client_email, cu.phone AS client_phone,
        lu.name AS lawyer_name, lu.email AS lawyer_email,
        lp.specialization, lp.avg_rating, lp.is_verified,
        lp.user_id AS lawyer_profile_id,
        lu.id AS lawyer_user_id
      FROM bookings b
      JOIN users cu ON cu.id = b.client_id
      JOIN users lu ON lu.id = b.lawyer_id
      LEFT JOIN lawyer_profiles lp ON lp.user_id = b.lawyer_id
      WHERE ${isLawyer ? 'b.lawyer_id' : 'b.client_id'} = $1
    `;
    const params = [req.user.id];

    if (status)   { params.push(status);                    q += ` AND b.status=$${params.length}`; }
    if (upcoming) { q += ` AND b.scheduled_at >= CURRENT_DATE`; }

    q += ' ORDER BY b.scheduled_at DESC LIMIT 100';

    const { rows } = await pool.query(q, params);
    res.json({ bookings: rows });
  } catch (err) { next(err); }
});

// PATCH /api/bookings/:id/status — lawyer accepts/rejects
router.patch('/:id/status', requireAuth, async (req, res, next) => {
  try {
    const { status } = req.body;
    if (!['confirmed','rejected','cancelled','completed'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    const { rows: [booking] } = await pool.query(
      `SELECT b.*,
              TO_CHAR(b.scheduled_at, 'YYYY-MM-DD') AS booking_date,
              TO_CHAR(b.scheduled_at, 'HH24:MI') AS start_time,
              LOWER(b.type) AS service_type,
              cu.name AS client_name, cu.email AS client_email, cu.phone AS client_phone,
              lu.name AS lawyer_name
       FROM bookings b
       JOIN users cu ON cu.id=b.client_id
       JOIN users lu ON lu.id=b.lawyer_id
       WHERE b.id=$1`,
      [req.params.id]
    );
    if (!booking) return res.status(404).json({ message: 'Booking not found' });

    // Auth check
    const canUpdate = booking.lawyer_id === req.user.id || booking.client_id === req.user.id || req.user.role === 'admin';
    if (!canUpdate) return res.status(403).json({ message: 'Not authorized' });

    const { rows: [updated] } = await pool.query(
      `UPDATE bookings SET status=$1 WHERE id=$2 
       RETURNING *, TO_CHAR(scheduled_at, 'YYYY-MM-DD') AS booking_date, TO_CHAR(scheduled_at, 'HH24:MI') AS start_time, LOWER(type) AS service_type`,
      [status, req.params.id]
    );

    // Notify client when lawyer confirms
    if (status === 'confirmed') {
      await notifyBookingConfirmed(booking.client_id, {
        lawyerName: booking.lawyer_name,
        date:       booking.booking_date,
        time:       booking.start_time?.slice(0,5),
      }).catch(console.error);

      await sendBookingConfirmation({
        to:          booking.client_email,
        clientName:  booking.client_name,
        lawyerName:  booking.lawyer_name,
        date:        booking.booking_date,
        time:        booking.start_time?.slice(0,5),
        serviceType: booking.service_type,
        fee:         booking.fee,
        bookingId:   booking.id,
      }).catch(console.error);

      if (booking.client_phone) {
        await sendBookingConfirmationWA({
          phone:      booking.client_phone,
          clientName: booking.client_name,
          lawyerName: booking.lawyer_name,
          date:       booking.booking_date,
          time:       booking.start_time?.slice(0,5),
          fee:        booking.fee,
          bookingId:  booking.id,
        }).catch(console.error);
      }

      // Save DB notification for client
      await pool.query(
        `INSERT INTO notifications (user_id, type, title, body, link)
         VALUES ($1,'booking','تم تأكيد حجزك',$2,'/bookings')`,
        [booking.client_id, `${booking.lawyer_name} قبل حجزك ${booking.booking_date}`]
      ).catch(console.error);
    }

    res.json({ booking: updated });
  } catch (err) { next(err); }
});

// POST /api/bookings/:id/cancel
router.post('/:id/cancel', requireAuth, async (req, res, next) => {
  try {
    const { reason } = req.body;
    const { rows: [b] } = await pool.query('SELECT * FROM bookings WHERE id=$1', [req.params.id]);
    if (!b) return res.status(404).json({ message: 'Not found' });
    if (b.client_id !== req.user.id && b.lawyer_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized' });
    }
    await pool.query(`UPDATE bookings SET status='cancelled', cancel_reason=$1 WHERE id=$2`, [reason||'', req.params.id]);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// GET /api/bookings/:id
router.get('/:id', requireAuth, async (req, res, next) => {
  try {
    const { rows: [booking] } = await pool.query(
      `SELECT b.*, 
              TO_CHAR(b.scheduled_at, 'YYYY-MM-DD') AS booking_date,
              TO_CHAR(b.scheduled_at, 'HH24:MI') AS start_time,
              LOWER(b.type) AS service_type,
              cu.name AS client_name, lu.name AS lawyer_name, lu.email AS lawyer_email,
              lp.specialization
       FROM bookings b
       JOIN users cu ON cu.id=b.client_id
       JOIN users lu ON lu.id=b.lawyer_id
       LEFT JOIN lawyer_profiles lp ON lp.user_id=b.lawyer_id
       WHERE b.id=$1 AND (b.client_id=$2 OR b.lawyer_id=$2 OR $3='admin')`,
      [req.params.id, req.user.id, req.user.role]
    );
    if (!booking) return res.status(404).json({ message: 'Not found' });
    res.json({ booking });
  } catch (err) { next(err); }
});

// PATCH /api/bookings/:id/no-show — lawyer marks client as no-show
router.patch('/:id/no-show', requireAuth, async (req, res, next) => {
  try {
    const { rows: [b] } = await pool.query('SELECT * FROM bookings WHERE id=$1', [req.params.id]);
    if (!b) return res.status(404).json({ message: 'Not found' });
    if (b.lawyer_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Only the assigned lawyer can mark a no-show' });
    }
    const { rows: [updated] } = await pool.query(
      `UPDATE bookings SET status='completed', cancel_reason='Client No-Show' WHERE id=$1 RETURNING *`,
      [req.params.id]
    );
    res.json({ ok: true, booking: updated });
  } catch (err) { next(err); }
});

module.exports = router;
