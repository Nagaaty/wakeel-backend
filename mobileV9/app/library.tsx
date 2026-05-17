import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TextInput, ScrollView, TouchableOpacity, LayoutAnimation, ActivityIndicator } from 'react-native';
import { Stack, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../src/theme';
import { useI18n } from '../src/i18n';
import { TopNav } from '../src/components/TopNav';
import { lawsAPI } from '../src/services/api';

export default function LegalLibraryScreen() {
  const insets = useSafeAreaInsets();
  const C = useTheme();
  const { isRTL } = useI18n();
  
  const [search, setSearch] = useState('');
  const [laws, setLaws] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Fetch laws from backend
  const fetchLaws = async (query = '') => {
    setLoading(true);
    try {
      const res = await lawsAPI.search({ search: query, limit: 50 });
      setLaws(res.laws || []);
    } catch (err) {
      console.warn('Error fetching laws:', err);
    } finally {
      setLoading(false);
    }
  };

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchLaws(search);
    }, 400);
    return () => clearTimeout(timer);
  }, [search]);

  const toggleExpand = (id: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedId(expandedId === id ? null : id);
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <Stack.Screen options={{ headerShown: false }} />
      <TopNav />
      
      {/* Header */}
      <View style={{ paddingHorizontal: 20, marginBottom: 16 }}>
        <TouchableOpacity onPress={() => router.back()} style={{ flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', marginBottom: 16 }}>
          <Feather name={isRTL ? "arrow-right" : "arrow-left"} size={24} color={C.text} />
        </TouchableOpacity>
        <Text style={{ fontSize: 28, fontWeight: '800', color: C.text, textAlign: isRTL ? 'right' : 'left' }}>
          {isRTL ? 'المكتبة القانونية' : 'Legal Library'} 📚
        </Text>
        <Text style={{ fontSize: 14, color: C.muted, marginTop: 4, textAlign: isRTL ? 'right' : 'left' }}>
          {isRTL ? 'ابحث عن أرقام ومواد القوانين المصرية.' : 'Search for Egyptian law articles and codes.'}
        </Text>
      </View>

      {/* Search Bar */}
      <View style={{ paddingHorizontal: 20, marginBottom: 16 }}>
        <View style={{
          flexDirection: isRTL ? 'row-reverse' : 'row',
          alignItems: 'center',
          backgroundColor: '#FDFBF7',
          borderRadius: 12,
          paddingHorizontal: 16,
          height: 50,
          borderWidth: 1,
          borderColor: '#E8E1D5',
        }}>
          <Feather name="search" size={20} color={C.muted} />
          <TextInput
            style={{ flex: 1, marginHorizontal: 10, textAlign: isRTL ? 'right' : 'left', color: '#1A1A1A', fontSize: 15 }}
            placeholder={isRTL ? 'ابحث برقم المادة أو اسم القانون...' : 'Search by article number or law...'}
            placeholderTextColor={C.muted}
            value={search}
            onChangeText={setSearch}
          />
          {search ? (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Feather name="x-circle" size={18} color={C.muted} />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {/* List */}
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 40, gap: 12 }}>
        {loading ? (
          <ActivityIndicator size="large" color={C.gold} style={{ marginTop: 40 }} />
        ) : laws.map((item: any) => {
          const isExpanded = expandedId === item.id;
          return (
            <TouchableOpacity
              key={item.id}
              activeOpacity={0.8}
              onPress={() => toggleExpand(item.id)}
              style={{
                backgroundColor: '#fff',
                borderRadius: 14,
                borderWidth: 1,
                borderColor: isExpanded ? C.gold : '#E8E1D5',
                padding: 16,
                shadowColor: isExpanded ? C.gold : 'transparent',
                shadowOpacity: isExpanded ? 0.2 : 0,
                shadowRadius: 8,
                elevation: isExpanded ? 4 : 0,
              }}
            >
              <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: C.gold, fontWeight: '800', fontSize: 18, textAlign: isRTL ? 'right' : 'left', marginBottom: 4 }}>
                    {isRTL ? item.article_number : item.article_number_en}
                  </Text>
                  <Text style={{ color: C.muted, fontWeight: '600', fontSize: 12, textAlign: isRTL ? 'right' : 'left' }}>
                    {isRTL ? item.law_name : item.law_name_en}
                  </Text>
                </View>
                <View style={{ backgroundColor: isExpanded ? C.gold : '#F0EBE0', width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' }}>
                  <Feather name={isExpanded ? 'chevron-up' : 'chevron-down'} size={20} color={isExpanded ? '#fff' : C.gold} />
                </View>
              </View>

              {isExpanded && (
                <View style={{ marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: '#E8E1D5' }}>
                  <Text style={{ color: '#1A1A1A', fontSize: 16, lineHeight: 26, textAlign: isRTL ? 'right' : 'left' }}>
                    {isRTL ? item.content : item.content_en}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}

        {!loading && laws.length === 0 && (
          <View style={{ alignItems: 'center', marginTop: 40 }}>
            <Feather name="search" size={48} color={'#E8E1D5'} />
            <Text style={{ color: C.muted, fontSize: 16, fontWeight: '700', marginTop: 16 }}>
              {isRTL ? 'لم يتم العثور على نتائج' : 'No results found'}
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}
