import React, { useState, useRef } from 'react';
import { View, Text, TouchableOpacity, TextInput, Alert } from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '../../src/hooks/useTheme';
import { Btn } from '../../src/components/ui';
import { authAPI } from '../../src/services/api';
import { useSelector } from 'react-redux';
import { selUser } from '../../src/store/slices/authSlice';
import { useI18n } from '../../src/i18n';

export default function VerifyEmailScreen() {
  const C    = useTheme();
  const user = useSelector(selUser);
  const { isRTL } = useI18n();

  const [otp,      setOtp]      = useState(['','','','','','']);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');
  const [resent,   setResent]   = useState(false);
  const [timeLeft, setTimeLeft] = useState(60);
  const inputs = useRef<(TextInput | null)[]>([]);

  React.useEffect(() => {
    if (timeLeft > 0) {
      const timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
      return () => clearTimeout(timer);
    } else {
      setResent(false);
    }
  }, [timeLeft]);

  const handleChange = (i: number, val: string) => {
    if (!/^\d?$/.test(val)) return;
    const next = [...otp]; next[i] = val; setOtp(next);
    setError('');
    if (val && i < 5) setTimeout(() => inputs.current[i + 1]?.focus(), 50);
  };

  const handleKeyDown = (i: number, key: string) => {
    if (key === 'Backspace' && !otp[i] && i > 0) setTimeout(() => inputs.current[i - 1]?.focus(), 50);
  };

  const verify = async () => {
    const code = otp.join('');
    if (code.length < 6) { setError(isRTL ? 'أدخل الكود كاملاً (6 أرقام)' : 'Enter the full 6-digit code'); return; }
    setLoading(true); setError('');
    try {
      await authAPI.verifyOtp({ code, purpose: 'verify' });
      Alert.alert('✅', isRTL ? 'تم التحقق من بريدك!' : 'Email verified!', [
        { text: isRTL ? 'متابعة' : 'Continue', onPress: () => router.replace('/(tabs)' as any) },
      ]);
    } catch (e: any) { setError(e?.message || (isRTL ? 'كود غير صحيح أو منتهي الصلاحية' : 'Invalid or expired code')); }
    finally { setLoading(false); }
  };

  const resend = async () => {
    if (timeLeft > 0 || loading) return;
    try {
      const res: any = await authAPI.sendOtp({ purpose: 'verify' });
      setResent(true);
      setTimeLeft(60);
      if (res?.devOtp) {
        Alert.alert('🔐 Dev OTP', `Email not configured.\nYour code: ${res.devOtp}`, [{ text: 'OK' }]);
      } else {
        Alert.alert('✅', isRTL ? 'تم إرسال كود جديد!' : 'New code sent!');
      }
    } catch (e: any) { Alert.alert(isRTL ? 'خطأ' : 'Error', e?.message); }
  };

  return (
    <View style={{ flex:1, backgroundColor:C.bg, justifyContent:'center', alignItems:'center', padding:24 }}>
      <Text style={{ fontSize:52, marginBottom:14 }}>📧</Text>
      <Text style={{ color:C.text, fontWeight:'700', fontSize:24, fontFamily:'Cairo-Bold', marginBottom:8, textAlign:'center' }}>
        {isRTL ? 'تحقق من بريدك' : 'Check your email'}
      </Text>
      <Text style={{ color:C.muted, fontSize:14, marginBottom:30, textAlign:'center', lineHeight:22 }}>
        {isRTL ? 'أرسلنا كود تحقق من 6 أرقام إلى' : 'We sent a 6-digit code to'}{' '}
        <Text style={{ color:C.gold, fontWeight:'600' }}>{user?.email}</Text>
      </Text>

      <View style={{ backgroundColor:C.card, borderWidth:1, borderColor:C.border, borderRadius:20, padding:24, width:'100%' }}>
        {error ? (
          <View style={{ backgroundColor:C.red+'15', borderRadius:10, padding:10, marginBottom:14 }}>
            <Text style={{ color:C.red, fontSize:13, textAlign:'center' }}>⚠️ {error}</Text>
          </View>
        ) : null}

        {/* OTP inputs */}
        <View style={{ flexDirection:'row', gap:8, justifyContent:'center', marginBottom:24 }}>
          {otp.map((v, i) => (
            <TextInput
              key={i}
              ref={el => { inputs.current[i] = el; }}
              value={v}
              onChangeText={val => handleChange(i, val)}
              onKeyPress={({ nativeEvent }) => handleKeyDown(i, nativeEvent.key)}
              maxLength={1}
              keyboardType="number-pad"
              selectTextOnFocus
              style={{ width:44, height:54, textAlign:'center', fontSize:24, fontWeight:'700', backgroundColor:C.bg, borderWidth:2, borderColor:v?C.gold:C.border, borderRadius:12, color:C.text }}
            />
          ))}
        </View>

        <Btn C={C} full disabled={loading} onPress={verify}>
          {loading
            ? (isRTL ? '⏳ جاري التحقق...' : '⏳ Verifying...')
            : (isRTL ? '✅ تحقق' : '✅ Verify')}
        </Btn>

        <View style={{ marginTop:16, flexDirection:'row', justifyContent:'center', alignItems:'center', gap:6 }}>
          <Text style={{ color:C.muted, fontSize:13 }}>
            {isRTL ? 'لم يصلك الكود؟' : "Didn't receive it?"}
          </Text>
          <TouchableOpacity onPress={resend} disabled={timeLeft > 0}>
            <Text style={{ color: (timeLeft > 0) ? C.muted : C.gold, fontWeight:'700', fontSize:13 }}>
              {timeLeft > 0
                ? (isRTL ? `انتظر ${timeLeft}ث` : `Wait ${timeLeft}s`)
                : (isRTL ? 'أرسل مجدداً' : 'Resend code')}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}