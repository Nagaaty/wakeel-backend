import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Alert } from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '../../src/theme';
import { useI18n } from '../../src/i18n';
import { lawyersAPI } from '../../src/services/api';
import { MaterialCommunityIcons } from '@expo/vector-icons';

export default function CRMList() {
  const C = useTheme();
  const { isRTL } = useI18n();
  const [search, setSearch] = useState('');
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    lawyersAPI.getMyClients()
      .then((res: any) => setClients(res.clients || []))
      .catch(console.warn)
      .finally(() => setLoading(false));
  }, []);

  const filtered = clients.filter(c => 
    c.name?.toLowerCase().includes(search.toLowerCase()) || 
    c.phone?.includes(search)
  );

  const handleClientPress = (c: any) => {
    Alert.alert(
      c.name,
      `${isRTL ? 'الهاتف' : 'Phone'}: ${c.phone || 'N/A'}\n${isRTL ? 'البريد' : 'Email'}: ${c.email || 'N/A'}\n\n${isRTL ? 'إجمالي المدفوعات' : 'Total Spent'}: EGP ${c.total_spent}`,
      [{ text: isRTL ? 'حسناً' : 'OK' }]
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, paddingTop: 50, backgroundColor: C.surface, borderBottomWidth: 1, borderBottomColor: C.border }}>
        <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 12 }}>
           <TouchableOpacity 
             onPress={() => router.push('/(lawyer-tabs)')}
             style={{ padding: 8, backgroundColor: '#EFECE5', borderRadius: 12, borderWidth: 1, borderColor: C.border }}>
             <MaterialCommunityIcons name={isRTL ? "arrow-right" : "arrow-left"} size={22} color={C.text} />
           </TouchableOpacity>
           <Text style={{ fontSize: 20, fontWeight: '700', color: C.text }}>{isRTL ? 'إدارة العملاء (CRM)' : 'Client Management (CRM)'}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16 }}>
        {/* Search Bar */}
        <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', backgroundColor: '#EFECE5', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, alignItems: 'center', marginBottom: 16, borderWidth: 1, borderColor: '#D4D4D8' }}>
            <Text style={{ fontSize: 18, color: '#A1A1AA' }}>🔍</Text>
            <TextInput 
                placeholder={isRTL ? 'ابحث باسم العميل أو الهاتف...' : 'Search by name or phone...'}
                value={search}
                onChangeText={setSearch}
                style={{ flex: 1, marginHorizontal: 10, textAlign: isRTL ? 'right' : 'left', color: C.text, fontSize: 15 }}
                placeholderTextColor="#A1A1AA"
            />
        </View>

        {/* Counter Row */}
        <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, paddingHorizontal: 4 }}>
            <Text style={{ color: C.muted, fontSize: 14 }}>{clients.length} {isRTL ? 'عميل' : 'Clients'}</Text>
            <Text style={{ color: '#D97706', fontWeight: '700', fontSize: 14 }}>{filtered.length} {isRTL ? 'مطابق' : 'Matches'}</Text>
        </View>

        {/* Client List */}
        {loading ? (
            <ActivityIndicator color={C.gold} style={{ marginTop: 50 }} />
        ) : filtered.length === 0 ? (
            <Text style={{ textAlign: 'center', color: C.muted, marginTop: 40 }}>{isRTL ? 'لا يوجد عملاء' : 'No clients found'}</Text>
        ) : (
            filtered.map((c, i) => (
                <TouchableOpacity key={i} onPress={() => handleClientPress(c)} style={{ backgroundColor: '#EFECE5', borderRadius: 16, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: '#E4E4E7', flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center' }}>
                    <View style={{ width: 50, height: 50, borderRadius: 25, backgroundColor: '#A16A2F', alignItems: 'center', justifyContent: 'center' }}>
                        <Text style={{ color: '#FFF', fontSize: 20, fontWeight: '700' }}>{c.name ? c.name[0].toUpperCase() : 'ع'}</Text>
                    </View>
                    <View style={{ flex: 1, paddingHorizontal: 16, alignItems: isRTL ? 'flex-end' : 'flex-start' }}>
                        <Text style={{ color: C.text, fontWeight: '700', fontSize: 16, marginBottom: 4 }}>{c.name || 'Unknown Client'}</Text>
                        <Text style={{ color: C.muted, fontSize: 13, textAlign: isRTL ? 'right' : 'left' }}>
                            {c.total_cases} {isRTL ? 'قضية' : 'Case(s)'} • {c.total_spent} {isRTL ? 'جنيه' : 'EGP'} • {new Date(c.last_booking_date).toLocaleDateString(isRTL ? 'ar-EG' : 'en-US', {month: 'short', day: 'numeric'})}
                        </Text>
                    </View>
                    <View style={{ alignItems: 'center', gap: 6 }}>
                        <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: '#16A34A' }} />
                    </View>
                </TouchableOpacity>
            ))
        )}

      </ScrollView>
    </View>
  );
}
