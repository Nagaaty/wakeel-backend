const nodemailer = require('nodemailer');

// ─── Email Service ──────────────────────────────────────────────────────────
//
// Priority order (first configured wins):
//
// 1. Resend (EASIEST — just one API key, free 3,000/month)
//    Sign up at: https://resend.com → Create API Key
//    Render env:  RESEND_API_KEY=re_xxxx
//    Render env:  RESEND_FROM=Wakeel <onboarding@resend.dev>  ← use this for testing
//
// 2. Gmail SMTP (requires App Password)
//    Google account → Security → 2-Step Verification → App Passwords
//    Render env: EMAIL_HOST=smtp.gmail.com
//    Render env: EMAIL_PORT=587
//    Render env: EMAIL_USER=your@gmail.com
//    Render env: EMAIL_PASS=your-16-char-app-password
// ─────────────────────────────────────────────────────────────────────────────

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;
  const timeouts = { connectionTimeout: 5000, socketTimeout: 8000, greetingTimeout: 5000 };
  if (process.env.EMAIL_SENDGRID_KEY) {
    transporter = nodemailer.createTransport({
      host: 'smtp.sendgrid.net', port: 587,
      auth: { user: 'apikey', pass: process.env.EMAIL_SENDGRID_KEY },
      ...timeouts,
    });
  } else if (process.env.EMAIL_HOST) {
    transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST, port: parseInt(process.env.EMAIL_PORT || '587'),
      secure: process.env.EMAIL_SECURE === 'true',
      auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
      ...timeouts,
    });
  } else {
    return null;
  }
  return transporter;
}

const FROM = process.env.EMAIL_FROM || process.env.RESEND_FROM || 'Wakeel Legal <onboarding@resend.dev>';
const BASE_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

// ─── Resend (primary — easiest setup) ──────────────────────────────────────
async function sendViaResend({ to, subject, html }) {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null; // not configured

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
    body: JSON.stringify({
      from: FROM,
      to: [to],
      subject,
      html,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Resend error');
  return { sent: true, messageId: data.id };
}

// ─── Core send function ─────────────────────────────────────────────────────
async function sendEmail({ to, subject, html, text }) {
  // 1. Try SMTP (Gmail, SendGrid, etc.) FIRST (since this was previously working for the user)
  const t = getTransporter();
  if (t) {
    try {
      // Gmail STRICTLY requires the 'from' address to match the authenticated user
      const smtpFrom = process.env.EMAIL_USER ? `Wakeel <${process.env.EMAIL_USER}>` : FROM;
      const info = await t.sendMail({ from: smtpFrom, to, subject, html, text });
      return { sent: true, messageId: info.messageId };
    } catch (err) {
      console.error('[EMAIL ERROR]', err.message);
      transporter = null; // Reset transporter on failure so we try again or fallback
    }
  }

  // 2. Try Resend if SMTP failed or is unconfigured
  if (process.env.RESEND_API_KEY) {
    try {
      return await sendViaResend({ to, subject, html });
    } catch (err) {
      console.error('[RESEND ERROR]', err.message);
    }
  }

  // 3. Nothing configured — log OTP to console so dev can still test
  const otpMatch = subject && subject.match(/^(\d{6})/);
  if (otpMatch) {
    console.log(`\n${'='.repeat(50)}`);
    console.log(`📧 OTP CODE (email not configured — add RESEND_API_KEY to Render)`);
    console.log(`   To:   ${to}`);
    console.log(`   Code: ${otpMatch[1]}`);
    console.log(`${'='.repeat(50)}\n`);
  } else {
    console.log(`[EMAIL SKIPPED] To: ${to} | Subject: ${subject}`);
  }
  return { skipped: true };
}

// ─── Email Templates ───────────────────────────────────────────────────────
const wrap = (content) => `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head><meta charset="UTF-8"><style>
  body { font-family: 'Segoe UI', Arial, sans-serif; background:#f5f2ec; margin:0; padding:20px; direction:rtl; }
  .card { background:#fff; border-radius:16px; max-width:560px; margin:0 auto; overflow:hidden; box-shadow:0 4px 24px #0001; }
  .header { background:linear-gradient(135deg,#1a1a2e,#2d2d44); padding:28px 32px; text-align:center; }
  .logo { color:#C8A84B; font-size:28px; font-weight:800; letter-spacing:1px; }
  .tagline { color:#aaa; font-size:13px; margin-top:4px; }
  .body { padding:32px; }
  .btn { display:inline-block; background:linear-gradient(135deg,#C8A84B,#8B6914); color:#fff; text-decoration:none; padding:14px 32px; border-radius:10px; font-weight:700; font-size:15px; margin:16px 0; }
  .footer { background:#f8f8f8; padding:16px 32px; text-align:center; color:#999; font-size:12px; border-top:1px solid #eee; }
  h2 { color:#1a1a2e; margin-top:0; }
  p { color:#555; line-height:1.8; }
  .highlight { background:#fef9ec; border:1px solid #C8A84B44; border-radius:10px; padding:16px; margin:16px 0; }
  .code { font-size:36px; font-weight:800; color:#C8A84B; letter-spacing:8px; text-align:center; padding:16px; }
</style></head>
<body><div class="card">
  <div class="header"><div class="logo">⚖️ Wakeel</div><div class="tagline">منصة المحامين المعتمدين في مصر</div></div>
  <div class="body">${content}</div>
  <div class="footer">© 2026 Wakeel.eg — جميع الحقوق محفوظة<br>هذا البريد أُرسل تلقائياً، لا تردّ عليه.</div>
</div></body></html>
`;

// ── Booking confirmation ───────────────────────────────────────────────────
async function sendBookingConfirmation({ to, clientName, lawyerName, date, time, serviceType, fee, bookingId }) {
  const subject = `✅ تأكيد حجزك مع ${lawyerName} — Wakeel`;
  const html = wrap(`
    <h2>مرحباً ${clientName}،</h2>
    <p>تم تأكيد حجزك بنجاح!</p>
    <div class="highlight">
      <p><strong>⚖️ المحامي:</strong> ${lawyerName}</p>
      <p><strong>📅 التاريخ:</strong> ${date}</p>
      <p><strong>⏰ الوقت:</strong> ${time}</p>
      <p><strong>🗂️ نوع الخدمة:</strong> ${serviceType}</p>
      <p><strong>💰 الرسوم:</strong> ${fee} جنيه</p>
      <p><strong>🔖 رقم الحجز:</strong> WK-${String(bookingId).padStart(6,'0')}</p>
    </div>
    <p>ستتلقى تذكيراً قبل 30 دقيقة من موعدك.</p>
    <a href="${BASE_URL}/bookings" class="btn">عرض حجزي</a>
    <p style="color:#999;font-size:12px;">إذا أردت الإلغاء أو إعادة الجدولة، يمكنك ذلك حتى ساعتين قبل الموعد.</p>
  `);
  return sendEmail({ to, subject, html });
}

// ── Booking reminder (30 min before) ──────────────────────────────────────
async function sendBookingReminder({ to, clientName, lawyerName, time, bookingId }) {
  const subject = `⏰ تذكير: لديك جلسة بعد 30 دقيقة — ${lawyerName}`;
  const html = wrap(`
    <h2>تذكير بموعدك</h2>
    <p>مرحباً ${clientName}،</p>
    <p>لديك جلسة قانونية <strong>بعد 30 دقيقة</strong> مع <strong>${lawyerName}</strong> الساعة <strong>${time}</strong>.</p>
    <a href="${BASE_URL}/bookings" class="btn">انضم للجلسة الآن</a>
  `);
  return sendEmail({ to, subject, html });
}

// ── OTP verification ───────────────────────────────────────────────────────
async function sendOTPEmail({ to, name, otp, purpose }) {
  const purposes = { verify:'تحقق من بريدك الإلكتروني', login:'تسجيل الدخول', reset:'إعادة تعيين كلمة المرور' };
  const subject = `${otp} — كود ${purposes[purpose] || 'التحقق'} في Wakeel`;
  const html = wrap(`
    <h2>${purposes[purpose] || 'كود التحقق'}</h2>
    <p>مرحباً ${name}،</p>
    <p>كود التحقق الخاص بك:</p>
    <div class="highlight"><div class="code">${otp}</div></div>
    <p style="color:#999;font-size:13px;">⏱️ ينتهي الكود خلال 10 دقائق. لا تشاركه مع أحد.</p>
  `);
  return sendEmail({ to, subject, html });
}

// ── Welcome email ──────────────────────────────────────────────────────────
async function sendWelcomeEmail({ to, name, role }) {
  const subject = `مرحباً بك في Wakeel.eg — ${name}`;
  const html = wrap(`
    <h2>أهلاً وسهلاً ${name}! 🎉</h2>
    <p>نحن سعداء بانضمامك إلى منصة Wakeel.eg — المنصة القانونية الأولى في مصر.</p>
    ${role === 'lawyer' ? `
      <p>كمحامٍ معتمد، يمكنك الآن:</p>
      <ul style="color:#555;line-height:2;">
        <li>تلقي حجوزات من عملاء جدد</li>
        <li>إدارة جدولك ومواعيدك</li>
        <li>بناء ملفك المهني</li>
      </ul>
      <a href="${BASE_URL}/lawyer/dashboard" class="btn">ابدأ الآن</a>
    ` : `
      <p>يمكنك الآن:</p>
      <ul style="color:#555;line-height:2;">
        <li>البحث عن محامين موثقين</li>
        <li>حجز استشارات بسهولة</li>
        <li>الحصول على إجابات قانونية سريعة</li>
      </ul>
      <a href="${BASE_URL}/lawyers" class="btn">ابحث عن محامٍ الآن</a>
    `}
  `);
  return sendEmail({ to, subject, html });
}

// ── Payment receipt ────────────────────────────────────────────────────────
async function sendPaymentReceipt({ to, clientName, amount, lawyerName, bookingId, paymentId }) {
  const subject = `🧾 إيصال الدفع — ${amount} جنيه — Wakeel`;
  const html = wrap(`
    <h2>تم الدفع بنجاح ✅</h2>
    <p>مرحباً ${clientName}، تم استلام دفعتك بنجاح.</p>
    <div class="highlight">
      <p><strong>💰 المبلغ:</strong> ${amount} جنيه مصري</p>
      <p><strong>⚖️ المحامي:</strong> ${lawyerName}</p>
      <p><strong>🔖 رقم الحجز:</strong> WK-${String(bookingId).padStart(6,'0')}</p>
      <p><strong>🧾 رقم المعاملة:</strong> ${paymentId}</p>
      <p><strong>📅 التاريخ:</strong> ${new Date().toLocaleDateString('ar-EG')}</p>
    </div>
    <a href="${BASE_URL}/bookings" class="btn">عرض إيصالاتي</a>
  `);
  return sendEmail({ to, subject, html });
}

// ── Lawyer verification result ─────────────────────────────────────────────
async function sendVerificationResult({ to, name, approved }) {
  const subject = approved ? '✅ تم قبول ملفك في Wakeel.eg' : '❌ لم يتم قبول ملفك في Wakeel.eg';
  const html = wrap(approved ? `
    <h2>مبروك ${name}! تم قبولك ✅</h2>
    <p>يسعدنا إبلاغك بأن ملفك تم مراجعته وقبوله في Wakeel.eg.</p>
    <p>يمكنك الآن تفعيل ملفك واستقبال العملاء.</p>
    <a href="${BASE_URL}/lawyer/dashboard" class="btn">اذهب إلى لوحة التحكم</a>
  ` : `
    <h2>عزيزي ${name}،</h2>
    <p>نأسف لإبلاغك بأن ملفك لم يستوفِ متطلبات التحقق في الوقت الحالي.</p>
    <p>يمكنك التواصل مع فريق الدعم لمعرفة التفاصيل وإعادة التقديم.</p>
    <a href="${BASE_URL}/support" class="btn">تواصل مع الدعم</a>
  `);
  return sendEmail({ to, subject, html });
}

// ── Password reset ─────────────────────────────────────────────────────────
async function sendPasswordReset({ to, name, resetToken }) {
  const resetUrl = `${BASE_URL}/reset-password?token=${resetToken}`;
  const subject = '🔐 إعادة تعيين كلمة المرور — Wakeel';
  const html = wrap(`
    <h2>إعادة تعيين كلمة المرور</h2>
    <p>مرحباً ${name}،</p>
    <p>تلقينا طلباً لإعادة تعيين كلمة مرورك. اضغط على الزر أدناه:</p>
    <a href="${resetUrl}" class="btn">إعادة تعيين كلمة المرور</a>
    <p style="color:#999;font-size:13px;">⏱️ الرابط صالح لمدة ساعة واحدة فقط.<br>إذا لم تطلب هذا، تجاهل هذا البريد.</p>
  `);
  return sendEmail({ to, subject, html });
}

// ── Support ticket reply ───────────────────────────────────────────────────
async function sendSupportReply({ to, name, ticketId, reply }) {
  const subject = `💬 رد على تذكرة الدعم #${ticketId} — Wakeel`;
  const html = wrap(`
    <h2>رد فريق الدعم</h2>
    <p>مرحباً ${name}، تم الرد على تذكرة دعمك:</p>
    <div class="highlight"><p style="color:#333;">${reply}</p></div>
    <a href="${BASE_URL}/support" class="btn">عرض التذكرة</a>
  `);
  return sendEmail({ to, subject, html });
}

module.exports = {
  sendEmail,
  sendBookingConfirmation,
  sendBookingReminder,
  sendOTPEmail,
  sendWelcomeEmail,
  sendPaymentReceipt,
  sendVerificationResult,
  sendPasswordReset,
  sendSupportReply,
};
