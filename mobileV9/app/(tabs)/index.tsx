import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, FlatList, Modal, Pressable } from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '../../src/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useI18n, LangToggle } from '../../src/i18n';
import { lawyersAPI } from '../../src/services/api';
import { Spinner, Avatar, Stars } from '../../src/components/ui';

export default function HomeTab() {
  const C = useTheme();
  const { isRTL, t, locale } = useI18n();
  
  // Define arrays inside the component so `t()` can re-evaluate on lang change
  const HOME_CATS = [
    { id: 1, icon: '👨‍👩‍👧', name: t('cat.family'), desc: locale === 'en' ? 'Divorce, alimony, custody, inheritance' : 'طلاق، نفقة، حضانة، ميراث' },
    { id: 2, icon: '🏢', name: t('cat.corporate'), desc: locale === 'en' ? 'Company formation, commercial contracts' : 'تأسيس شركات، عقود تجارية' },
    { id: 3, icon: '🏠', name: t('cat.realestate'), desc: locale === 'en' ? 'Buying & renting, property registration' : 'بيع وإيجار، تسجيل الشهر العقاري' },
    { id: 4, icon: '⚖️', name: t('cat.criminal'), desc: locale === 'en' ? 'Criminal cases, misdemeanors, bail' : 'قضايا جنائية، جنح، كفالات' },
    { id: 5, icon: '💼', name: t('cat.labor'), desc: locale === 'en' ? 'Employment contracts, compensation' : 'عقود عمل، تعويضات، إنهاء خدمة' },
  ];

  const SPECIALIZATIONS = [
    { key: '',               label: t('app.all'),      icon: '⚖️' },
    { key: 'الأحوال الشخصية', label: t('cat.family'), icon: '👨‍👩‍👧' },
    { key: 'الشركات والتجارة', label: t('cat.corporate'), icon: '🏢' },
    { key: 'قانون العقارات',  label: t('cat.realestate'),   icon: '🏠' },
    { key: 'القانون الجنائي', label: t('cat.criminal'),  icon: '🔏' },
    { key: 'قانون العمل',     label: t('cat.labor'),       icon: '💼' },
    { key: 'القانون الإداري', label: locale === 'en' ? 'Administrative' : 'القانون الإداري',  icon: '🏛️' },
    { key: 'الملكية الفكرية', label: t('cat.ip'),  icon: '💡' },
    { key: 'قانون الضرائب',   label: locale === 'en' ? 'Tax Law' : 'قانون الضرائب',    icon: '📊' },
    { key: 'قانون الأسرة',    label: locale === 'en' ? 'Family Law' : 'قانون الأسرة',     icon: '👪' },
    { key: 'القانون البحري',  label: locale === 'en' ? 'Maritime Law' : 'القانون البحري',   icon: '⚓' },
    { key: 'قانون التحكيم',   label: locale === 'en' ? 'Arbitration' : 'قانون التحكيم',    icon: '🤝' },
    { key: 'القانون الدولي',  label: locale === 'en' ? 'International Law' : 'القانون الدولي',   icon: '🌍' },
  ];

  const insets = useSafeAreaInsets();
  
  const [search,       setSearch]       = useState('');
  const [selectedSpec, setSelectedSpec] = useState(SPECIALIZATIONS[0]);
  const [showPicker,   setShowPicker]   = useState(false);
  const [topLawyers,   setTopLawyers]   = useState<any[]>([]);
  const [loading,      setLoading]      = useState(true);

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
            <Text style={{ color: C.gold, fontWeight: '700', fontSize: 13 }}>{t('home.heroBadge')}</Text>
          </View>

          <Text style={{ fontFamily: 'Cairo', fontSize: 36, fontWeight: '800', color: '#1C1611', textAlign: 'center', lineHeight: 50 }}>
            {t('home.heroTitle1')}
            <Text style={{ color: C.gold }}>{t('home.heroTitle2')}</Text>
          </Text>

          <Text style={{ color: '#6B5E4E', fontSize: 16, textAlign: 'center', lineHeight: 26, marginTop: 16, marginBottom: 32 }}>
            {t('home.heroDesc')}
          </Text>

          {/* Search Card */}
          <View style={{ backgroundColor: '#F4F0E6', borderWidth: 1, borderColor: '#EADDCB', borderRadius: 20, width: '100%', padding: 20, marginBottom: 24 }}>
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder={t('home.searchPlaceholder')}
              placeholderTextColor="#6B5E4E"
              style={{ color: '#1C1611', fontSize: 15, marginBottom: 16, textAlign: isRTL ? 'right' : 'left' }}
            />
            {/* Specialization Dropdown */}
            <TouchableOpacity
              onPress={() => setShowPicker(true)}
              style={{ backgroundColor: '#EADDCB', borderRadius: 12, paddingVertical: 14, paddingHorizontal: 16, marginBottom: 16, flexDirection: isRTL ? 'row' : 'row-reverse', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ color: '#6B5E4E', fontSize: 16 }}>⌄</Text>
              <Text style={{ color: '#6B5E4E', fontSize: 15, fontWeight: '700' }}>
                {selectedSpec.icon} {selectedSpec.label}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => router.push({ pathname: '/lawyers', params: { search, specialization: selectedSpec.key } } as any)}
              style={{ backgroundColor: '#9A6F2A', borderRadius: 12, paddingVertical: 16, alignItems: 'center' }}>
              <Text style={{ color: '#1C1611', fontWeight: '800', fontSize: 16 }}>{t('home.searchBtn')}</Text>
            </TouchableOpacity>
          </View>

          {/* Big Action Buttons */}
          <TouchableOpacity onPress={() => router.push('/lawyers' as any)}
            style={{ backgroundColor: '#9A6F2A', borderRadius: 16, width: '100%', paddingVertical: 18, alignItems: 'center', marginBottom: 14 }}>
            <Text style={{ color: '#1C1611', fontWeight: '800', fontSize: 18 }}>{t('home.findLawyerBtn')}</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => router.push('/forum' as any)}
            style={{ backgroundColor: '#FDFBF7', borderWidth: 1, borderColor: '#EADDCB', borderRadius: 16, width: '100%', paddingVertical: 18, alignItems: 'center' }}>
            <Text style={{ color: '#6B5E4E', fontWeight: '700', fontSize: 18 }}>{t('home.askFreeBtn')}</Text>
          </TouchableOpacity>
        </View>

        {/* Categories Horizontal Slider */}
        <View style={{ marginBottom: 40 }}>
          <View style={{ flexDirection: isRTL ? 'row' : 'row-reverse', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginBottom: 16 }}>
            <Text style={{ color: '#1C1611', fontSize: 22, fontWeight: '800', fontFamily: 'Cairo-Bold' }}>{t('home.categoriesTitle')}</Text>
            <TouchableOpacity onPress={() => router.push('/lawyers' as any)}>
              <Text style={{ color: C.gold, fontWeight: '700', fontSize: 14 }}>{t('home.viewAll')}</Text>
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
          <View style={{ flexDirection: isRTL ? 'row' : 'row-reverse', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginBottom: 20 }}>
            <Text style={{ color: '#1C1611', fontSize: 22, fontWeight: '800', fontFamily: 'Cairo-Bold' }}>{t('home.topLawyersTitle')}</Text>
            <TouchableOpacity onPress={() => router.push('/lawyers' as any)}>
              <Text style={{ color: C.gold, fontWeight: '700', fontSize: 14 }}>{t('home.searchBtn')}</Text>
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={{ padding: 40, alignItems: 'center' }}><Spinner C={C} /></View>
          ) : topLawyers.length === 0 ? (
            <Text style={{ textAlign: 'center', color: '#6B5E4E', marginVertical: 20 }}>{t('home.noLawyers')}</Text>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 16 }}>
              {topLawyers.map(l => (
                <View key={l.id} style={{ width: 260, backgroundColor: '#FFFFFF', borderRadius: 20, padding: 20, borderWidth: 1, borderColor: '#EADDCB', shadowColor: '#9A6F2A', shadowOpacity: 0.1, shadowOffset: { width: 0, height: 4 }, shadowRadius: 10, elevation: 4 }}>
                  <View style={{ flexDirection: isRTL ? 'row' : 'row-reverse', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                    <View style={{ flexDirection: isRTL ? 'row' : 'row-reverse', gap: 12, flex: 1 }}>
                      <Avatar initials={l.name ? l.name.substring(0, 2) : 'UK'} size={48} />
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: '#1C1611', fontWeight: '800', fontSize: 15, marginBottom: 4, textAlign: isRTL ? 'left' : 'right' }} numberOfLines={1}>{l.name}</Text>
                        <View style={{ flexDirection: isRTL ? 'row' : 'row-reverse', alignItems: 'center', gap: 4 }}>
                          <Stars rating={l.rating || 5} size={14} />
                          <Text style={{ color: C.green, fontSize: 11, fontWeight: '700' }}>✅ {t('lawyer.verified')}</Text>
                        </View>
                      </View>
                    </View>
                  </View>
                  <View style={{ backgroundColor: '#FDFBF7', borderRadius: 12, padding: 12, gap: 6, marginBottom: 16 }}>
                    <View style={{ flexDirection: isRTL ? 'row' : 'row-reverse', justifyContent: 'space-between' }}>
                      <Text style={{ color: '#6B5E4E', fontSize: 12 }}>{t('lawyer.city')}</Text>
                      <Text style={{ color: '#1C1611', fontSize: 12, fontWeight: '700' }}>{l.city || 'Cairo'}</Text>
                    </View>
                    <View style={{ flexDirection: isRTL ? 'row' : 'row-reverse', justifyContent: 'space-between' }}>
                      <Text style={{ color: '#6B5E4E', fontSize: 12 }}>{t('lawyer.perSession')}</Text>
                      <Text style={{ color: C.gold, fontSize: 13, fontWeight: '800' }}>{l.consultation_fee || 500} {t('app.egp')}</Text>
                    </View>
                  </View>
                  <TouchableOpacity onPress={() => router.push({ pathname: '/book', params: { lawyer: l.id }} as any)}
                    style={{ backgroundColor: C.gold, borderRadius: 12, paddingVertical: 12, alignItems: 'center' }}>
                    <Text style={{ color: '#1C1611', fontWeight: '800', fontSize: 14 }}>{t('home.bookNow')}</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>
          )}
        </View>

        {/* Wakeel Features List */}
        <View style={{ paddingHorizontal: 20, marginBottom: 40 }}>
          <Text style={{ color: '#1C1611', fontSize: 24, fontWeight: '800', fontFamily: 'Cairo', textAlign: 'center', marginBottom: 24 }}>{t('home.whyWakeel')}</Text>
          
          <View style={{ gap: 16 }}>
            {[
              { icon: '🪪', title: t('home.ft1Title'), desc: t('home.ft1Desc') },
              { icon: '🔒', title: t('home.ft2Title'), desc: t('home.ft2Desc') },
              { icon: '💳', title: t('home.ft3Title'), desc: t('home.ft3Desc') },
              { icon: '🤖', title: t('home.ft4Title'), desc: t('home.ft4Desc') },
            ].map((ft, i) => (
              <View key={i} style={{ flexDirection: isRTL ? 'row' : 'row-reverse', gap: 16, backgroundColor: '#FFFFFF', padding: 20, borderRadius: 20, borderWidth: 1, borderColor: '#EADDCB', alignItems: 'center' }}>
                <View style={{ width: 56, height: 56, borderRadius: 16, backgroundColor: '#FDF7E8', alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontSize: 28 }}>{ft.icon}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: '#1C1611', fontWeight: '800', fontSize: 16, marginBottom: 4, textAlign: isRTL ? 'right' : 'left' }}>{ft.title}</Text>
                  <Text style={{ color: '#6B5E4E', fontSize: 13, lineHeight: 20, textAlign: isRTL ? 'right' : 'left' }}>{ft.desc}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>
        
        {/* Simple Footer spacing */}
        <View style={{ height: 40 }} />
      </ScrollView>

      {/* ── Specialization Picker Modal ───────────────────────────── */}
      <Modal visible={showPicker} transparent animationType="slide" onRequestClose={() => setShowPicker(false)}>
        <Pressable style={{ flex: 1, backgroundColor: '#00000066' }} onPress={() => setShowPicker(false)} />
        <View style={{
          backgroundColor: '#FDFBF7',
          borderTopLeftRadius: 28, borderTopRightRadius: 28,
          paddingTop: 12, paddingBottom: 40,
          maxHeight: '75%',
        }}>
          {/* Handle */}
          <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: '#EADDCB', alignSelf: 'center', marginBottom: 16 }} />
          <Text style={{ textAlign: 'center', fontWeight: '800', fontSize: 18, color: '#1C1611', marginBottom: 16 }}>{t('home.selectSpec')}</Text>
          <FlatList
            data={SPECIALIZATIONS}
            keyExtractor={item => item.key}
            renderItem={({ item }) => (
              <TouchableOpacity
                onPress={() => { setSelectedSpec(item); setShowPicker(false); }}
                style={{
                  flexDirection: isRTL ? 'row' : 'row-reverse', alignItems: 'center', gap: 14,
                  paddingHorizontal: 24, paddingVertical: 16,
                  backgroundColor: selectedSpec.key === item.key ? '#FDF7E8' : 'transparent',
                  borderBottomWidth: 1, borderBottomColor: '#EADDCB',
                }}>
                <Text style={{ fontSize: 24 }}>{item.icon}</Text>
                <Text style={{ fontSize: 16, color: '#1C1611', fontWeight: selectedSpec.key === item.key ? '800' : '500', flex: 1, textAlign: isRTL ? 'right' : 'left' }}>
                  {item.label}
                </Text>
                {selectedSpec.key === item.key && <Text style={{ color: '#9A6F2A', fontSize: 18 }}>✓</Text>}
              </TouchableOpacity>
            )}
          />
        </View>
      </Modal>
    </View>
  );
}
