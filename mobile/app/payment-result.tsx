import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useTheme } from '../src/hooks/useTheme';
import { hapticSuccess, hapticError } from '../src/utils/haptics';
import { Btn } from '../src/components/ui';
import { paymentsAPI } from '../src/services/api';
import { useI18n } from '../src/i18n';

export default function PaymentResultScreen() {
  const C      = useTheme();
  useEffect(() => { success ? hapticSuccess() : hapticError(); }, []);
  const params = useLocalSearchParams<{ success?: string; id?: string; payment_id?: string; booking_id?: string; order?: string; convId?: string }>();
  const success   = params.success === 'true' || params.success === '1';
  const paymentId = params.id || params.payment_id;
  const bookingId = params.booking_id || params.order;
  const [confirmed, setConfirmed] = useState(false);

  useEffect(() => {
    if (success && paymentId && !confirmed) {
      paymentsAPI.confirm({ paymentId, success: true, bookingId })
        .then(() => setConfirmed(true))
        .catch(() => setConfirmed(true));
    }
  }, []);

  if (success) return (
    <View style={{ flex:1, backgroundColor:'#fff', justifyContent:'center', alignItems:'center', padding:24 }}>
      <View style={{ width:84, height:84, borderRadius:42, backgroundColor:'#F0FDF4', borderWidth:3, borderColor:'#22C55E', alignItems:'center', justifyContent:'center', marginBottom:20 }}>
        <Text style={{ fontSize:38 }}>✅</Text>
      </View>
      <Text style={{ fontFamily:'CormorantGaramond-Bold', fontSize:28, fontWeight:'700', color:'#111', marginBottom:8 }}>تم الدفع بنجاح!</Text>
      <Text style={{ color:'#666', fontSize:14, marginBottom:8, textAlign:'center' }}>تم تأكيد حجزك وسيتواصل معك المحامي قريباً.</Text>
      <Text style={{ color:'#999', fontSize:13, marginBottom:32, textAlign:'center', lineHeight:22 }}>ستصلك رسالة تأكيد على بريدك الإلكتروني وواتساب.</Text>
      <View style={{ flexDirection:'row', gap:12, width:'100%' }}>
        <Btn C={{ ...useTheme(), bg:'#fff' } as any} full onPress={() => router.replace('/bookings' as any)}>📅 عرض حجوزاتي</Btn>
        <Btn C={{ ...useTheme(), bg:'#fff' } as any} full variant="ghost" onPress={() => router.push(params.convId ? `/messages?convId=${params.convId}` : '/messages/index' as any)}>💬 راسل المحامي</Btn>
      </View>
    </View>
  );

  return (
    <View style={{ flex:1, backgroundColor:'#fff', justifyContent:'center', alignItems:'center', padding:24 }}>
      <View style={{ width:84, height:84, borderRadius:42, backgroundColor:'#FEF2F2', borderWidth:3, borderColor:'#EF4444', alignItems:'center', justifyContent:'center', marginBottom:20 }}>
        <Text style={{ fontSize:38 }}>❌</Text>
      </View>
      <Text style={{ fontFamily:'CormorantGaramond-Bold', fontSize:28, fontWeight:'700', color:'#111', marginBottom:8 }}>فشلت عملية الدفع</Text>
      <Text style={{ color:'#666', fontSize:14, marginBottom:32, textAlign:'center' }}>لم يتم خصم أي مبلغ. يمكنك المحاولة مجدداً.</Text>
      <View style={{ flexDirection:'row', gap:12, width:'100%' }}>
        <Btn C={useTheme()} full onPress={() => router.back()}>🔄 المحاولة مجدداً</Btn>
        <Btn C={useTheme()} full variant="ghost" onPress={() => router.push('/support' as any)}>🎫 الدعم الفني</Btn>
      </View>
    </View>
  );
}