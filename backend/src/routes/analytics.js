const router = require('express').Router();
const pool   = require('../config/db');
const { requireAuth, requireRole } = require('../middleware/auth');

// GET /api/analytics/admin — platform-wide stats (admin only)
router.get('/admin', requireAuth, requireRole('admin'), async (req, res, next) => {
  try {
    const [users, bookings, revenue, lawyers, recentBookings, topLawyers] = await Promise.all([
      pool.query(`SELECT
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE role='client') AS clients,
        COUNT(*) FILTER (WHERE role='lawyer') AS lawyers,
        COUNT(*) FILTER (WHERE created_at > NOW()-INTERVAL '30 days') AS new_this_month
        FROM users WHERE deleted_at IS NULL`),

      pool.query(`SELECT
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE status='completed') AS completed,
        COUNT(*) FILTER (WHERE status='pending') AS pending,
        COUNT(*) FILTER (WHERE created_at > NOW()-INTERVAL '30 days') AS this_month
        FROM bookings`),

      pool.query(`SELECT
        COALESCE(SUM(amount),0) AS total,
        COALESCE(SUM(amount) FILTER (WHERE created_at > NOW()-INTERVAL '30 days'),0) AS this_month,
        COALESCE(SUM(amount) FILTER (WHERE created_at > NOW()-INTERVAL '7 days'),0) AS this_week
        FROM payments WHERE status='paid'`),

      pool.query(`SELECT
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE is_verified=true) AS verified,
        COUNT(*) FILTER (WHERE created_at > NOW()-INTERVAL '30 days') AS new_this_month
        FROM lawyer_profiles`),

      pool.query(`SELECT b.id, b.booking_date, b.fee, b.status,
        cu.name AS client_name, lu.name AS lawyer_name
        FROM bookings b
        JOIN users cu ON cu.id=b.client_id
        JOIN users lu ON lu.id=b.lawyer_id
        ORDER BY b.created_at DESC LIMIT 10`),

      pool.query(`SELECT u.id, u.name, lp.avg_rating, lp.total_reviews, lp.wins,
        COUNT(b.id) AS booking_count,
        COALESCE(SUM(p.amount),0) AS total_revenue
        FROM users u
        JOIN lawyer_profiles lp ON lp.user_id=u.id
        LEFT JOIN bookings b ON b.lawyer_id=u.id AND b.status='completed'
        LEFT JOIN payments p ON p.booking_id=b.id AND p.status='paid'
        GROUP BY u.id, u.name, lp.avg_rating, lp.total_reviews, lp.wins
        ORDER BY total_revenue DESC LIMIT 10`),
    ]);

    res.json({
      users:          users.rows[0],
      bookings:       bookings.rows[0],
      revenue:        revenue.rows[0],
      lawyers:        lawyers.rows[0],
      recentBookings: recentBookings.rows,
      topLawyers:     topLawyers.rows,
    });
  } catch (err) { next(err); }
});

// GET /api/analytics/lawyer — lawyer's own analytics
router.get('/lawyer', requireAuth, requireRole('lawyer'), async (req, res, next) => {
  try {
    const lawyerId = req.user.id;
    const [stats, monthly, recentReviews, topClients] = await Promise.all([
      pool.query(`SELECT
        COUNT(*) AS total_bookings,
        COUNT(*) FILTER (WHERE status='completed') AS completed,
        COUNT(*) FILTER (WHERE status='pending') AS pending,
        COALESCE(SUM(fee) FILTER (WHERE status='completed'),0) AS total_earned,
        COALESCE(SUM(fee) FILTER (WHERE status='completed' AND created_at>NOW()-INTERVAL '30 days'),0) AS earned_this_month,
        COALESCE(AVG(fee) FILTER (WHERE status='completed'),0) AS avg_fee
        FROM bookings WHERE lawyer_id=$1`, [lawyerId]),

      pool.query(`SELECT
        DATE_TRUNC('month', created_at) AS month,
        COUNT(*) AS bookings,
        COALESCE(SUM(fee),0) AS revenue
        FROM bookings WHERE lawyer_id=$1 AND status='completed'
        GROUP BY month ORDER BY month DESC LIMIT 12`, [lawyerId]),

      pool.query(`SELECT r.*, u.name AS client_name FROM reviews r
        JOIN users u ON u.id=r.client_id
        WHERE r.lawyer_id=$1 ORDER BY r.created_at DESC LIMIT 5`, [lawyerId]),

      pool.query(`SELECT u.id, u.name, COUNT(b.id) AS sessions, SUM(b.fee) AS total_paid
        FROM bookings b JOIN users u ON u.id=b.client_id
        WHERE b.lawyer_id=$1 AND b.status='completed'
        GROUP BY u.id, u.name ORDER BY total_paid DESC LIMIT 5`, [lawyerId]),
    ]);

    res.json({
      stats:         stats.rows[0],
      monthly:       monthly.rows,
      recentReviews: recentReviews.rows,
      topClients:    topClients.rows,
    });
  } catch (err) { next(err); }
});

module.exports = router;
