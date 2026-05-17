import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, TextInput, Alert, RefreshControl, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '../../src/hooks/useTheme';
import { Badge, Card, Btn, Spinner, Empty } from '../../src/components/ui';
import { supportAPI } from '../../src/services/api';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useI18n } from '../../src/i18n';

const PRIORITY_COLOR: Record<string,string> = { urgent:'#EF4444', high:'#F59E0B', normal:'#22C55E' };
const PRIORITY_AR:    Record<string,string> = { urgent:'عاجل', high:'مرتفع', normal:'عادي' };
const STATUS_COLOR:   Record<string,string> = { open:'#F59E0B', in_progress:'#3B82F6', resolved:'#22C55E', closed:'#888' };
const STATUS_AR:      Record<string,string> = { open:'مفتوحة', in_progress:'جارية', resolved:'تم الحل', closed:'مغلقة' };

export default function AdminSupportScreen() {
  const C = useTheme(); const insets = useSafeAreaInsets();
  const [tickets,  setTickets]  = useState<any[]>([]);
  const [selected, setSelected] = useState<any>(null);
  const [reply,    setReply]    = useState('');
  const [filter,   setFilter]   = useState('open');
  const [loading,  setLoading]  = useState(true);
  const [sending,  setSending]  = useState(false);

  const load = async () => {
    try {
      const d: any = await supportAPI.getTickets();
      setTickets(d.tickets || d || []);
    } catch { setTickets([]); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const resolve = async () => {
    if (!reply.trim() || !selected) return;
    setSending(true);
    try {
      await supportAPI.resolveTicket(selected.id, reply);
      setTickets(p => p.map(t => t.id === selected.id ? { ...t, status:'resolved', admin_reply: reply } : t));
      setSelected(null); setReply('');
      Alert.alert('✅', 'تم الرد وإغلاق التذكرة');
    } catch (e: any) { Alert.alert('خطأ', e?.message); }
    finally { setSending(false); }
  };

  const filtered = filter === 'all' ? tickets : tickets.filter((t: any) => t.status === filter);

  if (selected) return (
    <View style={{ flex:1, backgroundColor:C.bg }}>
      <View style={{ backgroundColor:C.surface, paddingTop:insets.top+12, paddingHorizontal:16, paddingBottom:14, borderBottomWidth:1, borderBottomColor:C.border, flexDirection:'row', alignItems:'center', gap:12 }}>
        <TouchableOpacity onPress={() => { setSelected(null); setReply(''); }}>
          <Text style={{ color:C.text, fontSize:22 }}>‹</Text>
        </TouchableOpacity>
        <Text style={{ color:C.text, fontWeight:'700', fontSize:17 }}>تذكرة #{selected.id}</Text>
      </View>
      <ScrollView contentContainerStyle={{ padding:16, paddingBottom:80 }}>
        <Card C={C} style={{ marginBottom:14 }}>
          <View style={{ flexDirection:'row', justifyContent:'space-between', alignItems:'flex-start', marginBottom:12 }}>
            <View style={{ flex:1 }}>
              <Text style={{ color:C.text, fontWeight:'700', fontSize:15 }}>{selected.subject}</Text>
              <Text style={{ color:C.muted, fontSize:12, marginTop:2 }}>
                {selected.user_name} · {new Date(selected.created_at||Date.now()).toLocaleDateString('ar-EG')}
              </Text>
            </View>
            <View style={{ gap:6, alignItems:'flex-end' }}>
              <Badge C={C} color={PRIORITY_COLOR[selected.priority]}>{PRIORITY_AR[selected.priority]}</Badge>
              <Badge C={C} color={STATUS_COLOR[selected.status]}>{STATUS_AR[selected.status]}</Badge>
            </View>
          </View>
          <View style={{ backgroundColor:C.bg, borderRadius:10, padding:12 }}>
            <Text style={{ color:C.text, fontSize:13, lineHeight:22 }}>{selected.message}</Text>
          </View>
        </Card>

        {selected.admin_reply && (
          <Card C={C} style={{ marginBottom:14, borderColor:C.green+'40' }}>
            <Text style={{ color:C.green, fontWeight:'700', fontSize:13, marginBottom:8 }}>✅ الرد السابق</Text>
            <Text style={{ color:C.muted, fontSize:13, lineHeight:20 }}>{selected.admin_reply}</Text>
          </Card>
        )}

        {selected.status !== 'resolved' && selected.status !== 'closed' && (
          <Card C={C}>
            <Text style={{ color:C.text, fontWeight:'700', fontSize:14, marginBottom:12 }}>الرد على التذكرة</Text>
            <TextInput
              value={reply} onChangeText={setReply}
              placeholder="اكتب ردك على العميل..." placeholderTextColor={C.muted}
              multiline numberOfLines={5}
              style={{ backgroundColor:C.bg, borderWidth:1, borderColor:C.border, borderRadius:10, padding:12, color:C.text, fontSize:13, textAlignVertical:'top', minHeight:100, marginBottom:12 }}
            />
            <View style={{ flexDirection:'row', gap:10 }}>
              <Btn C={C} full disabled={!reply.trim()||sending} onPress={resolve}>
                {sending?'⏳ جاري الإرسال...':'✅ إرسال الرد وإغلاق التذكرة'}
              </Btn>
              <Btn C={C} full variant="ghost" onPress={() => { setSelected(null); setReply(''); }}>رجوع</Btn>
            </View>
          </Card>
        )}
      </ScrollView>
    </View>
  );

  return (
    <View style={{ flex:1, backgroundColor:C.bg }}>
      <View style={{ backgroundColor:C.surface, paddingTop:insets.top+12, paddingHorizontal:16, paddingBottom:12, borderBottomWidth:1, borderBottomColor:C.border }}>
        <View style={{ flexDirection:'row', alignItems:'center', gap:10, marginBottom:12 }}>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={{ color:C.text, fontSize:22 }}>‹</Text>
          </TouchableOpacity>
          <Text style={{ color:C.text, fontWeight:'700', fontSize:20, fontFamily:'Cairo-Bold' }}>تذاكر الدعم</Text>
        </View>
        <FlatList horizontal data={[['open','مفتوحة'],['in_progress','جارية'],['resolved','تم الحل'],['all','الكل']]}
          keyExtractor={item=>item[0]} showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap:8 }}
          renderItem={({ item:[f,lb] }) => (
            <TouchableOpacity onPress={() => setFilter(f)}
              style={{ paddingHorizontal:14, paddingVertical:7, borderRadius:20, borderWidth:1, borderColor:filter===f?C.gold:C.border, backgroundColor:filter===f?C.gold:'transparent' }}>
              <Text style={{ color:filter===f?'#fff':C.text, fontSize:12, fontWeight:filter===f?'700':'400' }}>{lb}</Text>
            </TouchableOpacity>
          )}
        />
      </View>
      <FlatList
        data={filtered} keyExtractor={item=>String(item.id)}
        contentContainerStyle={{ padding:16, paddingBottom:100 }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={C.gold} />}
        ListEmptyComponent={!loading ? <Empty C={C} icon="🎫" title="لا توجد تذاكر" /> : <View style={{ padding:40, alignItems:'center' }}><Spinner C={C} /></View>}
        renderItem={({ item:t }) => (
          <TouchableOpacity onPress={() => setSelected(t)}
            style={{ backgroundColor:C.card, borderWidth:1, borderColor:C.border, borderRadius:14, padding:14, marginBottom:10 }}>
            <View style={{ flexDirection:'row', justifyContent:'space-between', marginBottom:6 }}>
              <Text style={{ color:C.text, fontWeight:'700', fontSize:14, flex:1 }} numberOfLines={1}>#{t.id} — {t.subject}</Text>
              <Badge C={C} color={PRIORITY_COLOR[t.priority]}>{PRIORITY_AR[t.priority]}</Badge>
            </View>
            <Text style={{ color:C.muted, fontSize:12, marginBottom:8 }}>{t.user_name} · {new Date(t.created_at||Date.now()).toLocaleDateString('ar-EG')}</Text>
            <View style={{ flexDirection:'row', justifyContent:'space-between', alignItems:'center' }}>
              <Text style={{ color:C.muted, fontSize:12, flex:1 }} numberOfLines={1}>{t.message?.slice(0,70)}...</Text>
              <Badge C={C} color={STATUS_COLOR[t.status]}>{STATUS_AR[t.status]}</Badge>
            </View>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}
