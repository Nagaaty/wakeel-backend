const express = require('express');
const router  = express.Router();
const crypto  = require('crypto');

// In-memory store for demo (use Redis in production)
const OTP_STORE = {};

// POST /api/auth/send-otp
router.post('/send-otp', async (req, res) => {
  const { phone } = req.body;
  if (!phone) return res.status(400).json({ error: 'Phone required' });

  const code = crypto.randomInt(100000, 999999).toString();
  const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes
  OTP_STORE[phone] = { code, expiresAt, attempts: 0 };

  // Send via SMS provider (Twilio / Vonage / local Egyptian provider)
  // In demo mode — just log it
  if (process.env.NODE_ENV !== 'production') {
    console.log(`[OTP] ${phone} → ${code}`);
    return res.json({ success: true, demo: true });
  }

  // Production: use Twilio Verify or similar
  try {
    const twilio = require('twilio')(process.env.TWILIO_SID, process.env.TWILIO_TOKEN);
    await twilio.verify.v2.services(process.env.TWILIO_VERIFY_SID)
      .verifications.create({ to: phone, channel: 'sms' });
    res.json({ success: true });
  } catch (err) {
    console.error('OTP send error:', err.message);
    res.status(500).json({ error: 'Failed to send OTP' });
  }
});

// POST /api/auth/verify-otp
router.post('/verify-otp', (req, res) => {
  const { phone, code } = req.body;
  if (!phone || !code) return res.status(400).json({ error: 'Phone and code required' });

  const record = OTP_STORE[phone];
  if (!record) return res.status(400).json({ error: 'No OTP sent to this number' });
  if (Date.now() > record.expiresAt) return res.status(400).json({ error: 'OTP expired' });

  record.attempts++;
  if (record.attempts > 5) return res.status(429).json({ error: 'Too many attempts' });

  if (record.code !== code) return res.status(400).json({ error: 'Invalid OTP' });

  delete OTP_STORE[phone]; // Consume the OTP
  res.json({ success: true, verified: true });
});

module.exports = router;
