import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, KeyboardAvoidingView, Platform } from 'react-native';
import { Link, router } from 'expo-router';
import { useDispatch, useSelector } from 'react-redux';
import { register, selLoading, selError, clearError } from '../../src/store/slices/authSlice';
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

  const [name,     setName]     = useState('');
  const [email,    setEmail]    = useState('');
  const [phone,    setPhone]    = useState('');
  const [password, setPassword] = useState('');
  const [role,     setRole]     = useState<'client' | 'lawyer'>('client');
  const [agreed,   setAgreed]   = useState(false);

  const handleRegister = async () => {
    if (role === 'lawyer') {
      router.push('/(auth)/register-lawyer' as any);
      return;
    }
    if (!name || !email || !password) return;
    if (!agreed) return;
    dispatch(clearError());
    const res = await dispatch(register({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      phone,
      password,
      role,
    }));
    if (res.meta.requestStatus === 'fulfilled') {
      router.replace('/(auth)/verify-email' as any);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 24, paddingTop: insets.top + 20, paddingBottom: insets.bottom + 20 }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ alignItems: 'center', marginBottom: 28 }}>
          <Text style={{ fontSize: 48, marginBottom: 8 }}>⚖️</Text>
          <Text style={{ fontSize: 26, fontWeight: '800', color: C.text, fontFamily: 'CormorantGaramond-Bold' }}>
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

          {/* Client Specific Inputs */}
          {role === 'client' && (
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
            </>
          )}

          <Btn
            C={C}
            onPress={handleRegister}
            disabled={role === 'client' ? (loading || !name || !email || !password || !agreed) : false}
            full size="lg"
          >
            {role === 'lawyer'
              ? (isRTL ? 'متابعة كـ محامٍ ←' : 'Continue as Lawyer →')
              : loading
                ? (isRTL ? '⏳ جاري التسجيل...' : '⏳ Creating account...')
                : (isRTL ? 'إنشاء حساب عميل' : 'Create Client Account')}
          </Btn>
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
