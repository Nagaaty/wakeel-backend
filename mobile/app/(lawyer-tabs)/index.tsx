import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, SafeAreaView } from 'react-native';
import { useTheme } from '../../src/theme';
import { Avatar } from '../../src/components/ui';

export default function LawyerDashboardIndex() {
  const C = useTheme();

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
        
        {/* Top Header Row */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <TouchableOpacity style={{ borderColor: C.green, borderWidth: 1, backgroundColor: C.green + '14', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: C.green }} />
            <Text style={{ color: C.green, fontSize: 13, fontWeight: '700' }}>متاح الآن</Text>
          </TouchableOpacity>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={{ color: C.text, fontSize: 16, fontWeight: '700' }}>الأستاذ المحامي</Text>
              <Text style={{ color: C.muted, fontSize: 11, marginTop: 2 }}>الأحد، 29 مارس</Text>
            </View>
            <Avatar C={C} initials="DA" size={46} />
          </View>
        </View>

        {/* 3 Stats Cards */}
        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 24 }}>
          {[
            { val: '1,500 ج', label: 'أرباح اليوم', icon: '💰' },
            { val: '3', label: 'جلسات اليوم', icon: '📅' },
            { val: '2', label: 'طلبات معلقة', icon: '⏳' }
          ].reverse().map((s, i) => (
            <View key={i} style={{ flex: 1, backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 14, padding: 14, alignItems: 'center' }}>
              <Text style={{ fontSize: 22, marginBottom: 8 }}>{s.icon}</Text>
              <Text style={{ color: C.gold, fontSize: 16, fontWeight: '700', fontFamily: 'CormorantGaramond-Bold' }}>{s.val}</Text>
              <Text style={{ color: C.muted, fontSize: 11, marginTop: 4 }}>{s.label}</Text>
            </View>
          ))}
        </View>

        {/* Pending Requests Title */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 8, marginBottom: 14 }}>
          <View style={{ backgroundColor: '#FDE68A', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 }}>
            <Text style={{ color: '#92400E', fontSize: 12, fontWeight: '700' }}>2</Text>
          </View>
          <Text style={{ color: C.text, fontSize: 16, fontWeight: '700' }}>طلبات تحتاج ردك</Text>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: C.gold }} />
        </View>

        {/* Pending Request Cards */}
        {[
          { name: 'Rana Hassan', time: '7 مارس • 11:00 AM', type: 'Drug Offense Appeal', fee: '500' },
          { name: 'Karim Nour', time: '12 مارس • 2:00 PM', type: 'Fraud Investigation', fee: '500' }
        ].map((r, i) => (
          <View key={i} style={{ backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 16, padding: 18, marginBottom: 14 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
              <Text style={{ color: C.gold, fontWeight: '700', fontSize: 15 }}>{r.fee} ج</Text>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={{ color: C.text, fontWeight: '700', fontSize: 16 }}>{r.name}</Text>
                <Text style={{ color: C.muted, fontSize: 13, marginTop: 4 }}>{r.time} • {r.type}</Text>
              </View>
            </View>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TouchableOpacity style={{ flex: 1, backgroundColor: '#FEE2E2', borderRadius: 12, paddingVertical: 14, alignItems: 'center' }}>
                <Text style={{ color: '#DC2626', fontWeight: '700', fontSize: 14 }}>✗ رفض</Text>
              </TouchableOpacity>
              <TouchableOpacity style={{ flex: 1, backgroundColor: '#DCFCE7', borderRadius: 12, paddingVertical: 14, alignItems: 'center' }}>
                <Text style={{ color: '#16A34A', fontWeight: '700', fontSize: 14 }}>✓ قبول</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}

        {/* Next Session */}
        <View style={{ backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 16, padding: 18, marginBottom: 16, marginTop: 4 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <TouchableOpacity style={{ backgroundColor: '#8B6914', borderRadius: 12, paddingHorizontal: 28, paddingVertical: 14 }}>
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>ابدأ</Text>
            </TouchableOpacity>
            <View style={{ flex: 1, alignItems: 'flex-end', paddingRight: 16 }}>
              <Text style={{ color: C.text, fontWeight: '700', fontSize: 15 }}>الجلسة القادمة</Text>
              <Text style={{ color: C.muted, fontSize: 13, marginTop: 4 }}>Mohammed Al-Said • 10:00 AM</Text>
              <Text style={{ color: '#8B6914', fontSize: 12, fontWeight: '600', marginTop: 4 }}>⏱ خلال 42 دقيقة</Text>
            </View>
            <View style={{ width: 50, height: 50, borderRadius: 25, backgroundColor: C.card2, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: 24 }}>📹</Text>
            </View>
          </View>
        </View>

      </ScrollView>
    </View>
  );
}
