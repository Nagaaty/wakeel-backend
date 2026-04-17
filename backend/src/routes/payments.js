const router   = require('express').Router();
const pool     = require('../config/db');
const { validate, rules } = require('../middleware/validate');
const { requireAuth } = require('../middleware/auth');
const { initiatePayment, verifyWebhook } = require('../utils/paymob');
const { sendPaymentReceipt, sendBookingConfirmation } = require('../utils/email');
const { sendPaymentReceiptWA } = require('../utils/sms');
const { notifyPaymentReceived, notifyNewBooking } = require('../utils/push');

// POST /api/payments/initiate
router.post('/initiate', requireAuth, async (req, res, next) => {
  try {
    const { bookingId, method = 'card', promoCode } = req.body;
    if (!bookingId) return res.status(400).json({ message: 'bookingId required' });

    const { rows: [booking] } = await pool.query(
      `SELECT b.*, u.name as client_name, u.email as client_email, u.phone as client_phone,
              lu.name as lawyer_name, lu.email as lawyer_email
       FROM bookings b
       JOIN users u ON u.id = b.client_id
       JOIN users lu ON lu.id = b.lawyer_id
       WHERE b.id=$1 AND b.client_id=$2`,
      [bookingId, req.user.id]
    );
    if (!booking) return res.status(404).json({ message: 'Booking not found' });
    if (booking.status === 'confirmed' || booking.status === 'completed') return res.status(400).json({ message: 'Already paid' });

    let amount = parseFloat(booking.amount || 500);

    // Apply promo code if provided
    if (promoCode) {
      const { rows: [promo] } = await pool.query(
        `SELECT * FROM promo_codes WHERE code=$1 AND is_active=true AND (expires_at IS NULL OR expires_at > NOW())`,
        [promoCode.toUpperCase()]
      );
      if (promo) {
        const discount = promo.discount_type === 'percent'
          ? amount * (promo.discount_value / 100)
          : promo.discount_value;
        amount = Math.max(0, amount - discount);
      }
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // WAKEEL FAKE PAYMENT BYPASS
    // ─────────────────────────────────────────────────────────────────────────────
    // Since Paymob is not live, we simulate an instant success right here to activate the booking!

    // 1. Create a successful payment record instantly
    const { rows: [pmt] } = await pool.query(
      `INSERT INTO payments (booking_id, user_id, amount, method, ref_id, status)
       VALUES ($1,$2,$3,$4,$5,'completed') RETURNING *`,
      [bookingId, req.user.id, amount, method, `fake_txn_${Date.now()}`]
    );

    // 2. Mark booking as confirmed
    await pool.query(
      `UPDATE bookings SET status='confirmed' WHERE id=$1`,
      [bookingId]
    );

    // 3. Email + DB notification → Client
    const formattedDate = new Date(booking.scheduled_at).toISOString().split('T')[0];
    const formattedTime = new Date(booking.scheduled_at).toTimeString().substring(0, 5);

    await sendPaymentReceipt({
      to: booking.client_email, clientName: booking.client_name, amount,
      lawyerName: booking.lawyer_name, bookingId, paymentId: pmt.id,
      consultationDate: formattedDate, consultationTime: formattedTime,
    }).catch(console.error);

    await pool.query(
      `INSERT INTO notifications (user_id, type, title, body, link)
       VALUES ($1,'booking','✅ تم تأكيد الحجز',$2,'/bookings')`,
      [booking.client_id, `تم تأكيد حجزك مع ${booking.lawyer_name} بتاريخ ${formattedDate} الساعة ${formattedTime}`]
    ).catch(console.error);

    // 4. Email + DB notification → Lawyer
    await sendBookingConfirmation({
      to: booking.lawyer_email,
      clientName: booking.client_name,
      lawyerName: booking.lawyer_name,
      date: formattedDate,
      time: formattedTime,
      serviceType: booking.type || 'VIDEO',
      fee: amount,
      bookingId,
    }).catch(console.error);

    await pool.query(
      `INSERT INTO notifications (user_id, type, title, body, link)
       VALUES ($1,'booking','📅 حجز جديد',$2,'/lawyer/dashboard')`,
      [booking.lawyer_id, `${booking.client_name} حجز معك بتاريخ ${formattedDate} الساعة ${formattedTime}. المبلغ: ${amount} جم`]
    ).catch(console.error);

    await notifyNewBooking(booking.lawyer_id, {
      clientName: booking.client_name, date: formattedDate, time: formattedTime
    }).catch(console.error);

    await notifyPaymentReceived(booking.lawyer_id, {
      clientName: booking.client_name, amount
    }).catch(console.error);

    res.json({ checkoutUrl: null, success: true, fakeSuccess: true });
  } catch (err) { next(err); }
});

// POST /api/payments/confirm — called after successful Paymob redirect
router.post('/confirm', requireAuth, async (req, res, next) => {
  try {
    const { paymentId, paymobTransactionId, success } = req.body;

    const { rows: [pmt] } = await pool.query(
      `SELECT p.*, b.client_id, b.lawyer_id, b.fee,
              cu.name AS client_name, cu.email AS client_email, cu.phone AS client_phone,
              lu.name AS lawyer_name, lu.email AS lawyer_email
       FROM payments p
       JOIN bookings b ON b.id = p.booking_id
       JOIN users cu ON cu.id = b.client_id
       JOIN users lu ON lu.id = b.lawyer_id
       WHERE p.id=$1`,
      [paymentId]
    );
    if (!pmt) return res.status(404).json({ message: 'Payment not found' });

    const status = success !== false ? 'completed' : 'failed';

    await pool.query(
      `UPDATE payments SET status=$1, paymob_transaction_id=$2, paid_at=NOW() WHERE id=$3`,
      [status, paymobTransactionId || null, paymentId]
    );

    if (status === 'paid') {
      await pool.query(
        `UPDATE bookings SET payment_status='paid', status='confirmed' WHERE id=$1`,
        [pmt.booking_id]
      );

      // Send receipts
      await sendPaymentReceipt({
        to:         pmt.client_email,
        clientName: pmt.client_name,
        amount:     pmt.amount,
        lawyerName: pmt.lawyer_name,
        bookingId:  pmt.booking_id,
        paymentId:  paymobTransactionId || pmt.id,
      }).catch(console.error);

      if (pmt.client_phone) {
        await sendPaymentReceiptWA({
          phone:      pmt.client_phone,
          clientName: pmt.client_name,
          amount:     pmt.amount,
          lawyerName: pmt.lawyer_name,
          bookingId:  pmt.booking_id,
        }).catch(console.error);
      }

      await notifyPaymentReceived(pmt.lawyer_id, {
        clientName: pmt.client_name,
        amount:     pmt.amount,
      }).catch(console.error);
    }

    res.json({ status, message: status === 'paid' ? 'Payment confirmed' : 'Payment failed' });
  } catch (err) { next(err); }
});

// POST /api/payments/webhook — Paymob webhook (HMAC verified)
router.post('/webhook', async (req, res) => {
  try {
    const hmac = req.query.hmac;
    if (!verifyWebhook(req.body?.obj || {}, hmac)) {
      return res.status(401).json({ message: 'Invalid HMAC' });
    }

    const obj     = req.body?.obj || {};
    const success = obj.success === true || obj.success === 'true';
    const orderId = String(obj.order?.id || '');

    if (orderId) {
      const { rows: [pmt] } = await pool.query(
        `SELECT * FROM payments WHERE ref_id=$1`, [orderId]
      );
      if (pmt) {
        await pool.query(
          `UPDATE payments SET status=$1 WHERE id=$2`,
          [success ? 'paid' : 'failed', pmt.id]
        );
        if (success) {
          await pool.query(
            `UPDATE bookings SET status='confirmed' WHERE id=$1`,
            [pmt.booking_id]
          );
        }
      }
    }
    res.json({ received: true });
  } catch (err) {
    console.error('[Webhook error]', err.message);
    res.json({ received: true }); // Always 200 to Paymob
  }
});

// GET /api/payments/history
router.get('/history', requireAuth, async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT p.*, b.scheduled_at, lu.name AS lawyer_name, b.type AS service_type
       FROM payments p
       JOIN bookings b ON b.id = p.booking_id
       JOIN users lu ON lu.id = b.lawyer_id
       WHERE p.user_id=$1 ORDER BY p.created_at DESC`,
      [req.user.id]
    );
    res.json({ payments: rows });
  } catch (err) { next(err); }
});

// POST /api/payments/refund
router.post('/refund', requireAuth, async (req, res, next) => {
  try {
    const { paymentId, reason } = req.body;
    const { rows: [pmt] } = await pool.query(
      `SELECT p.*, b.client_id, b.scheduled_at
       FROM payments p JOIN bookings b ON b.id=p.booking_id
       WHERE p.id=$1`, [paymentId]
    );
    if (!pmt) return res.status(404).json({ message: 'Payment not found' });
    if (pmt.client_id !== req.user.id) return res.status(403).json({ message: 'Not authorized' });
    if (pmt.status !== 'paid') return res.status(400).json({ message: 'Not a paid payment' });

    // Check 24hr refund window
    const sessionTime = new Date(pmt.scheduled_at);
    const hoursUntil  = (sessionTime - new Date()) / 3600000;
    if (hoursUntil < 2) return res.status(400).json({ message: 'Refund window closed (less than 2 hours to session)' });

    await pool.query(`UPDATE payments SET status='refunded' WHERE id=$1`, [paymentId]);
    await pool.query(`UPDATE bookings SET refund_status='pending', status='cancelled' WHERE id=$1`, [pmt.booking_id]);

    res.json({ ok: true, message: 'Refund initiated — will process in 3-5 business days' });
  } catch (err) { next(err); }
});

module.exports = router;
