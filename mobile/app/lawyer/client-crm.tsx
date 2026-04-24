// ─── Wakeel — Lawyer Client CRM ───────────────────────────────────────────────
// Route: /lawyer/client-crm
// Lawyer-only: searchable client list with urgency flags, case counts, notes
// Matches ClientCRMPage from wakeel-v2-preview-10.html exactly
// ─────────────────────────────────────────────────────────────────────────────
import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  TextInput, Alert,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../src/hooks/useTheme';
import { useI18n } from '../../src/i18n';
import { Avatar, Btn, Inp } from '../../src/components/ui';
import { Gradient, GRADIENTS } from '../../src/components/Gradient';

interface Client {
  id:          number;
  name:        string;
  phone:       string;
  email:       string;
  cases:       number;
  lastContact: string;
  status:      'active' | 'inactive';
  totalPaid:   number;
  notes:       string;
  urgency:     'urgent' | 'normal' | 'low';
}

const DEMO_CLIENTS: Client[] = [
  { id:1, name:'محمد أحمد علي',   phone:'01012345678', email:'m.ahmed@gmail.com',   cases:3, lastContact:'2025-03-05', status:'active',   totalPaid:2400, notes:'عميل منتظم. قضية جنائية + عمالية',         urgency:'urgent' },
  { id:2, name:'فاطمة محمود',     phone:'01098765432', email:'fatima@yahoo.com',     cases:1, lastContact:'2025-02-20', status:'active',   totalPaid:650,  notes:'قضية حضانة. تحتاج متابعة أسبوعية',          urgency:'normal' },
  { id:3, name:'خالد إبراهيم',    phone:'01155667788', email:'k.ibrahim@hotmail.com',cases:2, lastContact:'2025-01-15', status:'inactive', totalPaid:1200, notes:'قضية إيجار. انتهت بتسوية',                   urgency:'low'    },
  { id:4, name:'سارة حسن',        phone:'01234567890', email:'sara.h@gmail.com',     cases:1, lastContact:'2025-03-10', status:'active',   totalPaid:400,  notes:'استشارة شركة جديدة',                         urgency:'normal' },
];

const URGENCY_COLOR = { urgent: '#EF4444', normal: '#D97706', low: '#22C55E' };
const URGENCY_LABEL = { urgent: '🔴 عاجل', normal: '🟡 عادي', low: '🟢 مرن' };

export default function ClientCRMScreen() {
  const C      = useTheme();
  const insets = useSafeAreaInsets();
  const { isRTL } = useI18n();
  const serif  = { fontFamily: 'Cairo-Bold' };

  const [search,   setSearch]   = useState('');
  const [selected, setSelected] = useState<Client | null>(null);
  const [newNote,  setNewNote]  = useState('');

  const filtered = DEMO_CLIENTS.filter(c =>
    c.name.includes(search) || c.phone.includes(search)
  );
  const activeCount = DEMO_CLIENTS.filter(c => c.status === 'active').length;

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      {/* Header */}
      <View style={{
        backgroundColor: C.surface, paddingTop: insets.top + 10,
        paddingHorizontal: 16, paddingBottom: 14,
        borderBottomWidth: 1, borderBottomColor: C.border,
        flexDirection: 'row', alignItems: 'center', gap: 12,
      }}>
        <TouchableOpacity onPress={() => selected ? setSelected(null) : router.back()}>
          <Text style={{ color: C.muted, fontSize: 22 }}>‹</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={{ ...serif, color: C.text, fontWeight: '700', fontSize: 18 }}>
            {selected ? 'ملف العميل' : 'إدارة العملاء (CRM)'}
          </Text>
          {!selected && (
            <Text style={{ color: C.muted, fontSize: 12, marginTop: 2 }}>
              {activeCount} عميل نشط من أصل {DEMO_CLIENTS.length}
            </Text>
          )}
        </View>
        {!selected && (
          <TouchableOpacity
            onPress={() => Alert.alert('قريباً', 'إضافة عميل يدوياً قادمة في الإصدار التالي')}
            style={{ backgroundColor: C.gold, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 }}>
            <Text style={{ color: '#000', fontWeight: '700', fontSize: 13 }}>+ إضافة</Text>
          </TouchableOpacity>
        )}
      </View>

      {selected ? (
        /* ── Client detail view ── */
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 60 }}>
          {/* Profile card */}
          <View style={{ backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 14, padding: 20, marginBottom: 14 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 16 }}>
              <Gradient colors={GRADIENTS.gold} style={{ width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: '#000', fontWeight: '800', fontSize: 20 }}>{selected.name[0]}</Text>
              </Gradient>
              <View style={{ flex: 1 }}>
                <Text style={{ color: C.text, fontWeight: '700', fontSize: 16, marginBottom: 3 }}>{selected.name}</Text>
                <Text style={{ color: URGENCY_COLOR[selected.urgency], fontSize: 12, fontWeight: '600' }}>
                  {URGENCY_LABEL[selected.urgency]}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <View style={{ backgroundColor: selected.status === 'active' ? `${C.green}18` : C.card2, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 }}>
                  <Text style={{ color: selected.status === 'active' ? C.green : C.muted, fontSize: 11, fontWeight: '700' }}>
                    {selected.status === 'active' ? '● نشط' : 'غير نشط'}
                  </Text>
                </View>
              </View>
            </View>
            {([
              ['📞', selected.phone],
              ['📧', selected.email],
              ['⚖️', `${selected.cases} قضية`],
              ['💰', `${selected.totalPaid.toLocaleString()} جنيه إجمالي`],
              ['📅', `آخر تواصل: ${selected.lastContact}`],
            ] as [string, string][]).map(([icon, val]) => (
              <View key={icon} style={{ flexDirection: 'row', gap: 12, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: C.border }}>
                <Text style={{ color: C.muted, fontSize: 14, width: 26 }}>{icon}</Text>
                <Text style={{ color: C.text, fontSize: 13, flex: 1 }}>{val}</Text>
              </View>
            ))}
          </View>

          {/* Notes */}
          <View style={{ backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 14, padding: 16, marginBottom: 14 }}>
            <Text style={{ color: C.text, fontWeight: '700', fontSize: 14, marginBottom: 10 }}>📝 ملاحظات خاصة</Text>
            <Text style={{ color: C.muted, fontSize: 13, lineHeight: 22, marginBottom: 12 }}>{selected.notes}</Text>
            <TextInput
              value={newNote}
              onChangeText={setNewNote}
              placeholder="أضف ملاحظة جديدة..."
              placeholderTextColor={C.muted}
              multiline
              numberOfLines={3}
              style={{
                backgroundColor: C.bg, borderWidth: 1, borderColor: C.border,
                borderRadius: 10, padding: 12, color: C.text, fontSize: 13,
                minHeight: 72, textAlignVertical: 'top', textAlign: isRTL ? 'right' : 'left',
              }}
            />
            {newNote.length > 0 && (
              <TouchableOpacity
                onPress={() => { Alert.alert('تم حفظ الملاحظة'); setNewNote(''); }}
                style={{ backgroundColor: C.gold, borderRadius: 10, padding: 11, alignItems: 'center', marginTop: 10 }}>
                <Text style={{ color: '#000', fontWeight: '700', fontSize: 14 }}>حفظ الملاحظة</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Action buttons */}
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <TouchableOpacity
              onPress={() => router.push('/messages/index' as any)}
              style={{ flex: 1, backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 12, padding: 13, alignItems: 'center' }}>
              <Text style={{ fontSize: 20 }}>💬</Text>
              <Text style={{ color: C.text, fontSize: 12, fontWeight: '600', marginTop: 4 }}>رسالة</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => router.push('/video' as any)}
              style={{ flex: 1, backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 12, padding: 13, alignItems: 'center' }}>
              <Text style={{ fontSize: 20 }}>📹</Text>
              <Text style={{ color: C.text, fontSize: 12, fontWeight: '600', marginTop: 4 }}>مكالمة</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => router.push('/lawyer/shared-case-folder' as any)}
              style={{ flex: 1, backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 12, padding: 13, alignItems: 'center' }}>
              <Text style={{ fontSize: 20 }}>📁</Text>
              <Text style={{ color: C.text, fontSize: 12, fontWeight: '600', marginTop: 4 }}>الملف</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      ) : (
        /* ── Client list view ── */
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 60 }}>
          {/* Search */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, marginBottom: 16 }}>
            <Text style={{ fontSize: 16 }}>🔍</Text>
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="ابحث باسم العميل أو الهاتف..."
              placeholderTextColor={C.muted}
              style={{ flex: 1, color: C.text, fontSize: 13, textAlign: isRTL ? 'right' : 'left' }}
            />
          </View>

          {/* Count row */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 }}>
            <Text style={{ color: C.muted, fontSize: 12 }}>{filtered.length} عميل</Text>
            <Text style={{ color: C.gold, fontWeight: '600', fontSize: 12 }}>{activeCount} نشط</Text>
          </View>

          {/* Client cards */}
          {filtered.map(cl => (
            <TouchableOpacity key={cl.id} onPress={() => setSelected(cl)}
              style={{ backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 12, padding: 14, marginBottom: 10, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Gradient colors={GRADIENTS.gold} style={{ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Text style={{ color: '#000', fontWeight: '800', fontSize: 16 }}>{cl.name[0]}</Text>
              </Gradient>
              <View style={{ flex: 1 }}>
                <Text style={{ color: C.text, fontWeight: '700', fontSize: 13, marginBottom: 3 }}>{cl.name}</Text>
                <Text style={{ color: C.muted, fontSize: 11 }}>
                  {cl.cases} قضية · {cl.totalPaid.toLocaleString()} جنيه · {cl.lastContact}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end', gap: 5 }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: cl.status === 'active' ? C.green : C.border }} />
                <Text style={{ color: URGENCY_COLOR[cl.urgency], fontSize: 11 }}>
                  {cl.urgency === 'urgent' ? '🔴' : cl.urgency === 'normal' ? '🟡' : '🟢'}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </View>
  );
}
