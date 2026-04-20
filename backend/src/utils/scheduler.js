// ─── Cron Job Scheduler ────────────────────────────────────────────────────────
// Handles:
//   • 30-minute booking reminders (email + WhatsApp + push)
//   • Daily court date reminders
//   • Subscription renewal warnings (7 days before)
//   • Expired OTP cleanup
//   • Expired JWT blacklist cleanup

const cron = require('node-cron');
const pool = require('../config/db');
const { sendBookingReminder }  = require('./email');
const { sendReminderSMS }      = require('./sms');
const { notifySessionReminder, notifyNewBooking } = require('./push');

let schedulerStarted = false;

function startScheduler() {
  if (schedulerStarted) return;
  schedulerStarted = true;

  console.log('⏰ Scheduler started');

  // ── Every minute: check for bookings starting in 30 minutes ─────────────────
  cron.schedule('* * * * *', async () => {
    try {
      const { rows } = await pool.query(`
        SELECT b.*, 
               cu.email AS client_email, cu.name AS client_name, cu.phone AS client_phone,
               lu.email AS lawyer_email, lu.name AS lawyer_name, lu.phone AS lawyer_phone
        FROM bookings b
        JOIN users cu ON cu.id = b.client_id
        JOIN users lu ON lu.id = b.lawyer_id
        WHERE b.status = 'confirmed'
          AND b.reminder_sent = false
          AND (
            COALESCE(b.scheduled_at, b.booking_date::timestamptz)
          ) BETWEEN NOW() + INTERVAL '29 minutes' AND NOW() + INTERVAL '31 minutes'
      `);

      for (const booking of rows) {
        // Email reminder to client
        await sendBookingReminder({
          to:         booking.client_email,
          clientName: booking.client_name,
          lawyerName: booking.lawyer_name,
          time:       booking.start_time?.slice(0,5),
          bookingId:  booking.id,
        }).catch(console.error);

        // WhatsApp/SMS reminder
        if (booking.client_phone) {
          await sendReminderSMS({
            phone:      booking.client_phone,
            lawyerName: booking.lawyer_name,
            time:       booking.start_time?.slice(0,5),
            bookingId:  booking.id,
          }).catch(console.error);
        }

        // Push notification
        await notifySessionReminder(booking.client_id, {
          lawyerName:    booking.lawyer_name,
          minutesBefore: 30,
        }).catch(console.error);

        // Mark reminder as sent
        await pool.query('UPDATE bookings SET reminder_sent=true WHERE id=$1', [booking.id]);
      }

      if (rows.length) console.log(`⏰ Sent ${rows.length} booking reminders`);
    } catch (err) { console.error('[Scheduler reminder error]', err.message); }
  });

  // ── Daily at 8:00 AM Cairo time: court date reminders ───────────────────────
  cron.schedule('0 6 * * *', async () => { // 6 UTC = 8 Cairo (EET)
    try {
      const { rows } = await pool.query(`
        SELECT cd.*, u.email, u.name, u.phone
        FROM court_dates cd
        JOIN users u ON u.id = cd.user_id
        WHERE cd.date = CURRENT_DATE + INTERVAL '1 day'
          AND cd.reminder = true
      `);

      for (const d of rows) {
        const { sendEmail } = require('./email');
        await sendEmail({
          to:      d.email,
          subject: `⏰ تذكير: ${d.title} — غداً`,
          html:    `<p>مرحباً ${d.name}،</p><p>لديك <strong>${d.title}</strong> غداً في <strong>${d.court}</strong> الساعة <strong>${d.time || 'انظر تفاصيلك'}</strong>.</p>`,
        }).catch(console.error);
      }

      if (rows.length) console.log(`📅 Sent ${rows.length} court date reminders`);
    } catch (err) { console.error('[Court reminder error]', err.message); }
  });

  // ── Daily at 9:00 AM: subscription renewal warning (7 days before) ───────────
  cron.schedule('0 7 * * *', async () => {
    try {
      const { rows } = await pool.query(`
        SELECT s.*, u.email, u.name
        FROM subscriptions s
        JOIN users u ON u.id = s.user_id
        WHERE s.status = 'active'
          AND s.expires_at BETWEEN NOW() AND NOW() + INTERVAL '7 days'
          AND s.renewal_warning_sent = false
      `);

      for (const sub of rows) {
        const { sendEmail } = require('./email');
        await sendEmail({
          to:      sub.email,
          subject: '⚠️ اشتراكك سينتهي خلال 7 أيام — Wakeel',
          html:    `<p>مرحباً ${sub.name}، اشتراكك ${sub.plan} سينتهي في ${new Date(sub.expires_at).toLocaleDateString('ar-EG')}. جدّد الآن للاستمرار في استقبال العملاء.</p>`,
        }).catch(console.error);

        await pool.query('UPDATE subscriptions SET renewal_warning_sent=true WHERE id=$1', [sub.id]).catch(() => {});
      }

      if (rows.length) console.log(`📧 Sent ${rows.length} renewal warnings`);
    } catch (err) { console.error('[Renewal warning error]', err.message); }
  });

  // ── Every hour: cleanup expired OTPs and blacklisted tokens ─────────────────
  cron.schedule('0 * * * *', async () => {
    try {
      await pool.query(`DELETE FROM otp_codes WHERE expires_at < NOW() - INTERVAL '1 hour'`);
      await pool.query(`DELETE FROM blacklist_tokens WHERE expires_at < NOW()`);
    } catch (err) { console.error('[Cleanup error]', err.message); }
  });

  // ── 🔄 Agent 1: Data Sync (Infrastructure) ── Nightly at 3:00 AM ────────────
  cron.schedule('0 3 * * *', async () => {
    try {
      console.log('🔄 Data Sync Agent: Recalculating forum counters...');
      // Fix ghost answers counts
      await pool.query(`
        UPDATE forum_questions fq
        SET answers_count = (SELECT COUNT(*) FROM forum_answers WHERE question_id = fq.id)
      `);
      // Hide inactive ghost lawyers
      await pool.query(`
        UPDATE lawyer_profiles lp
        SET is_visible = false
        FROM users u
        WHERE u.id = lp.user_id AND u.last_active_at < NOW() - INTERVAL '6 months'
      `);
      console.log('✅ Data Sync Agent finished.');
    } catch (err) { console.error('[Data Sync Agent Error]', err.message); }
  });

  // ── 🌟 Agent 2: Reputation Karma (Lawyer-Side) ── Nightly at 4:00 AM ───────
  cron.schedule('0 4 * * *', async () => {
    try {
      console.log('🌟 Reputation Agent: Calculating lawyer karma scores...');
      await pool.query(`
        UPDATE lawyer_profiles lp
        SET karma_score = (
          (COALESCE(lp.accepted_answers, 0) * 10) +
          (COALESCE((SELECT SUM(likes_count) FROM forum_answers WHERE lawyer_id = lp.user_id), 0) * 2) +
          (COALESCE((SELECT COUNT(*) FROM reviews WHERE lawyer_id = lp.user_id AND rating = 5), 0) * 5)
        )
      `);
      console.log('✅ Reputation Agent finished.');
    } catch (err) { console.error('[Reputation Agent Error]', err.message); }
  });

  // ── 📊 Agent 3: Business Intelligence (Market Trends) ── Sundays at Midnight 
  cron.schedule('0 0 * * 0', async () => {
    try {
      console.log('📊 BI Agent: Generating weekly market insights...');
      const { rows } = await pool.query(`
        SELECT category, COUNT(*) as post_count, COALESCE(SUM(likes_count), 0) as likes_count
        FROM forum_questions
        WHERE created_at >= NOW() - INTERVAL '7 days' AND category IS NOT NULL
        GROUP BY category
        ORDER BY post_count DESC
        LIMIT 10
      `);

      if (rows.length > 0) {
        // Truncate old trends and insert new
        await pool.query('TRUNCATE TABLE market_trends');
        for (const trend of rows) {
          await pool.query(
            'INSERT INTO market_trends (category, post_count, likes_count) VALUES ($1, $2, $3)',
            [trend.category, trend.post_count, trend.likes_count]
          );
        }
        console.log('✅ BI Agent finished crunching market trends.');
      }
    } catch (err) { console.error('[BI Agent Error]', err.message); }
  });
}

module.exports = { startScheduler };
