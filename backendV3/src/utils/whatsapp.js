// ─── WhatsApp Notification Helper (Twilio) ─────────────────────────────────
// Add to backend/src/utils/whatsapp.js
//
// FREE SANDBOX SETUP (takes 5 min):
// 1. Sign up at https://console.twilio.com (free $15 credit)
// 2. Go to Messaging → Try it Out → Send a WhatsApp Message
// 3. Follow sandbox setup (send "join <word>" to +1 415 523 8886)
// 4. Add to backend/.env:
//    TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
//    TWILIO_AUTH_TOKEN=your_auth_token
//    TWILIO_WHATSAPP_FROM=whatsapp:+14155238886
// ─────────────────────────────────────────────────────────────────────────────

async function sendWhatsApp(to, message) {
  const sid   = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from  = process.env.TWILIO_WHATSAPP_FROM || 'whatsapp:+14155238886';

  if (!sid || !token || sid === 'your_twilio_sid') {
    console.log(`📱 WhatsApp (not configured): ${to} → ${message.slice(0,60)}...`);
    return null;
  }

  const url = `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`;
  const body = new URLSearchParams({
    From: from,
    To:   `whatsapp:${to}`,
    Body: message,
  });

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': 'Basic ' + Buffer.from(`${sid}:${token}`).toString('base64'),
    },
    body: body.toString(),
  });

  const data = await res.json();
  if (!res.ok) console.error('WhatsApp error:', data.message);
  return data;
}

module.exports = { sendWhatsApp };
