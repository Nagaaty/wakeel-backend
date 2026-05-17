import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, Alert } from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '../src/theme';
import { Btn } from '../src/components/ui';
import { lawyersAPI } from '../src/services/api';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useI18n } from '../src/i18n';

const SERVICES = [
  { id:'text',     icon:'💬', label:'استشارة نصية' },
  { id:'voice',    icon:'📞', label:'مكالمة صوتية' },
  { id:'video',    icon:'📹', label:'استشارة فيديو' },
  { id:'inperson', icon:'🏛️', label:'حضور شخصي' },
  { id:'document', icon:'📄', label:'مراجعة مستند' },
];

export default function ServicePricingScreen() {
  const C = useTheme(); const insets = useSafeAreaInsets();
  const { isRTL, t } = useI18n();
  const [prices, setPrices] = useState<Record<string,number>>({ text:200, voice:400, video:600, inperson:800, document:350 });
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    lawyersAPI.getMyProfile().then((d:any) => {
      if (d?.service_prices) {
        const sp = typeof d.service_prices === 'string' ? JSON.parse(d.service_prices) : d.service_prices;
        setPrices(p => ({ ...p, ...sp }));
      } else if (d?.consultation_fee) {
        const base = d.consultation_fee;
        setPrices({ text:Math.round(base*0.5), voice:base, video:Math.round(base*1.5), inperson:Math.round(base*2), document:Math.round(base*0.8) });
      }
    }).catch(()=>{}).finally(() => setLoading(false));
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      await lawyersAPI.saveProfile({ consultation_fee:prices.voice, service_prices:prices });
      Alert.alert('✅','تم حفظ الأسعار!');
    } catch (e:any) { Alert.alert('خطأ',e?.message); }
    finally { setSaving(false); }
  };

  return (
    <View style={{ flex:1, backgroundColor:C.bg }}>
      <View style={{ backgroundColor:C.surface, paddingTop:insets.top+12, paddingHorizontal:16, paddingBottom:14, borderBottomWidth:1, borderBottomColor:C.border, flexDirection:'row', alignItems:'center', gap:10 }}>
        <TouchableOpacity onPress={() => router.back()}><Text style={{ color:C.text, fontSize:22 }}>‹</Text></TouchableOpacity>
        <Text style={{ color:C.text, fontWeight:'700', fontSize:20 }}>💲 أسعار خدماتي</Text>
      </View>
      <ScrollView keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding:16, paddingBottom:100 }}>
        <View style={{ backgroundColor:C.accent+'15', borderWidth:1, borderColor:C.accent+'30', borderRadius:12, padding:12, marginBottom:20 }}>
          <Text style={{ color:C.accent, fontWeight:'600', fontSize:13 }}>💡 المتوسط في المنصة: 400-600 جنيه للمكالمة الصوتية</Text>
        </View>
        {SERVICES.map(svc => {
          const val = prices[svc.id] || 0;
          const tooLow  = val > 0 && val < 50;
          const tooHigh = val > 5000;
          return (
            <View key={svc.id} style={{ backgroundColor:C.card, borderWidth:1, borderColor: tooLow||tooHigh ? C.red+'60' : C.border, borderRadius:14, padding:14, marginBottom:10 }}>
              <View style={{ flexDirection:'row', alignItems:'center', gap:12, marginBottom:8 }}>
                <Text style={{ fontSize:26 }}>{svc.icon}</Text>
                <Text style={{ flex:1, color:C.text, fontWeight:'600', fontSize:14 }}>{svc.label}</Text>
                <View style={{ flexDirection:'row', alignItems:'center', gap:6 }}>
                  <TextInput
                    value={String(val)}
                    onChangeText={v => setPrices(p => ({ ...p, [svc.id]: parseInt(v)||0 }))}
                    keyboardType="numeric"
                    style={{ width:80, backgroundColor:C.bg, borderWidth:1, borderColor: tooLow||tooHigh ? C.red : C.border, borderRadius:8, paddingHorizontal:10, paddingVertical:8, color:C.text, fontSize:16, fontWeight:'700', textAlign:'center' }}
                  />
                  <Text style={{ color:C.muted, fontSize:12 }}>ج</Text>
                </View>
              </View>
              <View style={{ flexDirection:'row', justifyContent:'space-between' }}>
                <Text style={{ color: tooLow ? C.red : C.muted, fontSize:11 }}>الحد الأدنى: 50 ج</Text>
                <Text style={{ color: tooHigh ? C.red : C.muted, fontSize:11 }}>الحد الأقصى: 5,000 ج</Text>
              </View>
              {(tooLow || tooHigh) && (
                <Text style={{ color:C.red, fontSize:11, marginTop:4 }}>
                  {tooLow ? '⚠️ السعر أقل من الحد الأدنى المسموح' : '⚠️ السعر أعلى من الحد الأقصى المسموح'}
                </Text>
              )}
            </View>
          );
        })}
        <Btn C={C} full size="lg" disabled={saving} onPress={save} style={{ marginTop:8 }}>
          {saving?t('app.loading'):isRTL ? '💾 حفظ الأسعار' : '💾 Save Prices'}
        </Btn>
      </ScrollView>
    </View>
  );
}