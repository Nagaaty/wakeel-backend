import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, ScrollView, Alert, RefreshControl, TextInput } from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '../../src/hooks/useTheme';
import { Avatar, Badge, Card, Spinner, Btn, Empty, ErrMsg } from '../../src/components/ui';
import { adminAPI } from '../../src/services/api';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useI18n } from '../../src/i18n';

const STATUS_COLOR: Record<string,string> = { pending:'#F59E0B', approved:'#22C55E', rejected:'#EF4444' };
const STATUS_AR: Record<string,string>    = { pending:'انتظار', approved:'موثق', rejected:'مرفوض' };

export default function AdminVerificationScreen() {
  const C = useTheme(); const insets = useSafeAreaInsets();
  const [lawyers,   setLawyers]  = useState<any[]>([]);
  const [selected,  setSelected] = useState<any>(null);
  const [loading,   setLoading]  = useState(true);
  const [acting,    setActing]   = useState(false);
  const [filter,    setFilter]   = useState('pending');
  const [error,     setError]    = useState('');
  const [showReject, setShowReject] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  const load = async () => {
    setError('');
    try {
      const d: any = await adminAPI.pendingLawyers();
      setLawyers(d.lawyers || d || []);
    } catch (e: any) { setError(e?.message || 'تعذر التحميل'); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const filtered = lawyers.filter((l: any) => filter === 'all' || l.verification_status === filter);

  const approve = async (id: string) => {
    setActing(true);
    try {
      await adminAPI.verifyLawyer(id, { action: 'approved' });
      setLawyers(p => p.map((l:any) => l.id === id ? { ...l, verification_status: 'approved' } : l));
      setSelected((s: any) => s ? { ...s, verification_status: 'approved' } : null);
      Alert.alert('✅', 'تم توثيق المحامي بنجاح');
    } catch (e: any) { Alert.alert('خطأ', e?.message); }
    finally { setActing(false); }
  };

  const reject = async (id: string, reason: string) => {
    setActing(true);
    try {
      await adminAPI.verifyLawyer(id, { action: 'rejected', reason });
      setLawyers(p => p.map((l:any) => l.id === id ? { ...l, verification_status: 'rejected' } : l));
      setSelected((s: any) => s ? { ...s, verification_status: 'rejected' } : null);
    } catch (e: any) { Alert.alert('خطأ', e?.message); }
    finally { setActing(false); }
  };

  if (selected) return (
    <View style={{ flex:1, backgroundColor:C.bg }}>
      <View style={{ backgroundColor:C.surface, paddingTop:insets.top+12, paddingHorizontal:16, paddingBottom:14, borderBottomWidth:1, borderBottomColor:C.border, flexDirection:'row', alignItems:'center', gap:12 }}>
        <TouchableOpacity onPress={() => setSelected(null)}><Text style={{ color:C.text, fontSize:22 }}>‹</Text></TouchableOpacity>
        <Text style={{ color:C.text, fontWeight:'700', fontSize:17 }}>مراجعة طلب التوثيق</Text>
      </View>
      <ScrollView contentContainerStyle={{ padding:16, paddingBottom:100 }}>
        <Card C={C} style={{ marginBottom:14 }}>
          <View style={{ flexDirection:'row', gap:14, alignItems:'center', marginBottom:16 }}>
            <Avatar C={C} initials={(selected.name||'L').split(' ').map((w:string)=>w[0]).join('').slice(0,2)} size={56} />
            <View style={{ flex:1 }}>
              <Text style={{ color:C.text, fontWeight:'700', fontSize:17 }}>{selected.name}</Text>
              <Text style={{ color:C.muted, fontSize:13, marginTop:2 }}>{selected.specialization} · {selected.city}</Text>
              <Badge C={C} color={STATUS_COLOR[selected.verification_status] || C.muted} style={{ marginTop:6, alignSelf:'flex-start' }}>
                {STATUS_AR[selected.verification_status] || '—'}
              </Badge>
            </View>
          </View>
          {[['البريد',selected.email],['الهاتف',selected.phone],['الخبرة',`${selected.experience_years} سنة`],['رقم النقابة',selected.bar_number||'غير محدد'],['رسوم الاستشارة',`${selected.consultation_fee} جنيه`]].map(([k,v])=>(
            <View key={k as string} style={{ flexDirection:'row', justifyContent:'space-between', paddingVertical:9, borderBottomWidth:1, borderBottomColor:C.border }}>
              <Text style={{ color:C.muted, fontSize:13 }}>{k as string}</Text>
              <Text style={{ color:C.text, fontSize:13, fontWeight:'600' }}>{v as string}</Text>
            </View>
          ))}
        </Card>

        <Card C={C} style={{ marginBottom:14 }}>
          <Text style={{ color:C.text, fontWeight:'700', fontSize:14, marginBottom:10 }}>📄 المستندات المرفوعة</Text>
          {(selected.documents||[]).length === 0
            ? <Text style={{ color:C.muted, fontSize:13 }}>لم يتم رفع مستندات بعد</Text>
            : (selected.documents||[]).map((d:string,i:number)=><Text key={i} style={{ color:C.gold, fontSize:13, paddingVertical:4 }}>📄 {d}</Text>)
          }
        </Card>

        {selected.bio ? (
          <Card C={C} style={{ marginBottom:14 }}>
            <Text style={{ color:C.text, fontWeight:'700', fontSize:14, marginBottom:8 }}>📝 النبذة المهنية</Text>
            <Text style={{ color:C.muted, fontSize:13, lineHeight:22 }}>{selected.bio}</Text>
          </Card>
        ) : null}

        {selected.verification_status === 'pending' && (
          <View style={{ flexDirection:'row', gap:12 }}>
            <Btn C={C} full disabled={acting} onPress={() => approve(selected.id)}>
              {acting?'⏳':'✅ قبول التوثيق'}
            </Btn>
            {showReject ? (
          <View style={{ marginTop: 10 }}>
            <TextInput
              value={rejectReason}
              onChangeText={setRejectReason}
              placeholder="سبب الرفض (إلزامي)..."
              placeholderTextColor={C.muted}
              multiline numberOfLines={3}
              style={{ backgroundColor: C.bg, borderWidth: 1, borderColor: C.red + '60', borderRadius: 10, padding: 12, color: C.text, fontSize: 14, textAlignVertical: 'top', minHeight: 80, marginBottom: 10 }}
            />
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Btn C={C} full disabled={acting} onPress={() => reject(selected.id, rejectReason)}>
                {acting ? '⏳' : '❌ تأكيد الرفض'}
              </Btn>
              <Btn C={C} full variant="ghost" onPress={() => { setShowReject(false); setRejectReason(''); }}>إلغاء</Btn>
            </View>
          </View>
        ) : (
          <Btn C={C} full variant="ghost" disabled={acting} onPress={() => setShowReject(true)}>❌ رفض الطلب</Btn>
        )}
          </View>
        )}
      </ScrollView>
    </View>
  );

  return (
    <View style={{ flex:1, backgroundColor:C.bg }}>
      <View style={{ backgroundColor:C.surface, paddingTop:insets.top+12, paddingHorizontal:16, paddingBottom:12, borderBottomWidth:1, borderBottomColor:C.border }}>
        <View style={{ flexDirection:'row', alignItems:'center', gap:10, marginBottom:12 }}>
          <TouchableOpacity onPress={() => router.back()}><Text style={{ color:C.text, fontSize:22 }}>‹</Text></TouchableOpacity>
          <Text style={{ color:C.text, fontWeight:'700', fontSize:20, fontFamily:'Cairo-Bold' }}>توثيق المحامين</Text>
        </View>
        <View style={{ flexDirection:'row', gap:8 }}>
          {[['pending','انتظار'],['approved','موثقون'],['rejected','مرفوضون'],['all','الكل']].map(([f,lb])=>{
            const count = lawyers.filter((l:any) => f==='all' || l.verification_status===f).length;
            return (
              <TouchableOpacity key={f} onPress={() => setFilter(f)}
                style={{ paddingHorizontal:12, paddingVertical:7, borderRadius:20, borderWidth:1, borderColor:filter===f?C.gold:C.border, backgroundColor:filter===f?C.gold:'transparent' }}>
                <Text style={{ color:filter===f?'#fff':C.text, fontSize:11, fontWeight:filter===f?'700':'400' }}>
                  {lb} ({count})
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
      {error ? <View style={{ padding:16 }}><ErrMsg C={C} msg={error} /></View> : null}
      <FlatList
        data={filtered}
        keyExtractor={item => String(item.id)}
        contentContainerStyle={{ padding:16, paddingBottom:100 }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={C.gold} />}
        ListEmptyComponent={!loading ? <Empty C={C} icon="⚖️" title="لا توجد طلبات" /> : <View style={{ padding:40, alignItems:'center' }}><Spinner C={C} /></View>}
        renderItem={({ item:l }) => {
          const initials = (l.name||'L').split(' ').map((w:string)=>w[0]).join('').slice(0,2).toUpperCase();
          return (
            <TouchableOpacity onPress={() => setSelected(l)}
              style={{ flexDirection:'row', gap:12, alignItems:'center', backgroundColor:C.card, borderWidth:1, borderColor:C.border, borderRadius:14, padding:14, marginBottom:10 }}>
              <Avatar C={C} initials={initials} size={46} />
              <View style={{ flex:1 }}>
                <Text style={{ color:C.text, fontWeight:'700', fontSize:14 }}>{l.name}</Text>
                <Text style={{ color:C.muted, fontSize:12, marginTop:2 }}>{l.specialization} · {l.city}</Text>
                <Text style={{ color:C.muted, fontSize:11, marginTop:1 }}>{l.email}</Text>
              </View>
              <Badge C={C} color={STATUS_COLOR[l.verification_status] || C.muted}>
                {STATUS_AR[l.verification_status] || '—'}
              </Badge>
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
}