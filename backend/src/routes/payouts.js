const router = require('express').Router();
const pool   = require('../config/db');
const { requireAuth, requireRole } = require('../middleware/auth');

// Lawyer: request payout
router.post('/payout-request', requireAuth, requireRole('lawyer'), async (req, res, next) => {
  try {
    const { method, accountNum, accountName, amount } = req.body;
    if (!method || !accountNum || !accountName) return res.status(400).json({ message: 'All fields required' });
    if (amount < 50) return res.status(400).json({ message: 'Minimum payout is 50 EGP' });

    const { rows:[req_] } = await pool.query(`
      INSERT INTO payout_requests (lawyer_id, amount, method, account_num, account_name)
      VALUES ($1,$2,$3,$4,$5) RETURNING *
    `, [req.user.id, amount, method, accountNum, accountName]);

    // Notify admin
    await pool.query(`
      INSERT INTO notifications (user_id, title, body, type)
      SELECT u.id, '💳 Payout Request', $1, 'payout'
      FROM users u WHERE u.role='admin' LIMIT 1
    `, [`Lawyer requested ${amount} EGP payout via ${method}`]);

    res.json({ message: 'Payout request submitted', request: req_ });
  } catch (err) { next(err); }
});

// Admin: list payout requests
router.get('/payout-requests', requireAuth, requireRole('admin'), async (req, res, next) => {
  try {
    const { status = 'pending' } = req.query;
    const { rows } = await pool.query(`
      SELECT pr.*, u.name AS lawyer_name, u.email, u.phone
      FROM payout_requests pr
      JOIN users u ON u.id = pr.lawyer_id
      WHERE pr.status = $1
      ORDER BY pr.requested_at DESC
    `, [status]);
    res.json(rows);
  } catch (err) { next(err); }
});

// Admin: update payout status
router.patch('/payout-requests/:id', requireAuth, requireRole('admin'), async (req, res, next) => {
  try {
    const { status, note } = req.body;
    const { rows:[pr] } = await pool.query(`
      UPDATE payout_requests SET status=$1, note=$2, processed_at=NOW() WHERE id=$3 RETURNING *
    `, [status, note||null, req.params.id]);
    if (!pr) return res.status(404).json({ message: 'Not found' });

    // Notify lawyer
    const msg = status === 'completed'
      ? `Your payout of ${pr.amount} EGP has been sent to your ${pr.method} account.`
      : `Your payout request was ${status}. ${note||''}`;
    await pool.query(`INSERT INTO notifications (user_id,title,body,type) VALUES ($1,$2,$3,'payout')`,
      [pr.lawyer_id, status==='completed'?'✅ Payout Sent':'Payout Update', msg]);

    res.json(pr);
  } catch (err) { next(err); }
});

module.exports = router;
