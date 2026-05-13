const crypto = require('crypto');
const pool   = require('../config/db');
const { sendOTPSMS }   = require('./sms');
const { sendOTPEmail } = require('./email');

const OTP_EXPIRE_MINUTES = 10;
const MAX_ATTEMPTS       = 5;

// Generate a 6-digit OTP
function generateOTP() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

// Send OTP to phone
async function sendPhoneOTP(phone, userId, purpose = 'verify') {
  const code      = generateOTP();
  const expiresAt = new Date(Date.now() + OTP_EXPIRE_MINUTES * 60 * 1000);

  // Invalidate previous OTPs for this phone+purpose
  await pool.query(
    `UPDATE otp_codes SET used_at=NOW() WHERE phone=$1 AND purpose=$2 AND used_at IS NULL`,
    [phone, purpose]
  );

  await pool.query(
    `INSERT INTO otp_codes (phone, user_id, code, purpose, expires_at) VALUES ($1,$2,$3,$4,$5)`,
    [phone, userId || null, code, purpose, expiresAt]
  );

  const smsResult = await sendOTPSMS({ phone, otp: code, purpose });
  return smsResult?.skipped ? { skipped: true, code } : { sent: true };
}

// Send OTP to email
async function sendEmailOTP(email, name, userId, purpose = 'verify') {
  const code      = generateOTP();
  const expiresAt = new Date(Date.now() + OTP_EXPIRE_MINUTES * 60 * 1000);

  await pool.query(
    `UPDATE otp_codes SET used_at=NOW() WHERE phone=$1 AND purpose=$2 AND used_at IS NULL`,
    [email, purpose]
  );

  await pool.query(
    `INSERT INTO otp_codes (phone, user_id, code, purpose, expires_at) VALUES ($1,$2,$3,$4,$5)`,
    [email, userId || null, code, purpose, expiresAt]
  );

  const emailResult = await sendOTPEmail({ to: email, name, otp: code, purpose });
  return (emailResult?.skipped || emailResult?.error) ? { skipped: true, code } : { sent: true };
}

// Verify OTP
async function verifyOTP(phoneOrEmail, code, purpose = 'verify') {
  const { rows } = await pool.query(
    `SELECT * FROM otp_codes
     WHERE phone=$1 AND purpose=$2 AND used_at IS NULL AND expires_at > NOW()
     ORDER BY created_at DESC LIMIT 1`,
    [phoneOrEmail, purpose]
  );

  if (!rows.length) return { valid: false, reason: 'expired_or_not_found' };

  const record = rows[0];

  // Increment attempts
  await pool.query(`UPDATE otp_codes SET attempts=attempts+1 WHERE id=$1`, [record.id]);

  if (record.attempts >= MAX_ATTEMPTS) return { valid: false, reason: 'too_many_attempts' };
  if (record.code !== code)            return { valid: false, reason: 'wrong_code' };

  // Mark as used
  await pool.query(`UPDATE otp_codes SET used_at=NOW() WHERE id=$1`, [record.id]);

  return { valid: true, userId: record.user_id };
}

module.exports = { sendPhoneOTP, sendEmailOTP, verifyOTP, generateOTP };
