import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, TextInput, Alert, RefreshControl } from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '../src/hooks/useTheme';
import { Btn, Spinner, Empty, ErrMsg } from '../src/components/ui';
import { courtDatesAPI } from '../src/services/api';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useI18n } from '../src/i18n';

const TYPE_CONFIG: Record<string, any> = {
  hearing:  { color:'#9A6F2A', icon:'⚖️',  label:'جلسة استماع' },
  deadline: { color:'#EF4444', icon:'📋',  label:'موعد نهائي' },
  meeting:  { color:'#3B82F6', icon:'👥',  label:'اجتماع' },
};
const daysUntil = (d: string) => Math.ceil((new Date(d).getTime() - Date.now()) / 86400000);

export default function CourtDatesScreen() {
  const C = useTheme(); const insets = useSafeAreaInsets();
  const { t } = useI18n();
  const [dates,   setDates]   = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');
  const [addMode, setAddMode] = useState(false);
  const [form,    setForm]    = useState({ title:'', court:'', date:'', time:'', type:'hearing', notes:'' });
  const [saving,  setSaving]  = useState(false);

  const load = () => courtDatesAPI.list()
    .then((d:any) => setDates(d.dates||[]))
    .catch((e:any) => setError(e?.message||'تعذر التحميل'))
    .finally(() => setLoading(false));
  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!form.title || !form.date) return;
    setSaving(true);
    try {
      const d:any = await courtDatesAPI.create(form);
      setDates(p => [...p, d.date||{ ...form, id:Date.now(), reminder:true }]);
      setForm({ title:'', court:'', date:'', time:'', type:'hearing', notes:'' });
      setAddMode(false);
    } catch { setDates(p=>[...p,{ ...form, id:Date.now(), reminder:true }]); setAddMode(false); }
    finally { setSaving(false); }
  };

  const remove = async (id: string) => {
    await courtDatesAPI.delete(id).catch(()=>{});
    setDates(p => p.filter(d => d.id !== id));
  };

  const sorted   = [...dates].sort((a,b) => new Date(a.date).getTime()-new Date(b.date).getTime());
  const upcoming = sorted.filter(d => daysUntil(d.date) >= 0);
  const past     = sorted.filter(d => daysUntil(d.date) < 0);

  return (
    <View style={{ flex:1, backgroundColor:C.bg }}>
      <View style={{ backgroundColor:C.surface, paddingTop:insets.top+12, paddingHorizontal:16, paddingBottom:12, borderBottomWidth:1, borderBottomColor:C.border }}>
        <View style={{ flexDirection:'row', alignItems:'center', justifyContent:'space-between' }}>
          <View style={{ flexDirection:'row', alignItems:'center', gap:10 }}>
            <TouchableOpacity onPress={() => router.back()}><Text style={{ color:C.text, fontSize:22 }}>‹</Text></TouchableOpacity>
            <View>
              <Text style={{ color:C.text, fontWeight:'700', fontSize:20, fontFamily:'Cairo-Bold' }}>مواعيد المحاكم</Text>
              <Text style={{ color:C.muted, fontSize:12, marginTop:2 }}>جلسات، مواعيد نهائية، واجتماعات</Text>
            </View>
          </View>
          <TouchableOpacity onPress={() => setAddMode(!addMode)}
            style={{ backgroundColor:C.gold, borderRadius:8, paddingHorizontal:12, paddingVertical:6 }}>
            <Text style={{ color:'#fff', fontWeight:'700', fontSize:13 }}>+ إضافة</Text>
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={[...upcoming, ...past]} keyExtractor={item=>String(item.id)}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding:16, paddingBottom:100 }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={C.gold} />}
        ListHeaderComponent={
          <>
            {error ? <ErrMsg C={C} msg={error} /> : null}
            {addMode && (
              <View style={{ backgroundColor:C.card, borderWidth:2, borderColor:C.gold, borderRadius:16, padding:16, marginBottom:14 }}>
                <Text style={{ color:C.text, fontWeight:'700', fontSize:14, marginBottom:12 }}>موعد جديد</Text>
                {[['العنوان *','title','اسم الجلسة'],['المحكمة','court','مثل: محكمة القاهرة'],['التاريخ *','date','YYYY-MM-DD'],['الوقت','time','10:00 AM'],['ملاحظات','notes','تفاصيل إضافية...']].map(([lb,k,ph])=>(
                  <View key={k} style={{ marginBottom:10 }}>
                    <Text style={{ color:C.muted, fontSize:12, fontWeight:'600', marginBottom:5 }}>{lb}</Text>
                    <TextInput value={(form as any)[k]} onChangeText={v=>setForm((f:any)=>({...f,[k]:v}))} placeholder={ph} placeholderTextColor={C.muted}
                      style={{ backgroundColor:C.bg, borderWidth:1, borderColor:C.border, borderRadius:9, paddingHorizontal:12, paddingVertical:9, color:C.text, fontSize:13 }} />
                  </View>
                ))}
                <View style={{ flexDirection:'row', gap:6, marginBottom:12 }}>
                  {['hearing','deadline','meeting'].map(t => (
                    <TouchableOpacity key={t} onPress={()=>setForm(f=>({...f,type:t}))}
                      style={{ flex:1, paddingVertical:8, borderRadius:8, borderWidth:1, borderColor:form.type===t?TYPE_CONFIG[t].color:C.border, backgroundColor:form.type===t?TYPE_CONFIG[t].color+'20':'transparent', alignItems:'center' }}>
                      <Text style={{ color:form.type===t?TYPE_CONFIG[t].color:C.muted, fontSize:11 }}>{TYPE_CONFIG[t].label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <View style={{ flexDirection:'row', gap:10 }}>
                  <Btn C={C} full disabled={saving||!form.title||!form.date} onPress={save}>{saving?'⏳':'💾 حفظ'}</Btn>
                  <Btn C={C} full variant="ghost" onPress={()=>setAddMode(false)}>إلغاء</Btn>
                </View>
              </View>
            )}
            {/* Stats row */}
            <View style={{ flexDirection:'row', gap:8, marginBottom:14 }}>
              {[
                [upcoming.length, 'قادمة', C.gold],
                [upcoming.filter(d => daysUntil(d.date) <= 7).length, 'هذا الأسبوع', '#EF4444'],
                [past.length, 'سابقة', C.muted],
              ].map(([v, lb, col]) => (
                <View key={lb as string} style={{ flex:1, backgroundColor:C.card, borderWidth:1, borderColor:C.border, borderRadius:12, padding:10, alignItems:'center' }}>
                  <Text style={{ color:col as string, fontWeight:'800', fontSize:20 }}>{v as number}</Text>
                  <Text style={{ color:C.muted, fontSize:11, marginTop:2 }}>{lb as string}</Text>
                </View>
              ))}
            </View>
            {upcoming.length > 0 && <Text style={{ color:C.text, fontWeight:'700', fontSize:14, marginBottom:10 }}>⏰ القادمة ({upcoming.length})</Text>}
          </>
        }
        ListEmptyComponent={!loading ? <Empty C={C} icon="📅" title="لا توجد مواعيد" /> : <View style={{padding:40,alignItems:'center'}}><Spinner C={C}/></View>}
        renderItem={({ item:d, index:i }) => {
          const days   = daysUntil(d.date);
          const cfg    = TYPE_CONFIG[d.type] || TYPE_CONFIG.hearing;
          const isPast = days < 0;
          // Add "Past" header
          const isFirstPast = isPast && i > 0 && daysUntil([...upcoming,...past][i-1]?.date) >= 0;
          return (
            <>
              {isFirstPast && <Text style={{ color:C.muted, fontWeight:'700', fontSize:13, marginTop:8, marginBottom:10 }}>السابقة</Text>}
              <View style={{ backgroundColor:C.card, borderWidth:1, borderColor:days<=3&&!isPast?C.red:C.border, borderRadius:14, padding:14, marginBottom:10, opacity:isPast?0.7:1 }}>
                <View style={{ flexDirection:'row', gap:12, alignItems:'flex-start' }}>
                  <View style={{ width:42, height:42, borderRadius:12, backgroundColor:cfg.color+'20', alignItems:'center', justifyContent:'center' }}>
                    <Text style={{ fontSize:20 }}>{cfg.icon}</Text>
                  </View>
                  <View style={{ flex:1 }}>
                    <View style={{ flexDirection:'row', justifyContent:'space-between', alignItems:'flex-start' }}>
                      <Text style={{ color:C.text, fontWeight:'700', fontSize:14, flex:1 }}>{d.title}</Text>
                      <View style={{ backgroundColor:isPast?C.muted+'20':days<=3?C.red+'20':C.gold+'20', borderRadius:8, paddingHorizontal:8, paddingVertical:3 }}>
                        <Text style={{ color:isPast?C.muted:days<=3?C.red:C.gold, fontSize:11, fontWeight:'700' }}>
                          {isPast?'✓ انتهى':days===0?'اليوم!':days===1?'غداً':`${days} يوم`}
                        </Text>
                      </View>
                    </View>
                    {d.court && <Text style={{ color:C.muted, fontSize:12, marginTop:2 }}>📍 {d.court}</Text>}
                    <Text style={{ color:C.muted, fontSize:12, marginTop:2 }}>📅 {d.date}{d.time?` · ⏰ ${d.time}`:''}</Text>
                    {d.notes && <Text style={{ color:C.muted, fontSize:12, marginTop:4, fontStyle:'italic' }}>"{d.notes}"</Text>}
                    <View style={{ flexDirection:'row', gap:6, marginTop:6 }}>
                      <View style={{ backgroundColor:cfg.color+'20', borderRadius:6, paddingHorizontal:8, paddingVertical:2 }}>
                        <Text style={{ color:cfg.color, fontSize:10, fontWeight:'600' }}>{cfg.label}</Text>
                      </View>
                    </View>
                  </View>
                  {!isPast && (
                    <TouchableOpacity onPress={() => {
                      Alert.alert(t('app.delete'),'هل تريد حذف هذا الموعد؟',[{text:t('app.cancel'),style:'cancel'},{text:t('app.delete'),style:'destructive',onPress:()=>remove(d.id)}]);
                    }}>
                      <Text style={{ color:C.muted, fontSize:20 }}>×</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            </>
          );
        }}
      />
    </View>
  );
}