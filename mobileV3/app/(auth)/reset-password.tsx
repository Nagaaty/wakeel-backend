import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '../../src/hooks/useTheme';
import { Btn, Inp } from '../../src/components/ui';
import { authAPI } from '../../src/services/api';
import { useI18n } from '../../src/i18n';

const RESEND_SECONDS = 60;

export default function ResetPasswordScreen() {
  const C = useTheme();
  const { isRTL } = useI18n();
  const [stage,    setStage]    = useState<'email'|'otp'|'new_password'>('email');
  const [email,    setEmail]    = useState('');
  const [otp,      setOtp]      = useState(['','','','','','']);
  const [password, setPassword] = useState('');
  const [confirm,  setConfirm]  = useState('');
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');
  const [done,     setDone]     = useState(false);
  // Resend countdown
  const [resendTimer, setResendTimer] = useState(0);
  const inputs = useRef<(TextInput | null)[]>([]);

  // Countdown ticker
  useEffect(() => {
    if (resendTimer <= 0) return;
    const t = setInterval(() => setResendTimer(s => s - 1), 1000);
    return () => clearInterval(t);
  }, [resendTimer]);

  // ── Stage 1: send OTP ────────────────────────────────────────────────────────
  const sendOtp = async () => {
    if (!email.trim()) { setError(isRTL ? 'أدخل بريدك الإلكتروني' : 'Please enter your email'); return; }
    setLoading(true); setError('');
    try {
      await authAPI.forgotPassword({ email: email.trim().toLowerCase() });
      setStage('otp');
      setResendTimer(RESEND_SECONDS);
    } catch { setError(isRTL ? 'تعذر الإرسال — تحقق من البريد الإلكتروني' : 'Failed to send — check your email address'); }
    finally { setLoading(false); }
  };

  const resendOtp = async () => {
    if (resendTimer > 0) return;
    setOtp(['','','','','','']);
    setError('');
    setLoading(true);
    try {
      await authAPI.forgotPassword({ email: email.trim().toLowerCase() });
      setResendTimer(RESEND_SECONDS);
    } catch { setError(isRTL ? 'تعذر إعادة الإرسال' : 'Failed to resend'); }
    finally { setLoading(false); }
  };

  // ── Stage 2: verify OTP against backend ──────────────────────────────────────
  const verifyOtp = async () => {
    const code = otp.join('');
    if (code.length < 6) { setError(isRTL ? 'أدخل الكود كاملاً (6 أرقام)' : 'Enter the full 6-digit code'); return; }
    setLoading(true); setError('');
    try {
      // Verify OTP server-side before allowing password stage
      await authAPI.verifyOtpPublic({ email: email.trim().toLowerCase(), code, purpose: 'reset' });
      setStage('new_password');
    } catch (e: any) {
      setError(isRTL ? 'الكود غير صحيح أو انتهت صلاحيته' : 'Invalid or expired code. Please try again.');
      setOtp(['','','','','','']);
      setTimeout(() => inputs.current[0]?.focus(), 100);
    }
    finally { setLoading(false); }
  };

  const handleOtpChange = (i: number, val: string) => {
    if (!/^\d?$/.test(val)) return;
    const next = [...otp]; next[i] = val; setOtp(next);
    setError('');
    if (val && i < 5) setTimeout(() => inputs.current[i + 1]?.focus(), 10);
    // Auto-submit when all digits filled
    if (val && i === 5) {
      const full = [...next];
      if (full.every(d => d)) setTimeout(verifyOtp, 150);
    }
  };

  const handleOtpKey = (i: number, key: string) => {
    if (key === 'Backspace' && !otp[i] && i > 0) setTimeout(() => inputs.current[i - 1]?.focus(), 10);
  };

  // ── Stage 3: reset password ─────────────────────────────────────────────────
  const resetPassword = async () => {
    if (password !== confirm) { setError(isRTL ? 'كلمات المرور غير متطابقة' : 'Passwords do not match'); return; }
    if (password.length < 8)  { setError(isRTL ? 'كلمة المرور يجب أن تكون 8 أحرف على الأقل' : 'Password must be at least 8 characters'); return; }
    setLoading(true); setError('');
    try {
      await authAPI.resetPassword({ token: otp.join(''), email: email.trim().toLowerCase(), newPassword: password });
      setDone(true);
      setTimeout(() => router.replace('/(auth)/login' as any), 2000);
    } catch { setError(isRTL ? 'تعذر تغيير كلمة المرور' : 'Failed to reset password. The code may have expired.'); }
    finally { setLoading(false); }
  };

  const TITLES: Record<string, string> = {
    email:        isRTL ? 'استعادة كلمة المرور'    : 'Reset Password',
    otp:          isRTL ? 'تحقق من بريدك'           : 'Check your email',
    new_password: isRTL ? 'تعيين كلمة مرور جديدة'  : 'Set new password',
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 24 }}>

        <TouchableOpacity
          onPress={() => stage === 'email' ? router.back() : setStage(stage === 'otp' ? 'email' : 'otp')}
          style={{ marginBottom: 20 }}>
          <Text style={{ color: C.gold, fontSize: 15 }}>{isRTL ? '← العودة' : '← Back'}</Text>
        </TouchableOpacity>

        <View style={{ alignItems: 'center', marginBottom: 28 }}>
          <Text style={{ fontSize: 48, marginBottom: 12 }}>
            {stage === 'email' ? '🔐' : stage === 'otp' ? '📧' : '🔑'}
          </Text>
          <Text style={{ color: C.text, fontWeight: '700', fontSize: 24, fontFamily: 'Cairo-Bold', textAlign: 'center' }}>
            {done ? (isRTL ? 'تم تغيير كلمة المرور!' : 'Password Changed!') : TITLES[stage]}
          </Text>
          {stage === 'otp' && !done && (
            <Text style={{ color: C.muted, fontSize: 13, marginTop: 8, textAlign: 'center' }}>
              {isRTL ? 'أرسلنا كود من 6 أرقام إلى ' : 'We sent a 6-digit code to '}
              <Text style={{ color: C.gold, fontWeight: '600' }}>{email}</Text>
            </Text>
          )}
        </View>

        {/* Progress dots */}
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 28 }}>
          {(['email', 'otp', 'new_password'] as const).map((s, i) => (
            <View key={s} style={{
              width: stage === s ? 24 : 8, height: 8, borderRadius: 4,
              backgroundColor: (stage === s || (stage === 'new_password' && i < 2) || (stage === 'otp' && i === 0))
                ? C.gold : C.border,
            }} />
          ))}
        </View>

        <View style={{ backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 20, padding: 24 }}>
          {!!error && (
            <View style={{ backgroundColor: (C.red || '#FF3844') + '15', borderRadius: 10, padding: 12, marginBottom: 14, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={{ fontSize: 16 }}>⚠️</Text>
              <Text style={{ color: C.red || '#FF3844', fontSize: 13, flex: 1 }}>{error}</Text>
            </View>
          )}

          {/* ── DONE ─────────────────────────────────────────── */}
          {done ? (
            <View style={{ alignItems: 'center', paddingVertical: 20 }}>
              <Text style={{ fontSize: 52, marginBottom: 12 }}>✅</Text>
              <Text style={{ color: C.text, fontWeight: '700', fontSize: 18, marginBottom: 8, fontFamily: 'Cairo-Bold' }}>
                {isRTL ? 'تم بنجاح!' : 'All done!'}
              </Text>
              <Text style={{ color: C.muted, fontSize: 13, textAlign: 'center', lineHeight: 22 }}>
                {isRTL
                  ? 'تم تغيير كلمة المرور بنجاح!\nجاري التوجيه لصفحة الدخول...'
                  : 'Password changed successfully!\nRedirecting to login...'}
              </Text>
            </View>

          /* ── STAGE 1: Email ──────────────────────────────────────── */
          ) : stage === 'email' ? (
            <>
              <Text style={{ color: C.muted, fontSize: 13, marginBottom: 16, lineHeight: 22 }}>
                {isRTL
                  ? 'أدخل بريدك الإلكتروني وسنرسل لك كود التحقق.'
                  : "Enter your email and we'll send you a 6-digit verification code."}
              </Text>
              <Inp C={C}
                label={isRTL ? 'البريد الإلكتروني *' : 'Email address *'}
                value={email} onChangeText={setEmail}
                placeholder="your@email.com"
                keyboardType="email-address"
                autoCapitalize="none" />
              <Btn C={C} full disabled={loading || !email.trim()} onPress={sendOtp}>
                {loading
                  ? (isRTL ? '⏳ جاري الإرسال...' : '⏳ Sending...')
                  : (isRTL ? 'إرسال كود التحقق' : 'Send Verification Code')}
              </Btn>
            </>

          /* ── STAGE 2: OTP ────────────────────────────────────────── */
          ) : stage === 'otp' ? (
            <>
              {/* 6-box OTP Input */}
              <View style={{ flexDirection: 'row', gap: 8, justifyContent: 'center', marginBottom: 24 }}>
                {otp.map((v, i) => (
                  <TextInput
                    key={i}
                    ref={el => { inputs.current[i] = el; }}
                    value={v}
                    onChangeText={val => handleOtpChange(i, val)}
                    onKeyPress={({ nativeEvent }) => handleOtpKey(i, nativeEvent.key)}
                    maxLength={1}
                    keyboardType="number-pad"
                    selectTextOnFocus
                    style={{
                      width: 44, height: 56, textAlign: 'center', fontSize: 24, fontWeight: '800',
                      backgroundColor: C.bg, borderWidth: 2,
                      borderColor: v ? C.gold : error ? (C.red || '#FF3844') : C.border,
                      borderRadius: 14, color: C.text,
                    }}
                  />
                ))}
              </View>

              <Btn C={C} full disabled={loading || otp.some(d => !d)} onPress={verifyOtp}>
                {loading
                  ? (isRTL ? '⏳ جاري التحقق...' : '⏳ Verifying...')
                  : (isRTL ? 'تحقق وتابع ✓' : 'Verify & Continue ✓')}
              </Btn>

              {/* Resend button with live countdown */}
              <View style={{ marginTop: 18, alignItems: 'center' }}>
                {resendTimer > 0 ? (
                  <Text style={{ color: C.muted, fontSize: 13 }}>
                    {isRTL
                      ? `إعادة الإرسال خلال ${resendTimer}s`
                      : `Resend code in ${resendTimer}s`}
                  </Text>
                ) : (
                  <TouchableOpacity onPress={resendOtp} disabled={loading}>
                    <Text style={{ color: C.muted, fontSize: 13 }}>
                      {isRTL ? 'لم يصلك الكود؟ ' : "Didn't receive it? "}
                      <Text style={{ color: C.gold, fontWeight: '700' }}>
                        {isRTL ? 'أعد الإرسال' : 'Resend code'}
                      </Text>
                    </Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity onPress={() => setStage('email')} style={{ marginTop: 10 }}>
                  <Text style={{ color: C.muted, fontSize: 12 }}>
                    {isRTL ? 'تغيير البريد الإلكتروني' : 'Use a different email'}
                  </Text>
                </TouchableOpacity>
              </View>
            </>

          /* ── STAGE 3: New Password ───────────────────────────────── */
          ) : (
            <>
              <Text style={{ color: C.muted, fontSize: 13, marginBottom: 16, lineHeight: 22 }}>
                {isRTL
                  ? 'أدخل كلمة المرور الجديدة. يجب أن تكون 8 أحرف على الأقل.'
                  : 'Choose a strong new password. Must be at least 8 characters.'}
              </Text>
              <Inp C={C}
                label={isRTL ? 'كلمة المرور الجديدة *' : 'New Password *'}
                value={password} onChangeText={setPassword}
                placeholder={isRTL ? '8 أحرف على الأقل' : 'At least 8 characters'}
                secureTextEntry />
              <Inp C={C}
                label={isRTL ? 'تأكيد كلمة المرور *' : 'Confirm Password *'}
                value={confirm} onChangeText={setConfirm}
                placeholder={isRTL ? 'أعد كتابة كلمة المرور' : 'Re-enter your password'}
                secureTextEntry />
              {/* Password match indicator */}
              {confirm.length > 0 && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12, marginTop: -6 }}>
                  <Text style={{ fontSize: 13 }}>{password === confirm ? '✅' : '❌'}</Text>
                  <Text style={{ color: password === confirm ? C.gold : (C.red || '#FF3844'), fontSize: 12 }}>
                    {password === confirm
                      ? (isRTL ? 'كلمتا المرور متطابقتان' : 'Passwords match')
                      : (isRTL ? 'كلمتا المرور غير متطابقتين' : 'Passwords do not match')}
                  </Text>
                </View>
              )}
              <Btn C={C} full disabled={loading || !password || !confirm || password !== confirm} onPress={resetPassword}>
                {loading
                  ? (isRTL ? '⏳ جاري الحفظ...' : '⏳ Saving...')
                  : (isRTL ? '🔑 تعيين كلمة المرور الجديدة' : '🔑 Set New Password')}
              </Btn>
            </>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
