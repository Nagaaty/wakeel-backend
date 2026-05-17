// ─── Wakeel — Lawyer Private Case Notes ──────────────────────────────────────
// Route: /lawyer/case-notes
// Private encrypted notes per case — client never sees these
// Matches CaseNotesPage from wakeel-v2-preview-10.html
// ─────────────────────────────────────────────────────────────────────────────
import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  TextInput, Alert, Switch,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../src/hooks/useTheme';
import { useI18n } from '../../src/i18n';
import { Gradient, GRADIENTS } from '../../src/components/Gradient';

interface CaseNote {
  id:        number;
  client:    string;
  type:      string;
  date:      string;
  title:     string;
  body:      string;
  important: boolean;
}

const DEMO_NOTES: CaseNote[] = [
  { id:1, client:'محمد أحمد',    type:'جنائي', date:'2025-03-05', title:'أولى جلسة استماع',       body:'طلب المحكمة مستندات إضافية. يجب تقديم شهادة الميلاد + سجل جنائي نظيف قبل 15 مارس.', important:true  },
  { id:2, client:'فاطمة محمود',  type:'أسرة',  date:'2025-02-20', title:'مستجدات قضية الحضانة', body:'الزوج وافق على الزيارة أسبوعياً. ننتظر توقيع الاتفاقية الرسمية.',                    important:false },
  { id:3, client:'خالد إبراهيم', type:'عمالي', date:'2025-03-08', title:'موعد الجلسة القادمة',   body:'الجلسة في 20 مارس الساعة 10 صباحاً. يجب إحضار عقد العمل الأصلي وشهادة الخبراء.',   important:true  },
];

export default function CaseNotesScreen() {
  const C      = useTheme();
  const insets = useSafeAreaInsets();
  const { isRTL } = useI18n();
  const serif  = { fontFamily: 'Cairo-Bold' };

  const [notes,    setNotes]    = useState<CaseNote[]>(DEMO_NOTES);
  const [showAdd,  setShowAdd]  = useState(false);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [form, setForm] = useState({ client: '', title: '', body: '', important: false });

  const addNote = () => {
    if (!form.title || !form.body) { Alert.alert('تنبيه', 'يرجى تعبئة العنوان والمحتوى'); return; }
    const note: CaseNote = {
      ...form,
      id:   Date.now(),
      type: 'عام',
      date: new Date().toISOString().slice(0, 10),
    };
    setNotes(prev => [note, ...prev]);
    setForm({ client: '', title: '', body: '', important: false });
    setShowAdd(false);
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      {/* Header */}
      <View style={{
        backgroundColor: C.surface, paddingTop: insets.top + 10,
        paddingHorizontal: 16, paddingBottom: 14,
        borderBottomWidth: 1, borderBottomColor: C.border,
        flexDirection: 'row', alignItems: 'center', gap: 12,
      }}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={{ color: C.muted, fontSize: 22 }}>‹</Text>
        </TouchableOpacity>
        <Text style={{ ...serif, color: C.text, fontWeight: '700', fontSize: 18, flex: 1 }}>
          ملاحظات القضايا 🔒
        </Text>
        <TouchableOpacity onPress={() => setShowAdd(v => !v)}
          style={{ backgroundColor: C.gold, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 }}>
          <Text style={{ color: '#000', fontWeight: '700', fontSize: 13 }}>+ ملاحظة</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 60 }}>
        {/* Privacy notice */}
        <View style={{ backgroundColor: '#fef3cd', borderWidth: 1, borderColor: '#fde68a', borderRadius: 10, padding: 12, marginBottom: 14 }}>
          <Text style={{ color: '#92400e', fontSize: 12, lineHeight: 20 }}>
            🔒 هذه الملاحظات خاصة بك فقط. لا يراها العميل ولا أحد غيرك. محمية ومشفرة.
          </Text>
        </View>

        {/* Add form */}
        {showAdd && (
          <View style={{ backgroundColor: C.card, borderWidth: 1, borderColor: C.gold, borderRadius: 14, padding: 16, marginBottom: 16 }}>
            <Text style={{ color: C.text, fontWeight: '700', fontSize: 14, marginBottom: 12 }}>ملاحظة جديدة</Text>
            {(['client', 'title'] as const).map((field) => (
              <TextInput key={field}
                value={form[field]}
                onChangeText={v => setForm(p => ({ ...p, [field]: v }))}
                placeholder={field === 'client' ? 'اسم العميل (اختياري)' : 'عنوان الملاحظة *'}
                placeholderTextColor={C.muted}
                style={{ backgroundColor: C.bg, borderWidth: 1, borderColor: C.border, borderRadius: 9, padding: 11, color: C.text, fontSize: 13, marginBottom: 8, textAlign: isRTL ? 'right' : 'left' }}
              />
            ))}
            <TextInput
              value={form.body}
              onChangeText={v => setForm(p => ({ ...p, body: v }))}
              placeholder="محتوى الملاحظة..."
              placeholderTextColor={C.muted}
              multiline
              numberOfLines={4}
              style={{ backgroundColor: C.bg, borderWidth: 1, borderColor: C.border, borderRadius: 9, padding: 11, color: C.text, fontSize: 13, minHeight: 90, textAlignVertical: 'top', textAlign: isRTL ? 'right' : 'left', marginBottom: 10 }}
            />
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <Switch
                value={form.important}
                onValueChange={v => setForm(p => ({ ...p, important: v }))}
                trackColor={{ false: C.border, true: `${C.gold}60` }}
                thumbColor={form.important ? C.gold : C.muted}
              />
              <Text style={{ color: C.muted, fontSize: 13 }}>تمييز كمهم ⭐</Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity onPress={addNote} style={{ flex: 1, backgroundColor: C.gold, borderRadius: 10, padding: 12, alignItems: 'center' }}>
                <Text style={{ color: '#000', fontWeight: '700', fontSize: 14 }}>حفظ</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setShowAdd(false)} style={{ flex: 1, backgroundColor: 'transparent', borderWidth: 1, borderColor: C.border, borderRadius: 10, padding: 12, alignItems: 'center' }}>
                <Text style={{ color: C.text, fontSize: 14 }}>إلغاء</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Notes list */}
        {notes.map(note => (
          <TouchableOpacity key={note.id} onPress={() => setExpanded(expanded === note.id ? null : note.id)}
            style={{ backgroundColor: C.card, borderWidth: 1, borderColor: note.important ? C.gold : C.border, borderRadius: 12, padding: 16, marginBottom: 10 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
              <View style={{ flex: 1, marginLeft: 8 }}>
                <Text style={{ color: C.text, fontWeight: '700', fontSize: 14 }}>
                  {note.important ? '⭐ ' : ''}{note.title}
                </Text>
                <Text style={{ color: C.muted, fontSize: 11, marginTop: 3 }}>
                  {note.client ? `${note.client} · ` : ''}{note.type} · {note.date}
                </Text>
              </View>
              <View style={{ backgroundColor: '#fee2e2', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 }}>
                <Text style={{ color: '#ef4444', fontSize: 10, fontWeight: '700' }}>خاص 🔒</Text>
              </View>
            </View>
            <Text style={{ color: C.muted, fontSize: 13, lineHeight: 21 }}
              numberOfLines={expanded === note.id ? undefined : 2}>
              {note.body}
            </Text>
            {note.body.length > 80 && (
              <Text style={{ color: C.gold, fontSize: 11, fontWeight: '700', marginTop: 6 }}>
                {expanded === note.id ? 'طي ↑' : 'عرض الكل ↓'}
              </Text>
            )}
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}
