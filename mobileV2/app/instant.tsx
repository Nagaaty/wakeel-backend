import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, Alert } from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '../src/theme';
import { Btn, Avatar, Stars, Card, Spinner } from '../src/components/ui';
import { usersAPI, messagesAPI } from '../src/services/api';
import { useSelector } from 'react-redux';
import { selLoggedIn } from '../src/store/slices/authSlice';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useI18n } from '../src/i18n';

export default function InstantScreen() {
  const C = useTheme(); const insets = useSafeAreaInsets();
  const { t, isRTL } = useI18n();
  const isLoggedIn = useSelector(selLoggedIn);
  const [lawyers, setLawyers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<any>(null);
  const [question, setQuestion] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [connected, setConnected] = useState<{ id: number | string } | null>(null);

  useEffect(() => {
    usersAPI.online().then((d:any) => setLawyers(d.lawyers||[])).catch(()=>{}).finally(()=>setLoading(false));
  }, []);

  const connect = async () => {
    if (!isLoggedIn) { router.push('/(auth)/login'); return; }
    if (!question.trim() || !selected) return;
    setConnecting(true);
    try {
      const d:any = await messagesAPI.createConversation(selected.id);
      await messagesAPI.sendMessage(d.conversation?.id || d.id, question.trim());
      setConnected({ id: d.conversation?.id || d.id });
    } catch (e:any) { Alert.alert('خطأ', e?.message||'تعذر الاتصال'); }
    finally { setConnecting(false); }
  };

  if (connected) return (
    <View style={{ flex:1, backgroundColor:C.bg, justifyContent:'center', alignItems:'center', padding:24 }}>
      <View style={{ width:80, height:80, borderRadius:40, backgroundColor:C.green+'20', borderWidth:3, borderColor:C.green, alignItems:'center', justifyContent:'center', marginBottom:20 }}>
        <Text style={{ fontSize:36 }}>✅</Text>
      </View>
      <Text style={{ color:C.text, fontWeight:'700', fontSize:20, marginBottom:8, fontFamily:'Cairo-Bold' }}>تم الاتصال!</Text>
      <Btn C={C} full onPress={() => router.push(connected?.id ? `/messages?convId=${connected.id}` : '/messages/index' as any)}>💬 افتح المحادثة</Btn>
      <TouchableOpacity onPress={() => { setConnected(null); setSelected(null); setQuestion(''); }} style={{ marginTop:12 }}>
        <Text style={{ color:C.muted, fontSize:13 }}>عودة</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={{ flex:1, backgroundColor:C.bg }}>
      <View style={{ backgroundColor:C.surface, paddingTop:insets.top+12, paddingHorizontal:16, paddingBottom:14, borderBottomWidth:1, borderBottomColor:C.border }}>
        <View style={{ flexDirection:'row', alignItems:'center', gap:10, marginBottom:6 }}>
          <TouchableOpacity onPress={() => router.back()}><Text style={{ color:C.text, fontSize:22 }}>‹</Text></TouchableOpacity>
          <Text style={{ color:C.text, fontWeight:'700', fontSize:20 }}>⚡ استشارة فورية</Text>
        </View>
        <View style={{ flexDirection:'row', alignItems:'center', gap:6 }}>
          <View style={{ width:8, height:8, borderRadius:4, backgroundColor:C.green }} />
          <Text style={{ color:C.green, fontSize:12, fontWeight:'600' }}>
            {loading?'...':`${lawyers.length} محامٍ متاح الآن`}
          </Text>
        </View>
      </View>
      <ScrollView contentContainerStyle={{ padding:16, paddingBottom:100 }}>
        {loading && <View style={{padding:40,alignItems:'center'}}><Spinner C={C}/></View>}
        {!loading && (
          <>
            <Text style={{ color:C.text, fontWeight:'700', fontSize:14, marginBottom:12 }}>اختر محامياً متاحاً</Text>
            {lawyers.map(l => {
              const initials = (l.name||'').split(' ').map((w:string)=>w[0]).join('').slice(0,2).toUpperCase();
              return (
                <TouchableOpacity key={l.id} onPress={() => setSelected(l)}
                  style={{ flexDirection:'row', gap:14, alignItems:'center', backgroundColor:C.card, borderWidth:2, borderColor:selected?.id===l.id?C.gold:C.border, borderRadius:14, padding:14, marginBottom:10 }}>
                  <View style={{ position:'relative' }}>
                    <Avatar C={C} initials={initials} size={50} />
                    <View style={{ position:'absolute', bottom:0, right:0, width:12, height:12, borderRadius:6, backgroundColor:C.green, borderWidth:2, borderColor:C.card }} />
                  </View>
                  <View style={{ flex:1 }}>
                    <Text style={{ color:C.text, fontWeight:'700', fontSize:14 }}>{l.name}</Text>
                    <Text style={{ color:C.muted, fontSize:12 }}>{l.specialization} · {l.city}</Text>
                    <Stars rating={parseFloat(l.avg_rating)||0} C={C} />
                  </View>
                  <View style={{ alignItems:'center' }}>
                    <Text style={{ color:C.gold, fontWeight:'800', fontSize:16 }}>{l.consultation_fee}</Text>
                    <Text style={{ color:C.muted, fontSize:10 }}>جنيه</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
            {selected && (
              <Card C={C} style={{ marginTop:8, marginBottom:16 }}>
                <Text style={{ color:C.text, fontWeight:'700', fontSize:14, marginBottom:10 }}>سؤالك لـ {selected.name}</Text>
                <TextInput value={question} onChangeText={setQuestion} placeholder="اكتب سؤالك أو صف قضيتك..." placeholderTextColor={C.muted} multiline numberOfLines={4}
                  style={{ backgroundColor:C.bg, borderWidth:1, borderColor:C.border, borderRadius:10, padding:12, color:C.text, fontSize:13, textAlignVertical:'top', minHeight:80 }} />
              </Card>
            )}
            <Btn C={C} full size="lg" disabled={!selected||!question.trim()||connecting} onPress={connect}>
              {connecting?t('app.loading'):isRTL ? '⚡ ابدأ الاستشارة الفورية' : '⚡ Start Instant Consult'}
            </Btn>
            {!selected && <Text style={{ color:C.muted, textAlign:'center', fontSize:13, marginTop:10 }}>اختر محامياً أولاً</Text>}
          </>
        )}
      </ScrollView>
    </View>
  );
}