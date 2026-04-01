const router = require('express').Router();
const pool   = require('../config/db');
const { requireAuth, requireRole } = require('../middleware/auth');

// ─── Subscription Plans ───────────────────────────────────────────────────────
const PLANS = {
  basic: { name:'Basic', price:0,   bookingLimit:10,  features:['Profile listing','Up to 10 bookings/mo','Standard support'] },
  pro:   { name:'Pro',   price:299,  bookingLimit:50,  features:['Everything in Basic','Featured placement','Priority ranking','Video consultations','Analytics'] },
  elite: { name:'Elite', price:599,  bookingLimit:null, features:['Everything in Pro','Top placement','Dedicated manager','Unlimited bookings','API access'] },
};

// GET /api/subscriptions/plans — public plan list
router.get('/plans', (req, res) => res.json(PLANS));

// GET /api/subscriptions/status — lawyer's current subscription
router.get('/status', requireAuth, requireRole('lawyer'), async (req, res, next) => {
  try {
    const { rows: [sub] } = await pool.query(`
      SELECT s.*, lp.subscription AS profile_plan
      FROM subscriptions s
      JOIN lawyer_profiles lp ON lp.user_id=s.lawyer_id
      WHERE s.lawyer_id=$1 AND s.is_active=true
      ORDER BY s.started_at DESC LIMIT 1
    `, [req.user.id]);

    if (!sub) {
      return res.json({ plan:'basic', isActive:true, bookingLimit:10, bookingsThisMonth:0, canBook:true });
    }

    // Count bookings this month
    const { rows:[{count}] } = await pool.query(`
      SELECT COUNT(*) FROM bookings
      WHERE lawyer_id=$1
        AND created_at >= date_trunc('month', NOW())
        AND status NOT IN ('cancelled','refunded')
    `, [req.user.id]);

    const limit = PLANS[sub.plan]?.bookingLimit;
    res.json({
      plan: sub.plan,
      isActive: sub.is_active,
      expiresAt: sub.expires_at,
      bookingLimit: limit,
      bookingsThisMonth: parseInt(count),
      canBook: !limit || parseInt(count) < limit,
      planDetails: PLANS[sub.plan],
    });
  } catch (err) { next(err); }
});

// POST /api/subscriptions/upgrade — initiate plan upgrade via PayMob
router.post('/upgrade', requireAuth, requireRole('lawyer'), async (req, res, next) => {
  try {
    const { plan } = req.body;
    if (!PLANS[plan]) return res.status(400).json({ message: 'Invalid plan' });
    if (plan === 'basic') return res.status(400).json({ message: 'Cannot downgrade to basic via this endpoint' });

    const planData = PLANS[plan];

    // ── If PayMob configured → create real payment ───────────────────────
    const paymobKey = process.env.PAYMOB_API_KEY;
    if (paymobKey && paymobKey !== 'your_paymob_api_key') {
      const amountCents = planData.price * 100;

      // Authenticate
      const authRes = await fetch('https://accept.paymob.com/api/auth/tokens', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ api_key: paymobKey }),
      });
      const { token: authToken } = await authRes.json();

      // Create order
      const orderRes = await fetch('https://accept.paymob.com/api/ecommerce/orders', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({
          auth_token: authToken, delivery_needed: false,
          amount_cents: amountCents, currency:'EGP',
          merchant_order_id: `sub_${req.user.id}_${plan}_${Date.now()}`,
          items:[{ name:`Wakeel ${planData.name} Subscription`, amount_cents: amountCents, quantity:1 }],
        }),
      });
      const order = await orderRes.json();

      // Get payment key
      const [fn,...ln] = (req.user.name||'Lawyer').split(' ');
      const keyRes = await fetch('https://accept.paymob.com/api/acceptance/payment_keys', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({
          auth_token: authToken, amount_cents: amountCents, expiration:3600,
          order_id: order.id, currency:'EGP',
          integration_id: parseInt(process.env.PAYMOB_INTEGRATION_ID||'0'),
          billing_data: {
            first_name:fn||'Lawyer', last_name:ln.join(' ')||'User',
            email: req.user.email, phone_number: req.user.phone||'+201000000000',
            apartment:'NA',floor:'NA',street:'NA',building:'NA',
            shipping_method:'NA',postal_code:'NA',city:'Cairo',country:'EG',state:'Cairo',
          },
        }),
      });
      const keyData = await keyRes.json();

      // Save pending subscription
      await pool.query(`
        INSERT INTO subscriptions (lawyer_id, plan, price, is_active, paymob_order_id)
        VALUES ($1,$2,$3,false,$4)
        ON CONFLICT DO NOTHING
      `, [req.user.id, plan, planData.price, String(order.id)]);

      const checkoutUrl = `https://accept.paymob.com/api/acceptance/iframes/${process.env.PAYMOB_IFRAME_ID}?payment_token=${keyData.token}`;
      return res.json({ checkoutUrl, plan, price: planData.price, status:'pending' });
    }

    // ── No PayMob → simulate upgrade for testing ─────────────────────────
    await pool.query(`UPDATE subscriptions SET is_active=false WHERE lawyer_id=$1`, [req.user.id]);
    const expiresAt = new Date(Date.now() + 30*24*60*60*1000); // 30 days
    const { rows:[sub] } = await pool.query(`
      INSERT INTO subscriptions (lawyer_id, plan, price, is_active, expires_at)
      VALUES ($1,$2,$3,true,$4) RETURNING *
    `, [req.user.id, plan, planData.price, expiresAt]);

    // Update lawyer_profiles.subscription
    await pool.query(`UPDATE lawyer_profiles SET subscription=$1 WHERE user_id=$2`, [plan, req.user.id]);

    // Notify lawyer
    await pool.query(`
      INSERT INTO notifications (user_id, title, body, type)
      VALUES ($1,$2,$3,'subscription')
    `, [req.user.id, `🌟 Upgraded to ${planData.name}`, `Your ${planData.name} plan is now active. Enjoy your new features!`]);

    res.json({ plan, price: planData.price, status:'active', expiresAt, simulated:true,
      message: process.env.PAYMOB_API_KEY ? 'Subscription activated' : '⚠️ Add PAYMOB_API_KEY to .env for real billing' });

  } catch (err) { next(err); }
});

// POST /api/subscriptions/webhook — PayMob calls this after subscription payment
router.post('/webhook', async (req, res, next) => {
  try {
    const obj = req.body?.obj || req.body;
    if (!obj || !obj.success) return res.sendStatus(200);

    const merchantOrderId = obj.order?.merchant_order_id || '';
    // merchant_order_id format: sub_{userId}_{plan}_{timestamp}
    const parts = merchantOrderId.split('_');
    if (parts[0] !== 'sub') return res.sendStatus(200);

    const [, userId, plan] = parts;
    const planData = PLANS[plan];
    if (!planData || !userId) return res.sendStatus(200);

    const expiresAt = new Date(Date.now() + 30*24*60*60*1000);

    // Activate subscription
    await pool.query(`UPDATE subscriptions SET is_active=false WHERE lawyer_id=$1`, [userId]);
    await pool.query(`
      UPDATE subscriptions SET is_active=true, started_at=NOW(), expires_at=$1
      WHERE lawyer_id=$2 AND paymob_order_id=$3
    `, [expiresAt, userId, String(obj.order?.id)]);

    await pool.query(`UPDATE lawyer_profiles SET subscription=$1 WHERE user_id=$2`, [plan, userId]);
    await pool.query(`
      INSERT INTO notifications (user_id, title, body, type)
      VALUES ($1,$2,$3,'subscription')
    `, [userId, `✅ ${planData.name} Plan Active`, `Payment confirmed. Your ${planData.name} subscription is now active until ${expiresAt.toLocaleDateString('en-EG')}.`]);

    res.sendStatus(200);
  } catch (err) { next(err); }
});

// POST /api/subscriptions/cancel
router.post('/cancel', requireAuth, requireRole('lawyer'), async (req, res, next) => {
  try {
    const { reason } = req.body;
    await pool.query(`
      UPDATE subscriptions SET is_active=false, cancelled_at=NOW(), cancel_reason=$1
      WHERE lawyer_id=$2 AND is_active=true
    `, [reason||'User requested cancellation', req.user.id]);
    await pool.query(`UPDATE lawyer_profiles SET subscription='basic' WHERE user_id=$1`, [req.user.id]);
    res.json({ message:'Subscription cancelled. You have been moved to the Basic plan.' });
  } catch (err) { next(err); }
});

// GET /api/subscriptions/check-limit — called before creating booking to enforce limits
router.get('/check-limit', requireAuth, requireRole('lawyer'), async (req, res, next) => {
  try {
    const { rows:[lp] } = await pool.query(`SELECT subscription FROM lawyer_profiles WHERE user_id=$1`, [req.user.id]);
    const plan = lp?.subscription || 'basic';
    const limit = PLANS[plan]?.bookingLimit;
    if (!limit) return res.json({ allowed:true, plan, limit:null });

    const { rows:[{count}] } = await pool.query(`
      SELECT COUNT(*) FROM bookings
      WHERE lawyer_id=$1 AND created_at >= date_trunc('month',NOW())
        AND status NOT IN ('cancelled','refunded')
    `, [req.user.id]);

    const allowed = parseInt(count) < limit;
    res.json({ allowed, plan, used:parseInt(count), limit,
      message: allowed ? null : `You've reached your ${limit} bookings/month limit on the ${PLANS[plan].name} plan. Upgrade to get more.` });
  } catch (err) { next(err); }
});

// GET /api/subscriptions/admin — all subscriptions (admin)
router.get('/admin', requireAuth, requireRole('admin'), async (req, res, next) => {
  try {
    const { rows } = await pool.query(`
      SELECT s.*, u.name AS lawyer_name, u.email AS lawyer_email
      FROM subscriptions s
      JOIN users u ON u.id=s.lawyer_id
      WHERE s.is_active=true
      ORDER BY s.started_at DESC
    `);
    res.json(rows);
  } catch (err) { next(err); }
});


// POST /api/subscriptions/subscribe — subscribe to a plan
router.post('/subscribe', requireAuth, requireRole('lawyer'), async (req, res, next) => {
  try {
    const { plan } = req.body;
    const PLANS = {
      basic:      { price:99,  features:['5 bookings/month','Basic profile','Email support'] },
      pro:        { price:299, features:['Unlimited bookings','Featured profile','Priority support','Analytics'] },
      enterprise: { price:599, features:['Everything in Pro','Dedicated manager','Custom domain','API access'] },
    };
    const planData = PLANS[plan];
    if (!planData) return res.status(400).json({ message: 'Invalid plan. Choose: basic, pro, enterprise' });

    const expiresAt = new Date(Date.now() + 30 * 24 * 3600 * 1000);

    // Try Paymob payment
    let checkoutUrl = null;
    try {
      const { initiatePayment } = require('../utils/paymob');
      const { rows: [user] } = await pool.query('SELECT * FROM users WHERE id=$1', [req.user.id]);
      const result = await initiatePayment({
        amountEGP:   planData.price,
        description: 'Wakeel ' + plan + ' Subscription',
        billing:     { firstName: user.name?.split(' ')[0] || 'Lawyer', email: user.email, phone: user.phone },
      });
      checkoutUrl = result.checkoutUrl;
    } catch {}

    // Save subscription (active immediately for dev, pending payment in prod)
    const { rows: [sub] } = await pool.query(
      `INSERT INTO subscriptions (user_id, plan, price, status, started_at, expires_at)
       VALUES ($1,$2,$3,$4,NOW(),$5)
       ON CONFLICT (user_id) DO UPDATE SET plan=$2, price=$3, status=$4, expires_at=$5, started_at=NOW()
       RETURNING *`,
      [req.user.id, plan, planData.price, checkoutUrl ? 'pending' : 'active', expiresAt]
    );

    // Update lawyer profile plan
    await pool.query(
      `UPDATE lawyer_profiles SET subscription_plan=$1 WHERE user_id=$2`,
      [plan, req.user.id]
    );

    res.json({
      subscription: sub,
      plan, price: planData.price,
      features: planData.features,
      expiresAt,
      checkoutUrl,
      message: checkoutUrl ? 'Proceed to payment' : 'Subscription activated successfully',
    });
  } catch (err) { next(err); }
});

module.exports = router;
