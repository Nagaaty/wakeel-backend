import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { useTheme } from '../../src/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar } from '../../src/components/ui';

export default function MyRequestsTab() {
  const C = useTheme();
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<'active'|'pending'|'completed'>('active');

  const DEMO_CASES = [
    { id: 1, lawyer: 'Dr. Ahmed Hassan', category: 'Criminal Defense', initials: 'AH', status: 'active', step: 3, totalSteps: 5, nextDate: '10-03-2025' },
    { id: 2, lawyer: 'سارة محمود', category: 'قانون الأسرة', initials: 'SM', status: 'active', step: 2, totalSteps: 5, nextDate: '15-03-2025' },
  ];

  const filtered = DEMO_CASES.filter(c => c.status === tab);

  return (
    <View style={{ flex: 1, backgroundColor: '#FDFBF7' }}>
      <View style={{ paddingTop: 20, paddingHorizontal: 20, backgroundColor: '#FFFFFF', paddingBottom: 0 }}>
        {/* Header */}
        <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 8 }}>
            <Text style={{ fontSize: 24, fontWeight: '800', color: '#1C1611', fontFamily: 'Cairo-Bold' }}>طلباتي</Text>
            <Text style={{ fontSize: 24 }}>📋</Text>
          </View>
        </View>
        <Text style={{ textAlign: 'right', color: '#6B5E4E', fontSize: 13, marginBottom: 20 }}>2 قضية في المجموع</Text>

        {/* Tabs */}
        <View style={{ flexDirection: 'row-reverse', borderBottomWidth: 1, borderColor: '#EADDCB' }}>
          {[
            { id: 'active', label: 'نشطة', count: 1 },
            { id: 'pending', label: 'معلقة', count: 0 },
            { id: 'completed', label: 'مكتملة', count: 1 }
          ].map(t => (
            <TouchableOpacity key={t.id} onPress={() => setTab(t.id as any)}
              style={{ flex: 1, paddingVertical: 12, borderBottomWidth: 3, borderColor: tab === t.id ? C.gold : 'transparent', alignItems: 'center', flexDirection: 'row-reverse', justifyContent: 'center', gap: 6 }}>
              <Text style={{ fontSize: 16, fontWeight: tab === t.id ? '800' : '600', color: tab === t.id ? '#1C1611' : '#6B5E4E' }}>{t.label}</Text>
              {t.count > 0 && (
                <View style={{ backgroundColor: '#EADDCB', borderRadius: 10, paddingHorizontal: 6, paddingVertical: 2 }}>
                  <Text style={{ fontSize: 11, color: '#6B5E4E', fontWeight: '700' }}>{t.count}</Text>
                </View>
              )}
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20 }}>
        {filtered.length === 0 ? (
          <Text style={{ textAlign: 'center', color: '#6B5E4E', marginTop: 40, fontSize: 16 }}>لا توجد قضايا هنا</Text>
        ) : (
          filtered.map(c => (
            <View key={c.id} style={{ backgroundColor: '#F4F0E6', borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#EADDCB' }}>
              <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 12 }}>
                  <Avatar C={C} initials={c.initials} size={48} />
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={{ fontSize: 16, fontWeight: '800', color: '#1C1611', marginBottom: 2 }}>{c.lawyer}</Text>
                    <Text style={{ fontSize: 13, color: '#6B5E4E' }}>{c.category}</Text>
                  </View>
                </View>
                <View style={{ backgroundColor: '#D1FAE5', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12 }}>
                  <Text style={{ color: '#059669', fontSize: 12, fontWeight: '700' }}>نشطة</Text>
                </View>
              </View>

              <View style={{ marginBottom: 16 }}>
                <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', marginBottom: 8 }}>
                  <Text style={{ fontSize: 13, color: '#6B5E4E', fontWeight: '700' }}>التقدم</Text>
                  <Text style={{ fontSize: 13, color: '#1C1611', fontWeight: '800' }}>{c.step}/{c.totalSteps} خطوات</Text>
                </View>
                <View style={{ height: 6, backgroundColor: '#EADDCB', borderRadius: 3, flexDirection: 'row-reverse' }}>
                  <View style={{ width: `${(c.step / c.totalSteps) * 100}%`, height: '100%', backgroundColor: '#059669', borderRadius: 3 }} />
                </View>
              </View>

              <View style={{ backgroundColor: '#EADDCB', borderRadius: 12, padding: 12, flexDirection: 'row-reverse', justifyContent: 'center', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                <Text style={{ fontSize: 14 }}>📅</Text>
                <Text style={{ fontSize: 14, color: '#1C1611', fontWeight: '700' }}>الجلسة القادمة: {c.nextDate}</Text>
              </View>

              <TouchableOpacity style={{ alignItems: 'center' }}>
                <Text style={{ color: '#6B5E4E', fontSize: 13, fontWeight: '700' }}>تفاصيل ▾</Text>
              </TouchableOpacity>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}
