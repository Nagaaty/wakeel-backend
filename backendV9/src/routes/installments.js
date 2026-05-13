const router = require('express').Router();
const pool   = require('../config/db');
const { requireAuth } = require('../middleware/auth');
const { initiatePayment } = require('../utils/paymob');

// POST /api/installments — create installment plan for a booking
router.post('/', requireAuth, async (req, res, next) => {
  try {
    const { bookingId, numInstallments = 3 } = req.body;
    if (!bookingId) return res.status(400).json({ message: 'bookingId required' });
    if (![2,3,4,6].includes(numInstallments)) return res.status(400).json({ message: 'installments must be 2, 3, 4 or 6' });

    const { rows: [booking] } = await pool.query(
      'SELECT * FROM bookings WHERE id=$1 AND client_id=$2', [bookingId, req.user.id]
    );
    if (!booking) return res.status(404).json({ message: 'Booking not found' });

    const total       = parseFloat(booking.fee);
    const installAmt  = Math.ceil((total / numInstallments) * 100) / 100;
    const nextDue     = new Date(Date.now() + 30 * 24 * 3600 * 1000);

    const { rows: [plan] } = await pool.query(
      `INSERT INTO installments (booking_id, user_id, total_amount, installments, interval_days, next_due_at)
       VALUES ($1,$2,$3,$4,30,$5) RETURNING *`,
      [bookingId, req.user.id, total, numInstallments, nextDue]
    );

    // Create first payment immediately
    const { rows: [firstPayment] } = await pool.query(
      `INSERT INTO installment_payments (installment_id, amount, status)
       VALUES ($1,$2,'pending') RETURNING *`,
      [plan.id, installAmt]
    );

    // Initiate Paymob for first installment
    const { rows: [user] } = await pool.query('SELECT * FROM users WHERE id=$1', [req.user.id]);
    const payResult = await initiatePayment({
      amountEGP:   installAmt,
      description: `قسط 1/${numInstallments} — حجز WK-${String(bookingId).padStart(6,'0')}`,
      billing: { firstName: user.name?.split(' ')[0], lastName: user.name?.split(' ')[1] || 'User', email: user.email, phone: user.phone },
    });

    res.status(201).json({
      plan,
      installmentAmount: installAmt,
      totalInstallments: numInstallments,
      firstPayment:      { ...firstPayment, checkoutUrl: payResult.checkoutUrl },
      schedule: Array.from({ length: numInstallments }, (_, i) => ({
        number: i + 1,
        amount: installAmt,
        dueDate: new Date(Date.now() + i * 30 * 24 * 3600 * 1000).toISOString().slice(0,10),
        status: i === 0 ? 'pending' : 'upcoming',
      })),
    });
  } catch (err) { next(err); }
});

// GET /api/installments — my installment plans
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT i.*, b.booking_date, b.service_type, lu.name AS lawyer_name,
              (SELECT json_agg(ip ORDER BY ip.created_at) FROM installment_payments ip WHERE ip.installment_id=i.id) AS payments
       FROM installments i
       JOIN bookings b ON b.id=i.booking_id
       JOIN users lu ON lu.id=b.lawyer_id
       WHERE i.user_id=$1 ORDER BY i.created_at DESC`,
      [req.user.id]
    );
    res.json({ plans: rows });
  } catch (err) { next(err); }
});

module.exports = router;
