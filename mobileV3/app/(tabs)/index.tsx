import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, FlatList, Modal } from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '../../src/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useI18n, LangToggle } from '../../src/i18n';
import { lawyersAPI } from '../../src/services/api';
import { Spinner, Avatar, Stars } from '../../src/components/ui';

// Hardcoded typical categories for beautiful display like the HTML
const HOME_CATS = [
  { id: 1, icon: '👨‍👩‍👧', name: 'الأحوال الشخصية', desc: 'طلاق، نفقة، حضانة، ميراث' },
  { id: 2, icon: '🏢', name: 'الشركات والتجارة', desc: 'تأسيس شركات، عقود تجارية' },
  { id: 3, icon: '🏠', name: 'قانون العقارات', desc: 'بيع وإيجار، تسجيل الشهر العقاري' },
  { id: 4, icon: '⚖️', name: 'القانون الجنائي', desc: 'قضايا جنائية، جنح، كفالات' },
  { id: 5, icon: '💼', name: 'قانون العمل', desc: 'عقود عمل، تعويضات، إنهاء خدمة' },
];

export default function HomeTab() {
  const C = useTheme();
  const { isRTL, t } = useI18n();
  const insets = useSafeAreaInsets();
  
  const [search, setSearch] = useState('');
  const [topLawyers, setTopLawyers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Attempt to fetch top rated lawyers for the horizontal list
    lawyersAPI.list({ sort: 'rating', limit: 5 })
      .then((d: any) => setTopLawyers(Array.isArray(d) ? d.slice(0, 5) : (d?.lawyers || d?.data || []).slice(0, 5)))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: '#FDFBF7' }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>

        {/* Hero Section */}
        <View style={{ alignItems: 'center', paddingHorizontal: 20, marginBottom: 40 }}>
          <View style={{ backgroundColor: '#FDF7E8', borderWidth: 1, borderColor: '#F2DAB3', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 6, marginBottom: 24 }}>
            <Text style={{ color: C.gold, fontWeight: '700', fontSize: 13 }}>🇪🇬 أذكى منصة قانونية في مصر</Text>
          </View>

          <Text style={{ fontFamily: 'Cairo', fontSize: 36, fontWeight: '800', color: '#1C1611', textAlign: 'center', lineHeight: 50 }}>
            العدالة تستحق{'\n'}
            <Text style={{ color: C.gold }}>أفضل محامٍ</Text>
          </Text>

          <Text style={{ color: '#6B5E4E', fontSize: 16, textAlign: 'center', lineHeight: 26, marginTop: 16, marginBottom: 32 }}>
            المنصة الوحيدة في مصر حيث كل محامٍ موثق بالبطاقة الوطنية. احجز استشارة 15 دقيقة بدءاً من 450 جنيه.
          </Text>

          {/* Search Card */}
          <View style={{ backgroundColor: '#F4F0E6', borderWidth: 1, borderColor: '#EADDCB', borderRadius: 20, width: '100%', padding: 20, marginBottom: 24 }}>
            <Text style={{ color: '#6B5E4E', fontSize: 16, marginBottom: 16, textAlign: isRTL ? 'right' : 'left' }}>
              ابحث بالاسم أو التخصص...
            </Text>
            <View style={{ backgroundColor: '#EADDCB', borderRadius: 12, paddingVertical: 14, paddingHorizontal: 16, marginBottom: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ color: '#6B5E4E', fontSize: 16 }}>⌄</Text>
              <Text style={{ color: '#6B5E4E', fontSize: 16, fontWeight: '700' }}>كل التخصصات</Text>
            </View>
            <TouchableOpacity onPress={() => router.push({ pathname: '/lawyers', params: { search } } as any)}
              style={{ backgroundColor: '#9A6F2A', borderRadius: 12, paddingVertical: 16, alignItems: 'center' }}>
              <Text style={{ color: '#1C1611', fontWeight: '800', fontSize: 16 }}>بحث ←</Text>
            </TouchableOpacity>
          </View>

          {/* Big Action Buttons */}
          <TouchableOpacity onPress={() => router.push('/lawyers' as any)}
            style={{ backgroundColor: '#9A6F2A', borderRadius: 16, width: '100%', paddingVertical: 18, alignItems: 'center', marginBottom: 14 }}>
            <Text style={{ color: '#1C1611', fontWeight: '800', fontSize: 18 }}>ابحث عن محاميك ⚖️</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => router.push('/forum' as any)}
            style={{ backgroundColor: '#FDFBF7', borderWidth: 1, borderColor: '#EADDCB', borderRadius: 16, width: '100%', paddingVertical: 18, alignItems: 'center' }}>
            <Text style={{ color: '#6B5E4E', fontWeight: '700', fontSize: 18 }}>اسأل سؤالاً قانونياً مجانياً 🤖</Text>
          </TouchableOpacity>
        </View>

        {/* Categories Horizontal Slider */}
        <View style={{ marginBottom: 40 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginBottom: 16 }}>
            <Text style={{ color: '#1C1611', fontSize: 22, fontWeight: '800', fontFamily: 'Cairo-Bold' }}>تخصصات القانون</Text>
            <TouchableOpacity onPress={() => router.push('/lawyers' as any)}>
              <Text style={{ color: C.gold, fontWeight: '700', fontSize: 14 }}>عرض الكل ←</Text>
            </TouchableOpacity>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 12 }}>
            {HOME_CATS.map(cat => (
              <TouchableOpacity key={cat.id} onPress={() => router.push({ pathname: '/lawyers', params: { search: cat.name } } as any)}
                style={{ width: 150, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#EADDCB', borderRadius: 20, padding: 16 }}>
                <Text style={{ fontSize: 32, marginBottom: 12 }}>{cat.icon}</Text>
                <Text style={{ color: '#1C1611', fontWeight: '800', fontSize: 15, marginBottom: 6 }}>{cat.name}</Text>
                <Text style={{ color: '#6B5E4E', fontSize: 12, lineHeight: 18 }}>{cat.desc}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Top Rated Lawyers Horizontal Slider */}
        <View style={{ marginBottom: 40, backgroundColor: '#FDF7E8', paddingVertical: 40, borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#EADDCB' }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginBottom: 20 }}>
            <Text style={{ color: '#1C1611', fontSize: 22, fontWeight: '800', fontFamily: 'Cairo-Bold' }}>أعلى المحامين تقييماً ⭐</Text>
            <TouchableOpacity onPress={() => router.push('/lawyers' as any)}>
              <Text style={{ color: C.gold, fontWeight: '700', fontSize: 14 }}>بحث ←</Text>
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={{ padding: 40, alignItems: 'center' }}><Spinner C={C} /></View>
          ) : topLawyers.length === 0 ? (
            <Text style={{ textAlign: 'center', color: '#6B5E4E', marginVertical: 20 }}>لا يوجد محامين حاليا.</Text>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 16 }}>
              {topLawyers.map(l => (
                <View key={l.id} style={{ width: 260, backgroundColor: '#FFFFFF', borderRadius: 20, padding: 20, borderWidth: 1, borderColor: '#EADDCB', shadowColor: '#9A6F2A', shadowOpacity: 0.1, shadowOffset: { width: 0, height: 4 }, shadowRadius: 10, elevation: 4 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                    <View style={{ flexDirection: 'row', gap: 12, flex: 1 }}>
                      <Avatar initials={l.name ? l.name.substring(0, 2) : 'UK'} size={48} />
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: '#1C1611', fontWeight: '800', fontSize: 15, marginBottom: 4 }} numberOfLines={1}>{l.name}</Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                          <Stars rating={l.rating || 5} size={14} />
                          <Text style={{ color: C.green, fontSize: 11, fontWeight: '700' }}>✅ موثق</Text>
                        </View>
                      </View>
                    </View>
                  </View>
                  <View style={{ backgroundColor: '#FDFBF7', borderRadius: 12, padding: 12, gap: 6, marginBottom: 16 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <Text style={{ color: '#6B5E4E', fontSize: 12 }}>مدينة</Text>
                      <Text style={{ color: '#1C1611', fontSize: 12, fontWeight: '700' }}>{l.city || 'القاهرة'}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <Text style={{ color: '#6B5E4E', fontSize: 12 }}>سعر الاستشارة</Text>
                      <Text style={{ color: C.gold, fontSize: 13, fontWeight: '800' }}>{l.consultation_fee || 500} ج</Text>
                    </View>
                  </View>
                  <TouchableOpacity onPress={() => router.push({ pathname: '/book', params: { lawyer: l.id }} as any)}
                    style={{ backgroundColor: C.gold, borderRadius: 12, paddingVertical: 12, alignItems: 'center' }}>
                    <Text style={{ color: '#1C1611', fontWeight: '800', fontSize: 14 }}>احجز الآن 📅</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>
          )}
        </View>

        {/* Wakeel Features List */}
        <View style={{ paddingHorizontal: 20, marginBottom: 40 }}>
          <Text style={{ color: '#1C1611', fontSize: 24, fontWeight: '800', fontFamily: 'Cairo', textAlign: 'center', marginBottom: 24 }}>لماذا تختار منصة وكيل؟ 🇪🇬</Text>
          
          <View style={{ gap: 16 }}>
            {[
              { icon: '🪪', title: 'محامون موثقون ١٠٠٪', desc: 'نقوم بمراجعة البطاقة الوطنية وكارنيه النقابة وسجل المحاكم لكل محامٍ.' },
              { icon: '🔒', title: 'سرية تامة وأمان', desc: 'كافة استشاراتك وملفاتك مشفرة ولا يطلع عليها سوى محاميك.' },
              { icon: '💳', title: 'دفع إلكتروني سهل', desc: 'ادفع بأمان عبر بطاقة الائتمان، فودافون كاش، محفظتك، أو إنستاباي.' },
              { icon: '🤖', title: 'تحليل ذكي فوري', desc: 'المنصة تدعمك بالذكاء الاصطناعي لفهم قضيتك قبل حجز أي استشارة.' },
            ].map((ft, i) => (
              <View key={i} style={{ flexDirection: 'row', gap: 16, backgroundColor: '#FFFFFF', padding: 20, borderRadius: 20, borderWidth: 1, borderColor: '#EADDCB', alignItems: 'center' }}>
                <View style={{ width: 56, height: 56, borderRadius: 16, backgroundColor: '#FDF7E8', alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontSize: 28 }}>{ft.icon}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: '#1C1611', fontWeight: '800', fontSize: 16, marginBottom: 4 }}>{ft.title}</Text>
                  <Text style={{ color: '#6B5E4E', fontSize: 13, lineHeight: 20 }}>{ft.desc}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>
        
        {/* Simple Footer spacing */}
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}
