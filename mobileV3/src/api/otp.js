import api from './client';

// Send OTP to phone number
export async function sendOTP(phone) {
  const res = await api.post('/auth/send-otp', { phone });
  return res.data;
}

// Verify OTP code entered by user
export async function verifyOTP(phone, code) {
  const res = await api.post('/auth/verify-otp', { phone, code });
  return res.data;
}
