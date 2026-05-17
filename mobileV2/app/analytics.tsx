import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, RefreshControl,
  InteractionManager,} from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '../src/hooks/useTheme';
import { useAuth } from '../src/hooks/useAuth';
import { Card, Spinner, ErrMsg } from '../src/components/ui';
import { analyticsAPI } from '../src/services/api';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useI18n } from '../src/i18n';

export default function AnalyticsScreen() {
  const C = useTheme(); const insets = useSafeAreaInsets();
  const { isAdmin, isLawyer } = useAuth();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    setError('');
    try { setData(isAdmin ? await analyticsAPI.admin() : await analyticsAPI.lawyer()); }
    catch (e:any) { setError(e?.message||'تعذر تحميل التحليلات'); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);
  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  if (loading) return <View style={{ flex:1, backgroundColor:C.bg, justifyContent:'center', alignItems:'center' }}><Spinner C={C} /></View>;

  const stats   = data?.stats || data || {};
  const monthly = data?.monthly || [];
  const maxR    = Math.max(...monthly.map((m:any)=>parseFloat(m.revenue||0)), 1);

  return (
    <View style={{ flex:1, backgroundColor:C.bg }}>
      <View style={{ backgroundColor:C.surface, paddingTop:insets.top+12, paddingHorizontal:16, paddingBottom:14, borderBottomWidth:1, borderBottomColor:C.border, flexDirection:'row', alignItems:'center', gap:10 }}>
        <TouchableOpacity onPress={() => router.back()}><Text style={{ color:C.text, fontSize:22 }}>‹</Text></TouchableOpacity>
        <Text style={{ color:C.text, fontWeight:'700', fontSize:20 }}>{isAdmin?'📊 تحليلات المنصة':'📊 تحليلاتي'}</Text>
      </View>
      <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.gold} />}
        contentContainerStyle={{ padding:16, paddingBottom:100 }}>
        {error ? <ErrMsg C={C} msg={error} /> : null}

        {/* Stats grid */}
        <View style={{ flexDirection:'row', flexWrap:'wrap', gap:10, marginBottom:16 }}>
          {(isAdmin ? [
            ['👥', data?.users?.total||0,        'مستخدمون', '#3B82F6'],
            ['⚖️', data?.lawyers?.verified||0,   'محامون',   C.gold],
            ['📅', data?.bookings?.total||0,     'حجوزات',  C.green],
            ['💰', `${parseFloat(data?.revenue?.total||0).toFixed(0)} ج`, 'إيرادات', C.gold],
          ] : [
            ['📅', stats.total_bookings||0,                                      'إجمالي الحجوزات', C.gold],
            ['✅', stats.completed||0,                                            'مكتملة',          C.green],
            ['💰', `${parseFloat(stats.total_earned||0).toFixed(0)} ج`,          'إجمالي الأرباح',  C.gold],
            ['📅', `${parseFloat(stats.earned_this_month||0).toFixed(0)} ج`,     'هذا الشهر',       '#3B82F6'],
          ]).map(([icon,val,label,color]) => (
            <View key={label as string} style={{ width:'47%', backgroundColor:C.card, borderWidth:1, borderColor:C.border, borderRadius:14, padding:14 }}>
              <Text style={{ fontSize:22, marginBottom:4 }}>{icon as string}</Text>
              <Text style={{ color:color as string, fontWeight:'800', fontSize:22 }}>{val as any}</Text>
              <Text style={{ color:C.muted, fontSize:12, marginTop:3 }}>{label as string}</Text>
            </View>
          ))}
        </View>

        {/* Monthly bar chart */}
        {monthly.length > 0 && (
          <Card C={C} style={{ marginBottom:16 }}>
            <Text style={{ color:C.text, fontWeight:'700', fontSize:14, marginBottom:14 }}>الإيرادات الشهرية</Text>
            <View style={{ flexDirection:'row', alignItems:'flex-end', height:100, gap:4, marginBottom:6 }}>
              {monthly.slice(0,12).reverse().map((m:any,i:number) => {
                const h = Math.max(4, Math.round((parseFloat(m.revenue||0)/maxR)*90));
                const rev = parseFloat(m.revenue||0);
                return (
                  <View key={i} style={{ flex:1, alignItems:'center', gap:2 }}>
                    {rev > 0 && <Text style={{ color:C.gold, fontSize:7 }}>{(rev/1000).toFixed(0)}k</Text>}
                    <View style={{ width:'100%', height:h, backgroundColor:C.gold, borderRadius:3, opacity:0.6+i*0.04 }} />
                  </View>
                );
              })}
            </View>
            <View style={{ flexDirection:'row', gap:4 }}>
              {monthly.slice(0,12).reverse().map((m:any,i:number) => (
                <View key={i} style={{ flex:1 }}>
                  <Text style={{ color:C.muted, fontSize:7, textAlign:'center' }}>
                    {new Date(m.month).toLocaleDateString('ar-EG',{month:'short'})}
                  </Text>
                </View>
              ))}
            </View>
          </Card>
        )}

        {/* Top lawyers (admin) */}
        {isAdmin && data?.topLawyers?.length > 0 && (
          <Card C={C} style={{ marginBottom:16 }}>
            <Text style={{ color:C.text, fontWeight:'700', fontSize:14, marginBottom:12 }}>🏆 أفضل المحامين</Text>
            {data.topLawyers.map((l:any,i:number) => (
              <View key={l.id} style={{ flexDirection:'row', gap:10, alignItems:'center', paddingVertical:9, borderBottomWidth:1, borderBottomColor:C.border }}>
                <Text style={{ color:C.gold, fontWeight:'800', width:22 }}>#{i+1}</Text>
                <Text style={{ flex:1, color:C.text, fontWeight:'600', fontSize:13 }}>{l.name}</Text>
                <Text style={{ color:C.gold, fontWeight:'700', fontSize:13 }}>{parseFloat(l.total_revenue||0).toFixed(0)} ج</Text>
              </View>
            ))}
          </Card>
        )}

        {/* Top clients (lawyer) */}
        {!isAdmin && data?.topClients?.length > 0 && (
          <Card C={C}>
            <Text style={{ color:C.text, fontWeight:'700', fontSize:14, marginBottom:12 }}>👥 أهم العملاء</Text>
            {data.topClients.map((cl:any,i:number) => (
              <View key={cl.id} style={{ flexDirection:'row', gap:10, alignItems:'center', paddingVertical:9, borderBottomWidth:1, borderBottomColor:C.border }}>
                <Text style={{ color:C.gold, fontWeight:'800', width:22 }}>#{i+1}</Text>
                <View style={{ flex:1 }}>
                  <Text style={{ color:C.text, fontWeight:'600', fontSize:13 }}>{cl.name}</Text>
                  <Text style={{ color:C.muted, fontSize:11 }}>{cl.sessions} جلسة</Text>
                </View>
                <Text style={{ color:C.gold, fontWeight:'700', fontSize:13 }}>{parseFloat(cl.total_paid||0).toFixed(0)} ج</Text>
              </View>
            ))}
          </Card>
        )}
      </ScrollView>
    </View>
  );
}