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

  const [otp,      setOtp]      = useState(['','','','','','']);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');
  const [resent,   setResent]   = useState(false);
  const inputs = useRef<(TextInput | null)[]>([]);

  const handleChange = (i: number, val: string) => {
    if (!/^\d?$/.test(val)) return;
    const next = [...otp]; next[i] = val; setOtp(next);
    setError('');
    if (val && i < 5) {
      setTimeout(() => inputs.current[i + 1]?.focus(), 50);
    }
  };

  const handleKeyDown = (i: number, key: string) => {
    if (key === 'Backspace' && !otp[i] && i > 0) {
      setTimeout(() => inputs.current[i - 1]?.focus(), 50);
    }
  };

  const verify = async () => {
    const code = otp.join('');
    if (code.length < 6) { setError('أدخل الكود كاملاً (6 أرقام)'); return; }
    setLoading(true); setError('');
    try {
      await authAPI.verifyOtp({ code, purpose: 'verify' });
      Alert.alert('✅', 'تم التحقق من بريدك!', [{ text: 'متابعة', onPress: () => router.replace('/(tabs)' as any) }]);
    } catch (e: any) { setError(e?.message || 'كود غير صحيح أو منتهي الصلاحية'); }
    finally { setLoading(false); }
  };

  const resend = async () => {
    if (resent) return;
    try {
      await authAPI.sendOtp({ purpose: 'verify' });
      setResent(true);
      setTimeout(() => setResent(false), 30000);
      Alert.alert('✅', 'تم إرسال كود جديد!');
    } catch (e: any) { Alert.alert('خطأ', e?.message); }
  };

  return (
    <View style={{ flex:1, backgroundColor:C.bg, justifyContent:'center', alignItems:'center', padding:24 }}>
      <Text style={{ fontSize:52, marginBottom:14 }}>📧</Text>
      <Text style={{ color:C.text, fontWeight:'700', fontSize:24, fontFamily:'CormorantGaramond-Bold', marginBottom:8, textAlign:'center' }}>تحقق من بريدك</Text>
      <Text style={{ color:C.muted, fontSize:14, marginBottom:30, textAlign:'center', lineHeight:22 }}>
        أرسلنا كود تحقق من 6 أرقام إلى{" "}
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
          {loading?'⏳ جاري التحقق...':'✅ تحقق'}
        </Btn>

        <View style={{ marginTop:16, flexDirection:'row', justifyContent:'center', alignItems:'center', gap:6 }}>
          <Text style={{ color:C.muted, fontSize:13 }}>لم يصلك الكود؟</Text>
          <TouchableOpacity onPress={resend} disabled={resent}>
            <Text style={{ color:resent?C.muted:C.gold, fontWeight:'700', fontSize:13 }}>
              {resent?'✅ تم الإرسال':'أرسل مجدداً'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}