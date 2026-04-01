import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, Alert, Share } from 'react-native';
import { router } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { useTheme } from '../src/hooks/useTheme';
import { Btn, Card, ErrMsg } from '../src/components/ui';
import { referralAPI } from '../src/services/api';
import { useSelector } from 'react-redux';
import { selLoggedIn } from '../src/store/slices/authSlice';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useI18n } from '../src/i18n';

export default function ReferralScreen() {
  const C = useTheme(); const insets = useSafeAreaInsets();
  const isLoggedIn = useSelector(selLoggedIn);
  const [data,      setData]      = useState({ code: 'WK-DEMO2025', referrals: 3, earnings: 200 });
  const [copied,    setCopied]    = useState(false);
  const [applyCode, setApplyCode] = useState('');
  const [applyMsg,  setApplyMsg]  = useState('');
  const [applying,  setApplying]  = useState(false);

  useEffect(() => {
    if (!isLoggedIn) return;
    referralAPI.myCode().then((d:any) => setData(d)).catch(() => {});
  }, [isLoggedIn]);

  const copy = async () => {
    await Clipboard.setStringAsync(data.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const shareCode = async () => {
    try {
      await Share.share({
        message: `🎁 استخدم كود إحالتي ${data.code} على Wakeel.eg واحصل على خصم 50 جنيه في استشارتك القانونية الأولى! \nhttps://wakeel.eg/register?ref=${data.code}`,
        title: 'كود إحالة Wakeel',
      });
    } catch (e: any) {
      if (!e?.message?.includes('cancel')) Alert.alert('', e?.message);
    }
  };

  const applyReferral = async () => {
    if (!applyCode.trim()) return;
    setApplying(true); setApplyMsg('');
    try {
      const d: any = await referralAPI.apply(applyCode.trim());
      setApplyMsg(`✅ ${d.message || 'تم تطبيق الكود! حصلت على 50 جنيه خصم.'}`);
      setApplyCode('');
    } catch (e: any) {
      setApplyMsg(`❌ ${e?.message || 'كود غير صحيح أو منتهي الصلاحية'}`);
    } finally {
      setApplying(false);
      setTimeout(() => setApplyMsg(''), 5000);
    }
  };

  return (
    <View style={{ flex:1, backgroundColor:C.bg }}>
      <View style={{ backgroundColor:C.surface, paddingTop:insets.top+12, paddingHorizontal:16, paddingBottom:14, borderBottomWidth:1, borderBottomColor:C.border, flexDirection:'row', alignItems:'center', gap:10 }}>
        <TouchableOpacity onPress={() => router.back()}><Text style={{ color:C.text, fontSize:22 }}>‹</Text></TouchableOpacity>
        <Text style={{ color:C.text, fontWeight:'700', fontSize:20, fontFamily:'CormorantGaramond-Bold' }}>🎁 برنامج الإحالة</Text>
      </View>
      <ScrollView contentContainerStyle={{ padding:16, paddingBottom:80 }}>
        {/* Hero card */}
        <View style={{ backgroundColor:C.gold+'20', borderWidth:1, borderColor:C.gold+'40', borderRadius:20, padding:24, alignItems:'center', marginBottom:20 }}>
          <Text style={{ fontSize:52, marginBottom:10 }}>💰</Text>
          <Text style={{ color:C.gold, fontWeight:'800', fontSize:30, fontFamily:'CormorantGaramond-Bold', marginBottom:6 }}>اكسب 100 جنيه</Text>
          <Text style={{ color:C.muted, fontSize:14, textAlign:'center', lineHeight:22, marginBottom:22 }}>لكل صديق يكمل استشارته الأولى. صديقك يحصل على خصم 50 جنيه!</Text>
          {/* Code box */}
          <View style={{ backgroundColor:C.card, borderRadius:14, padding:'12px 16px' as any, paddingHorizontal:16, paddingVertical:12, flexDirection:'row', alignItems:'center', justifyContent:'space-between', width:'100%', marginBottom:14 }}>
            <Text style={{ fontFamily:'monospace', fontSize:22, color:C.gold, letterSpacing:3, fontWeight:'700' }}>{data.code}</Text>
            <TouchableOpacity onPress={copy} style={{ paddingHorizontal:14, paddingVertical:7, borderRadius:10, borderWidth:1, borderColor:copied?C.green:C.border, backgroundColor:copied?C.green+'20':'transparent' }}>
              <Text style={{ color:copied?C.green:C.muted, fontWeight:'700', fontSize:13 }}>{copied?'✓ تم النسخ':'📋 نسخ'}</Text>
            </TouchableOpacity>
          </View>
          <View style={{ flexDirection:'row', gap:10, width:'100%' }}>
            <TouchableOpacity onPress={shareCode} style={{ flex:1, paddingVertical:9, borderRadius:10, borderWidth:1, borderColor:C.border, backgroundColor:'transparent', alignItems:'center' }}>
              <Text style={{ color:C.text, fontSize:12 }}>📱 مشاركة</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => Share.share({ message: `استخدم كودي ${data.code} على Wakeel.eg`, url: `https://wakeel.eg/register?ref=${data.code}` })}
              style={{ flex:1, paddingVertical:9, borderRadius:10, borderWidth:1, borderColor:C.border, backgroundColor:'transparent', alignItems:'center' }}>
              <Text style={{ color:C.text, fontSize:12 }}>🔗 رابط</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Stats */}
        <View style={{ flexDirection:'row', gap:10, marginBottom:20 }}>
          {[[data.referrals,'إحالات',C.muted],[data.referrals,'مكتملة',C.gold],[`${data.earnings} ج`,'مكسوبة',C.green]].map(([v,l,col])=>(
            <Card key={l as string} C={C} style={{ flex:1, alignItems:'center', padding:14 }}>
              <Text style={{ color:col as string, fontWeight:'800', fontSize:22, fontFamily:'CormorantGaramond-Bold' }}>{v as any}</Text>
              <Text style={{ color:C.muted, fontSize:12, marginTop:3 }}>{l as string}</Text>
            </Card>
          ))}
        </View>

        {/* How it works */}
        <Card C={C} style={{ marginBottom:20 }}>
          <Text style={{ color:C.text, fontWeight:'700', fontSize:14, marginBottom:14 }}>📋 كيف يعمل البرنامج؟</Text>
          {[['1️⃣','شارك كودك الخاص مع الأصدقاء'],['2️⃣','يسجل صديقك ويستخدم الكود عند الحجز'],['3️⃣','يحصل صديقك على خصم 50 جنيه'],['4️⃣','تحصل أنت على 100 جنيه رصيد']].map(([n,t])=>(
            <View key={n as string} style={{ flexDirection:'row', gap:12, paddingVertical:10, borderBottomWidth:1, borderBottomColor:C.border }}>
              <Text style={{ fontSize:20 }}>{n as string}</Text>
              <Text style={{ color:C.text, fontSize:13, flex:1 }}>{t as string}</Text>
            </View>
          ))}
        </Card>

        {/* Apply code */}
        <Card C={C}>
          <Text style={{ color:C.text, fontWeight:'700', fontSize:14, marginBottom:12 }}>🎟️ لديك كود إحالة؟ طبّقه هنا</Text>
          {applyMsg ? (
            <View style={{ backgroundColor:applyMsg.startsWith('✅')?C.green+'15':C.red+'15', borderWidth:1, borderColor:applyMsg.startsWith('✅')?C.green:C.red, borderRadius:10, padding:10, marginBottom:12 }}>
              <Text style={{ color:applyMsg.startsWith('✅')?C.green:C.red, fontSize:13, fontWeight:'600' }}>{applyMsg}</Text>
            </View>
          ) : null}
          <View style={{ flexDirection:'row', gap:10 }}>
            <TextInput value={applyCode} onChangeText={setApplyCode} placeholder="أدخل الكود مثال: WK-AH4X2"
              placeholderTextColor={C.muted} autoCapitalize="characters"
              style={{ flex:1, backgroundColor:C.bg, borderWidth:1, borderColor:C.border, borderRadius:10, padding:11, color:C.text, fontSize:13 }} />
            <Btn C={C} disabled={!applyCode.trim()||applying} onPress={applyReferral}>
              {applying?'⏳':'تطبيق'}
            </Btn>
          </View>
        </Card>
      </ScrollView>
    </View>
  );
}