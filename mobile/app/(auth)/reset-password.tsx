import React, { useState, useRef } from 'react';
import { View, Text, TouchableOpacity, TextInput, Alert, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '../../src/hooks/useTheme';
import { Btn, Inp } from '../../src/components/ui';
import { authAPI } from '../../src/services/api';
import { useI18n } from '../../src/i18n';

export default function ResetPasswordScreen() {
  const C = useTheme();
  const { t, isRTL, locale } = useI18n();
  // 3 stages: email → otp → new_password
  const [stage,    setStage]    = useState<'email'|'otp'|'new_password'>('email');
  const [email,    setEmail]    = useState('');
  const [otp,      setOtp]      = useState(['','','','','','']);
  const [password, setPassword] = useState('');
  const [confirm,  setConfirm]  = useState('');
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');
  const [done,     setDone]     = useState(false);
  const inputs = useRef<(TextInput | null)[]>([]);

  // Stage 1: send OTP to email
  const sendOtp = async () => {
    if (!email.trim()) { setError('أدخل بريدك الإلكتروني'); return; }
    setLoading(true); setError('');
    try {
      await authAPI.forgotPassword({ email: email.trim().toLowerCase() });
      setStage('otp');
    } catch (e: any) { setError(e?.message || 'تعذر الإرسال — تحقق من البريد الإلكتروني'); }
    finally { setLoading(false); }
  };

  // Stage 2: verify OTP
  const verifyOtp = async () => {
    const code = otp.join('');
    if (code.length < 6) { setError('أدخل الكود كاملاً (6 أرقام)'); return; }
    setError('');
    setStage('new_password');
  };

  const handleOtpChange = (i: number, val: string) => {
    if (!/^\d?$/.test(val)) return;
    const next = [...otp]; next[i] = val; setOtp(next);
    setError('');
    if (val && i < 5) {
      setTimeout(() => inputs.current[i + 1]?.focus(), 10);
    }
  };

  const handleOtpKey = (i: number, key: string) => {
    if (key === 'Backspace' && !otp[i] && i > 0) {
      setTimeout(() => inputs.current[i - 1]?.focus(), 10);
    }
  };

  // Stage 3: reset password
  const resetPassword = async () => {
    if (password !== confirm) { setError('كلمات المرور غير متطابقة'); return; }
    if (password.length < 8)  { setError('كلمة المرور يجب أن تكون 8 أحرف على الأقل'); return; }
    setLoading(true); setError('');
    try {
      await authAPI.resetPassword({ token: otp.join(''), email, newPassword: password });
      setDone(true);
      setTimeout(() => router.replace('/(auth)/login' as any), 2000);
    } catch (e: any) { setError(e?.message || 'تعذر تغيير كلمة المرور'); }
    finally { setLoading(false); }
  };

  const TITLES: Record<string, string> = {
    email: 'استعادة كلمة المرور',
    otp: 'تحقق من بريدك',
    new_password: 'تعيين كلمة مرور جديدة',
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 24 }}>
        <TouchableOpacity onPress={() => stage === 'email' ? router.back() : setStage(stage === 'otp' ? 'email' : 'otp')} style={{ marginBottom: 20 }}>
          <Text style={{ color: C.gold, fontSize: 15 }}>← العودة</Text>
        </TouchableOpacity>

        <View style={{ alignItems: 'center', marginBottom: 28 }}>
          <Text style={{ fontSize: 48, marginBottom: 12 }}>
            {stage === 'email' ? '🔐' : stage === 'otp' ? '📧' : '🔑'}
          </Text>
          <Text style={{ color: C.text, fontWeight: '700', fontSize: 24, fontFamily: 'CormorantGaramond-Bold', textAlign: 'center' }}>
            {done ? 'تم تغيير كلمة المرور!' : TITLES[stage]}
          </Text>
        </View>

        {/* Progress dots */}
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 28 }}>
          {(['email', 'otp', 'new_password'] as const).map((s, i) => (
            <View key={s} style={{ width: stage === s ? 24 : 8, height: 8, borderRadius: 4, backgroundColor: stage === s || (stage === 'new_password' && i < 2) || (stage === 'otp' && i === 0) ? C.gold : C.border }} />
          ))}
        </View>

        <View style={{ backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 20, padding: 24 }}>
          {error ? (
            <View style={{ backgroundColor: C.red + '15', borderRadius: 10, padding: 10, marginBottom: 14 }}>
              <Text style={{ color: C.red, fontSize: 13, textAlign: 'center' }}>⚠️ {error}</Text>
            </View>
          ) : null}

          {done ? (
            <View style={{ alignItems: 'center', paddingVertical: 20 }}>
              <Text style={{ fontSize: 48, marginBottom: 12 }}>✅</Text>
              <Text style={{ color: C.muted, fontSize: 13, textAlign: 'center', lineHeight: 22 }}>
                تم تغيير كلمة المرور بنجاح!\nجاري التوجيه لصفحة الدخول...
              </Text>
            </View>

          ) : stage === 'email' ? (
            <>
              <Text style={{ color: C.muted, fontSize: 13, marginBottom: 16, lineHeight: 20 }}>
                أدخل بريدك الإلكتروني وسنرسل لك كود التحقق.
              </Text>
              <Inp C={C} label="البريد الإلكتروني *" value={email} onChangeText={setEmail}
                placeholder="your@email.com" keyboardType="email-address" autoCapitalize="none" />
              <Btn C={C} full disabled={loading || !email.trim()} onPress={sendOtp}>
                {loading ? '⏳ جاري الإرسال...' : 'إرسال كود التحقق'}
              </Btn>
            </>

          ) : stage === 'otp' ? (
            <>
              <Text style={{ color: C.muted, fontSize: 13, marginBottom: 20, textAlign: 'center', lineHeight: 20 }}>
                أرسلنا كود من 6 أرقام إلى{' '}
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
                    style={{ width: 44, height: 54, textAlign: 'center', fontSize: 24, fontWeight: '700',
                      backgroundColor: C.bg, borderWidth: 2, borderColor: v ? C.gold : C.border,
                      borderRadius: 12, color: C.text }}
                  />
                ))}
              </View>
              <Btn C={C} full disabled={loading} onPress={verifyOtp}>
                {loading ? '⏳ جاري التحقق...' : 'تحقق من الكود'}
              </Btn>
              <TouchableOpacity onPress={sendOtp} style={{ marginTop: 14, alignItems: 'center' }}>
                <Text style={{ color: C.muted, fontSize: 13 }}>لم يصلك الكود؟ <Text style={{ color: C.gold, fontWeight: '600' }}>أعد الإرسال</Text></Text>
              </TouchableOpacity>
            </>

          ) : (
            <>
              <Text style={{ color: C.muted, fontSize: 13, marginBottom: 16, lineHeight: 20 }}>
                أدخل كلمة المرور الجديدة. يجب أن تكون 8 أحرف على الأقل.
              </Text>
              <Inp C={C} label="كلمة المرور الجديدة *" value={password} onChangeText={setPassword}
                placeholder="8 أحرف على الأقل" secureTextEntry />
              <Inp C={C} label="تأكيد كلمة المرور *" value={confirm} onChangeText={setConfirm}
                placeholder="أعد كتابة كلمة المرور" secureTextEntry />
              <Btn C={C} full disabled={loading || !password || !confirm} onPress={resetPassword}>
                {loading ? '⏳ جاري التغيير...' : 'تغيير كلمة المرور'}
              </Btn>
            </>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
