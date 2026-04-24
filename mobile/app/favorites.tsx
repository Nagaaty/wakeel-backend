import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, Alert, RefreshControl } from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '../src/hooks/useTheme';
import { Avatar, Stars, Badge, Spinner, Empty, Btn, ErrMsg } from '../src/components/ui';
import { favoritesAPI } from '../src/services/api';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useI18n } from '../src/i18n';
import { hapticLight } from '../src/utils/haptics';

export default function FavoritesScreen() {
  const C      = useTheme();
  const insets = useSafeAreaInsets();
  const [favorites, setFavorites] = useState<any[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState('');

  const load = async () => {
    setError('');
    try {
      const d: any = await favoritesAPI.list();
      setFavorites(d.favorites || d || []);
    } catch (e: any) { setError(e?.message || 'تعذر التحميل'); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const remove = async (lawyerId: string) => {
    Alert.alert('حذف', 'إزالة هذا المحامي من المحفوظين؟', [
      { text: 'إلغاء', style: 'cancel' },
      { text: 'حذف', style: 'destructive', onPress: async () => {
        hapticLight(); await favoritesAPI.toggle(lawyerId).catch(() => {});
        setFavorites(p => p.filter((f: any) => (f.lawyer_id || f.id) !== lawyerId));
      }},
    ]);
  };

  return (
    <View style={{ flex:1, backgroundColor:C.bg }}>
      <View style={{ backgroundColor:C.surface, paddingTop:insets.top+12, paddingHorizontal:16, paddingBottom:14, borderBottomWidth:1, borderBottomColor:C.border, flexDirection:'row', alignItems:'center', gap:10 }}>
        <TouchableOpacity onPress={() => router.back()}><Text style={{ color:C.text, fontSize:22 }}>‹</Text></TouchableOpacity>
        <Text style={{ color:C.text, fontWeight:'700', fontSize:20, fontFamily:'Cairo-Bold' }}>❤️ المحامون المحفوظون</Text>
      </View>
      {error ? <View style={{ padding:16 }}><ErrMsg C={C} msg={error} /></View> : null}
      <FlatList
        data={favorites}
        keyExtractor={item => String(item.id || item.lawyer_id)}
        contentContainerStyle={{ padding:16, paddingBottom:100 }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={C.gold} />}
        ListEmptyComponent={
          !loading ? (
            <Empty C={C} icon="❤️" title="لا توجد محامون محفوظون" subtitle="احفظ المحامين الذين يعجبونك للرجوع إليهم لاحقاً"
              action={{ label: '🔍 ابحث عن محامٍ', onPress: () => router.push('/lawyers' as any) }}
            />
          ) : <View style={{ padding:40, alignItems:'center' }}><Spinner C={C} /></View>
        }
        renderItem={({ item: fav }) => {
          const l = fav.lawyer || fav;
          const initials = (l.name||'').split(' ').map((w:string)=>w[0]).join('').slice(0,2).toUpperCase();
          return (
            <View style={{ backgroundColor:C.card, borderWidth:1, borderColor:C.border, borderRadius:16, padding:16, marginBottom:12, flexDirection:'row', gap:14, alignItems:'flex-start' }}>
              <Avatar C={C} initials={initials} size={54} />
              <View style={{ flex:1 }}>
                <View style={{ flexDirection:'row', justifyContent:'space-between', alignItems:'flex-start' }}>
                  <View style={{ flex:1 }}>
                    <Text style={{ color:C.text, fontWeight:'700', fontSize:15 }}>{l.name}</Text>
                    <Text style={{ color:C.muted, fontSize:12, marginTop:2 }}>{l.specialization} · {l.city}</Text>
                  </View>
                  <TouchableOpacity onPress={() => remove(l.id || fav.lawyer_id)} style={{ padding:4 }}>
                    <Text style={{ fontSize:22 }}>❤️</Text>
                  </TouchableOpacity>
                </View>
                <View style={{ flexDirection:'row', gap:10, marginTop:8, alignItems:'center', flexWrap:'wrap' }}>
                  <Stars rating={parseFloat(l.avg_rating||l.rating||0)} C={C} />
                  {l.is_verified && <Badge C={C} color={C.green}>✅ موثق</Badge>}
                  <Text style={{ color:C.gold, fontWeight:'700', fontSize:13 }}>{l.consultation_fee||l.price} ج</Text>
                </View>
                <View style={{ flexDirection:'row', gap:8, marginTop:12 }}>
                  <Btn C={C} size="sm" onPress={() => router.push(`/lawyer/${l.id}` as any)}>👤 الملف الشخصي</Btn>
                  <Btn C={C} size="sm" variant="ghost" onPress={() => router.push(`/book?lawyer=${l.id}` as any)}>📅 احجز</Btn>
                </View>
              </View>
            </View>
          );
        }}
      />
    </View>
  );
}