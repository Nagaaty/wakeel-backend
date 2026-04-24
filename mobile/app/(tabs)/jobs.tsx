import React, { useEffect, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  TextInput, RefreshControl, Alert, ScrollView,
} from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '../../src/hooks/useTheme';
import { Badge, Spinner, Empty, Btn, Card } from '../../src/components/ui';
import { jobsAPI } from '../../src/services/api';
import { useAuth } from '../../src/hooks/useAuth';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useI18n } from '../../src/i18n';

const TYPE_COLORS: Record<string, string> = {
  'Full-time':  '#22C55E',
  'Internship': '#3B82F6',
  'Freelance':  '#F59E0B',
  'Part-time':  '#8B5CF6',
};

export default function JobsTab() {
  const C        = useTheme();
  const { isLoggedIn } = useAuth();
  const insets   = useSafeAreaInsets();

  const [jobs,     setJobs]     = useState<any[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState('');
  const [search,   setSearch]   = useState('');
  const [typeFilter, setType]   = useState('');
  const [selected, setSelected] = useState<any>(null);
  const [applied,  setApplied]  = useState<number[]>([]);
  const [applying, setApplying] = useState<number | null>(null);

  const load = (params?: any) => {
    setLoading(true);
    setError('');
    jobsAPI.list(params)
      .then((d: any) => setJobs(d.jobs || []))
      .catch((e: any) => setError(e?.message || 'تعذر تحميل الوظائف'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const applyToJob = async (jobId: number) => {
    if (!isLoggedIn) { router.push('/(auth)/login'); return; }
    setApplying(jobId);
    try {
      await jobsAPI.apply(jobId, {});
      setApplied(p => [...p, jobId]);
      Alert.alert('✅', 'تم إرسال طلبك بنجاح!');
    } catch (e: any) {
      Alert.alert('خطأ', e?.message || 'تعذر إرسال الطلب');
    } finally { setApplying(null); }
  };

  const types = [...new Set(jobs.map((j: any) => j.type))];
  const filtered = jobs.filter(j =>
    (!typeFilter || j.type === typeFilter) &&
    (!search || j.title.toLowerCase().includes(search.toLowerCase()) ||
               j.company.toLowerCase().includes(search.toLowerCase()))
  );

  // Job detail view
  if (selected) return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={{ backgroundColor: C.surface, paddingTop: insets.top + 12, paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: C.border }}>
        <TouchableOpacity onPress={() => setSelected(null)} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={{ color: C.text, fontSize: 22 }}>‹</Text>
          <Text style={{ color: C.text, fontWeight: '700', fontSize: 16, flex: 1 }} numberOfLines={1}>{selected.title}</Text>
        </TouchableOpacity>
      </View>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 120 }}>
        <Card C={C} style={{ marginBottom: 12 }}>
          <Text style={{ color: C.gold, fontWeight: '800', fontSize: 18, marginBottom: 4 }}>{selected.company}</Text>
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
            <Badge C={C} color={TYPE_COLORS[selected.type] || C.gold}>{selected.type}</Badge>
            {selected.urgent && <Badge C={C} color={C.red}>🔴 عاجل</Badge>}
          </View>
          {[
            ['📍 الموقع',   selected.location],
            ['💰 الراتب',   `${selected.salary_min?.toLocaleString()} – ${selected.salary_max?.toLocaleString()} جنيه`],
            ['📋 نوع العقد', selected.type],
          ].map(([k, v]) => (
            <View key={k as string} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: C.border }}>
              <Text style={{ color: C.muted, fontSize: 13 }}>{k as string}</Text>
              <Text style={{ color: C.text, fontWeight: '600', fontSize: 13 }}>{v as string}</Text>
            </View>
          ))}
        </Card>

        {selected.description && (
          <Card C={C} style={{ marginBottom: 12 }}>
            <Text style={{ color: C.text, fontWeight: '700', fontSize: 14, marginBottom: 8 }}>📝 الوصف</Text>
            <Text style={{ color: C.muted, fontSize: 14, lineHeight: 22 }}>{selected.description}</Text>
          </Card>
        )}

        {(selected.requirements?.length > 0) && (
          <Card C={C} style={{ marginBottom: 16 }}>
            <Text style={{ color: C.text, fontWeight: '700', fontSize: 14, marginBottom: 8 }}>✅ المتطلبات</Text>
            {(typeof selected.requirements === 'string'
              ? JSON.parse(selected.requirements)
              : selected.requirements
            ).map((r: string, i: number) => (
              <View key={i} style={{ flexDirection: 'row', gap: 8, paddingVertical: 5 }}>
                <Text style={{ color: C.gold }}>•</Text>
                <Text style={{ color: C.muted, fontSize: 13 }}>{r}</Text>
              </View>
            ))}
          </Card>
        )}
      </ScrollView>

      {/* Apply button */}
      <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: C.surface, borderTopWidth: 1, borderTopColor: C.border, padding: 16, paddingBottom: insets.bottom + 16 }}>
        {applied.includes(selected.id)
          ? <View style={{ backgroundColor: C.green + '15', borderWidth: 1, borderColor: C.green, borderRadius: 12, padding: 14, alignItems: 'center' }}>
              <Text style={{ color: C.green, fontWeight: '700', fontSize: 14 }}>✅ تم إرسال طلبك!</Text>
            </View>
          : <Btn C={C} full size="lg" disabled={applying === selected.id} onPress={() => applyToJob(selected.id)}>
              {applying === selected.id ? '⏳ جاري الإرسال...' : '📨 تقدم للوظيفة'}
            </Btn>
        }
      </View>
    </View>
  );

  // Jobs list view
  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      {/* Header */}
      <View style={{ backgroundColor: C.surface, paddingTop: insets.top + 12, paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: C.border }}>
        <Text style={{ color: C.text, fontWeight: '700', fontSize: 20, fontFamily: 'Cairo-Bold', marginBottom: 10 }}>💼 وظائف قانونية</Text>

        {/* Search */}
        <View style={{ flexDirection: 'row', backgroundColor: C.card2, borderWidth: 1, borderColor: C.border, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <Text>🔍</Text>
          <TextInput
            value={search}
            onChangeText={setSearch}
            onSubmitEditing={() => load({ search, type: typeFilter || undefined })}
            placeholder="ابحث بالمسمى أو الشركة..."
            placeholderTextColor={C.muted}
            style={{ flex: 1, color: C.text, fontSize: 14 }}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => { setSearch(''); load({ type: typeFilter || undefined }); }}>
              <Text style={{ color: C.muted, fontSize: 18 }}>×</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Type filter */}
        <FlatList
          keyboardShouldPersistTaps="handled"
        horizontal
          data={[['', 'الكل'], ...types.map(t => [t, t])] as [string, string][]}
          keyExtractor={item => item[0]}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8 }}
          renderItem={({ item: [val, lb] }) => (
            <TouchableOpacity onPress={() => { setType(val); load({ search: search || undefined, type: val || undefined }); }}
              style={{ paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1, borderColor: typeFilter === val ? C.gold : C.border, backgroundColor: typeFilter === val ? C.gold : 'transparent' }}>
              <Text style={{ color: typeFilter === val ? '#fff' : C.text, fontSize: 12, fontWeight: typeFilter === val ? '700' : '400' }}>{lb}</Text>
            </TouchableOpacity>
          )}
        />
      </View>

      {/* Error state */}
      {error && (
        <View style={{ backgroundColor: C.red + '12', borderBottomWidth: 1, borderBottomColor: C.red + '30', padding: 12, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={{ color: C.red, fontSize: 13, flex: 1 }}>⚠️ {error}</Text>
          <TouchableOpacity onPress={() => load()}>
            <Text style={{ color: C.red, fontWeight: '700', fontSize: 12 }}>إعادة</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Jobs list */}
      <FlatList
       keyboardShouldPersistTaps="handled"
        data={filtered}
        keyExtractor={item => String(item.id)}
        contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => load()} tintColor={C.gold} />}
        ListEmptyComponent={
          !loading
            ? <Empty C={C} icon="💼" title="لا توجد وظائف" subtitle="جرب مصطلح بحث مختلف" />
            : <View style={{ padding: 40, alignItems: 'center' }}><Spinner C={C} /></View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity onPress={() => setSelected(item)}
            style={{ backgroundColor: C.card, borderWidth: 1, borderColor: item.urgent ? C.red + '60' : C.border, borderRadius: 16, padding: 14, marginBottom: 12 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
              <View style={{ flex: 1, marginRight: 10 }}>
                <Text style={{ color: C.text, fontWeight: '700', fontSize: 14, marginBottom: 2 }}>{item.title}</Text>
                <Text style={{ color: C.gold, fontSize: 13, fontWeight: '600' }}>{item.company}</Text>
              </View>
              <Badge C={C} color={TYPE_COLORS[item.type] || C.gold}>{item.type}</Badge>
            </View>
            <View style={{ flexDirection: 'row', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
              <Text style={{ color: C.muted, fontSize: 12 }}>📍 {item.location}</Text>
              <Text style={{ color: C.muted, fontSize: 12 }}>
                💰 {item.salary_min?.toLocaleString()} – {item.salary_max?.toLocaleString()} ج
              </Text>
              {item.urgent && <Text style={{ color: C.red, fontWeight: '700', fontSize: 12 }}>🔴 عاجل</Text>}
            </View>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}
