// ─── SMS & WhatsApp Service via Twilio ────────────────────────────────────────
// Setup: create account at twilio.com → get Account SID, Auth Token, phone number
// .env:
//   TWILIO_ACCOUNT_SID=ACxxxxxxxx
//   TWILIO_AUTH_TOKEN=xxxxxxxx
//   TWILIO_PHONE=+12015551234
//   TWILIO_WHATSAPP=whatsapp:+14155238886  (Twilio sandbox or approved number)

let twilioClient = null;

function getClient() {
  if (twilioClient) return twilioClient;
  const sid   = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token || sid === 'ACxxxxxxxx') return null;
  try {
    twilioClient = require('twilio')(sid, token);
    return twilioClient;
  } catch { return null; }
}

async function sendSMS(to, body) {
  const client = getClient();
  if (!client) {
    console.log(`[SMS SKIPPED — Twilio not configured] To: ${to} | ${body.slice(0,60)}`);
    return { skipped: true };
  }
  try {
    const msg = await client.messages.create({
      body,
      from: process.env.TWILIO_PHONE,
      to: to.startsWith('+') ? to : `+2${to}`, // Egypt prefix
    });
    return { sent: true, sid: msg.sid };
  } catch (err) {
    console.error('[SMS ERROR]', err.message);
    return { error: err.message };
  }
}

async function sendWhatsApp(to, body) {
  const client = getClient();
  const from   = process.env.TWILIO_WHATSAPP || 'whatsapp:+14155238886';
  if (!client) {
    console.log(`[WHATSAPP SKIPPED] To: ${to} | ${body.slice(0,60)}`);
    return { skipped: true };
  }
  try {
    const phone = to.startsWith('+') ? to : `+2${to}`;
    const msg   = await client.messages.create({
      body, from, to: `whatsapp:${phone}`,
    });
    return { sent: true, sid: msg.sid };
  } catch (err) {
    console.error('[WHATSAPP ERROR]', err.message);
    return { error: err.message };
  }
}

// ── Message templates ─────────────────────────────────────────────────────────

async function sendBookingConfirmationSMS({ phone, clientName, lawyerName, date, time, bookingId }) {
  const body = `✅ وكيل: تأكيد حجزك\nالمحامي: ${lawyerName}\nالتاريخ: ${date} - ${time}\nرقم الحجز: WK-${String(bookingId).padStart(6,'0')}\nتفاصيل: wakeel.eg/bookings`;
  return sendSMS(phone, body);
}

async function sendBookingConfirmationWA({ phone, clientName, lawyerName, date, time, fee, bookingId }) {
  const body = `⚖️ *Wakeel.eg — تأكيد الحجز*\n\nمرحباً ${clientName}! ✅\n\n*المحامي:* ${lawyerName}\n*التاريخ:* ${date}\n*الوقت:* ${time}\n*الرسوم:* ${fee} جنيه\n*رقم الحجز:* WK-${String(bookingId).padStart(6,'0')}\n\nستصلك رسالة تذكير قبل 30 دقيقة من موعدك.\n\nلإلغاء الحجز: wakeel.eg/bookings`;
  return sendWhatsApp(phone, body);
}

async function sendReminderSMS({ phone, lawyerName, time, bookingId }) {
  const body = `⏰ وكيل: تذكير بموعدك بعد 30 دقيقة\nمع: ${lawyerName} الساعة ${time}\nانضم: wakeel.eg/bookings`;
  return Promise.all([sendSMS(phone, body), sendWhatsApp(phone, body)]);
}

async function sendOTPSMS({ phone, otp, purpose }) {
  const purposes = { verify:'التحقق', login:'تسجيل الدخول', reset:'إعادة تعيين كلمة المرور' };
  const body = `⚖️ Wakeel — كود ${purposes[purpose] || 'التحقق'}: *${otp}*\nصالح 10 دقائق. لا تشاركه مع أحد.`;
  return sendSMS(phone, body);
}

async function sendPaymentReceiptWA({ phone, clientName, amount, lawyerName, bookingId }) {
  const body = `💰 *Wakeel.eg — تم الدفع*\n\nمرحباً ${clientName}!\nتم استلام ${amount} جنيه لحجزك مع ${lawyerName}.\nرقم الحجز: WK-${String(bookingId).padStart(6,'0')}\n\nشكراً لاستخدامك Wakeel ⚖️`;
  return sendWhatsApp(phone, body);
}

async function sendLawyerNewBookingWA({ phone, lawyerName, clientName, date, time, fee }) {
  const body = `⚖️ *Wakeel.eg — حجز جديد*\n\nمرحباً ${lawyerName}!\n\nلديك حجز جديد:\n*العميل:* ${clientName}\n*التاريخ:* ${date}\n*الوقت:* ${time}\n*الرسوم:* ${fee} جنيه\n\nقبول/رفض: wakeel.eg/lawyer/dashboard`;
  return sendWhatsApp(phone, body);
}

module.exports = {
  sendSMS, sendWhatsApp,
  sendBookingConfirmationSMS,
  sendBookingConfirmationWA,
  sendReminderSMS,
  sendOTPSMS,
  sendPaymentReceiptWA,
  sendLawyerNewBookingWA,
};
