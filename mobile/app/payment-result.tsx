import React, { useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useTheme } from '../src/hooks/useTheme';
import { hapticSuccess, hapticError } from '../src/utils/haptics';
import { Btn } from '../src/components/ui';
import { paymentsAPI } from '../src/services/api';
import { useI18n } from '../src/i18n';

export default function PaymentResultScreen() {
  const C = useTheme();
  const { isRTL } = useI18n();
  const params = useLocalSearchParams<{ success?: string; id?: string; payment_id?: string; booking_id?: string; order?: string; convId?: string }>();

  // Derive success BEFORE useEffect so it's defined
  const success   = params.success === 'true' || params.success === '1';
  const paymentId = params.id || params.payment_id;
  const bookingId = params.booking_id || params.order;
  const convId    = params.convId;

  const [confirmed, setConfirmed] = useState(false);

  // Haptic feedback — success is now defined above
  useEffect(() => { success ? hapticSuccess() : hapticError(); }, []);

  // Confirm payment server-side if we have a paymentId
  useEffect(() => {
    if (success && paymentId && !confirmed) {
      paymentsAPI.confirm({ paymentId, success: true, bookingId })
        .then(() => setConfirmed(true))
        .catch(() => setConfirmed(true));
    }
  }, []);

  if (success) return (
    <View style={{ flex:1, backgroundColor: C.bg, justifyContent:'center', alignItems:'center', padding:24 }}>
      <View style={{ width:84, height:84, borderRadius:42, backgroundColor:'#F0FDF4', borderWidth:3, borderColor:'#22C55E', alignItems:'center', justifyContent:'center', marginBottom:20 }}>
        <Text style={{ fontSize:38 }}>✅</Text>
      </View>
      <Text style={{ fontFamily:'Cairo-Bold', fontSize:28, fontWeight:'700', color: C.text, marginBottom:8, textAlign:'center' }}>
        {isRTL ? 'تم الدفع بنجاح!' : 'Payment Successful!'}
      </Text>
      <Text style={{ color: C.muted, fontSize:14, marginBottom:8, textAlign:'center' }}>
        {isRTL ? 'تم تأكيد حجزك وسيتواصل معك المحامي قريباً.' : 'Your booking is confirmed. The lawyer will contact you shortly.'}
      </Text>
      <Text style={{ color: C.muted, fontSize:13, marginBottom:32, textAlign:'center', lineHeight:22 }}>
        {isRTL ? 'ستصلك رسالة تأكيد على بريدك الإلكتروني وواتساب.' : 'A confirmation will be sent to your email and WhatsApp.'}
      </Text>
      <View style={{ flexDirection:'row', gap:12, width:'100%' }}>
        <Btn C={C} full onPress={() => router.replace('/bookings' as any)}>
          📅 {isRTL ? 'عرض حجوزاتي' : 'My Bookings'}
        </Btn>
        <Btn C={C} full variant="ghost"
          onPress={() => router.push(convId ? `/messages?convId=${convId}` : '/messages/index' as any)}>
          💬 {isRTL ? 'راسل المحامي' : 'Message Lawyer'}
        </Btn>
      </View>
    </View>
  );

  return (
    <View style={{ flex:1, backgroundColor: C.bg, justifyContent:'center', alignItems:'center', padding:24 }}>
      <View style={{ width:84, height:84, borderRadius:42, backgroundColor:'#FEF2F2', borderWidth:3, borderColor:'#EF4444', alignItems:'center', justifyContent:'center', marginBottom:20 }}>
        <Text style={{ fontSize:38 }}>❌</Text>
      </View>
      <Text style={{ fontFamily:'Cairo-Bold', fontSize:28, fontWeight:'700', color: C.text, marginBottom:8 }}>
        {isRTL ? 'فشلت عملية الدفع' : 'Payment Failed'}
      </Text>
      <Text style={{ color: C.muted, fontSize:14, marginBottom:32, textAlign:'center' }}>
        {isRTL ? 'لم يتم خصم أي مبلغ. يمكنك المحاولة مجدداً.' : 'No charge was made. You can try again.'}
      </Text>
      <View style={{ flexDirection:'row', gap:12, width:'100%' }}>
        <Btn C={C} full onPress={() => router.back()}>
          🔄 {isRTL ? 'المحاولة مجدداً' : 'Try Again'}
        </Btn>
        <Btn C={C} full variant="ghost" onPress={() => router.push('/support' as any)}>
          🎫 {isRTL ? 'الدعم الفني' : 'Support'}
        </Btn>
      </View>
    </View>
  );
}