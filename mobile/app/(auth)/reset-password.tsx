import React, { useState, useRef } from 'react';
import { View, Text, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '../../src/hooks/useTheme';
import { Btn, Inp } from '../../src/components/ui';
import { authAPI } from '../../src/services/api';
import { useI18n } from '../../src/i18n';

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
  const inputs = useRef<(TextInput | null)[]>([]);

  const sendOtp = async () => {
    if (!email.trim()) { setError(isRTL ? 'أدخل بريدك الإلكتروني' : 'Please enter your email'); return; }
    setLoading(true); setError('');
    try {
      await authAPI.forgotPassword({ email: email.trim().toLowerCase() });
      setStage('otp');
    } catch { setError(isRTL ? 'تعذر الإرسال — تحقق من البريد الإلكتروني' : 'Failed to send — check your email address'); }
    finally { setLoading(false); }
  };

  const verifyOtp = () => {
    const code = otp.join('');
    if (code.length < 6) { setError(isRTL ? 'أدخل الكود كاملاً (6 أرقام)' : 'Enter the full 6-digit code'); return; }
    setError('');
    setStage('new_password');
  };

  const handleOtpChange = (i: number, val: string) => {
    if (!/^\d?$/.test(val)) return;
    const next = [...otp]; next[i] = val; setOtp(next);
    setError('');
    if (val && i < 5) setTimeout(() => inputs.current[i + 1]?.focus(), 10);
  };

  const handleOtpKey = (i: number, key: string) => {
    if (key === 'Backspace' && !otp[i] && i > 0) setTimeout(() => inputs.current[i - 1]?.focus(), 10);
  };

  const resetPassword = async () => {
    if (password !== confirm) { setError(isRTL ? 'كلمات المرور غير متطابقة' : 'Passwords do not match'); return; }
    if (password.length < 8)  { setError(isRTL ? 'كلمة المرور يجب أن تكون 8 أحرف على الأقل' : 'Password must be at least 8 characters'); return; }
    setLoading(true); setError('');
    try {
      await authAPI.resetPassword({ token: otp.join(''), email, newPassword: password });
      setDone(true);
      setTimeout(() => router.replace('/(auth)/login' as any), 2000);
    } catch { setError(isRTL ? 'تعذر تغيير كلمة المرور' : 'Failed to reset password'); }
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
          <Text style={{ color: C.text, fontWeight: '700', fontSize: 24, fontFamily: 'CormorantGaramond-Bold', textAlign: 'center' }}>
            {done ? (isRTL ? 'تم تغيير كلمة المرور!' : 'Password Changed!') : TITLES[stage]}
          </Text>
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
            <View style={{ backgroundColor: (C.red || '#FF3844') + '15', borderRadius: 10, padding: 10, marginBottom: 14 }}>
              <Text style={{ color: C.red || '#FF3844', fontSize: 13, textAlign: 'center' }}>⚠️ {error}</Text>
            </View>
          )}

          {done ? (
            <View style={{ alignItems: 'center', paddingVertical: 20 }}>
              <Text style={{ fontSize: 48, marginBottom: 12 }}>✅</Text>
              <Text style={{ color: C.muted, fontSize: 13, textAlign: 'center', lineHeight: 22 }}>
                {isRTL
                  ? 'تم تغيير كلمة المرور بنجاح!\nجاري التوجيه لصفحة الدخول...'
                  : 'Password changed successfully!\nRedirecting to login...'}
              </Text>
            </View>

          ) : stage === 'email' ? (
            <>
              <Text style={{ color: C.muted, fontSize: 13, marginBottom: 16, lineHeight: 20 }}>
                {isRTL
                  ? 'أدخل بريدك الإلكتروني وسنرسل لك كود التحقق.'
                  : "Enter your email and we'll send you a verification code."}
              </Text>
              <Inp C={C} label={isRTL ? 'البريد الإلكتروني *' : 'Email *'} value={email} onChangeText={setEmail}
                placeholder="your@email.com" keyboardType="email-address" autoCapitalize="none" />
              <Btn C={C} full disabled={loading || !email.trim()} onPress={sendOtp}>
                {loading
                  ? (isRTL ? '⏳ جاري الإرسال...' : '⏳ Sending...')
                  : (isRTL ? 'إرسال كود التحقق' : 'Send Verification Code')}
              </Btn>
            </>

          ) : stage === 'otp' ? (
            <>
              <Text style={{ color: C.muted, fontSize: 13, marginBottom: 20, textAlign: 'center', lineHeight: 20 }}>
                {isRTL ? 'أرسلنا كود من 6 أرقام إلى ' : 'We sent a 6-digit code to '}
                <Text style={{ color: C.gold, fontWeight: '600' }}>{email}</Text>
              </Text>
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
                      width: 44, height: 54, textAlign: 'center', fontSize: 24, fontWeight: '700',
                      backgroundColor: C.bg, borderWidth: 2, borderColor: v ? C.gold : C.border,
                      borderRadius: 12, color: C.text,
                    }}
                  />
                ))}
              </View>
              <Btn C={C} full disabled={loading} onPress={verifyOtp}>
                {loading
                  ? (isRTL ? '⏳ جاري التحقق...' : '⏳ Verifying...')
                  : (isRTL ? 'تحقق من الكود' : 'Verify Code')}
              </Btn>
              <TouchableOpacity onPress={sendOtp} style={{ marginTop: 14, alignItems: 'center' }}>
                <Text style={{ color: C.muted, fontSize: 13 }}>
                  {isRTL ? 'لم يصلك الكود؟ ' : "Didn't receive the code? "}
                  <Text style={{ color: C.gold, fontWeight: '600' }}>{isRTL ? 'أعد الإرسال' : 'Resend'}</Text>
                </Text>
              </TouchableOpacity>
            </>

          ) : (
            <>
              <Text style={{ color: C.muted, fontSize: 13, marginBottom: 16, lineHeight: 20 }}>
                {isRTL
                  ? 'أدخل كلمة المرور الجديدة. يجب أن تكون 8 أحرف على الأقل.'
                  : 'Enter your new password. Must be at least 8 characters.'}
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
              <Btn C={C} full disabled={loading || !password || !confirm} onPress={resetPassword}>
                {loading
                  ? (isRTL ? '⏳ جاري التغيير...' : '⏳ Changing...')
                  : (isRTL ? 'تغيير كلمة المرور' : 'Change Password')}
              </Btn>
            </>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
