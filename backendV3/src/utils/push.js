// ─── Firebase Push Notifications ──────────────────────────────────────────────
// Setup: Firebase console → Project → Cloud Messaging → get Server Key
// .env:
//   FIREBASE_PROJECT_ID=wakeel-eg
//   FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n..."
//   FIREBASE_CLIENT_EMAIL=firebase-adminsdk@wakeel-eg.iam.gserviceaccount.com

const pool = require('../config/db');
let firebaseAdmin = null;

function getFirebase() {
  if (firebaseAdmin) return firebaseAdmin;
  if (!process.env.FIREBASE_PROJECT_ID) return null;
  try {
    const admin = require('firebase-admin');
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId:   process.env.FIREBASE_PROJECT_ID,
          privateKey:  (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        }),
      });
    }
    firebaseAdmin = admin;
    return admin;
  } catch (err) {
    console.error('[Firebase init error]', err.message);
    return null;
  }
}

// Send to a single token
async function sendToToken(token, { title, body, data = {}, imageUrl }) {
  const admin = getFirebase();
  if (!admin) {
    console.log(`[PUSH SKIPPED] ${title}: ${body}`);
    return { skipped: true };
  }
  try {
    const result = await admin.messaging().send({
      token,
      notification: { title, body, ...(imageUrl ? { imageUrl } : {}) },
      data:         Object.fromEntries(Object.entries(data).map(([k,v]) => [k, String(v)])),
      webpush: {
        notification: { icon:'/favicon.svg', badge:'/badge.png', requireInteraction: true },
        fcmOptions:   { link: data.link || '/' },
      },
    });
    return { sent: true, messageId: result };
  } catch (err) {
    if (err.code === 'messaging/registration-token-not-registered') {
      // Token expired — remove from DB
      await pool.query('DELETE FROM push_tokens WHERE token=$1', [token]).catch(() => {});
    }
    console.error('[PUSH ERROR]', err.message);
    return { error: err.message };
  }
}

// Send to all devices of a user
async function sendToUser(userId, notification) {
  const { rows } = await pool.query('SELECT token FROM push_tokens WHERE user_id=$1', [userId]);
  if (!rows.length) return { noTokens: true };
  const results = await Promise.all(rows.map(r => sendToToken(r.token, notification)));
  return { sent: results.filter(r => r.sent).length, total: rows.length };
}

// Save a device token
async function saveToken(userId, token, platform = 'web') {
  await pool.query(
    `INSERT INTO push_tokens (user_id, token, platform) VALUES ($1,$2,$3)
     ON CONFLICT (user_id, token) DO NOTHING`,
    [userId, token, platform]
  );
}

// Remove a device token (on logout)
async function removeToken(userId, token) {
  await pool.query('DELETE FROM push_tokens WHERE user_id=$1 AND token=$2', [userId, token]);
}

// ── Notification helpers ───────────────────────────────────────────────────────
async function notifyNewBooking(lawyerId, { clientName, date, time }) {
  return sendToUser(lawyerId, {
    title: '📅 حجز جديد!',
    body:  `${clientName} حجز معك ${date} الساعة ${time}`,
    data:  { type: 'new_booking', link: '/lawyer/dashboard' },
  });
}

async function notifyBookingConfirmed(clientId, { lawyerName, date, time }) {
  return sendToUser(clientId, {
    title: '✅ تم تأكيد حجزك',
    body:  `${lawyerName} قبل حجزك ${date} الساعة ${time}`,
    data:  { type: 'booking_confirmed', link: '/bookings' },
  });
}

async function notifySessionReminder(userId, { lawyerName, minutesBefore = 30 }) {
  return sendToUser(userId, {
    title: `⏰ تذكير: ${minutesBefore} دقيقة للجلسة`,
    body:  `جلستك مع ${lawyerName} تبدأ قريباً`,
    data:  { type: 'reminder', link: '/bookings' },
  });
}

async function notifyNewMessage(userId, { senderName, preview }) {
  return sendToUser(userId, {
    title: `💬 رسالة من ${senderName}`,
    body:  preview.slice(0, 80),
    data:  { type: 'new_message', link: '/messages' },
  });
}

async function notifyPaymentReceived(lawyerId, { clientName, amount }) {
  return sendToUser(lawyerId, {
    title: '💰 تم استلام دفعة',
    body:  `${clientName} دفع ${amount} جنيه`,
    data:  { type: 'payment', link: '/lawyer/dashboard' },
  });
}

module.exports = {
  sendToToken, sendToUser, saveToken, removeToken,
  notifyNewBooking, notifyBookingConfirmed, notifySessionReminder,
  notifyNewMessage, notifyPaymentReceived,
};
