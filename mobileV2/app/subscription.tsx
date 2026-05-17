import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '../src/theme';
import { Btn, Card, Spinner } from '../src/components/ui';
import { subscriptionsAPI } from '../src/services/api';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useI18n } from '../src/i18n';

const PLANS = [
  { id:'basic',   price:0,   period:'مجاناً',  icon:'🌱', label:'الأساسي',  color:'#6B7280',
    features:['5 حجوزات/شهر','ملف مهني أساسي','تقييمات العملاء'] },
  { id:'pro',     price:299, period:'شهرياً',  icon:'⭐', label:'المحترف',  color:'#C8A84B',
    features:['حجوزات غير محدودة','ظهور في البحث أولاً','رسائل فورية','تحليلات متقدمة','شارة موثق مميز'] },
  { id:'premium', price:599, period:'شهرياً',  icon:'👑', label:'المتميز',  color:'#7C3AED',
    features:['كل مميزات المحترف','استشارات فيديو مميزة','مساعد ذكاء اصطناعي','CRM متقدم','دعم أولوية 24/7'] },
];

export default function SubscriptionScreen() {
  const C = useTheme(); const insets = useSafeAreaInsets();
  const [status, setStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [subscribing, setSubscribing] = useState<string|null>(null);

  useEffect(() => { subscriptionsAPI.status().then(setStatus).catch(()=>{}).finally(()=>setLoading(false)); }, []);

  const subscribe = async (planId: string) => {
    setSubscribing(planId);
    try {
      const d:any = await subscriptionsAPI.subscribe({ plan:planId });
      if (d.checkoutUrl) router.push({ pathname: '/payment-webview', params: { url: d.checkoutUrl, bookingId: '', amount: String(PLANS.find(p => p.id === planId)?.price || 0) } } as any);
      else Alert.alert('✅', 'تم تفعيل الاشتراك!');
      subscriptionsAPI.status().then(setStatus).catch(()=>{});
    } catch (e:any) { Alert.alert('خطأ', e?.message); }
    finally { setSubscribing(null); }
  };

  return (
    <View style={{ flex:1, backgroundColor:C.bg }}>
      <View style={{ backgroundColor:C.surface, paddingTop:insets.top+12, paddingHorizontal:16, paddingBottom:14, borderBottomWidth:1, borderBottomColor:C.border, flexDirection:'row', alignItems:'center', gap:10 }}>
        <TouchableOpacity onPress={() => router.back()}><Text style={{ color:C.text, fontSize:22 }}>‹</Text></TouchableOpacity>
        <Text style={{ color:C.text, fontWeight:'700', fontSize:20 }}>🏆 اشتراكي</Text>
      </View>
      <ScrollView contentContainerStyle={{ padding:16, paddingBottom:100 }}>
        {loading ? <View style={{padding:40,alignItems:'center'}}><Spinner C={C}/></View> : (
          <>
            {status?.plan && (
              <Card C={C} style={{ marginBottom:16, borderColor:C.gold }}>
                <Text style={{ color:C.gold, fontWeight:'700', fontSize:15, marginBottom:4 }}>✅ اشتراكك الحالي: {status.plan}</Text>
                <Text style={{ color:C.muted, fontSize:13 }}>ينتهي في: {status.expires_at ? new Date(status.expires_at).toLocaleDateString('ar-EG') : '—'}</Text>
              </Card>
            )}
            {PLANS.map(plan => (
              <Card key={plan.id} C={C} style={{ marginBottom:12, borderColor:status?.plan===plan.id?plan.color:C.border }}>
                <View style={{ flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
                  <View style={{ flexDirection:'row', alignItems:'center', gap:10 }}>
                    <Text style={{ fontSize:28 }}>{plan.icon}</Text>
                    <Text style={{ color:C.text, fontWeight:'700', fontSize:17 }}>{plan.label}</Text>
                  </View>
                  <View style={{ alignItems:'center' }}>
                    <Text style={{ color:plan.color, fontWeight:'800', fontSize:22 }}>
                      {plan.price === 0 ? 'مجاناً' : `${plan.price} ج`}
                    </Text>
                    {plan.price > 0 && <Text style={{ color:C.muted, fontSize:11 }}>/{plan.period}</Text>}
                  </View>
                </View>
                {plan.features.map(f => (
                  <View key={f} style={{ flexDirection:'row', gap:8, paddingVertical:5 }}>
                    <Text style={{ color:plan.color }}>✓</Text>
                    <Text style={{ color:C.muted, fontSize:13 }}>{f}</Text>
                  </View>
                ))}
                <Btn C={C} full disabled={status?.plan===plan.id||!!subscribing} onPress={() => subscribe(plan.id)} style={{ marginTop:12 }}>
                  {subscribing===plan.id
                    ? '⏳ جاري...'
                    : status?.plan===plan.id
                    ? '✅ خطتك الحالية'
                    : plan.id==='basic'
                    ? 'الرجوع للخطة المجانية'
                    : `الترقية إلى ${plan.label}`}
                </Btn>
              </Card>
            ))}
          </>
        )}
      </ScrollView>
    </View>
  );
}