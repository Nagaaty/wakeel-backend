import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Alert, Linking } from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '../../src/theme';
import { useI18n } from '../../src/i18n';
import { lawyersAPI } from '../../src/services/api';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface Client {
  client_id:         string;
  name:              string;
  phone:             string;
  email:             string;
  total_cases:       number;
  total_spent:       number;
  last_booking_date: string;
  notes:             string | null;
  urgency:           'urgent' | 'normal' | 'low';
}

const URGENCY_COLOR = { urgent: '#EF4444', normal: '#D97706', low: '#22C55E' };
const URGENCY_LABEL = {
  urgent: { ar: '🔴 عاجل', en: '🔴 Urgent' },
  normal: { ar: '🟡 عادي', en: '🟡 Normal' },
  low: { ar: '🟢 مرن', en: '🟢 Low' }
};

export default function CRMList() {
  const C = useTheme();
  const { isRTL } = useI18n();
  const insets = useSafeAreaInsets();

  const [search, setSearch] = useState('');
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Client | null>(null);

  // Temp editing states for notes and urgency
  const [tempNote, setTempNote] = useState('');
  const [tempUrgency, setTempUrgency] = useState<'urgent' | 'normal' | 'low'>('normal');
  const [saving, setSaving] = useState(false);

  const fetchClients = () => {
    setLoading(true);
    lawyersAPI.getMyClients()
      .then((res: any) => {
        setClients(res.clients || []);
      })
      .catch(console.warn)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchClients();
  }, []);

  const handleSelectClient = (c: Client) => {
    setSelected(c);
    setTempNote(c.notes || '');
    setTempUrgency(c.urgency || 'normal');
  };

  const handleSaveNotes = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      await lawyersAPI.saveClientNotes(selected.client_id, { notes: tempNote, urgency: tempUrgency });
      
      // Update local state
      setClients(prev => prev.map(c => 
        c.client_id === selected.client_id 
          ? { ...c, notes: tempNote, urgency: tempUrgency } 
          : c
      ));
      
      setSelected(prev => prev ? { ...prev, notes: tempNote, urgency: tempUrgency } : null);
      Alert.alert(isRTL ? 'نجاح' : 'Success', isRTL ? 'تم حفظ التحديثات بنجاح!' : 'Updates saved successfully!');
    } catch (e: any) {
      Alert.alert(isRTL ? 'خطأ' : 'Error', e?.message || (isRTL ? 'فشل الحفظ' : 'Failed to save notes'));
    } finally {
      setSaving(false);
    }
  };

  const filtered = clients.filter(c => 
    c.name?.toLowerCase().includes(search.toLowerCase()) || 
    c.phone?.includes(search)
  );

  const activeCount = clients.length;

  const renderClientDetail = (c: Client) => {
    const formattedDate = c.last_booking_date 
      ? new Date(c.last_booking_date).toLocaleDateString(isRTL ? 'ar-EG' : 'en-US', { year: 'numeric', month: 'short', day: 'numeric' })
      : '—';

    const hasChanges = tempNote !== (c.notes || '') || tempUrgency !== (c.urgency || 'normal');

    return (
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 60 }} style={{ flex: 1 }}>
        {/* Profile Card */}
        <View style={{ backgroundColor: '#EFECE5', borderWidth: 1, borderColor: C.border, borderRadius: 20, padding: 20, marginBottom: 16 }}>
          <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 14, marginBottom: 20 }}>
            <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: '#A16A2F', alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ color: '#FFF', fontSize: 22, fontWeight: '700' }}>{c.name ? c.name[0].toUpperCase() : 'ع'}</Text>
            </View>
            <View style={{ flex: 1, alignItems: isRTL ? 'flex-end' : 'flex-start' }}>
              <Text style={{ color: C.text, fontWeight: '800', fontSize: 18, marginBottom: 4 }}>{c.name}</Text>
              <View style={{ backgroundColor: URGENCY_COLOR[c.urgency] + '20', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 4 }}>
                <Text style={{ color: URGENCY_COLOR[c.urgency], fontSize: 12, fontWeight: '700' }}>
                  {isRTL ? URGENCY_LABEL[c.urgency].ar : URGENCY_LABEL[c.urgency].en}
                </Text>
              </View>
            </View>
          </View>

          {/* Details Rows */}
          {([
            ['📞', isRTL ? 'الهاتف' : 'Phone', c.phone || 'N/A'],
            ['📧', isRTL ? 'البريد الالكتروني' : 'Email', c.email || 'N/A'],
            ['⚖️', isRTL ? 'إجمالي القضايا' : 'Total Cases', `${c.total_cases} ${isRTL ? 'استشارة' : 'Case(s)'}`],
            ['💰', isRTL ? 'إجمالي المدفوعات' : 'Total Spent', `EGP ${c.total_spent}`],
            ['📅', isRTL ? 'آخر استشارة' : 'Last Consultation', formattedDate],
          ] as [string, string, string][]).map(([icon, label, val], idx) => (
            <View key={idx} style={{ flexDirection: isRTL ? 'row-reverse' : 'row', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: idx === 4 ? 0 : 1, borderBottomColor: '#E4E4E7' }}>
              <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', gap: 8, alignItems: 'center' }}>
                <Text style={{ fontSize: 16 }}>{icon}</Text>
                <Text style={{ color: C.muted, fontSize: 14 }}>{label}</Text>
              </View>
              <Text style={{ color: C.text, fontWeight: '700', fontSize: 14 }}>{val}</Text>
            </View>
          ))}
        </View>

        {/* Notes & Urgency Settings Card */}
        <View style={{ backgroundColor: '#EFECE5', borderWidth: 1, borderColor: C.border, borderRadius: 20, padding: 18, marginBottom: 16 }}>
          <Text style={{ color: C.text, fontWeight: '800', fontSize: 16, marginBottom: 12, textAlign: isRTL ? 'right' : 'left' }}>
            {isRTL ? '⚙️ إعدادات وتصنيف العميل' : '⚙️ Client Classification & Notes'}
          </Text>

          {/* Urgency Selector */}
          <Text style={{ color: C.muted, fontSize: 13, marginBottom: 8, textAlign: isRTL ? 'right' : 'left' }}>
            {isRTL ? 'درجة المتابعة والاستعجال:' : 'Urgency level for follow-ups:'}
          </Text>
          <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', gap: 8, marginBottom: 18 }}>
            {(['urgent', 'normal', 'low'] as const).map(u => {
              const selectedStyle = tempUrgency === u;
              return (
                <TouchableOpacity
                  key={u}
                  onPress={() => setTempUrgency(u)}
                  style={{
                    flex: 1,
                    paddingVertical: 10,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: selectedStyle ? URGENCY_COLOR[u] : '#D4D4D8',
                    backgroundColor: selectedStyle ? URGENCY_COLOR[u] + '15' : 'transparent',
                    alignItems: 'center',
                  }}>
                  <Text style={{ color: selectedStyle ? URGENCY_COLOR[u] : C.muted, fontWeight: '700', fontSize: 12 }}>
                    {isRTL ? URGENCY_LABEL[u].ar : URGENCY_LABEL[u].en}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Notes Input */}
          <Text style={{ color: C.muted, fontSize: 13, marginBottom: 8, textAlign: isRTL ? 'right' : 'left' }}>
            {isRTL ? '📝 ملاحظات خاصة (لا تظهر للعميل):' : '📝 Private Notes (invisible to client):'}
          </Text>
          <TextInput
            value={tempNote}
            onChangeText={setTempNote}
            placeholder={isRTL ? 'أدخل ملاحظات الجلسة أو المتابعة...' : 'Enter consultation or follow-up notes...'}
            placeholderTextColor="#A1A1AA"
            multiline
            numberOfLines={4}
            style={{
              backgroundColor: '#FFF',
              borderWidth: 1,
              borderColor: C.border,
              borderRadius: 12,
              padding: 12,
              color: C.text,
              fontSize: 14,
              minHeight: 100,
              textAlignVertical: 'top',
              textAlign: isRTL ? 'right' : 'left',
            }}
          />

          {hasChanges && (
            <TouchableOpacity
              onPress={handleSaveNotes}
              disabled={saving}
              style={{ backgroundColor: C.gold, borderRadius: 12, paddingVertical: 12, alignItems: 'center', marginTop: 14 }}>
              {saving ? (
                <ActivityIndicator color="#000" size="small" />
              ) : (
                <Text style={{ color: '#000', fontWeight: '800', fontSize: 15 }}>
                  {isRTL ? 'حفظ التغييرات ✓' : 'Save Changes ✓'}
                </Text>
              )}
            </TouchableOpacity>
          )}
        </View>

        {/* Quick actions row */}
        <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', gap: 12 }}>
          <TouchableOpacity
            onPress={() => c.phone ? Linking.openURL('tel:' + c.phone) : Alert.alert(isRTL ? 'تنبيه' : 'Alert', isRTL ? 'رقم الهاتف غير متوفر' : 'Phone number not available')}
            style={{ flex: 1, backgroundColor: '#EFECE5', borderWidth: 1, borderColor: C.border, borderRadius: 16, paddingVertical: 14, alignItems: 'center', gap: 6 }}>
            <Text style={{ fontSize: 20 }}>📞</Text>
            <Text style={{ color: C.text, fontSize: 12, fontWeight: '700' }}>{isRTL ? 'اتصال هاتف' : 'Call'}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => router.push('/messages/index' as any)}
            style={{ flex: 1, backgroundColor: '#EFECE5', borderWidth: 1, borderColor: C.border, borderRadius: 16, paddingVertical: 14, alignItems: 'center', gap: 6 }}>
            <Text style={{ fontSize: 20 }}>💬</Text>
            <Text style={{ color: C.text, fontSize: 12, fontWeight: '700' }}>{isRTL ? 'مراسلة' : 'Message'}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => router.push('/lawyer/shared-case-folder' as any)}
            style={{ flex: 1, backgroundColor: '#EFECE5', borderWidth: 1, borderColor: C.border, borderRadius: 16, paddingVertical: 14, alignItems: 'center', gap: 6 }}>
            <Text style={{ fontSize: 20 }}>📁</Text>
            <Text style={{ color: C.text, fontSize: 12, fontWeight: '700' }}>{isRTL ? 'مجلد مشترك' : 'Case Folder'}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      {/* Header */}
      <View style={{
        flexDirection: isRTL ? 'row-reverse' : 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingTop: insets.top + 10,
        paddingBottom: 14,
        backgroundColor: C.surface,
        borderBottomWidth: 1,
        borderBottomColor: C.border
      }}>
        <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 12 }}>
          <TouchableOpacity 
            onPress={() => selected ? setSelected(null) : router.push('/(lawyer-tabs)')}
            style={{ padding: 8, backgroundColor: '#EFECE5', borderRadius: 12, borderWidth: 1, borderColor: C.border }}>
            <MaterialCommunityIcons name={isRTL ? "arrow-right" : "arrow-left"} size={22} color={C.text} />
          </TouchableOpacity>
          <View>
            <Text style={{ fontSize: 20, fontWeight: '800', color: C.text }}>
              {selected ? (isRTL ? 'ملف العميل' : 'Client Profile') : (isRTL ? 'إدارة العملاء (CRM)' : 'Client CRM')}
            </Text>
            {!selected && (
              <Text style={{ color: C.muted, fontSize: 12, marginTop: 2, textAlign: isRTL ? 'right' : 'left' }}>
                {activeCount} {isRTL ? 'عميل نشط' : 'active client(s)'}
              </Text>
            )}
          </View>
        </View>
      </View>

      {selected ? (
        renderClientDetail(selected)
      ) : (
        /* Client list view */
        <ScrollView 
          contentContainerStyle={{ padding: 16 }}
          style={{ flex: 1 }}
        >
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
            <Text style={{ textAlign: 'center', color: C.muted, marginTop: 40 }}>{isRTL ? 'لا يوجد عملاء بعد' : 'No clients found'}</Text>
          ) : (
            filtered.map((c, i) => {
              const urgency = c.urgency || 'normal';
              const formattedDate = c.last_booking_date 
                ? new Date(c.last_booking_date).toLocaleDateString(isRTL ? 'ar-EG' : 'en-US', { month: 'short', day: 'numeric' })
                : '—';

              return (
                <TouchableOpacity 
                  key={c.client_id} 
                  onPress={() => handleSelectClient(c)} 
                  style={{ backgroundColor: '#EFECE5', borderRadius: 16, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: '#E4E4E7', flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center' }}
                >
                  <View style={{ width: 50, height: 50, borderRadius: 25, backgroundColor: '#A16A2F', alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ color: '#FFF', fontSize: 20, fontWeight: '700' }}>{c.name ? c.name[0].toUpperCase() : 'ع'}</Text>
                  </View>
                  <View style={{ flex: 1, paddingHorizontal: 16, alignItems: isRTL ? 'flex-end' : 'flex-start' }}>
                    <Text style={{ color: C.text, fontWeight: '800', fontSize: 16, marginBottom: 4 }}>{c.name || (isRTL ? 'عميل غير معروف' : 'Unknown Client')}</Text>
                    <Text style={{ color: C.muted, fontSize: 13, textAlign: isRTL ? 'right' : 'left' }}>
                      {c.total_cases} {isRTL ? 'استشارة' : 'Case(s)'} • EGP {c.total_spent} • {formattedDate}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'center', gap: 6 }}>
                    <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: URGENCY_COLOR[urgency] }} />
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </ScrollView>
      )}
    </View>
  );
}
