const router = require('express').Router();
const pool   = require('../config/db');
const { validate, rules } = require('../middleware/validate');
const { requireAuth, requireRole } = require('../middleware/auth');
const { sendVerificationResult } = require('../utils/email');

const adminOnly = [requireAuth, requireRole('admin')];

// GET /api/admin/stats — real platform statistics
router.get('/stats', ...adminOnly, async (req, res, next) => {
  try {
    const [users, bookings, revenue, pendingLawyers, tickets, todayBookings] = await Promise.all([
      pool.query(`SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE role='client') AS clients,
        COUNT(*) FILTER (WHERE role='lawyer') AS lawyers,
        COUNT(*) FILTER (WHERE created_at > NOW()-INTERVAL '7 days') AS new_this_week,
        COUNT(*) FILTER (WHERE created_at > NOW()-INTERVAL '30 days') AS new_this_month
        FROM users WHERE deleted_at IS NULL`),
      pool.query(`SELECT COUNT(*) AS total,
        COUNT(*) FILTER (WHERE status='completed') AS completed,
        COUNT(*) FILTER (WHERE status='pending') AS pending,
        COUNT(*) FILTER (WHERE status='cancelled') AS cancelled
        FROM bookings`),
      pool.query(`SELECT COALESCE(SUM(amount),0) AS total,
        COALESCE(SUM(amount) FILTER (WHERE created_at > NOW()-INTERVAL '30 days'),0) AS this_month,
        COALESCE(SUM(amount) FILTER (WHERE created_at > NOW()-INTERVAL '7 days'),0) AS this_week
        FROM payments WHERE status='paid'`),
      pool.query(`SELECT COUNT(*) AS count FROM lawyer_profiles WHERE verification_status='pending'`),
      pool.query(`SELECT COUNT(*) AS open FROM support_tickets WHERE status='open'`),
      pool.query(`SELECT COUNT(*) AS count FROM bookings WHERE booking_date=CURRENT_DATE`),
    ]);
    res.json({
      users:          users.rows[0],
      bookings:       bookings.rows[0],
      revenue:        revenue.rows[0],
      pendingLawyers: parseInt(pendingLawyers.rows[0].count),
      openTickets:    parseInt(tickets.rows[0].open),
      todayBookings:  parseInt(todayBookings.rows[0].count),
    });
  } catch (err) { next(err); }
});

// GET /api/admin/users — list all users with filters
router.get('/users', ...adminOnly, async (req, res, next) => {
  try {
    const { role, search, status, page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page)-1) * parseInt(limit);
    const params = [];
    let where = 'WHERE u.deleted_at IS NULL';
    if (role)   { params.push(role);          where += ` AND u.role=$${params.length}`; }
    if (search) { params.push(`%${search}%`); where += ` AND (u.name ILIKE $${params.length} OR u.email ILIKE $${params.length})`; }
    if (status === 'banned')   where += ` AND u.is_banned=true`;
    if (status === 'verified') where += ` AND u.email_verified=true`;

    params.push(parseInt(limit), offset);
    const { rows } = await pool.query(
      `SELECT u.id, u.name, u.email, u.phone, u.role, u.created_at,
              u.email_verified, u.phone_verified, u.is_online, u.last_active_at,
              u.is_banned, u.deleted_at,
              lp.is_verified AS lawyer_verified, lp.specialization, lp.city
       FROM users u LEFT JOIN lawyer_profiles lp ON lp.user_id=u.id
       ${where} ORDER BY u.created_at DESC
       LIMIT $${params.length-1} OFFSET $${params.length}`,
      params
    );
    const { rows: [{ count }] } = await pool.query(`SELECT COUNT(*) FROM users u ${where}`, params.slice(0,-2));
    res.json({ users: rows, total: parseInt(count) });
  } catch (err) { next(err); }
});

// PATCH /api/admin/users/:id/ban — ban or unban user
router.patch('/users/:id/ban', ...adminOnly, async (req, res, next) => {
  try {
    const { banned, reason } = req.body;
    await pool.query(
      `UPDATE users SET is_banned=$1, ban_reason=$2 WHERE id=$3`,
      [!!banned, reason||null, req.params.id]
    );
    // Audit log
    await pool.query(
      `INSERT INTO audit_logs (user_id, action, entity, entity_id, meta) VALUES ($1,$2,'user',$3,$4)`,
      [req.user.id, banned?'ban_user':'unban_user', req.params.id, JSON.stringify({ reason })]
    ).catch(()=>{});
    res.json({ ok: true, banned: !!banned });
  } catch (err) { next(err); }
});

// DELETE /api/admin/users/:id — hard delete user (GDPR)
router.delete('/users/:id', ...adminOnly, async (req, res, next) => {
  try {
    await pool.query(`UPDATE users SET deleted_at=NOW(), email=email||'_deleted_'||id WHERE id=$1`, [req.params.id]);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// GET /api/admin/lawyers/pending — pending verification
router.get('/lawyers/pending', ...adminOnly, async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT u.id, u.name, u.email, u.phone, u.created_at,
              lp.specialization, lp.city, lp.experience_years, lp.bar_number,
              lp.verification_status, lp.consultation_fee, lp.bio
       FROM users u JOIN lawyer_profiles lp ON lp.user_id=u.id
       WHERE u.role='lawyer' AND lp.verification_status='pending' AND u.deleted_at IS NULL
       ORDER BY u.created_at ASC`
    );
    res.json({ lawyers: rows });
  } catch (err) { next(err); }
});

// PATCH /api/admin/lawyers/:id/verify — approve or reject
router.patch('/lawyers/:id/verify', ...adminOnly, async (req, res, next) => {
  try {
    const { status, reason } = req.body;
    if (!['approved','rejected'].includes(status)) return res.status(400).json({ message: 'status must be approved or rejected' });

    await pool.query(
      `UPDATE lawyer_profiles SET verification_status=$1, verified_at=NOW(), rejection_reason=$2
       WHERE user_id=$3`,
      [status, reason||null, req.params.id]
    );
    if (status === 'approved') {
      await pool.query(`UPDATE lawyer_profiles SET is_verified=true WHERE user_id=$1`, [req.params.id]);
    }

    // Notify lawyer
    const { rows: [lawyer] } = await pool.query('SELECT email, name FROM users WHERE id=$1', [req.params.id]);
    if (lawyer) {
      await sendVerificationResult({ to: lawyer.email, name: lawyer.name, approved: status==='approved' }).catch(()=>{});
    }

    // Audit log
    await pool.query(
      `INSERT INTO audit_logs (user_id, action, entity, entity_id, meta) VALUES ($1,$2,'lawyer',$3,$4)`,
      [req.user.id, `lawyer_${status}`, req.params.id, JSON.stringify({ reason })]
    ).catch(()=>{});

    res.json({ ok: true, status });
  } catch (err) { next(err); }
});

// GET /api/admin/bookings — all bookings
router.get('/bookings', ...adminOnly, async (req, res, next) => {
  try {
    const { status, page=1, limit=20 } = req.query;
    const offset = (parseInt(page)-1)*parseInt(limit);
    const params = [parseInt(limit), offset];
    let where = '';
    if (status) { params.unshift(status); where = `WHERE b.status=$1`; }
    const { rows } = await pool.query(
      `SELECT b.*, cu.name AS client_name, lu.name AS lawyer_name
       FROM bookings b JOIN users cu ON cu.id=b.client_id JOIN users lu ON lu.id=b.lawyer_id
       ${where} ORDER BY b.created_at DESC LIMIT $${params.length-1} OFFSET $${params.length}`,
      params
    );
    res.json({ bookings: rows });
  } catch (err) { next(err); }
});

// GET /api/admin/audit-logs
router.get('/audit-logs', ...adminOnly, async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT al.*, u.name AS admin_name FROM audit_logs al
       LEFT JOIN users u ON u.id=al.user_id
       ORDER BY al.created_at DESC LIMIT 100`
    );
    res.json({ logs: rows });
  } catch (err) { next(err); }
});

module.exports = router;
