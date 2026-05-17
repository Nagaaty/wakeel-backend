const router = require('express').Router();
const pool   = require('../config/db');
const { validate, rules } = require('../middleware/validate');
const { requireAuth } = require('../middleware/auth');

function generateInvoiceNo() {
  const now  = new Date();
  const year = now.getFullYear();
  const rand = Math.floor(Math.random() * 90000) + 10000;
  return `WK-INV-${year}-${rand}`;
}

// POST /api/invoices — generate invoice for a booking
router.post('/', requireAuth, async (req, res, next) => {
  try {
    const { bookingId } = req.body;
    if (!bookingId) return res.status(400).json({ message: 'bookingId required' });

    // Check existing invoice
    const { rows: [existing] } = await pool.query(
      'SELECT * FROM invoices WHERE booking_id=$1', [bookingId]
    );
    if (existing) return res.json({ invoice: existing });

    const { rows: [booking] } = await pool.query(
      `SELECT b.*, cu.name AS client_name, lu.name AS lawyer_name,
              cu.email AS client_email, lu.email AS lawyer_email
       FROM bookings b
       JOIN users cu ON cu.id=b.client_id
       JOIN users lu ON lu.id=b.lawyer_id
       WHERE b.id=$1 AND (b.client_id=$2 OR b.lawyer_id=$2 OR $3='admin')`,
      [bookingId, req.user.id, req.user.role]
    );
    if (!booking) return res.status(404).json({ message: 'Booking not found' });

    const amount     = parseFloat(booking.fee || 0);
    const taxRate    = 0.14; // 14% VAT in Egypt
    const taxAmount  = Math.round(amount * taxRate * 100) / 100;
    const total      = amount + taxAmount;
    const invoiceNo  = generateInvoiceNo();

    const { rows: [invoice] } = await pool.query(
      `INSERT INTO invoices
         (booking_id, user_id, lawyer_id, invoice_no, amount, tax_amount, total_amount, status, due_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'issued',NOW()+INTERVAL '7 days') RETURNING *`,
      [bookingId, booking.client_id, booking.lawyer_id, invoiceNo, amount, taxAmount, total]
    );

    res.status(201).json({
      invoice: { ...invoice, client_name: booking.client_name, lawyer_name: booking.lawyer_name,
                 service_type: booking.service_type, booking_date: booking.booking_date }
    });
  } catch (err) { next(err); }
});

// GET /api/invoices — list my invoices
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT i.*, b.booking_date, b.service_type,
              cu.name AS client_name, lu.name AS lawyer_name
       FROM invoices i
       JOIN bookings b ON b.id=i.booking_id
       JOIN users cu ON cu.id=i.user_id
       JOIN users lu ON lu.id=i.lawyer_id
       WHERE i.user_id=$1 OR i.lawyer_id=$1
       ORDER BY i.issued_at DESC`,
      [req.user.id]
    );
    res.json({ invoices: rows });
  } catch (err) { next(err); }
});

// GET /api/invoices/:id
router.get('/:id', requireAuth, async (req, res, next) => {
  try {
    const { rows: [invoice] } = await pool.query(
      `SELECT i.*, b.booking_date, b.service_type, b.start_time,
              cu.name AS client_name, cu.email AS client_email, cu.phone AS client_phone,
              lu.name AS lawyer_name, lu.email AS lawyer_email
       FROM invoices i
       JOIN bookings b ON b.id=i.booking_id
       JOIN users cu ON cu.id=i.user_id
       JOIN users lu ON lu.id=i.lawyer_id
       WHERE i.id=$1 AND (i.user_id=$2 OR i.lawyer_id=$2 OR $3='admin')`,
      [req.params.id, req.user.id, req.user.role]
    );
    if (!invoice) return res.status(404).json({ message: 'Invoice not found' });
    res.json({ invoice });
  } catch (err) { next(err); }
});

module.exports = router;
