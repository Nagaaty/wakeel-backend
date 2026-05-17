import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, KeyboardAvoidingView, Platform, Alert, TextInput } from 'react-native';
import { Link, router } from 'expo-router';
import { useDispatch, useSelector } from 'react-redux';
import { register, selLoading, selError, clearError } from '../../src/store/slices/authSlice';
import { authAPI } from '../../src/services/api';
import { useTheme } from '../../src/theme';
import { Btn, Inp } from '../../src/components/ui';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useI18n } from '../../src/i18n';

export default function RegisterScreen() {
  const C        = useTheme();
  const dispatch = useDispatch<any>();
  const loading  = useSelector(selLoading);
  const error    = useSelector(selError);
  const insets   = useSafeAreaInsets();
  const { isRTL } = useI18n();

  const [name, setName]         = useState('');
  const [email, setEmail]       = useState('');
  const [phone, setPhone]       = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole]         = useState<'client' | 'lawyer'>('client');
  const [agreed, setAgreed]     = useState(false);

  const [step, setStep] = useState(1);
  const [loadingCode, setLoadingCode] = useState(false);
  const [timeLeft, setTimeLeft] = useState(60);
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const otpInputs = React.useRef<any[]>([]);

  React.useEffect(() => {
    if (step === 2 && timeLeft > 0) {
      const timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [step, timeLeft]);

  const handleOtpChange = (i: number, val: string) => {
    if (!/^\d?$/.test(val)) return;
    const next = [...otp];
    next[i] = val;
    setOtp(next);
    if (val && i < 5) { setTimeout(() => otpInputs.current[i + 1]?.focus(), 10); }
  };

  const handleOtpKeyDown = (i: number, key: string) => {
    if (key === 'Backspace' && !otp[i] && i > 0) { setTimeout(() => otpInputs.current[i - 1]?.focus(), 10); }
  };

  const handleSendOtp = async () => {
    if (role === 'lawyer') { router.push('/(auth)/register-lawyer' as any); return; }
    if (!name || !email || !password || !agreed) return;
    setLoadingCode(true);
    try {
      const res: any = await authAPI.sendOtpPublic({ email: email.toLowerCase().trim(), purpose: 'verify' });
      setStep(2);
      if (res?.devOtp) Alert.alert('🔐 Dev OTP', `Email not configured on server.\nYour code is: ${res.devOtp}`, [{ text: 'OK' }]);
    } catch(e: any) { Alert.alert('Error', e?.message || 'Could not send OTP'); }
    finally { setLoadingCode(false); }
  };

  const handleRegister = async () => {
    setLoadingCode(true);
    try {
      await authAPI.verifyOtpPublic({ email: email.toLowerCase().trim(), code: otp.join(''), purpose: 'verify' });
      dispatch(clearError());
      await dispatch(register({ name: name.trim(), email: email.toLowerCase().trim(), password, role: 'client' }));
    } catch(e: any) { Alert.alert('Error', e?.message || 'Invalid OTP code'); }
    finally { setLoadingCode(false); }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 24, paddingTop: insets.top + 20, paddingBottom: insets.bottom + 20 }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ alignItems: 'center', marginBottom: 28 }}>
          <Text style={{ fontSize: 48, marginBottom: 8 }}>⚖️</Text>
          <Text style={{ fontSize: 26, fontWeight: '800', color: C.text, fontFamily: 'Cairo-Bold' }}>
            {isRTL ? 'إنشاء حساب جديد' : 'Create Account'}
          </Text>
          <Text style={{ color: C.muted, fontSize: 13, marginTop: 4 }}>
            {isRTL ? 'انضم لمنصة Wakeel القانونية' : 'Join the Wakeel Legal Platform'}
          </Text>
        </View>

        <View style={{ backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 20, padding: 24 }}>
          {error ? (
            <View style={{ backgroundColor: C.red + '15', borderWidth: 1, borderColor: C.red + '40', borderRadius: 10, padding: 12, marginBottom: 14 }}>
              <Text style={{ color: C.red, fontSize: 13 }}>⚠️ {error}</Text>
            </View>
          ) : null}

          {/* Role selector */}
          {step === 1 && (
            <>
              <Text style={{ color: C.muted, fontSize: 12, fontWeight: '600', marginBottom: 8 }}>
                {isRTL ? 'نوع الحساب *' : 'Account type *'}
              </Text>
              <View style={{ flexDirection: 'row', gap: 10, marginBottom: 18 }}>
                {(['client', 'lawyer'] as const).map(r => (
                  <TouchableOpacity
                    key={r}
                    onPress={() => setRole(r)}
                    style={{
                      flex: 1, paddingVertical: 14, borderRadius: 12,
                      borderWidth: 2, borderColor: role === r ? C.gold : C.border,
                      backgroundColor: role === r ? C.gold + '15' : 'transparent',
                      alignItems: 'center',
                    }}
                  >
                    <Text style={{ fontSize: 22, marginBottom: 4 }}>{r === 'client' ? '👤' : '⚖️'}</Text>
                    <Text style={{ color: role === r ? C.gold : C.text, fontWeight: '700', fontSize: 13 }}>
                      {r === 'client'
                        ? (isRTL ? 'عميل' : 'Client')
                        : (isRTL ? 'محامٍ' : 'Lawyer')}
                    </Text>
                    <Text style={{ color: C.muted, fontSize: 11, marginTop: 2 }}>
                      {r === 'client'
                        ? (isRTL ? 'أبحث عن محامٍ' : 'I need a lawyer')
                        : (isRTL ? 'أقدم خدمات قانونية' : 'I offer legal services')}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}

          {/* Client Specific Inputs */}
          {role === 'client' && step === 1 && (
            <>
              <Inp C={C} label={isRTL ? 'الاسم الكامل *' : 'Full name *'}
                value={name} onChangeText={setName}
                placeholder={isRTL ? 'محمد أحمد علي' : 'John Smith'}
                autoCapitalize="words" />
              <Inp C={C} label={isRTL ? 'البريد الإلكتروني *' : 'Email address *'}
                value={email} onChangeText={setEmail}
                placeholder="your@email.com"
                keyboardType="email-address" autoCapitalize="none" />
              <Inp C={C} label={isRTL ? 'رقم الهاتف' : 'Phone number'}
                value={phone} onChangeText={setPhone}
                placeholder={isRTL ? '01xxxxxxxxx' : '+20 1xx xxx xxxx'}
                keyboardType="phone-pad" />
              <Inp C={C} label={isRTL ? 'كلمة المرور *' : 'Password *'}
                value={password} onChangeText={setPassword}
                placeholder={isRTL ? '8 أحرف على الأقل' : 'At least 8 characters'}
                secureTextEntry />

              {/* Terms agreement */}
              <TouchableOpacity
                onPress={() => setAgreed(!agreed)}
                style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 18, marginTop: 4 }}
              >
                <View style={{
                  width: 22, height: 22, borderRadius: 6, borderWidth: 2,
                  borderColor: agreed ? C.gold : C.border,
                  backgroundColor: agreed ? C.gold : 'transparent',
                  alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1,
                }}>
                  {agreed && <Text style={{ color: '#fff', fontSize: 13, fontWeight: '800' }}>✓</Text>}
                </View>
                <Text style={{ color: C.muted, fontSize: 13, lineHeight: 20, flex: 1 }}>
                  {isRTL ? 'بالتسجيل توافق على ' : 'By registering you agree to our '}
                  <Text style={{ color: C.gold, fontWeight: '600' }}>
                    {isRTL ? 'شروط الاستخدام' : 'Terms of Service'}
                  </Text>
                  {isRTL ? ' و' : ' and '}
                  <Text style={{ color: C.gold, fontWeight: '600' }}>
                    {isRTL ? 'سياسة الخصوصية' : 'Privacy Policy'}
                  </Text>
                </Text>
              </TouchableOpacity>
              
              <Btn
                C={C}
                onPress={handleSendOtp}
                disabled={role === 'client' ? (loadingCode || !name || !email || !password || !agreed) : false}
                full size="lg"
              >
                {loadingCode
                    ? (isRTL ? '⏳ جاري الإرسال...' : '⏳ Sending OTP...')
                    : (isRTL ? 'إنشاء حساب عميل' : 'Create Client Account')}
              </Btn>
            </>
          )}

          {step === 2 && (
            <>
              <Text style={{ color: C.text, fontSize: 15, textAlign: 'center', marginBottom: 20 }}>
                {isRTL ? 'أدخل الرمز المكون من 6 أرقام المرسل إلى بريدك الإلكتروني' : 'Enter the 6-digit code sent to your email'}
              </Text>
              <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', justifyContent: 'center', gap: 8, marginBottom: 24 }}>
                {otp.map((digit, i) => (
                  <TextInput
                    key={i}
                    ref={el => otpInputs.current[i] = el}
                    style={{
                      width: 45, height: 55,
                      borderWidth: 1, borderColor: digit ? C.gold : C.border,
                      borderRadius: 12, backgroundColor: C.surface,
                      color: C.text, fontSize: 24, fontWeight: '700', textAlign: 'center',
                    }}
                    keyboardType="number-pad"
                    maxLength={1}
                    value={digit}
                    onChangeText={val => handleOtpChange(i, val)}
                    onKeyPress={({ nativeEvent }) => handleOtpKeyDown(i, nativeEvent.key)}
                  />
                ))}
              </View>
              <Btn C={C} full size="lg" onPress={handleRegister} disabled={otp.join('').length < 6 || loadingCode}>
                {loadingCode ? (isRTL ? '⏳ جاري التحقق...' : '⏳ Verifying...') : (isRTL ? 'تحقق ومتابعة' : 'Verify & Continue')}
              </Btn>

              {/* Resend button with countdown */}
              <View style={{ marginTop: 18, alignItems: 'center' }}>
                <TouchableOpacity onPress={() => { if (timeLeft === 0) { setTimeLeft(60); handleSendOtp(); } }} disabled={timeLeft > 0 || loadingCode}>
                  <Text style={{ color: timeLeft > 0 ? C.muted : C.gold, fontSize: 13, fontWeight: '700' }}>
                    {timeLeft > 0
                      ? (isRTL ? `إعادة الإرسال خلال ${timeLeft}ث` : `Wait ${timeLeft}s to resend`)
                      : (isRTL ? 'لم يصلك الكود؟ أعد الإرسال' : 'Resend code')}
                  </Text>
                </TouchableOpacity>
              </View>
            </>
          )}

          {role === 'lawyer' && (
            <Btn
              C={C}
              onPress={() => router.push('/(auth)/register-lawyer' as any)}
              full size="lg"
            >
              {isRTL ? 'متابعة كـ محامٍ ←' : 'Continue as Lawyer →'}
            </Btn>
          )}
        </View>

        <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: 20, gap: 6 }}>
          <Text style={{ color: C.muted, fontSize: 14 }}>
            {isRTL ? 'لديك حساب؟' : 'Already have an account?'}
          </Text>
          <Link href="/(auth)/login">
            <Text style={{ color: C.gold, fontSize: 14, fontWeight: '700' }}>
              {isRTL ? 'تسجيل الدخول' : 'Sign in'}
            </Text>
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
