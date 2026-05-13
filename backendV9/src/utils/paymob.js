// ─── Paymob Payment Gateway ────────────────────────────────────────────────────
// Egypt's most popular payment gateway. Accepts cards, Fawry, Vodafone Cash,
// Orange Money, and Meeza.
//
// Setup:
// 1. Register at accept.paymob.com
// 2. Get your API key, integration IDs from the dashboard
// .env:
//   PAYMOB_API_KEY=ZXlKaGJHY2lPaUpJVXpVeE1pSXNJblI1Y0NJNklrcFhWQ0o5...
//   PAYMOB_INTEGRATION_CARD=12345       (card payment integration ID)
//   PAYMOB_INTEGRATION_FAWRY=12346      (Fawry integration ID)
//   PAYMOB_INTEGRATION_WALLET=12347     (mobile wallet integration ID)
//   PAYMOB_IFRAME_ID=12348              (iframe ID for hosted checkout)
//   PAYMOB_HMAC_SECRET=abc123           (for webhook verification)

const PAYMOB_BASE = 'https://accept.paymob.com/api';

async function paymobRequest(endpoint, data, method = 'POST') {
  const res = await fetch(`${PAYMOB_BASE}${endpoint}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: method !== 'GET' ? JSON.stringify(data) : undefined,
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Paymob error ${res.status}: ${err.slice(0,200)}`);
  }
  return res.json();
}

// Step 1: Authenticate and get auth token
async function getAuthToken() {
  const apiKey = process.env.PAYMOB_API_KEY;
  if (!apiKey) throw new Error('PAYMOB_API_KEY not set');
  const { token } = await paymobRequest('/auth/tokens', { api_key: apiKey });
  return token;
}

// Step 2: Create order
async function createOrder(authToken, { amountCents, currency = 'EGP', items = [] }) {
  const { id } = await paymobRequest('/ecommerce/orders', {
    auth_token:     authToken,
    delivery_needed: false,
    amount_cents:    amountCents,
    currency,
    items,
  });
  return id;
}

// Step 3: Get payment key
async function getPaymentKey(authToken, { orderId, amountCents, currency = 'EGP', billing, integrationId }) {
  const { token } = await paymobRequest('/acceptance/payment_keys', {
    auth_token:      authToken,
    amount_cents:    amountCents,
    expiration:      3600,
    order_id:        orderId,
    currency,
    integration_id:  integrationId,
    billing_data: {
      first_name:   billing.firstName || 'NA',
      last_name:    billing.lastName  || 'NA',
      email:        billing.email     || 'NA',
      phone_number: billing.phone     || 'NA',
      apartment:    'NA', floor:'NA', building:'NA',
      street:'NA', shipping_method:'NA', postal_code:'NA',
      city:'NA', country:'EG', state:'NA',
    },
  });
  return token;
}

// ── Full checkout flow ─────────────────────────────────────────────────────────
async function initiatePayment({ amountEGP, billing, method = 'card', description = 'Wakeel Consultation' }) {
  if (!process.env.PAYMOB_API_KEY) {
    // Return simulated response for development
    return {
      simulated:   true,
      checkoutUrl: null,
      paymentKey:  'SIMULATED_KEY',
      orderId:     'SIMULATED_ORDER',
      message:     'Paymob not configured — payment simulated',
    };
  }

  const amountCents   = Math.round(amountEGP * 100);
  const integrationMap = {
    card:   process.env.PAYMOB_INTEGRATION_CARD,
    fawry:  process.env.PAYMOB_INTEGRATION_FAWRY,
    wallet: process.env.PAYMOB_INTEGRATION_WALLET,
  };
  const integrationId = integrationMap[method] || integrationMap.card;
  const iframeId      = process.env.PAYMOB_IFRAME_ID;

  const authToken  = await getAuthToken();
  const orderId    = await createOrder(authToken, { amountCents, items: [{ name: description, amount_cents: amountCents, quantity: 1 }] });
  const paymentKey = await getPaymentKey(authToken, { orderId, amountCents, billing, integrationId });

  const checkoutUrl = method === 'fawry'
    ? `https://accept.paymob.com/api/acceptance/payments/pay?payment_token=${paymentKey}`
    : `https://accept.paymob.com/api/acceptance/iframes/${iframeId}?payment_token=${paymentKey}`;

  return { paymentKey, orderId, checkoutUrl, simulated: false };
}

// ── Verify Paymob webhook HMAC ─────────────────────────────────────────────────
const crypto = require('crypto');
function verifyWebhook(body, receivedHmac) {
  const secret = process.env.PAYMOB_HMAC_SECRET;
  if (!secret) return true; // skip verification if not configured

  const fields = ['amount_cents','created_at','currency','error_occured','has_parent_transaction',
    'id','integration_id','is_3d_secure','is_auth','is_capture','is_refunded','is_standalone_payment',
    'is_voided','order','owner','pending','source_data.pan','source_data.sub_type','source_data.type',
    'success'];

  const str = fields.map(f => {
    const val = f.split('.').reduce((o, k) => o?.[k], body);
    return val ?? '';
  }).join('');

  const computed = crypto.createHmac('sha512', secret).update(str).digest('hex');
  return computed === receivedHmac;
}

module.exports = { initiatePayment, verifyWebhook, getAuthToken };
