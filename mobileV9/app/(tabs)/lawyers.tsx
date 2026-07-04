import React, { useEffect, useState, useCallback, useRef, useMemo, memo } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, TextInput, Modal,
  RefreshControl, ActivityIndicator, Platform, InteractionManager, Alert
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { router, useLocalSearchParams } from 'expo-router';
import { useDispatch, useSelector } from 'react-redux';
import {
  fetchLawyers, selLawyers, selLawyersLoad, selLawyersTotal,
} from '../../src/features/lawyers/lawyersSlice';
import { selLoggedIn, selUser } from '../../src/features/auth/authSlice';
import { useTheme } from '../../src/theme';
import { Avatar, WinBar, Stars, Tag, Btn, Spinner, Empty, ErrMsg } from '../../src/components/ui';
import { favoritesAPI } from '../../src/services/api';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { AppDispatch } from '../../src/store';
import type { LawyerProfile } from '../../src/types';
import { useI18n } from '../../src/i18n';
import { ListSkeleton } from '../../src/components/Skeleton';
import { CachedAvatar } from '../../src/components/CachedImage';
import { useNetworkStatus } from '../../src/hooks/useNetworkStatus';

// Fixed card height for getItemLayout — avoids measurement on every render
// Card: padding(44) + topRow(68) + stars(20) + winbar(16) + bio(36) + meta(20) + actions(36) + save(36) + margin(18) = 294
const LAWYER_CARD_HEIGHT = 294;

const CATEGORIES_AR = [
  '',
  'الأحوال الشخصية',
  'الشركات والتجارة',
  'قانون العقارات',
  'القانون الجنائي',
  'قانون العمل',
  'القانون الإداري',
  'الملكية الفكرية',
  'قانون الضرائب',
  'قانون الأسرة',
  'القانون البحري',
  'قانون التحكيم',
  'القانون الدولي',
  'قانون الهجرة والسفر',
  'القانون المصرفي والمالي',
  'القانون الطبي',
  'قانون التكنولوجيا والجرائم الإلكترونية',
  'صياغة العقود'
];
const CATEGORIES_EN = [
  '',
  'Personal Status',
  'Corporate',
  'Real Estate',
  'Criminal Law',
  'Labor Law',
  'Administrative',
  'IP Law',
  'Tax Law',
  'Family Law',
  'Maritime Law',
  'Arbitration',
  'International Law',
  'Immigration & Travel',
  'Banking & Finance',
  'Medical Law',
  'Cybercrime & IT Law',
  'Contract Drafting'
];
const CITIES_AR     = ['', 'القاهرة', 'الجيزة', 'الإسكندرية', 'القليوبية', 'الغربية', 'المنوفية', 'الدقهلية', 'الشرقية', 'البحيرة', 'دمياط', 'بورسعيد', 'الإسماعيلية', 'السويس', 'كفر الشيخ', 'الفيوم', 'بني سويف', 'المنيا', 'أسيوط', 'سوهاج', 'قنا', 'الأقصر', 'أسوان', 'البحر الأحمر', 'الوادي الجديد', 'مطروح', 'شمال سيناء', 'جنوب سيناء'];
const CITIES_EN     = ['', 'Cairo', 'Giza', 'Alexandria', 'Qalyubia', 'Gharbia', 'Monufia', 'Dakahlia', 'Sharqia', 'Beheira', 'Damietta', 'Port Said', 'Ismailia', 'Suez', 'Kafr El Sheikh', 'Faiyum', 'Beni Suef', 'Minya', 'Asyut', 'Sohag', 'Qena', 'Luxor', 'Aswan', 'Red Sea', 'New Valley', 'Matrouh', 'North Sinai', 'South Sinai'];
const CITY_TRANSLATIONS: Record<string, string> = {
  'Cairo': 'القاهرة',
  'Alexandria': 'الإسكندرية',
  'Giza': 'الجيزة',
  'Qalyubia': 'القليوبية',
  'Gharbia': 'الغربية',
  'Monufia': 'المنوفية',
  'Dakahlia': 'الدقهلية',
  'Sharqia': 'الشرقية',
  'Beheira': 'البحيرة',
  'Damietta': 'دمياط',
  'Port Said': 'بورسعيد',
  'Ismailia': 'الإسماعيلية',
  'Suez': 'السويس',
  'Kafr El Sheikh': 'كفر الشيخ',
  'Faiyum': 'الفيوم',
  'Beni Suef': 'بني سويف',
  'Minya': 'المنيا',
  'Asyut': 'أسيوط',
  'Sohag': 'سوهاج',
  'Qena': 'قنا',
  'Luxor': 'الأقصر',
  'Aswan': 'أسوان',
  'Red Sea': 'البحر الأحمر',
  'New Valley': 'الوادي الجديد',
  'Matrouh': 'مطروح',
  'North Sinai': 'شمال سيناء',
  'South Sinai': 'جنوب سيناء'
};
// sort options: [value, arLabel, enLabel]
const SORT_OPTS: [string,string,string][] = [
  ['rating',    '⭐ الأعلى تقييماً', '⭐ Top Rated'],
  ['price_asc', '💰 السعر ↑',        '💰 Price: Low to High'],
  ['price_desc','💰 السعر ↓',        '💰 Price: High to Low'],
];

// Compact Grid LawyerCard
const LawyerCardGrid = memo(function LawyerCardGrid({ lawyer, C, onBook, onProfile, isFav, onToggleFav }: any) {
  const serif = { fontFamily: 'Cairo-Bold' };

  return (
    <View style={{
      flex: 1, backgroundColor: C.card,
      borderWidth: 1, borderColor: C.border,
      borderRadius: 16, padding: 12,
      marginHorizontal: 6, marginBottom: 12, overflow: 'hidden', alignItems: 'center'
    }}>
      <View style={{ position:'absolute', top:0, left:0, right:0, height:60, backgroundColor: C.gold, opacity:0.05 }} pointerEvents="none" />

      {/* Header row: Save (left) | Flag (right) */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%', marginBottom: 8 }}>
        <TouchableOpacity onPress={() => onToggleFav?.(lawyer.id)} style={{ padding: 4 }}>
          <Text style={{ fontSize: 18 }}>{isFav ? '❤️' : '🤍'}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => Alert.alert('Reported', 'Lawyer has been flagged for review.')}
          style={{ padding: 4 }}>
          <Text style={{ fontSize: 16 }}>🚩</Text>
        </TouchableOpacity>
      </View>

      {/* Avatar — tappable to open profile */}
      <TouchableOpacity
        onPress={() => onProfile?.(lawyer)}
        activeOpacity={0.7}
        style={{ position: 'relative', marginBottom: 10 }}
      >
        <CachedAvatar C={C} uri={lawyer.avatar_url} initials={(lawyer.name||'').split(' ').map((w:string)=>w[0]).join('').slice(0,2).toUpperCase()} size={64} />
        {lawyer.is_online && (
          <View style={{ position:'absolute', bottom:0, right:0, width:14, height:14, borderRadius:7, backgroundColor:C.green, borderWidth:2, borderColor:C.card }} />
        )}
      </TouchableOpacity>

      {/* Info */}
      <Text style={{ color:C.text, fontWeight:'700', fontSize:13, textAlign: 'center', marginBottom: 2 }} numberOfLines={1}>
        {lawyer.name} {lawyer.is_verified && <Text style={{ color:C.green, fontSize:11 }}>✅</Text>}
      </Text>
      <Text style={{ color:C.muted, fontSize:11, textAlign: 'center', marginBottom: 6 }} numberOfLines={1}>
        {lawyer.specialization} • {lawyer.city}
      </Text>

      <View style={{ marginBottom: 6 }}>
        <Stars rating={parseFloat(String(lawyer.avg_rating))||0} C={C} size={12} />
      </View>

      <Text style={{ ...serif, color:C.gold, fontWeight:'900', fontSize:18, marginBottom: 10 }}>
        {lawyer.consultation_fee} <Text style={{ fontSize: 10, color: C.muted }}>EGP/15m</Text>
      </Text>

      {/* Action buttons */}
      <View style={{ width: '100%', gap: 6 }}>
        <Btn C={C} onPress={()=>onBook?.(lawyer)} size="sm">{'📅 Book / حجز'}</Btn>
        <Btn C={C} variant="ghost" size="sm" onPress={()=>onProfile?.(lawyer)}>View</Btn>
      </View>
    </View>
  );
}, (prev, next) => {
  return prev.lawyer.id === next.lawyer.id &&
         prev.lawyer.avg_rating === next.lawyer.avg_rating &&
         prev.lawyer.is_online === next.lawyer.is_online &&
         prev.isFav === next.isFav &&
         prev.C === next.C;
});

// Wide List LawyerCard
const LawyerCardList = memo(function LawyerCardList({ lawyer, C, onBook, onProfile, isFav, onToggleFav }: any) {
  const serif = { fontFamily: 'Cairo-Bold' };

  return (
    <View style={{
      backgroundColor: C.card,
      borderWidth: 1, borderColor: C.border,
      borderRadius: 16, padding: 16,
      marginBottom: 18, marginHorizontal: 16,
      overflow: 'hidden',
    }}>
      <View style={{ position:'absolute', top:0, right:0, width:80, height:80, backgroundColor: C.gold, opacity:0.05, borderTopRightRadius:16 }} pointerEvents="none" />

      {/* Header row: Save (left) | Flag (right) */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <TouchableOpacity
          onPress={() => onToggleFav?.(lawyer.id)}
          style={{ padding: 4, backgroundColor: C.surface, borderRadius: 20 }}>
          <Text style={{ fontSize: 18 }}>{isFav ? '❤️' : '🤍'}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => Alert.alert('Reported', 'Lawyer has been flagged for review.')}
          style={{ padding: 4, backgroundColor: C.surface, borderRadius: 20 }}>
          <Text style={{ fontSize: 16 }}>🚩</Text>
        </TouchableOpacity>
      </View>

      {/* Main content row: Avatar | Info | Price */}
      <View style={{ flexDirection:'row', gap:12, marginBottom:12 }}>
        <TouchableOpacity onPress={() => onProfile?.(lawyer)} activeOpacity={0.7} style={{ position: 'relative' }}>
          <CachedAvatar C={C} uri={lawyer.avatar_url} initials={(lawyer.name||'').split(' ').map((w:string)=>w[0]).join('').slice(0,2).toUpperCase()} size={54} />
          {lawyer.is_online && (
            <View style={{ position:'absolute', bottom:0, right:0, width:14, height:14, borderRadius:7, backgroundColor:C.green, borderWidth:2, borderColor:C.card }} />
          )}
        </TouchableOpacity>
        <View style={{ flex:1 }}>
          <View style={{ flexDirection:'row', alignItems:'center', gap:6, flexWrap:'wrap', marginBottom:2 }}>
            <Text style={{ color:C.text, fontWeight:'700', fontSize:15 }} numberOfLines={1}>{lawyer.name}</Text>
            {lawyer.is_verified && <Text style={{ color:C.green, fontSize:11, fontWeight:'700' }}>✅</Text>}
          </View>
          <Text style={{ color:C.muted, fontSize:12, marginBottom: lawyer.office ? 2 : 4 }}>
            {lawyer.specialization} • {lawyer.city}
          </Text>
          {lawyer.office && (
            <Text style={{ color:C.muted, fontSize:11, marginBottom: 4 }} numberOfLines={1}>
              📍 {lawyer.office}
            </Text>
          )}
        </View>
        <View style={{ alignItems:'flex-end', flexShrink:0 }}>
          <Text style={{ ...serif, color:C.gold, fontWeight:'900', fontSize:20 }}>
            {lawyer.consultation_fee}
          </Text>
          <Text style={{ color:C.muted, fontSize:10 }}>EGP/15m</Text>
        </View>
      </View>

      <View style={{ marginBottom:8 }}>
        <Stars rating={parseFloat(String(lawyer.avg_rating))||0} C={C} />
      </View>

      <WinBar wins={(lawyer as any).wins||0} losses={(lawyer as any).losses||0} C={C} />

      <Text style={{ color:C.muted, fontSize:12, marginBottom:12, marginTop: 10 }}>
        📅 {lawyer.experience_years}yr exp {lawyer.badge ? `• ${lawyer.badge}` : ''}
      </Text>

      {/* Action buttons */}
      <View style={{ flexDirection:'row', gap:6 }}>
        <Btn C={C} onPress={()=>onBook?.(lawyer)} size="sm" style={{ flex:1 }}>
          {'📅 Book / حجز'}
        </Btn>
        <Btn C={C} variant="ghost" size="sm" style={{ flex:1 }} onPress={()=>onProfile?.(lawyer)}>
          👤 View
        </Btn>
      </View>
    </View>
  );
}, (prev, next) => {
  return prev.lawyer.id === next.lawyer.id &&
         prev.lawyer.avg_rating === next.lawyer.avg_rating &&
         prev.lawyer.is_online === next.lawyer.is_online &&
         prev.isFav === next.isFav &&
         prev.C === next.C;
});

export default function LawyersTab() {
  const C        = useTheme();
  const dispatch = useDispatch<AppDispatch>();
  const params   = useLocalSearchParams<{ cat?: string; specialization?: string; search?: string; city?: string; sort?: string }>();
  const lawyers  = useSelector(selLawyers) as LawyerProfile[];
  const loading  = useSelector(selLawyersLoad);
  const total    = useSelector(selLawyersTotal);
  const insets   = useSafeAreaInsets();
  const isLoggedIn = useSelector(selLoggedIn);
  const currentUser = useSelector(selUser);
  const { isRTL } = useI18n();
  const [favorites, setFavorites] = useState<number[]>([]);

  // Memoize onToggleFav to avoid re-rendering LawyerCard grid/list pointlessly
  const handleToggleFav = useCallback(async (id: number) => {
    if (!isLoggedIn) { router.push('/(auth)/login'); return; }
    try {
      const d: any = await favoritesAPI.toggle(id);
      if (d.saved) {
        setFavorites(f => [...f, id]);
        Alert.alert(isRTL ? 'تم حفظ المحامي' : 'Saved', isRTL ? 'تمت الإضافة للمفضلة بنجاح' : 'Added to favourites');
      } else {
        setFavorites(f => f.filter(x => x !== id));
        Alert.alert(isRTL ? 'تم إزالة المحامي' : 'Removed', isRTL ? 'تم الإزالة من المفضلة' : 'Removed from favourites');
      }
    } catch {
      setFavorites(f => f.includes(id) ? f.filter(x => x !== id) : [...f, id]);
    }
  }, [isLoggedIn, isRTL]);
  const [search,   setSearch]   = useState(params.search || '');
  const [category, setCategory] = useState(params.specialization || params.cat || '');
  const [city, setCity]       = useState(params.city || '');
  const [sort, setSort]       = useState(params.sort || 'rating');
  const [showCityDropdown, setShowCityDropdown] = useState(false);
  const [citySelectModalVisible, setCitySelectModalVisible] = useState(false);

  // Sync incoming search params from other screens dynamically (e.g. AI Matcher)
  useEffect(() => {
    if (params.specialization || params.cat) {
      setCategory(params.specialization || params.cat || '');
    }
    if (params.city !== undefined) {
      setCity(params.city || '');
    }
    if (params.sort) {
      setSort(params.sort);
    }
  }, [params.cat, params.specialization, params.city, params.sort]);
  const [showSort, setShowSort] = useState(false);
  const [isGrid, setIsGrid]   = useState(true);
  const [page, setPage]       = useState(1);
  const [error, setError]     = useState('');
  const timer = useRef<any>(null);

  const load = useCallback(async (opts: any = {}, reset = false) => {
    setError('');
    try {
      await dispatch(fetchLawyers({
        search:   (opts.search   ?? search)   || undefined,
        cat:      (opts.category ?? category) || undefined,
        city:     (opts.city     ?? city)     || undefined,
        sort:     opts.sort     ?? sort,
        page:     reset ? 1 : (opts.page ?? page),
        limit:    20,
      })).unwrap();
      if (reset) setPage(1);
    } catch (e: any) { setError(e?.message || 'Failed to load lawyers'); }
  }, [dispatch, search, category, sort, page, city]);

  useEffect(() => { load({}, true); }, [category, city, sort]);

  const onSearchChange = (text: string) => {
    setSearch(text);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => load({ search: text }, true), 500);
  };

  const onEndReached = () => {
    if (lawyers.length < total && !loading) {
      const next = page + 1; setPage(next); load({ page: next });
    }
  };

  const serif = { fontFamily: 'Cairo-Bold' };

  return (
    <View style={{ flex:1, backgroundColor:C.bg }}>
      {/* Header */}
      <View style={{ backgroundColor:C.surface, paddingTop:10, paddingHorizontal:16, paddingBottom:10, borderBottomWidth:1, borderBottomColor:C.border }}>
        <View style={{ flexDirection:'row', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
          <Text style={{ ...serif, color:C.text, fontWeight:'700', fontSize:22 }}>
            {isRTL ? 'ابحث عن محاميك' : 'Find Your Lawyer'}
          </Text>
          <View style={{ flexDirection:'row', alignItems:'center', gap: 8 }}>
            <TouchableOpacity onPress={()=>setIsGrid(!isGrid)} style={{ padding: 6 }}>
              <Text style={{ fontSize: 18 }}>{isGrid ? '📋' : '🔲'}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={()=>setShowSort(!showSort)}
              style={{ flexDirection:'row', alignItems:'center', gap:4, backgroundColor:C.card, borderWidth:1, borderColor:C.border, borderRadius:8, paddingHorizontal:10, paddingVertical:6 }}>
              <Text style={{ color:C.text, fontSize:12 }}>
                {SORT_OPTS.find(s=>s[0]===sort)?.[isRTL ? 1 : 2] || (isRTL ? 'ترتيب' : 'Sort')} ▾
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Sort dropdown */}
        {showSort && (
          <View style={{ backgroundColor:C.card, borderWidth:1, borderColor:C.border, borderRadius:10, marginBottom:8, overflow:'hidden' }}>
            {SORT_OPTS.map(([val, arLabel, enLabel]) => (
              <TouchableOpacity key={val} onPress={()=>{ setSort(val); setShowSort(false); }}
                style={{ padding:12, borderBottomWidth:1, borderBottomColor:C.border, flexDirection:'row', justifyContent:'space-between' }}>
                <Text style={{ color:C.text, fontSize:13 }}>{isRTL ? arLabel : enLabel}</Text>
                {sort===val && <Text style={{ color:C.gold }}>✓</Text>}
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Search */}
        <View style={{ flexDirection:'row', backgroundColor:C.card2, borderWidth:1, borderColor:C.border, borderRadius:12, paddingHorizontal:12, paddingVertical:10, alignItems:'center', gap:8, marginBottom:10 }}>
          <Text style={{ fontSize:16 }}>🔍</Text>
          <TextInput value={search} onChangeText={onSearchChange}
            placeholder={isRTL ? 'ابحث بالاسم أو التخصص...' : 'Search by name or specialty...'}
            placeholderTextColor={C.muted}
            style={{ flex:1, color:C.text, fontSize:14 }} />
          {search.length > 0 && (
            <TouchableOpacity onPress={()=>{ setSearch(''); load({ search:'' }, true); }}>
              <Text style={{ color:C.muted, fontSize:18 }}>×</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Category chips */}
        <FlatList horizontal data={isRTL ? CATEGORIES_AR : CATEGORIES_EN} keyExtractor={i=>i||'all'}
          showsHorizontalScrollIndicator={true}
          contentContainerStyle={{ gap:8, marginBottom:8 }}
          renderItem={({ item, index }) => {
            const apiValue = CATEGORIES_AR[index]; // always send Arabic to backend
            const active = category === apiValue;
            return (
              <TouchableOpacity onPress={()=>setCategory(active ? '' : apiValue)}
                style={{ paddingHorizontal:14, paddingVertical:7, borderRadius:20, borderWidth:1, borderColor:active?C.gold:C.border, backgroundColor:active?`${C.gold}15`:'transparent' }}>
                <Text style={{ color:active?C.gold:C.text, fontSize:12, fontWeight:active?'700':'400' }}>
                  {item || (isRTL ? 'الكل' : 'All')}
                </Text>
              </TouchableOpacity>
            );
          }}
        />

        {/* City Selection Collapsible Trigger Button */}
        <TouchableOpacity
          onPress={() => setCitySelectModalVisible(true)}
          style={{
            flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
            backgroundColor: C.card, borderWidth: 1, borderColor: C.border,
            borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10,
            marginBottom: 10,
          }}
        >
          <Text style={{ color: C.text, fontSize: 13, fontWeight: '600' }}>
            📍 {city === '' ? (isRTL ? 'كل المدن' : 'All Cities') : (
              isRTL ? CITY_TRANSLATIONS[city] : city
            )}
          </Text>
          <Text style={{ color: C.muted, fontSize: 10 }}>▼</Text>
        </TouchableOpacity>

        {/* City Search Modal Overlay */}
        <CitySelectModal
          visible={citySelectModalVisible}
          onClose={() => setCitySelectModalVisible(false)}
          selectedCity={city}
          onSelect={(selected) => {
            setCity(selected);
          }}
          isRTL={isRTL}
          C={C}
        />
      </View>

      {error ? <View style={{ paddingHorizontal:16, paddingTop:8 }}><ErrMsg C={C} msg={error} /></View> : null}

      {/* List */}
      <View style={{ flex: 1 }}>
        <FlashList
          data={lawyers.filter((l: any) => l.id !== currentUser?.id)}
          key={isGrid ? 'g' : 'l'}
          keyExtractor={item => String(item.id)}
          numColumns={isGrid ? 2 : 1}
          renderItem={({ item }) => {
            const CardComponent = isGrid ? LawyerCardGrid : LawyerCardList;
            return (
              <CardComponent
                lawyer={item} C={C}
                onBook={(l: any) => router.push({ pathname:'/book', params:{ lawyer:l.id } } as any)}
                onProfile={(l: any) => router.push(`/lawyer/${l.id}` as any)}
                isFav={favorites.includes(Number(item.id))}
                onToggleFav={handleToggleFav}
              />
            );
          }}
          contentContainerStyle={{ paddingTop:14, paddingBottom:100, paddingHorizontal: isGrid ? 10 : 0 }}
          onEndReached={onEndReached}
          onEndReachedThreshold={0.4}
          refreshControl={<RefreshControl refreshing={loading && page===1} onRefresh={()=>load({},true)} tintColor={C.gold} />}
          ListHeaderComponent={total > 0 ? (
            <Text style={{ color:C.muted, fontSize:12, paddingHorizontal:16, marginBottom:4 }}>
              Showing {lawyers.length} of {total.toLocaleString()} lawyers
            </Text>
          ) : null}
          ListFooterComponent={loading && page > 1 ? <ActivityIndicator color={C.gold} style={{ padding:20 }} /> : null}
          ListEmptyComponent={
            !loading
              ? <Empty C={C} icon="🔍" title={isRTL ? 'لا توجد نتائج' : 'No results'} subtitle={isRTL ? 'جرب بحثاً مختلفاً' : 'Try a different search or category'} action={{ label: isRTL ? 'عرض كل المحامين' : 'View All Lawyers', onPress:()=>{ setSearch(''); setCategory(''); setCity(''); load({search:'',category:'',city:''},true); }}} />
              : <View style={{ padding:40, alignItems:'center' }}><Spinner C={C} size="large" /></View>
          }
        />
      </View>
    </View>
  );
}

// ─── Searchable City Overlay Modal (UX Best Practice) ──────────────────────────
interface CitySelectModalProps {
  visible: boolean;
  onClose: () => void;
  selectedCity: string;
  onSelect: (city: string) => void;
  isRTL: boolean;
  C: any;
}

function CitySelectModal({ visible, onClose, selectedCity, onSelect, isRTL, C }: CitySelectModalProps) {
  const [search, setSearch] = useState('');
  
  const filteredCities = ['', 'Cairo', 'Giza', 'Alexandria', 'Qalyubia', 'Gharbia', 'Monufia', 'Dakahlia', 'Sharqia', 'Beheira', 'Damietta', 'Port Said', 'Ismailia', 'Suez', 'Kafr El Sheikh', 'Faiyum', 'Beni Suef', 'Minya', 'Asyut', 'Sohag', 'Qena', 'Luxor', 'Aswan', 'Red Sea', 'New Valley', 'Matrouh', 'North Sinai', 'South Sinai'].filter(city => {
    if (!city) return true; // "All Cities" option
    const ar = CITY_TRANSLATIONS[city] || '';
    const en = city;
    const term = search.toLowerCase();
    return en.toLowerCase().includes(term) || ar.toLowerCase().includes(term);
  });

  return (
    <Modal visible={visible} animationType="fade" transparent={true} onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
        <View style={{ width: '100%', maxHeight: '70%', backgroundColor: C.card, borderRadius: 20, borderWidth: 1, borderColor: C.border, padding: 20, overflow: 'hidden' }}>
          {/* Header */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <Text style={{ color: C.text, fontSize: 16, fontWeight: 'bold', fontFamily: 'Cairo-Bold' }}>
              {isRTL ? 'اختر المنطقة أو المحافظة' : 'Select Region or City'}
            </Text>
            <TouchableOpacity onPress={onClose} style={{ padding: 4 }}>
              <Text style={{ color: C.muted, fontSize: 16, fontWeight: 'bold' }}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Search Input */}
          <View style={{ flexDirection: 'row', backgroundColor: C.card2, borderWidth: 1, borderColor: C.border, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <Text style={{ fontSize: 14 }}>🔍</Text>
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder={isRTL ? 'ابحث عن محافظة...' : 'Search for a city...'}
              placeholderTextColor={C.muted}
              style={{ flex: 1, color: C.text, fontSize: 13, padding: 0 }}
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => setSearch('')}>
                <Text style={{ color: C.muted, fontSize: 16 }}>×</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* List of Cities */}
          <FlatList
            data={filteredCities}
            keyExtractor={item => item || 'all'}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <TouchableOpacity
                onPress={() => {
                  onSelect(item);
                  setSearch('');
                  onClose();
                }}
                style={{
                  flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
                  paddingVertical: 12, paddingHorizontal: 12,
                  borderBottomWidth: 1, borderBottomColor: C.border,
                  backgroundColor: selectedCity === item ? `${C.gold}15` : 'transparent',
                }}
              >
                <Text style={{ color: selectedCity === item ? C.gold : C.text, fontSize: 13, fontWeight: selectedCity === item ? 'bold' : 'normal' }}>
                  {item === '' ? (isRTL ? '📍 كل المدن' : '📍 All Cities') : (
                    isRTL ? CITY_TRANSLATIONS[item] : item
                  )}
                </Text>
                {selectedCity === item && <Text style={{ color: C.gold, fontSize: 12 }}>✓</Text>}
              </TouchableOpacity>
            )}
          />
        </View>
      </View>
    </Modal>
  );
}
