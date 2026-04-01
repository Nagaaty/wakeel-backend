import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, TextInput, Alert, RefreshControl, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '../../src/hooks/useTheme';
import { Badge, Card, Btn, Spinner, Empty } from '../../src/components/ui';
import { promosAPI } from '../../src/services/api';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useI18n } from '../../src/i18n';

export default function AdminPromosScreen() {
  const C = useTheme(); const insets = useSafeAreaInsets();
  const { isRTL, t } = useI18n();
  const [promos,    setPromos]    = useState<any[]>([]);
  const [showForm,  setShowForm]  = useState(false);
  const [loading,   setLoading]   = useState(true);
  const [creating,  setCreating]  = useState(false);
  const [form, setForm] = useState({
    code: '', discount_type: 'percent', discount_value: 10, max_uses: 100, expires_at: '',
  });

  const load = async () => {
    try {
      const d: any = await promosAPI.list();
      setPromos(d.promos || d || []);
    } catch { setPromos([]); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const create = async () => {
    if (!form.code.trim()) { Alert.alert('', 'أدخل رمز الكود'); return; }
    setCreating(true);
    try {
      const d: any = await promosAPI.create(form);
      setPromos(p => [d?.promo || { ...form, id:Date.now(), uses:0, is_active:true }, ...p]);
      setShowForm(false);
      setForm({ code:'', discount_type:'percent', discount_value:10, max_uses:100, expires_at:'' });
    } catch (e: any) { Alert.alert('خطأ', e?.message); }
    finally { setCreating(false); }
  };

  const toggle = async (id: string, is_active: boolean) => {
    await promosAPI.toggle(id, !is_active).catch(() => {});
    setPromos(p => p.map(pr => pr.id===id ? { ...pr, is_active: !is_active } : pr));
  };

  return (
    <View style={{ flex:1, backgroundColor:C.bg }}>
      <View style={{ backgroundColor:C.surface, paddingTop:insets.top+12, paddingHorizontal:16, paddingBottom:14, borderBottomWidth:1, borderBottomColor:C.border }}>
        <View style={{ flexDirection:'row', alignItems:'center', justifyContent:'space-between' }}>
          <View style={{ flexDirection:'row', alignItems:'center', gap:10 }}>
            <TouchableOpacity onPress={() => router.back()}>
              <Text style={{ color:C.text, fontSize:22 }}>‹</Text>
            </TouchableOpacity>
            <Text style={{ color:C.text, fontWeight:'700', fontSize:20, fontFamily:'CormorantGaramond-Bold' }}>أكواد الخصم</Text>
          </View>
          <TouchableOpacity onPress={() => setShowForm(!showForm)}
            style={{ backgroundColor:C.gold, borderRadius:10, paddingHorizontal:14, paddingVertical:7 }}>
            <Text style={{ color:'#fff', fontWeight:'700', fontSize:13 }}>+ كود جديد</Text>
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={promos} keyExtractor={item=>String(item.id)}
        contentContainerStyle={{ padding:16, paddingBottom:100 }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={C.gold} />}
        ListHeaderComponent={showForm ? (
          <Card C={C} style={{ marginBottom:16, borderColor:C.gold }}>
            <Text style={{ color:C.text, fontWeight:'700', fontSize:15, marginBottom:14 }}>إنشاء كود خصم جديد</Text>
            {([
              ['الكود *', 'code', 'default', 'WAKEEL20'],
              ['قيمة الخصم', 'discount_value', 'numeric', '10'],
              ['الحد الأقصى للاستخدام', 'max_uses', 'numeric', '100'],
            ] as [string,string,any,string][]).map(([lb,k,kb,ph]) => (
              <View key={k} style={{ marginBottom:10 }}>
                <Text style={{ color:C.muted, fontSize:12, fontWeight:'600', marginBottom:5 }}>{lb}</Text>
                <TextInput
                  value={String((form as any)[k])} keyboardType={kb}
                  onChangeText={v => setForm(p => ({ ...p, [k]: k==='code'?v.toUpperCase():Number(v)||0 }))}
                  placeholder={ph} placeholderTextColor={C.muted} autoCapitalize={k==='code'?'characters':'none'}
                  style={{ backgroundColor:C.bg, borderWidth:1, borderColor:C.border, borderRadius:10, padding:11, color:C.text, fontSize:14 }}
                />
              </View>
            ))}
            <Text style={{ color:C.muted, fontSize:12, fontWeight:'600', marginBottom:6 }}>نوع الخصم</Text>
            <View style={{ flexDirection:'row', gap:8, marginBottom:14 }}>
              {([['percent','نسبة مئوية (%)'],['fixed','مبلغ ثابت (ج)']] as [string,string][]).map(([v,lb]) => (
                <TouchableOpacity key={v} onPress={() => setForm(p => ({ ...p, discount_type:v }))}
                  style={{ flex:1, paddingVertical:9, borderRadius:10, borderWidth:1, borderColor:form.discount_type===v?C.gold:C.border, backgroundColor:form.discount_type===v?C.gold+'20':'transparent', alignItems:'center' }}>
                  <Text style={{ color:form.discount_type===v?C.gold:C.muted, fontSize:12 }}>{lb}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={{ flexDirection:'row', gap:10 }}>
              <Btn C={C} full disabled={!form.code.trim()||creating} onPress={create}>
                {creating?'⏳ جاري الإنشاء...':'إنشاء الكود'}
              </Btn>
              <Btn C={C} full variant="ghost" onPress={() => setShowForm(false)}>إلغاء</Btn>
            </View>
          </Card>
        ) : null}
        ListEmptyComponent={!loading ? <Empty C={C} icon="🎫" title="لا توجد أكواد خصم" /> : <View style={{ padding:40, alignItems:'center' }}><Spinner C={C} /></View>}
        renderItem={({ item:p }) => {
          const pct = Math.min(100, Math.round(((p.uses||0)/Math.max(p.max_uses,1))*100));
          return (
            <View style={{ backgroundColor:C.card, borderWidth:1, borderColor:C.border, borderRadius:14, padding:14, marginBottom:10 }}>
              <View style={{ flexDirection:'row', justifyContent:'space-between', alignItems:'flex-start', marginBottom:10 }}>
                <View style={{ flex:1 }}>
                  <Text style={{ color:C.gold, fontWeight:'800', fontSize:18, letterSpacing:2 }}>{p.code}</Text>
                  <Text style={{ color:C.muted, fontSize:12, marginTop:3 }}>
                    خصم {p.discount_value}{p.discount_type==='percent'?'%':' جنيه'} · استخدم {p.uses||0}/{p.max_uses} مرة
                  </Text>
                  {p.expires_at && (
                    <Text style={{ color:C.muted, fontSize:11, marginTop:2 }}>
                      ينتهي: {new Date(p.expires_at).toLocaleDateString('ar-EG')}
                    </Text>
                  )}
                </View>
                <View style={{ alignItems:'flex-end', gap:8 }}>
                  <Badge C={C} color={p.is_active?C.green:'#999'}>{p.is_active?'نشط':'متوقف'}</Badge>
                  <TouchableOpacity onPress={() => toggle(p.id, p.is_active)}
                    style={{ borderWidth:1, borderColor:C.border, borderRadius:8, paddingHorizontal:10, paddingVertical:5 }}>
                    <Text style={{ color:C.muted, fontSize:11 }}>{p.is_active?'إيقاف':'تفعيل'}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => {
                    Alert.alert('حذف الكود', `حذف كود "${p.code}"؟`, [
                      { text: t('app.cancel'), style: 'cancel' },
                      { text: t('app.delete'), style: 'destructive', onPress: async () => {
                        await promosAPI.delete(p.id).catch(() => {});
                        setPromos(prev => prev.filter(x => x.id !== p.id));
                      }},
                    ]);
                  }} style={{ borderWidth:1, borderColor:C.red+'40', borderRadius:8, paddingHorizontal:10, paddingVertical:5 }}>
                    <Text style={{ color:C.red, fontSize:11 }}>🗑️</Text>
                  </TouchableOpacity>
                </View>
              </View>
              {/* Usage bar */}
              <View style={{ backgroundColor:C.bg, borderRadius:4, height:6, overflow:'hidden' }}>
                <View style={{ height:'100%', width:`${pct}%` as any, backgroundColor:C.gold, borderRadius:4 }} />
              </View>
            </View>
          );
        }}
      />
    </View>
  );
}
