import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, TextInput, RefreshControl, Alert, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '../src/theme';
import { Badge, Spinner, Empty, Btn, Card } from '../src/components/ui';
import { jobsAPI } from '../src/services/api';
import { useSelector } from 'react-redux';
import { selLoggedIn } from '../src/store/slices/authSlice';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useI18n } from '../src/i18n';

const TYPE_COLORS: Record<string,string> = { 'Full-time':'#22C55E', 'Internship':'#3B82F6', 'Freelance':'#F59E0B' };

export default function JobsScreen() {
  const C = useTheme(); const insets = useSafeAreaInsets(); const isLoggedIn = useSelector(selLoggedIn);
  const [jobs, setJobs] = useState<any[]>([]); const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(''); const [type, setType] = useState('');
  const [selected, setSelected] = useState<any>(null); const [applied, setApplied] = useState<number[]>([]);

  const load = () => jobsAPI.list({ search:search||undefined, type:type||undefined }).then((d:any)=>setJobs(d.jobs||[])).catch(()=>{}).finally(()=>setLoading(false));
  useEffect(() => { load(); }, [type]);

  const apply = async (jobId: number) => {
    if (!isLoggedIn) { router.push('/(auth)/login'); return; }
    try { await jobsAPI.apply(jobId, {}); setApplied(p=>[...p,jobId]); Alert.alert('✅','تم إرسال طلبك!'); }
    catch (e:any) { Alert.alert('خطأ',e?.message); }
  };

  const types = [...new Set(jobs.map((j:any)=>j.type))];

  if (selected) return (
    <View style={{ flex:1, backgroundColor:C.bg }}>
      <View style={{ backgroundColor:C.surface, paddingTop:insets.top+12, paddingHorizontal:16, paddingBottom:14, borderBottomWidth:1, borderBottomColor:C.border, flexDirection:'row', alignItems:'center', gap:10 }}>
        <TouchableOpacity onPress={() => setSelected(null)}><Text style={{ color:C.text, fontSize:22 }}>‹</Text></TouchableOpacity>
        <Text style={{ color:C.text, fontWeight:'700', fontSize:16, flex:1 }} numberOfLines={1}>{selected.title}</Text>
      </View>
      <ScrollView contentContainerStyle={{ padding:16, paddingBottom:100 }}>
        <Card C={C} style={{ marginBottom:12 }}>
          <Text style={{ color:C.gold, fontWeight:'700', fontSize:16, marginBottom:4 }}>{selected.company}</Text>
          <Text style={{ color:C.muted, fontSize:13, marginBottom:10 }}>📍 {selected.location}</Text>
          {[['💰 الراتب',`${selected.salary_min?.toLocaleString()}–${selected.salary_max?.toLocaleString()} ج`],['📋 النوع',selected.type]].map(([k,v])=>(
            <View key={k as string} style={{ flexDirection:'row', justifyContent:'space-between', paddingVertical:8, borderBottomWidth:1, borderBottomColor:C.border }}>
              <Text style={{ color:C.muted, fontSize:13 }}>{k as string}</Text>
              <Text style={{ color:C.text, fontWeight:'600', fontSize:13 }}>{v as string}</Text>
            </View>
          ))}
        </Card>
        <Card C={C} style={{ marginBottom:12 }}>
          <Text style={{ color:C.text, fontWeight:'700', fontSize:14, marginBottom:8 }}>الوصف</Text>
          <Text style={{ color:C.muted, fontSize:13, lineHeight:20 }}>{selected.description}</Text>
        </Card>
        {(selected.requirements||[]).length > 0 && (
          <Card C={C} style={{ marginBottom:16 }}>
            <Text style={{ color:C.text, fontWeight:'700', fontSize:14, marginBottom:8 }}>المتطلبات</Text>
            {(typeof selected.requirements === 'string' ? JSON.parse(selected.requirements) : selected.requirements).map((r:string,i:number)=>(
              <View key={i} style={{ flexDirection:'row', gap:8, paddingVertical:4 }}>
                <Text style={{ color:C.gold }}>•</Text>
                <Text style={{ color:C.muted, fontSize:13 }}>{r}</Text>
              </View>
            ))}
          </Card>
        )}
        {applied.includes(selected.id)
          ? <View style={{ backgroundColor:C.green+'15', borderWidth:1, borderColor:C.green, borderRadius:12, padding:16, alignItems:'center' }}>
              <Text style={{ color:C.green, fontWeight:'700' }}>✅ تم إرسال طلبك!</Text>
            </View>
          : <Btn C={C} full size="lg" onPress={() => apply(selected.id)}>📨 تقدم للوظيفة</Btn>
        }
      </ScrollView>
    </View>
  );

  return (
    <View style={{ flex:1, backgroundColor:C.bg }}>
      <View style={{ backgroundColor:C.surface, paddingTop:insets.top+12, paddingHorizontal:16, paddingBottom:12, borderBottomWidth:1, borderBottomColor:C.border }}>
        <Text style={{ color:C.text, fontWeight:'700', fontSize:20, fontFamily:'Cairo-Bold', marginBottom:10 }}>💼 وظائف قانونية</Text>
        <View style={{ flexDirection:'row', backgroundColor:C.card2, borderWidth:1, borderColor:C.border, borderRadius:12, paddingHorizontal:12, paddingVertical:10, alignItems:'center', gap:8, marginBottom:10 }}>
          <Text>🔍</Text>
          <TextInput value={search} onChangeText={setSearch} onSubmitEditing={load} placeholder="ابحث..." placeholderTextColor={C.muted} style={{ flex:1, color:C.text, fontSize:14 }} />
        </View>
        <FlatList horizontal data={[['','الكل'],...types.map(t=>[t,t])]} keyExtractor={item=>item[0]} showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap:8 }}
          renderItem={({ item:[val,lb] }) => (
            <TouchableOpacity onPress={() => setType(val)} style={{ paddingHorizontal:14, paddingVertical:6, borderRadius:20, borderWidth:1, borderColor:type===val?C.gold:C.border, backgroundColor:type===val?C.gold:'transparent' }}>
              <Text style={{ color:type===val?'#fff':C.text, fontSize:13 }}>{lb}</Text>
            </TouchableOpacity>
          )}
        />
      </View>
      <FlatList data={jobs} keyExtractor={item=>String(item.id)} contentContainerStyle={{ padding:16, paddingBottom:100 }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={C.gold} />}
        ListEmptyComponent={!loading?<Empty C={C} icon="💼" title="لا توجد وظائف" />:<View style={{padding:40,alignItems:'center'}}><Spinner C={C}/></View>}
        renderItem={({ item }) => (
          <TouchableOpacity onPress={() => setSelected(item)} style={{ backgroundColor:C.card, borderWidth:1, borderColor:item.urgent?C.red:C.border, borderRadius:16, padding:14, marginBottom:10 }}>
            <View style={{ flexDirection:'row', justifyContent:'space-between', alignItems:'flex-start', marginBottom:8 }}>
              <View style={{ flex:1 }}>
                <Text style={{ color:C.text, fontWeight:'700', fontSize:14, marginBottom:2 }}>{item.title}</Text>
                <Text style={{ color:C.gold, fontSize:13 }}>{item.company}</Text>
              </View>
              <Badge C={C} color={TYPE_COLORS[item.type]||C.gold}>{item.type}</Badge>
            </View>
            <View style={{ flexDirection:'row', gap:12, flexWrap:'wrap' }}>
              <Text style={{ color:C.muted, fontSize:12 }}>📍 {item.location}</Text>
              <Text style={{ color:C.muted, fontSize:12 }}>💰 {item.salary_min?.toLocaleString()}–{item.salary_max?.toLocaleString()} ج</Text>
              {item.urgent && <Text style={{ color:C.red, fontWeight:'700', fontSize:12 }}>🔴 عاجل</Text>}
            </View>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}